use std::fs;
use std::path::{Component, Path, PathBuf};

fn strip_verbatim_prefix(p: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        let s = p.to_string_lossy();
        if let Some(stripped) = s.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{}", stripped));
        }
        if let Some(stripped) = s.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
    }
    p.to_path_buf()
}

fn normalize_path_for_compare(p: &Path) -> PathBuf {
    let stripped = strip_verbatim_prefix(p);
    let mut out = PathBuf::new();
    for comp in stripped.components() {
        if !matches!(comp, Component::CurDir) {
            out.push(comp.as_os_str());
        }
    }
    out
}

pub fn canonicalize_or_normalize(p: &Path) -> PathBuf {
    fs::canonicalize(p)
        .map(|canon| normalize_path_for_compare(&canon))
        .unwrap_or_else(|_| normalize_path_for_compare(p))
}

fn components_equal(a: &Component<'_>, b: &Component<'_>) -> bool {
    #[cfg(windows)]
    {
        a.as_os_str().to_string_lossy().to_lowercase()
            == b.as_os_str().to_string_lossy().to_lowercase()
    }
    #[cfg(not(windows))]
    {
        a.as_os_str() == b.as_os_str()
    }
}

fn is_within_root(root: &Path, candidate: &Path) -> bool {
    let root_norm = normalize_path_for_compare(root);
    let cand_norm = normalize_path_for_compare(candidate);
    let root_comps: Vec<_> = root_norm.components().collect();
    let cand_comps: Vec<_> = cand_norm.components().collect();
    if cand_comps.len() < root_comps.len() {
        return false;
    }
    root_comps
        .iter()
        .zip(cand_comps.iter())
        .all(|(r, c)| components_equal(r, c))
}

fn is_same_path(a: &Path, b: &Path) -> bool {
    is_within_root(a, b) && is_within_root(b, a)
}

fn check_canonical_within(canon_ws: &Path, target: &Path) -> Result<(), String> {
    let Ok(canon) = fs::canonicalize(target) else {
        return Ok(());
    };
    if !is_within_root(canon_ws, &strip_verbatim_prefix(&canon)) {
        return Err("Symlink target outside workspace is not allowed".to_string());
    }
    Ok(())
}

pub fn ensure_not_workspace_root(ws_path: &Path, target: &Path) -> Result<(), String> {
    let canon_ws = canonicalize_or_normalize(ws_path);
    let norm_target = normalize_path_for_compare(target);
    if is_same_path(&canon_ws, &norm_target) {
        return Err("Operation on workspace root is not allowed".to_string());
    }
    Ok(())
}

pub fn is_safe_external_url(trimmed: &str) -> bool {
    (trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("mailto:"))
        && !trimmed.chars().any(|c| c.is_control())
}

pub fn safe_join_workspace(ws_path: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.contains('\0') {
        return Err("Null bytes in path are not allowed".to_string());
    }

    let canon_ws = canonicalize_or_normalize(ws_path);
    let trimmed = rel.trim();
    if trimmed.is_empty() {
        return Ok(canon_ws);
    }

    let mut candidate = canon_ws.clone();
    let raw_path = Path::new(trimmed);
    let is_unc = trimmed.starts_with(r"\\") || trimmed.starts_with("//");

    if raw_path.is_absolute() || is_unc {
        for comp in raw_path.components() {
            if matches!(comp, Component::ParentDir) {
                return Err("Path traversal outside workspace is not allowed".to_string());
            }
        }
        let lex = normalize_path_for_compare(raw_path);
        if !is_within_root(&canon_ws, &lex) {
            return Err("Path outside active workspace is not allowed".to_string());
        }
        let root_len = canon_ws.components().count();
        for comp in lex.components().skip(root_len) {
            if let Component::Normal(seg) = comp {
                candidate.push(seg);
            }
        }
    } else {
        let normalized = trimmed.replace('\\', "/");
        let stripped = normalized.trim_start_matches('/');
        for comp in Path::new(stripped).components() {
            match comp {
                Component::Normal(seg) => candidate.push(seg),
                Component::CurDir => {}
                Component::ParentDir => {
                    return Err("Path traversal outside workspace is not allowed".to_string());
                }
                Component::Prefix(_) | Component::RootDir => {
                    return Err("Path outside active workspace is not allowed".to_string());
                }
            }
        }
    }

    // Verify no symlink in the existing ancestor chain or target escapes the workspace
    if fs::symlink_metadata(&candidate).is_ok() {
        check_canonical_within(&canon_ws, &candidate)?;
    }
    let mut probe = candidate.as_path();
    while !probe.exists() {
        match probe.parent() {
            Some(parent) => probe = parent,
            None => break,
        }
    }
    if probe.exists() {
        check_canonical_within(&canon_ws, probe)?;
    }

    Ok(candidate)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_temp_workspace(suffix: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!(
            "lumina-cmd-test-{}-{}-{}",
            suffix,
            std::process::id(),
            nanos
        ));
        let _ = fs::create_dir_all(&dir);
        dir
    }

    #[test]
    fn test_safe_join_workspace_accepts_valid_paths() {
        let ws = make_temp_workspace("valid");
        let sub = ws.join("notes");
        let _ = fs::create_dir_all(&sub);

        let p1 = safe_join_workspace(&ws, "notes/hello.md").unwrap();
        assert!(p1.ends_with(Path::new("notes").join("hello.md")));

        let p2 = safe_join_workspace(&ws, "./notes/./hello.md").unwrap();
        assert_eq!(p1, p2);

        let in_ws_abs = ws.join("notes").join("inside.md");
        let p3 = safe_join_workspace(&ws, &in_ws_abs.to_string_lossy()).unwrap();
        assert!(p3.ends_with(Path::new("notes").join("inside.md")));

        let _ = fs::remove_dir_all(&ws);
    }

    #[test]
    fn test_safe_join_workspace_blocks_traversal_external_and_nulls() {
        let ws = make_temp_workspace("reject");

        assert!(safe_join_workspace(&ws, "../outside.md").is_err());
        assert!(safe_join_workspace(&ws, "notes/../../outside.md").is_err());
        assert!(safe_join_workspace(&ws, "notes\0bad.md").is_err());
        assert!(safe_join_workspace(&ws, r"\\server\share\secret.md").is_err());

        #[cfg(windows)]
        {
            assert!(safe_join_workspace(&ws, r"C:\Windows\System32\cmd.exe").is_err());
            assert!(safe_join_workspace(&ws, r"C:/Users/Public/other.md").is_err());
            assert!(safe_join_workspace(&ws, r"C:relative_escape.md").is_err());
        }
        #[cfg(not(windows))]
        {
            assert!(safe_join_workspace(&ws, "/etc/passwd").is_err());
        }

        let _ = fs::remove_dir_all(&ws);
    }

    #[test]
    fn test_ensure_not_workspace_root() {
        let ws = make_temp_workspace("root");

        let root_from_empty = safe_join_workspace(&ws, "").unwrap();
        assert!(ensure_not_workspace_root(&ws, &root_from_empty).is_err());

        let root_from_dot = safe_join_workspace(&ws, ".").unwrap();
        assert!(ensure_not_workspace_root(&ws, &root_from_dot).is_err());

        assert!(ensure_not_workspace_root(&ws, &ws).is_err());

        let child = safe_join_workspace(&ws, "folder").unwrap();
        assert!(ensure_not_workspace_root(&ws, &child).is_ok());

        let _ = fs::remove_dir_all(&ws);
    }

    #[test]
    fn test_is_safe_external_url() {
        assert!(is_safe_external_url("https://example.com/docs"));
        assert!(is_safe_external_url("http://localhost:3000/callback"));
        assert!(is_safe_external_url("mailto:hello@example.com"));

        assert!(!is_safe_external_url("file:///C:/Windows/System32/calc.exe"));
        assert!(!is_safe_external_url("javascript:alert(1)"));
        assert!(!is_safe_external_url("cmd.exe"));
        assert!(!is_safe_external_url("https://example.com/\n calc.exe"));
        assert!(!is_safe_external_url("https://example.com/\r"));
    }
}
