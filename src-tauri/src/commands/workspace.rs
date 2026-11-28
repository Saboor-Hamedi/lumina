//! Workspace, note/snippet CRUD, folder management, and OS integration commands.

use super::common::{
    get_recent_workspaces_list, mark_internal_workspace_write, remove_recent_workspace_path,
    resolve_workspace_path, run_blocking, sanitize_filename, scanned_note_to_json,
    set_active_workspace_path,
};
use lumina_core::{
    canonicalize_or_normalize, ensure_not_workspace_root, is_safe_external_url,
    safe_join_workspace, scan_vault_impl, workspace_metadata_db_path, NoteMetadataStore,
    ScanResult,
};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Syncs external YAML/TOML frontmatter properties into the workspace SQLite
/// NoteMetadataStore without overwriting properties the user already edited in Lumina.
fn sync_frontmatter_properties_to_store(
    ws_path: &Path,
    items: &[(&str, &BTreeMap<String, String>)],
) {
    let non_empty: Vec<_> = items.iter().filter(|(_, p)| !p.is_empty()).collect();
    if non_empty.is_empty() {
        return;
    }
    let db_path = workspace_metadata_db_path(ws_path);
    let Ok(store) = NoteMetadataStore::open(&db_path) else {
        return;
    };
    for (note_id, props) in non_empty {
        let existing_keys: HashSet<String> = store
            .get_note_metadata(note_id)
            .unwrap_or_default()
            .into_iter()
            .map(|e| e.key.to_lowercase())
            .collect();
        for (k, v) in *props {
            if v.trim().is_empty() || existing_keys.contains(&k.to_lowercase()) {
                continue;
            }
            let prop_type = lumina_core::scanner::infer_metadata_prop_type(k, v);
            let _ = store.upsert_note_metadata(note_id, k, prop_type, v, None);
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Core & Workspace Tauri Commands
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_core_version() -> String {
    "lumina-core-tauri/1.1.2".to_string()
}

#[tauri::command]
pub async fn scan_workspace(
    vault_path: Option<String>,
    max_bytes: Option<usize>,
) -> Result<ScanResult, String> {
    run_blocking(move || {
        let path =
            vault_path.unwrap_or_else(|| resolve_workspace_path().to_string_lossy().to_string());
        let limit = max_bytes.unwrap_or(5 * 1024 * 1024);
        Ok(scan_vault_impl(&path, limit))
    })
    .await
}

#[tauri::command]
pub async fn get_snippets() -> Result<Value, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let ws_str = ws_path.to_string_lossy().to_string();
        let scan = scan_vault_impl(&ws_str, 5 * 1024 * 1024);
        let prop_pairs: Vec<(&str, &BTreeMap<String, String>)> = scan
            .notes
            .iter()
            .filter(|n| !n.properties.is_empty())
            .map(|n| (n.id.as_str(), &n.properties))
            .collect();
        sync_frontmatter_properties_to_store(&ws_path, &prop_pairs);
        let snippets: Vec<Value> = scan.notes.into_iter().map(scanned_note_to_json).collect();
        Ok(json!({
            "snippets": snippets,
            "folders": scan.folders,
            "workspacePath": ws_str
        }))
    })
    .await
}

#[tauri::command]
pub async fn read_snippet(id: String) -> Result<Value, String> {
    run_blocking(move || {
        if id.trim().is_empty() {
            return Ok(Value::Null);
        }
        let ws_path = resolve_workspace_path();
        let ws_canon = canonicalize_or_normalize(&ws_path);
        let full_path = safe_join_workspace(&ws_path, &id)?;
        if !full_path.exists() || !full_path.is_file() {
            return Ok(Value::Null);
        }
        let rel = full_path
            .strip_prefix(&ws_canon)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| id.replace('\\', "/").trim_start_matches('/').to_string());
        let raw_code = fs::read_to_string(&full_path).unwrap_or_default();
        let file_name = full_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| rel.clone());
        let default_title = full_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| file_name.clone());
        let folder_id = Path::new(&rel)
            .parent()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        let is_canvas = file_name.ends_with(".canvas");

        if is_canvas {
            return Ok(json!({
                "id": rel,
                "title": default_title,
                "code": raw_code,
                "fileName": file_name,
                "folderId": folder_id,
                "relativePath": rel,
                "language": "canvas",
                "type": "canvas"
            }));
        }

        let (fm, stripped_body) = lumina_core::scanner::extract_and_strip_frontmatter(&raw_code);
        let note_id = fm
            .id
            .clone()
            .unwrap_or_else(|| format!("note-{:032x}", lumina_core::scanner::md5_hash(&rel)));
        if !fm.properties.is_empty() {
            sync_frontmatter_properties_to_store(&ws_path, &[(&note_id, &fm.properties)]);
        }
        let title = fm.title.unwrap_or(default_title);

        Ok(json!({
            "id": note_id,
            "title": title,
            "code": stripped_body,
            "tags": fm.tags.join(", "),
            "createdAt": fm.created_at,
            "customIcon": fm.custom_icon,
            "color": fm.color,
            "properties": fm.properties,
            "fileName": file_name,
            "folderId": folder_id,
            "relativePath": rel,
            "language": fm.language.unwrap_or_else(|| "markdown".to_string()),
            "type": "snippet"
        }))
    })
    .await
}

#[tauri::command]
pub async fn save_snippet(snippet: Value) -> Result<Value, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let obj = snippet.as_object().ok_or("Invalid snippet payload")?;

        let title = obj
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled")
            .trim();
        let folder_id = obj
            .get("folderId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim_matches('/')
            .replace('\\', "/");
        let note_type = obj
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("snippet");
        let is_canvas = note_type == "canvas"
            || obj.get("language").and_then(|v| v.as_str()) == Some("canvas")
            || obj
                .get("fileName")
                .and_then(|v| v.as_str())
                .map(|f| f.ends_with(".canvas"))
                .unwrap_or(false);

        let ext = if is_canvas { ".canvas" } else { ".md" };
        let safe_stem = sanitize_filename(if title.is_empty() { "Untitled" } else { title });
        let file_name = if safe_stem.ends_with(ext) {
            safe_stem.clone()
        } else {
            format!("{}{}", safe_stem, ext)
        };

        let rel_path = if folder_id.is_empty() {
            file_name.clone()
        } else {
            format!("{}/{}", folder_id, file_name)
        };

        // If previous relativePath/id existed and differs (rename), remove old file
        if let Some(old_rel) = obj
            .get("relativePath")
            .or_else(|| obj.get("id"))
            .and_then(|v| v.as_str())
        {
            let old_norm = old_rel.replace('\\', "/");
            if !old_norm.is_empty()
                && old_norm != rel_path
                && (old_norm.ends_with(".md") || old_norm.ends_with(".canvas"))
            {
                if let Ok(old_full) = safe_join_workspace(&ws_path, &old_norm) {
                    if ensure_not_workspace_root(&ws_path, &old_full).is_ok()
                        && old_full.exists()
                        && old_full.is_file()
                    {
                        let _ = fs::remove_file(old_full);
                    }
                }
            }
        }

        let full_path = safe_join_workspace(&ws_path, &rel_path)?;
        if let Some(parent) = full_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let note_id = if is_canvas {
            // `.canvas` files have no YAML frontmatter, so the workspace scanner
            // always assigns `note-<md5_hash(rel_path)>`. Match it 1:1 on save.
            format!("note-{:032x}", lumina_core::scanner::md5_hash(&rel_path))
        } else {
            obj.get("id")
                .and_then(|v| v.as_str())
                .filter(|s| !s.trim().is_empty())
                .unwrap_or(&rel_path)
                .to_string()
        };
        let clean_title = safe_stem.trim_end_matches(ext).to_string();
        let code = obj.get("code").and_then(|v| v.as_str()).unwrap_or("");

        let mut saved_created_at: Option<String> = None;

        if is_canvas {
            fs::write(&full_path, code).map_err(|e| e.to_string())?;
            saved_created_at = fs::metadata(&full_path)
                .ok()
                .and_then(|m| m.created().ok())
                .and_then(lumina_core::scanner::system_time_to_iso8601);
        } else {
            let language = obj
                .get("language")
                .and_then(|v| v.as_str())
                .unwrap_or("markdown");
            let tags = obj.get("tags").and_then(|v| v.as_str()).unwrap_or("");
            let is_pinned = obj.get("isPinned").and_then(|v| v.as_bool()).unwrap_or(false);
            let is_learned = obj.get("isLearned").and_then(|v| v.as_bool()).unwrap_or(false);
            let custom_icon = obj
                .get("customIcon")
                .and_then(|v| v.as_str())
                .unwrap_or("null");
            let color = obj.get("color").and_then(|v| v.as_str()).unwrap_or("null");
            let timestamp = obj
                .get("timestamp")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);

            let existing_disk_created_at = if full_path.exists() {
                fs::read_to_string(&full_path)
                    .ok()
                    .and_then(|raw| lumina_core::scanner::extract_and_strip_frontmatter(&raw).0.created_at)
                    .or_else(|| {
                        fs::metadata(&full_path)
                            .ok()
                            .and_then(|m| m.created().ok())
                            .and_then(lumina_core::scanner::system_time_to_iso8601)
                    })
            } else {
                None
            };
            let incoming_created_at = obj
                .get("createdAt")
                .and_then(|v| {
                    if let Some(s) = v.as_str() {
                        let trimmed = s.trim();
                        if !trimmed.is_empty() { Some(trimmed.to_string()) } else { None }
                    } else if let Some(n) = v.as_u64() {
                        Some(lumina_core::scanner::epoch_ms_to_iso8601(n))
                    } else {
                        None
                    }
                });
            let resolved_created_at = existing_disk_created_at
                .or(incoming_created_at)
                .or_else(|| lumina_core::scanner::system_time_to_iso8601(std::time::SystemTime::now()))
                .unwrap_or_default();

            let mut extra_yaml_lines = String::new();
            let mut merged_props: std::collections::BTreeMap<String, String> =
                std::collections::BTreeMap::new();
            if let Some(props_obj) = obj.get("properties").and_then(|v| v.as_object()) {
                for (k, val) in props_obj {
                    let clean_key = k.trim();
                    if clean_key.is_empty()
                        || !clean_key
                            .chars()
                            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
                    {
                        continue;
                    }
                    let lower = clean_key.to_lowercase();
                    if matches!(
                        lower.as_str(),
                        "id" | "title"
                            | "language"
                            | "tags"
                            | "selection"
                            | "ispinned"
                            | "pinned"
                            | "islearned"
                            | "learned"
                            | "customicon"
                            | "icon"
                            | "createdat"
                            | "created_at"
                            | "timestamp"
                            | "color"
                            | "type"
                            | "folderid"
                            | "folder_id"
                    ) {
                        continue;
                    }
                    let str_val = match val {
                        Value::String(s) => s.clone(),
                        Value::Bool(b) => b.to_string(),
                        Value::Number(n) => n.to_string(),
                        Value::Null => continue,
                        other => other.to_string(),
                    };
                    merged_props.insert(clean_key.to_string(), str_val);
                }
            } else if full_path.exists() {
                if let Ok(raw_disk) = fs::read_to_string(&full_path) {
                    let (disk_fm, _) = lumina_core::scanner::extract_and_strip_frontmatter(&raw_disk);
                    merged_props = disk_fm.properties;
                }
            }
            for (k, v) in &merged_props {
                let escaped = v
                    .replace('\\', "\\\\")
                    .replace('"', "\\\"")
                    .replace('\n', " ")
                    .replace('\r', "");
                extra_yaml_lines.push_str(&format!("\n{}: \"{}\"", k, escaped));
            }

            let (_, stripped_body) = lumina_core::scanner::extract_and_strip_frontmatter(code);
            let file_content = format!(
                "---\nid: \"{}\"\ntitle: \"{}\"\nlanguage: \"{}\"\ntags: \"{}\"\nisPinned: {}\nisLearned: {}\ncustomIcon: {}\ncolor: {}\ncreatedAt: \"{}\"\ntimestamp: {}{}\n---\n\n{}",
                note_id.replace('"', "\\\""),
                clean_title.replace('"', "\\\""),
                language,
                tags.replace('"', "\\\""),
                is_pinned,
                is_learned,
                if custom_icon == "null" || custom_icon.is_empty() {
                    "null".to_string()
                } else {
                    format!("\"{}\"", custom_icon)
                },
                if color == "null" || color.is_empty() {
                    "null".to_string()
                } else {
                    format!("\"{}\"", color)
                },
                resolved_created_at.replace('"', "\\\""),
                timestamp as u64,
                extra_yaml_lines,
                stripped_body.trim_start_matches('\n')
            );
            fs::write(&full_path, file_content).map_err(|e| e.to_string())?;
            if !resolved_created_at.is_empty() {
                saved_created_at = Some(resolved_created_at);
            }
        }

        let mut returned = snippet.clone();
        if let Some(ret_obj) = returned.as_object_mut() {
            ret_obj.insert("id".to_string(), Value::String(note_id));
            ret_obj.insert("fileName".to_string(), Value::String(file_name));
            ret_obj.insert("folderId".to_string(), Value::String(folder_id));
            ret_obj.insert("relativePath".to_string(), Value::String(rel_path));
            ret_obj.insert("title".to_string(), Value::String(clean_title));
            if let Some(created_at) = saved_created_at {
                ret_obj.insert("createdAt".to_string(), Value::String(created_at));
            }
        }
        mark_internal_workspace_write();
        Ok(returned)
    })
    .await
}

fn resolve_snippet_target(ws_path: &Path, id: &str) -> Option<PathBuf> {
    if id.trim().is_empty() {
        return None;
    }
    if let Ok(direct) = safe_join_workspace(ws_path, id) {
        if ensure_not_workspace_root(ws_path, &direct).is_ok() && direct.exists() && direct.is_file() {
            return Some(direct);
        }
    }
    let cleaned = id.replace('\\', "/");
    let ws_str = ws_path.to_string_lossy().to_string();
    let scan = scan_vault_impl(&ws_str, 5 * 1024 * 1024);
    for n in scan.notes {
        if n.id == id || n.relative_path == cleaned {
            if let Ok(p) = safe_join_workspace(ws_path, &n.relative_path) {
                if p.exists() && p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn delete_snippet(id: String) -> Result<bool, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        if let Some(target) = resolve_snippet_target(&ws_path, &id) {
            fs::remove_file(target).map_err(|e| e.to_string())?;
            mark_internal_workspace_write();
        }
        Ok(true)
    })
    .await
}

#[tauri::command]
pub async fn create_folder(path: String) -> Result<bool, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let target = safe_join_workspace(&ws_path, &path)?;
        ensure_not_workspace_root(&ws_path, &target)?;
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        mark_internal_workspace_write();
        Ok(true)
    })
    .await
}

#[tauri::command]
pub async fn rename_folder(old_path: String, new_path: String) -> Result<bool, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let src = safe_join_workspace(&ws_path, &old_path)?;
        let dst = safe_join_workspace(&ws_path, &new_path)?;
        ensure_not_workspace_root(&ws_path, &src)?;
        ensure_not_workspace_root(&ws_path, &dst)?;
        if src.exists() {
            if let Some(parent) = dst.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::rename(src, dst).map_err(|e| e.to_string())?;
            mark_internal_workspace_write();
        }
        Ok(true)
    })
    .await
}

fn move_file_sync(old_rel_path: String, new_rel_path: String) -> Result<Value, String> {
    let ws_path = resolve_workspace_path();
    let src = safe_join_workspace(&ws_path, &old_rel_path)?;
    let dst = safe_join_workspace(&ws_path, &new_rel_path)?;
    ensure_not_workspace_root(&ws_path, &src)?;
    ensure_not_workspace_root(&ws_path, &dst)?;
    if src.exists() {
        if let Some(parent) = dst.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::rename(&src, &dst).map_err(|e| e.to_string())?;
        mark_internal_workspace_write();
    }
    Ok(json!({
        "success": true,
        "newRelPath": new_rel_path.replace('\\', "/"),
        "migratedImages": []
    }))
}

#[tauri::command]
pub async fn move_file(old_rel_path: String, new_rel_path: String) -> Result<Value, String> {
    run_blocking(move || move_file_sync(old_rel_path, new_rel_path)).await
}

#[tauri::command]
pub async fn move_files(moves: Vec<Value>) -> Result<Value, String> {
    run_blocking(move || {
        let mut results = Vec::new();
        for m in moves {
            let old_p = m.get("oldRelPath").and_then(|v| v.as_str()).unwrap_or("");
            let new_p = m.get("newRelPath").and_then(|v| v.as_str()).unwrap_or("");
            if !old_p.is_empty() && !new_p.is_empty() {
                move_file_sync(old_p.to_string(), new_p.to_string())?;
                results.push(json!({
                    "oldRelPath": old_p,
                    "newRelPath": new_p,
                    "success": true
                }));
            }
        }
        Ok(json!({
            "success": true,
            "results": results,
            "migratedImages": []
        }))
    })
    .await
}

#[tauri::command]
pub async fn delete_folder(path: String) -> Result<Value, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let target = safe_join_workspace(&ws_path, &path)?;
        ensure_not_workspace_root(&ws_path, &target)?;
        if target.exists() && target.is_dir() {
            fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
            mark_internal_workspace_write();
        }
        Ok(json!({ "success": true }))
    })
    .await
}

#[tauri::command]
pub async fn bulk_delete(
    folder_ids: Option<Vec<String>>,
    snippet_ids: Option<Vec<String>>,
) -> Result<Value, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let mut deleted_count: usize = 0;
        if let Some(s_ids) = snippet_ids {
            for sid in s_ids {
                if let Some(p) = resolve_snippet_target(&ws_path, &sid) {
                    if fs::remove_file(p).is_ok() {
                        deleted_count += 1;
                    }
                }
            }
        }
        if let Some(f_ids) = folder_ids {
            for fid in f_ids {
                if let Ok(p) = safe_join_workspace(&ws_path, &fid) {
                    if ensure_not_workspace_root(&ws_path, &p).is_ok() && p.exists() && p.is_dir() {
                        if fs::remove_dir_all(p).is_ok() {
                            deleted_count += 1;
                        }
                    }
                }
            }
        }
        if deleted_count > 0 {
            mark_internal_workspace_write();
        }
        Ok(json!({ "success": true, "deletedCount": deleted_count }))
    })
    .await
}

#[tauri::command]
pub async fn select_workspace(window: tauri::WebviewWindow) -> Result<Value, String> {
    let _ = &window;
    #[cfg(target_os = "windows")]
    let parent_hwnd: Option<isize> = window.hwnd().ok().map(|h| h.0 as isize);
    #[cfg(not(target_os = "windows"))]
    let parent_hwnd: Option<isize> = None;

    let chosen = tauri::async_runtime::spawn_blocking(move || {
        crate::export::pick_directory_native(
            parent_hwnd,
            "Select Lumina Workspace Folder".to_string(),
            "Select Folder".to_string(),
        )
    })
    .await
    .map_err(|e| e.to_string())??;

    let Some(chosen) = chosen else {
        return Ok(Value::Null);
    };

    run_blocking(move || {
        set_active_workspace_path(&chosen);
        mark_internal_workspace_write();
        let scan = scan_vault_impl(&chosen, 5 * 1024 * 1024);
        let prop_pairs: Vec<(&str, &BTreeMap<String, String>)> = scan
            .notes
            .iter()
            .filter(|n| !n.properties.is_empty())
            .map(|n| (n.id.as_str(), &n.properties))
            .collect();
        sync_frontmatter_properties_to_store(Path::new(&chosen), &prop_pairs);
        let snippets: Vec<Value> = scan.notes.into_iter().map(scanned_note_to_json).collect();
        let recent = get_recent_workspaces_list();
        Ok(json!({
            "path": chosen,
            "workspacePath": chosen,
            "snippets": snippets,
            "folders": scan.folders,
            "recentWorkspaces": recent.get("recentWorkspaces").cloned().unwrap_or_else(|| json!([]))
        }))
    })
    .await
}

#[tauri::command]
pub async fn get_recent_workspaces() -> Result<Value, String> {
    run_blocking(move || Ok(get_recent_workspaces_list())).await
}

#[tauri::command]
pub async fn switch_workspace(path: String) -> Result<Value, String> {
    run_blocking(move || {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            return Err("Workspace path cannot be empty".to_string());
        }
        let target = PathBuf::from(trimmed);
        if !target.exists() || !target.is_dir() {
            return Err(format!("Workspace directory does not exist: {}", trimmed));
        }
        let canonical_str = target.to_string_lossy().to_string();
        set_active_workspace_path(&canonical_str);
        mark_internal_workspace_write();
        let scan = scan_vault_impl(&canonical_str, 5 * 1024 * 1024);
        let prop_pairs: Vec<(&str, &BTreeMap<String, String>)> = scan
            .notes
            .iter()
            .filter(|n| !n.properties.is_empty())
            .map(|n| (n.id.as_str(), &n.properties))
            .collect();
        sync_frontmatter_properties_to_store(&target, &prop_pairs);
        let snippets: Vec<Value> = scan.notes.into_iter().map(scanned_note_to_json).collect();
        let recent = get_recent_workspaces_list();
        Ok(json!({
            "path": canonical_str,
            "workspacePath": canonical_str,
            "snippets": snippets,
            "folders": scan.folders,
            "recentWorkspaces": recent.get("recentWorkspaces").cloned().unwrap_or_else(|| json!([]))
        }))
    })
    .await
}

#[tauri::command]
pub async fn remove_recent_workspace(path: String) -> Result<Value, String> {
    run_blocking(move || Ok(remove_recent_workspace_path(&path))).await
}

fn resolve_allowed_open_target(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    let ws_path = resolve_workspace_path();
    if trimmed.is_empty() {
        return Ok(ws_path);
    }
    if let Ok(joined) = safe_join_workspace(&ws_path, trimmed) {
        return Ok(joined);
    }
    let cand = PathBuf::from(trimmed);
    if cand.is_absolute() && crate::export::is_allowed_export_open(&cand) {
        return Ok(cand);
    }
    Err("Path outside active workspace is not allowed".to_string())
}

pub(super) fn open_path_in_os_sync(path: String) -> Result<bool, String> {
    let trimmed = path.trim().to_string();
    if is_safe_external_url(&trimmed) {
        #[cfg(target_os = "windows")]
        {
            // Avoid `open::that` for URLs on Windows because `cmd /c start` splits on `&` query params.
            let _ = Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", &trimmed])
                .spawn();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = open::that(&trimmed);
        }
        return Ok(true);
    }

    let target = resolve_allowed_open_target(&trimmed)?;
    let _ = open::that(target);
    Ok(true)
}

#[tauri::command]
pub async fn open_path_in_os(path: String) -> Result<bool, String> {
    run_blocking(move || open_path_in_os_sync(path)).await
}

#[tauri::command]
pub async fn reveal_path_in_os(path: String) -> Result<bool, String> {
    run_blocking(move || {
        let target = resolve_allowed_open_target(path.trim())?;
        #[cfg(target_os = "windows")]
        {
            if target.is_file() {
                let _ = Command::new("explorer")
                    .arg(format!("/select,{}", target.display()))
                    .spawn();
            } else {
                let _ = Command::new("explorer").arg(&target).spawn();
            }
        }
        #[cfg(target_os = "macos")]
        {
            if target.is_file() {
                let _ = Command::new("open")
                    .args(["-R", &target.to_string_lossy()])
                    .spawn();
            } else {
                let _ = Command::new("open").arg(&target).spawn();
            }
        }
        #[cfg(target_os = "linux")]
        {
            let dir = if target.is_file() {
                target.parent().unwrap_or(&target)
            } else {
                target.as_path()
            };
            let _ = Command::new("xdg-open").arg(dir).spawn();
        }
        Ok(true)
    })
    .await
}
