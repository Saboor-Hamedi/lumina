//! Workspace, note/snippet CRUD, folder management, and OS integration commands.

use super::common::{
    mark_internal_workspace_write, resolve_workspace_path, run_blocking, sanitize_filename,
    scanned_note_to_json, set_active_workspace_path,
};
use lumina_core::{
    canonicalize_or_normalize, ensure_not_workspace_root, is_safe_external_url,
    safe_join_workspace, scan_vault_impl, ScanResult,
};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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
        let code = fs::read_to_string(&full_path).unwrap_or_default();
        let file_name = full_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| rel.clone());
        let title = full_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| file_name.clone());
        let folder_id = Path::new(&rel)
            .parent()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        let is_canvas = file_name.ends_with(".canvas");
        Ok(json!({
            "id": rel,
            "title": title,
            "code": code,
            "fileName": file_name,
            "folderId": folder_id,
            "relativePath": rel,
            "language": if is_canvas { "canvas" } else { "markdown" },
            "type": if is_canvas { "canvas" } else { "snippet" }
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

        let note_id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .unwrap_or(&rel_path)
            .to_string();
        let clean_title = safe_stem.trim_end_matches(ext).to_string();
        let code = obj.get("code").and_then(|v| v.as_str()).unwrap_or("");

        if is_canvas {
            fs::write(&full_path, code).map_err(|e| e.to_string())?;
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

            let (_, stripped_body) = lumina_core::scanner::extract_and_strip_frontmatter(code);
            let file_content = format!(
                "---\nid: \"{}\"\ntitle: \"{}\"\nlanguage: \"{}\"\ntags: \"{}\"\nisPinned: {}\nisLearned: {}\ncustomIcon: {}\ncolor: {}\ntimestamp: {}\n---\n\n{}",
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
                timestamp as u64,
                stripped_body.trim_start_matches('\n')
            );
            fs::write(&full_path, file_content).map_err(|e| e.to_string())?;
        }

        let mut returned = snippet.clone();
        if let Some(ret_obj) = returned.as_object_mut() {
            ret_obj.insert("id".to_string(), Value::String(note_id));
            ret_obj.insert("fileName".to_string(), Value::String(file_name));
            ret_obj.insert("folderId".to_string(), Value::String(folder_id));
            ret_obj.insert("relativePath".to_string(), Value::String(rel_path));
            ret_obj.insert("title".to_string(), Value::String(clean_title));
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
        let snippets: Vec<Value> = scan.notes.into_iter().map(scanned_note_to_json).collect();
        Ok(json!({
            "path": chosen,
            "workspacePath": chosen,
            "snippets": snippets,
            "folders": scan.folders
        }))
    })
    .await
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
