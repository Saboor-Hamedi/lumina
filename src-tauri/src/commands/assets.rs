//! Workspace binary assets, image storage, external imports, orphan cleanup, and ZIP backups.

use super::common::{
    mark_internal_workspace_write, resolve_workspace_path, run_blocking, sanitize_filename,
};
use lumina_core::zip_util::{build_zip_bytes, ZipEntry};
use lumina_core::{canonicalize_or_normalize, safe_join_workspace};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

static BACKUP_CANCELLED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn save_workspace_image(
    bytes: Vec<u8>,
    target_folder: Option<String>,
    name: Option<String>,
) -> Result<String, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let folder = target_folder.unwrap_or_default().replace('\\', "/");
        let raw_name = name.unwrap_or_else(|| {
            format!(
                "image-{}.png",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis())
                    .unwrap_or(0)
            )
        });
        let safe_name = sanitize_filename(&raw_name);
        let rel_path = if folder.trim().is_empty() {
            safe_name
        } else {
            format!("{}/{}", folder.trim_matches('/'), safe_name)
        };
        let full_path = safe_join_workspace(&ws_path, &rel_path)?;
        if let Some(parent) = full_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&full_path, bytes).map_err(|e| e.to_string())?;
        mark_internal_workspace_write();
        Ok(rel_path)
    })
    .await
}

#[tauri::command]
pub async fn read_asset_bytes(relative_path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let full_path = safe_join_workspace(&ws_path, &relative_path)?;
        fs::read(full_path).map_err(|e| e.to_string())
    })
    .await?;
    Ok(tauri::ipc::Response::new(bytes))
}

fn dedup_dest_path(dir: &Path, raw_filename: &str) -> PathBuf {
    let candidate = dir.join(raw_filename);
    if !candidate.exists() {
        return candidate;
    }
    let p = Path::new(raw_filename);
    let stem = p
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("");
    let mut counter: usize = 1;
    loop {
        let next_name = if ext.is_empty() {
            format!("{stem} ({counter})")
        } else {
            format!("{stem} ({counter}).{ext}")
        };
        let next = dir.join(next_name);
        if !next.exists() {
            return next;
        }
        counter += 1;
    }
}

fn is_supported_import_ext(ext: &str) -> bool {
    matches!(
        ext,
        "md" | "markdown"
            | "txt"
            | "canvas"
            | "pdf"
            | "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "bmp"
            | "avif"
            | "svg"
    )
}

fn is_note_import_ext(ext: &str) -> bool {
    matches!(ext, "md" | "markdown" | "txt" | "canvas" | "pdf")
}

fn import_external_entry(
    src: &Path,
    dst_dir: &Path,
    ws_canon: &Path,
    imported: &mut usize,
    note_ids: &mut Vec<String>,
    folder_ids: &mut Vec<String>,
) {
    if src.is_dir() {
        let Some(folder_name) = src.file_name().and_then(|s| s.to_str()) else {
            return;
        };
        if folder_name.starts_with('.') || folder_name == "node_modules" {
            return;
        }
        let safe_folder = sanitize_filename(folder_name);
        let sub_dir = dedup_dest_path(dst_dir, &safe_folder);
        if fs::create_dir_all(&sub_dir).is_err() {
            return;
        }
        if let Ok(rel) = sub_dir.strip_prefix(ws_canon) {
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            if !rel_str.is_empty() {
                folder_ids.push(rel_str);
            }
        }
        if let Ok(entries) = fs::read_dir(src) {
            for entry in entries.flatten() {
                import_external_entry(&entry.path(), &sub_dir, ws_canon, imported, note_ids, folder_ids);
            }
        }
        return;
    }

    if !src.is_file() {
        return;
    }
    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !is_supported_import_ext(&ext) {
        return;
    }
    let Some(raw_name) = src.file_name().and_then(|s| s.to_str()) else {
        return;
    };
    let safe_name = sanitize_filename(raw_name);
    let dest = dedup_dest_path(dst_dir, &safe_name);
    if fs::copy(src, &dest).is_ok() {
        *imported += 1;
        if is_note_import_ext(&ext) {
            if let Ok(rel) = dest.strip_prefix(ws_canon) {
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                if !rel_str.is_empty() {
                    note_ids.push(rel_str);
                }
            }
        }
    }
}

#[tauri::command]
pub async fn open_file_dialog(window: tauri::WebviewWindow) -> Result<Value, String> {
    let _ = &window;
    #[cfg(target_os = "windows")]
    let parent_hwnd: Option<isize> = window.hwnd().ok().map(|h| h.0 as isize);
    #[cfg(not(target_os = "windows"))]
    let parent_hwnd: Option<isize> = None;

    let paths = tauri::async_runtime::spawn_blocking(move || {
        crate::export::pick_open_files_native(
            parent_hwnd,
            "Open Note File".to_string(),
            false,
            "Markdown & Text Files".to_string(),
            vec!["md".to_string(), "markdown".to_string(), "txt".to_string()],
        )
    })
    .await
    .map_err(|e| e.to_string())??;

    let Some(path_str) = paths.into_iter().next() else {
        return Ok(Value::Null);
    };
    run_blocking(move || {
        let path = Path::new(&path_str);
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        let content = String::from_utf8_lossy(&bytes).to_string();
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled.md")
            .to_string();
        Ok(json!({
            "name": name,
            "path": path_str,
            "content": content
        }))
    })
    .await
}

#[tauri::command]
pub async fn import_external_paths(
    paths: Vec<String>,
    target_folder: Option<String>,
) -> Result<Value, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let ws_canon = canonicalize_or_normalize(&ws_path);
        let rel_target = target_folder.unwrap_or_default().replace('\\', "/");
        let dest_dir = safe_join_workspace(&ws_path, rel_target.trim())?;
        if !dest_dir.exists() {
            fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
        }

        let mut imported = 0usize;
        let mut note_ids = Vec::new();
        let mut folder_ids = Vec::new();

        for raw in paths {
            let src = PathBuf::from(&raw);
            if src.exists() {
                import_external_entry(
                    &src,
                    &dest_dir,
                    &ws_canon,
                    &mut imported,
                    &mut note_ids,
                    &mut folder_ids,
                );
            }
        }

        if imported > 0 || !folder_ids.is_empty() {
            mark_internal_workspace_write();
        }

        Ok(json!({
            "imported": imported,
            "importedNoteIds": note_ids,
            "importedSnippetIds": note_ids,
            "importedFolderIds": folder_ids
        }))
    })
    .await
}

#[tauri::command]
pub async fn save_image_from_path(
    file_path: String,
    filename: Option<String>,
) -> Result<Option<String>, String> {
    run_blocking(move || {
        let src = Path::new(&file_path);
        if !src.exists() || !src.is_file() {
            return Ok(None);
        }
        let ext = src
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "avif" | "svg"
        ) {
            return Ok(None);
        }
        let meta = fs::metadata(src).map_err(|e| e.to_string())?;
        if meta.len() > 50 * 1024 * 1024 {
            return Err("Image exceeds 50 MB limit".to_string());
        }

        let ws_path = resolve_workspace_path();
        let assets_dir = safe_join_workspace(&ws_path, "assets")?;
        fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

        let raw_name = filename
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .or_else(|| src.file_name().and_then(|s| s.to_str()))
            .unwrap_or("image.png");
        let mut safe_name = sanitize_filename(raw_name);
        if Path::new(&safe_name).extension().is_none() && !ext.is_empty() {
            safe_name = format!("{safe_name}.{ext}");
        }
        let dst = dedup_dest_path(&assets_dir, &safe_name);
        let final_name = dst
            .file_name()
            .and_then(|s| s.to_str())
            .ok_or_else(|| "Invalid destination image name".to_string())?
            .to_string();
        let rel_path = format!("assets/{final_name}");
        let checked_dst = safe_join_workspace(&ws_path, &rel_path)?;
        fs::copy(src, &checked_dst).map_err(|e| e.to_string())?;
        mark_internal_workspace_write();
        Ok(Some(rel_path))
    })
    .await
}

#[tauri::command]
pub async fn clean_orphans() -> Result<Value, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let assets_dir = ws_path.join("assets");
        if !assets_dir.exists() || !assets_dir.is_dir() {
            return Ok(json!({ "deleted": 0 }));
        }

        let mut note_bodies = String::new();
        let mut stack = vec![ws_path.clone()];
        while let Some(dir) = stack.pop() {
            let Ok(entries) = fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') || name == "node_modules" {
                    continue;
                }
                let p = entry.path();
                if p.is_dir() {
                    stack.push(p);
                } else if matches!(
                    p.extension()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_lowercase()
                        .as_str(),
                    "md" | "markdown" | "canvas" | "txt"
                ) {
                    if let Ok(text) = fs::read_to_string(&p) {
                        note_bodies.push('\n');
                        note_bodies.push_str(&text.to_lowercase());
                    }
                }
            }
        }

        let mut deleted = 0usize;
        let mut asset_stack = vec![assets_dir.clone()];
        while let Some(dir) = asset_stack.pop() {
            let Ok(entries) = fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    asset_stack.push(p);
                    continue;
                }
                let rel = p
                    .strip_prefix(&ws_path)
                    .map(|r| r.to_string_lossy().replace('\\', "/").to_lowercase())
                    .unwrap_or_default();
                let fname = p
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if fname.is_empty() {
                    continue;
                }
                let encoded_fname = fname.replace(' ', "%20");
                let encoded_rel = rel.replace(' ', "%20");
                let referenced = note_bodies.contains(&fname)
                    || note_bodies.contains(&encoded_fname)
                    || (!rel.is_empty()
                        && (note_bodies.contains(&rel) || note_bodies.contains(&encoded_rel)));
                if !referenced && fs::remove_file(&p).is_ok() {
                    deleted += 1;
                }
            }
        }

        if deleted > 0 {
            mark_internal_workspace_write();
        }
        Ok(json!({ "deleted": deleted }))
    })
    .await
}

#[tauri::command]
pub fn cancel_backup() -> Result<bool, String> {
    BACKUP_CANCELLED.store(true, Ordering::SeqCst);
    Ok(true)
}

fn collect_workspace_backup_files(root: &Path) -> Vec<(PathBuf, String)> {
    const IGNORED_NAMES: [&str; 7] = [
        ".git",
        ".obsidian",
        ".lumina",
        ".trash",
        "node_modules",
        ".DS_Store",
        "Thumbs.db",
    ];

    let root_canon = canonicalize_or_normalize(root);
    let mut results: Vec<(PathBuf, String)> = Vec::new();
    let mut stack = vec![root_canon.clone()];

    while let Some(dir) = stack.pop() {
        let Ok(read) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in read.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || IGNORED_NAMES.contains(&name.as_str()) {
                continue;
            }
            let p = entry.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.is_file() {
                if let Ok(rel) = p.strip_prefix(&root_canon) {
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    if !rel_str.is_empty() {
                        results.push((p, rel_str));
                    }
                }
            }
        }
    }

    results.sort_by(|a, b| a.1.cmp(&b.1));
    results
}

#[tauri::command]
pub async fn list_workspace_files() -> Result<Vec<String>, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        if !ws_path.exists() {
            return Err("Workspace directory does not exist".to_string());
        }
        let files = collect_workspace_backup_files(&ws_path);
        Ok(files.into_iter().map(|(_, rel)| rel).collect())
    })
    .await
}

#[tauri::command]
pub async fn build_workspace_zip_bytes() -> Result<tauri::ipc::Response, String> {
    let zip_bytes = run_blocking(move || {
        BACKUP_CANCELLED.store(false, Ordering::SeqCst);
        let ws_path = resolve_workspace_path();
        if !ws_path.exists() {
            return Err("Workspace directory does not exist".to_string());
        }

        let files = collect_workspace_backup_files(&ws_path);
        let mut entries: Vec<ZipEntry> = Vec::with_capacity(files.len());
        for (full_path, rel_str) in files {
            if BACKUP_CANCELLED.load(Ordering::SeqCst) {
                return Err("Backup cancelled".to_string());
            }
            if let Ok(bytes) = fs::read(&full_path) {
                entries.push(ZipEntry {
                    name: rel_str,
                    data: bytes,
                });
            }
        }

        if BACKUP_CANCELLED.load(Ordering::SeqCst) {
            return Err("Backup cancelled".to_string());
        }

        build_zip_bytes(&entries)
    })
    .await?;

    Ok(tauri::ipc::Response::new(zip_bytes))
}
