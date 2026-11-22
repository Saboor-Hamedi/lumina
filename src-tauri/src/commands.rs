use lumina_core::{
    build_graph_data_impl, canonicalize_or_normalize, ensure_not_workspace_root,
    is_safe_external_url, safe_join_workspace, scan_vault_impl, search_notes_impl, GraphData,
    NoteInput, ScanResult, ScannedNote, SearchHit, SearchIndexItem,
};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

// ──────────────────────────────────────────────────────────────────────────────
// Paths & Config Helpers
// ──────────────────────────────────────────────────────────────────────────────

fn get_app_data_dir() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let p = PathBuf::from(appdata).join("lumina");
        let _ = fs::create_dir_all(&p);
        return p;
    }
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        let p = PathBuf::from(home).join(".config").join("lumina");
        let _ = fs::create_dir_all(&p);
        return p;
    }
    PathBuf::from(".")
}

fn get_default_workspace_dir() -> PathBuf {
    let base = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let ws = PathBuf::from(base).join("Documents").join("lumina");
    let _ = fs::create_dir_all(&ws);
    ws
}

fn strip_json_comments(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_str = false;
    let mut escape = false;
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if in_str {
            out.push(c);
            if escape {
                escape = false;
            } else if c == '\\' {
                escape = true;
            } else if c == '"' {
                in_str = false;
            }
            i += 1;
        } else if c == '"' {
            in_str = true;
            out.push(c);
            i += 1;
        } else if c == '/' && i + 1 < chars.len() && chars[i + 1] == '/' {
            i += 2;
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
        } else if c == '/' && i + 1 < chars.len() && chars[i + 1] == '*' {
            i += 2;
            while i + 1 < chars.len() && !(chars[i] == '*' && chars[i + 1] == '/') {
                i += 1;
            }
            i += 2;
        } else {
            out.push(c);
            i += 1;
        }
    }
    out
}

fn read_json_file(path: &Path) -> Value {
    if let Ok(raw) = fs::read_to_string(path) {
        let cleaned = strip_json_comments(&raw);
        if let Ok(val) = serde_json::from_str::<Value>(&cleaned) {
            return val;
        }
    }
    Value::Object(Map::new())
}

fn get_app_config_path() -> PathBuf {
    get_app_data_dir().join("app_config.json")
}

pub fn resolve_workspace_path() -> PathBuf {
    let cfg = read_json_file(&get_app_config_path());
    let candidate = cfg
        .get("workspace")
        .and_then(|ws| {
            ws.get("path")
                .or_else(|| ws.get("lastWorkspaceOpened"))
                .or_else(|| ws.get("vaultPath"))
        })
        .and_then(|v| v.as_str())
        .or_else(|| cfg.get("lastWorkspaceOpened").and_then(|v| v.as_str()))
        .or_else(|| cfg.get("lastWorkspacePath").and_then(|v| v.as_str()))
        .or_else(|| cfg.get("workspacePath").and_then(|v| v.as_str()));

    if let Some(p) = candidate {
        if !p.trim().is_empty() {
            let pb = PathBuf::from(p);
            let _ = fs::create_dir_all(&pb);
            return pb;
        }
    }
    get_default_workspace_dir()
}

fn set_active_workspace_path(new_path: &str) {
    let cfg_path = get_app_config_path();
    let mut cfg = read_json_file(&cfg_path);
    if !cfg.is_object() {
        cfg = Value::Object(Map::new());
    }
    let obj = cfg.as_object_mut().unwrap();
    obj.insert("lastWorkspaceOpened".to_string(), Value::String(new_path.to_string()));
    obj.insert("lastWorkspacePath".to_string(), Value::String(new_path.to_string()));
    let ws_entry = obj
        .entry("workspace".to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if let Some(ws_obj) = ws_entry.as_object_mut() {
        ws_obj.insert("path".to_string(), Value::String(new_path.to_string()));
        ws_obj.insert(
            "lastWorkspaceOpened".to_string(),
            Value::String(new_path.to_string()),
        );
        ws_obj.insert("vaultPath".to_string(), Value::String(new_path.to_string()));
    }
    if let Ok(serialized) = serde_json::to_string_pretty(&cfg) {
        let _ = fs::write(cfg_path, serialized);
    }
}

fn scanned_note_to_json(n: ScannedNote) -> Value {
    json!({
        "id": n.id,
        "title": n.title,
        "code": n.code,
        "language": n.language,
        "tags": n.tags,
        "timestamp": n.timestamp,
        "createdAt": n.created_at,
        "isPinned": n.is_pinned,
        "isLearned": n.is_learned,
        "customIcon": n.custom_icon,
        "color": n.color,
        "type": n.note_type,
        "is_draft": n.is_draft,
        "fileName": n.file_name,
        "folderId": n.folder_id,
        "relativePath": n.relative_path,
        "size": n.size,
        "isOversized": n.is_oversized,
        "ext": n.ext,
        "wikilinks": n.wikilinks
    })
}

fn sanitize_filename(name: &str) -> String {
    let mut s: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect();
    s = s.trim().to_string();
    if s.is_empty() {
        "Untitled".to_string()
    } else {
        s
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
pub fn scan_workspace(vault_path: Option<String>, max_bytes: Option<usize>) -> Result<ScanResult, String> {
    let path = vault_path.unwrap_or_else(|| resolve_workspace_path().to_string_lossy().to_string());
    let limit = max_bytes.unwrap_or(5 * 1024 * 1024);
    Ok(scan_vault_impl(&path, limit))
}

#[tauri::command]
pub fn get_snippets() -> Result<Value, String> {
    let ws_path = resolve_workspace_path();
    let ws_str = ws_path.to_string_lossy().to_string();
    let scan = scan_vault_impl(&ws_str, 5 * 1024 * 1024);
    let snippets: Vec<Value> = scan.notes.into_iter().map(scanned_note_to_json).collect();
    Ok(json!({
        "snippets": snippets,
        "folders": scan.folders,
        "workspacePath": ws_str
    }))
}

#[tauri::command]
pub fn read_snippet(id: String) -> Result<Value, String> {
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
}

#[tauri::command]
pub fn save_snippet(snippet: Value) -> Result<Value, String> {
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
        if !old_norm.is_empty() && old_norm != rel_path && (old_norm.ends_with(".md") || old_norm.ends_with(".canvas")) {
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
        let language = obj.get("language").and_then(|v| v.as_str()).unwrap_or("markdown");
        let tags = obj.get("tags").and_then(|v| v.as_str()).unwrap_or("");
        let is_pinned = obj.get("isPinned").and_then(|v| v.as_bool()).unwrap_or(false);
        let is_learned = obj.get("isLearned").and_then(|v| v.as_bool()).unwrap_or(false);
        let custom_icon = obj.get("customIcon").and_then(|v| v.as_str()).unwrap_or("null");
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
            if custom_icon == "null" || custom_icon.is_empty() { "null".to_string() } else { format!("\"{}\"", custom_icon) },
            if color == "null" || color.is_empty() { "null".to_string() } else { format!("\"{}\"", color) },
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
    Ok(returned)
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
pub fn delete_snippet(id: String) -> Result<bool, String> {
    let ws_path = resolve_workspace_path();
    if let Some(target) = resolve_snippet_target(&ws_path, &id) {
        fs::remove_file(target).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
pub fn create_folder(path: String) -> Result<bool, String> {
    let ws_path = resolve_workspace_path();
    let target = safe_join_workspace(&ws_path, &path)?;
    ensure_not_workspace_root(&ws_path, &target)?;
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn rename_folder(old_path: String, new_path: String) -> Result<bool, String> {
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
    }
    Ok(true)
}

#[tauri::command]
pub fn move_file(old_rel_path: String, new_rel_path: String) -> Result<Value, String> {
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
    }
    Ok(json!({
        "success": true,
        "newRelPath": new_rel_path.replace('\\', "/"),
        "migratedImages": []
    }))
}

#[tauri::command]
pub fn move_files(moves: Vec<Value>) -> Result<Value, String> {
    let mut results = Vec::new();
    for m in moves {
        let old_p = m.get("oldRelPath").and_then(|v| v.as_str()).unwrap_or("");
        let new_p = m.get("newRelPath").and_then(|v| v.as_str()).unwrap_or("");
        if !old_p.is_empty() && !new_p.is_empty() {
            move_file(old_p.to_string(), new_p.to_string())?;
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
}

#[tauri::command]
pub fn delete_folder(path: String) -> Result<Value, String> {
    let ws_path = resolve_workspace_path();
    let target = safe_join_workspace(&ws_path, &path)?;
    ensure_not_workspace_root(&ws_path, &target)?;
    if target.exists() && target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
    }
    Ok(json!({ "success": true }))
}

#[tauri::command]
pub fn bulk_delete(folder_ids: Option<Vec<String>>, snippet_ids: Option<Vec<String>>) -> Result<Value, String> {
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
    Ok(json!({ "success": true, "deletedCount": deleted_count }))
}

#[tauri::command]
pub fn select_workspace() -> Result<Value, String> {
    let chosen: String = {
        #[cfg(target_os = "windows")]
        {
            let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Select Lumina Workspace Folder'
$dlg.ShowNewFolderButton = $true
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dlg.SelectedPath
}
"#;
            let output = Command::new("powershell")
                .args(["-NoProfile", "-Sta", "-Command", script])
                .output()
                .map_err(|e| e.to_string())?;
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        }
        #[cfg(target_os = "macos")]
        {
            let output = Command::new("osascript")
                .args([
                    "-e",
                    r#"POSIX path of (choose folder with prompt "Select Lumina Workspace Folder")"#,
                ])
                .output()
                .map_err(|e| e.to_string())?;
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        }
        #[cfg(target_os = "linux")]
        {
            let output = Command::new("zenity")
                .args(["--file-selection", "--directory", "--title=Select Lumina Workspace Folder"])
                .output()
                .map_err(|e| e.to_string())?;
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        }
    };

    if chosen.is_empty() {
        return Ok(Value::Null);
    }
    set_active_workspace_path(&chosen);
    let scan = scan_vault_impl(&chosen, 5 * 1024 * 1024);
    let snippets: Vec<Value> = scan.notes.into_iter().map(scanned_note_to_json).collect();
    Ok(json!({
        "path": chosen,
        "workspacePath": chosen,
        "snippets": snippets,
        "folders": scan.folders
    }))
}

#[tauri::command]
pub fn open_path_in_os(path: String) -> Result<bool, String> {
    let trimmed = path.trim();
    if is_safe_external_url(trimmed) {
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", trimmed])
                .spawn();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("open").arg(trimmed).spawn();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = Command::new("xdg-open").arg(trimmed).spawn();
        }
        return Ok(true);
    }

    let ws_path = resolve_workspace_path();
    let target = if trimmed.is_empty() {
        ws_path
    } else {
        safe_join_workspace(&ws_path, trimmed)?
    };
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("explorer").arg(target).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(target).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(target).spawn();
    }
    Ok(true)
}

#[tauri::command]
pub fn save_workspace_image(
    bytes: Vec<u8>,
    target_folder: Option<String>,
    name: Option<String>,
) -> Result<String, String> {
    let ws_path = resolve_workspace_path();
    let folder = target_folder.unwrap_or_default().replace('\\', "/");
    let raw_name = name.unwrap_or_else(|| format!("image-{}.png", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)));
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
    Ok(rel_path)
}

#[tauri::command]
pub fn read_asset_bytes(relative_path: String) -> Result<Vec<u8>, String> {
    let ws_path = resolve_workspace_path();
    let full_path = safe_join_workspace(&ws_path, &relative_path)?;
    fs::read(full_path).map_err(|e| e.to_string())
}

// ──────────────────────────────────────────────────────────────────────────────
// Settings & Memory Tauri Commands
// ──────────────────────────────────────────────────────────────────────────────

fn settings_master_key() -> [u8; 32] {
    lumina_core::secrets::load_or_create_master_key(&get_app_data_dir())
}

#[tauri::command]
pub fn get_setting(key: Option<String>) -> Result<Value, String> {
    let ws_path = resolve_workspace_path();
    let settings_file = ws_path.join(".lumina").join("settings.json");
    let mut settings = read_json_file(&settings_file);
    if !settings.is_object() {
        settings = Value::Object(Map::new());
    }
    lumina_core::secrets::decrypt_settings_secrets(&mut settings, &settings_master_key());
    let app_cfg = read_json_file(&get_app_config_path());

    if let Some(obj) = settings.as_object_mut() {
        obj.insert(
            "workspacePath".to_string(),
            Value::String(ws_path.to_string_lossy().to_string()),
        );
        if let Some(theme) = app_cfg.get("theme") {
            obj.entry("theme".to_string()).or_insert_with(|| theme.clone());
        }
        if let Some(shortcuts) = app_cfg.get("shortcuts") {
            obj.entry("shortcuts".to_string())
                .or_insert_with(|| shortcuts.clone());
        }
        if let Some(ws) = app_cfg.get("workspace").and_then(|v| v.as_object()) {
            for k in [
                "pinnedFolders",
                "folderOrder",
                "expandedFolders",
                "openTabs",
                "pinnedTabIds",
                "lastNoteId",
                "lastSnippetId",
                "splitLayout",
            ] {
                if let Some(val) = ws.get(k) {
                    obj.insert(k.to_string(), val.clone());
                }
            }
        }
    }

    if let Some(k) = key {
        if !k.is_empty() {
            return Ok(settings.get(&k).cloned().unwrap_or(Value::Null));
        }
    }
    Ok(settings)
}

#[tauri::command]
pub fn save_settings(new_settings: Value) -> Result<bool, String> {
    let Some(updates) = new_settings.as_object() else {
        return Ok(false);
    };

    if let Some(new_ws) = updates.get("workspacePath").and_then(|v| v.as_str()) {
        if !new_ws.trim().is_empty() {
            set_active_workspace_path(new_ws);
        }
    }

    let ws_path = resolve_workspace_path();
    let lumina_dir = ws_path.join(".lumina");
    let _ = fs::create_dir_all(&lumina_dir);
    let settings_file = lumina_dir.join("settings.json");

    let mut current = read_json_file(&settings_file);
    if !current.is_object() {
        current = Value::Object(Map::new());
    }

    let cfg_path = get_app_config_path();
    let mut app_cfg = read_json_file(&cfg_path);
    if !app_cfg.is_object() {
        app_cfg = Value::Object(Map::new());
    }

    let ws_keys = [
        "pinnedFolders",
        "folderOrder",
        "expandedFolders",
        "openTabs",
        "pinnedTabIds",
        "lastNoteId",
        "lastSnippetId",
        "splitLayout",
    ];

    if let (Some(curr_obj), Some(cfg_obj)) = (current.as_object_mut(), app_cfg.as_object_mut()) {
        for (k, v) in updates {
            if k == "workspacePath" || k == "vaultPath" {
                continue;
            }
            if k == "theme" {
                cfg_obj.insert("theme".to_string(), v.clone());
            }
            if k == "shortcuts" {
                cfg_obj.insert("shortcuts".to_string(), v.clone());
            }
            if ws_keys.contains(&k.as_str()) {
                let ws_entry = cfg_obj
                    .entry("workspace".to_string())
                    .or_insert_with(|| Value::Object(Map::new()));
                if let Some(ws_obj) = ws_entry.as_object_mut() {
                    ws_obj.insert(k.clone(), v.clone());
                }
            }
            curr_obj.insert(k.clone(), v.clone());
        }
    }

    lumina_core::secrets::encrypt_settings_secrets(&mut current, &settings_master_key());

    if let Ok(s) = serde_json::to_string_pretty(&current) {
        let _ = fs::write(&settings_file, s);
    }
    if let Ok(c) = serde_json::to_string_pretty(&app_cfg) {
        let _ = fs::write(&cfg_path, c);
    }
    Ok(true)
}

#[tauri::command]
pub fn save_setting(key: String, value: Value) -> Result<bool, String> {
    let mut map = Map::new();
    map.insert(key, value);
    save_settings(Value::Object(map))
}

#[tauri::command]
pub fn load_memory() -> Result<Value, String> {
    let mem_path = get_app_data_dir().join("user-memory.json");
    if mem_path.exists() {
        Ok(read_json_file(&mem_path))
    } else {
        Ok(json!({ "facts": [], "preferences": {} }))
    }
}

#[tauri::command]
pub fn save_memory(memory: Value) -> Result<bool, String> {
    let mem_path = get_app_data_dir().join("user-memory.json");
    if let Ok(s) = serde_json::to_string_pretty(&memory) {
        let _ = fs::write(mem_path, s);
    }
    Ok(true)
}

// ──────────────────────────────────────────────────────────────────────────────
// Search & Graph Commands
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn search_notes(
    items: Vec<SearchIndexItem>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
    let hit_limit = limit.unwrap_or(50);
    Ok(search_notes_impl(&items, &query, hit_limit))
}

#[tauri::command]
pub fn search_workspace(query: String, limit: Option<usize>) -> Result<Vec<SearchHit>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let ws_path = resolve_workspace_path();
    let scan = scan_vault_impl(&ws_path.to_string_lossy(), 5 * 1024 * 1024);
    let items: Vec<SearchIndexItem> = scan
        .notes
        .into_iter()
        .map(|n| SearchIndexItem {
            id: n.id,
            title: n.title,
            relative_path: n.relative_path,
            tags: n.tags,
            content: n.code,
        })
        .collect();
    let hit_limit = limit.unwrap_or(40);
    Ok(search_notes_impl(&items, &query, hit_limit))
}

#[tauri::command]
pub fn build_graph_data(notes: Vec<NoteInput>) -> Result<GraphData, String> {
    Ok(build_graph_data_impl(&notes))
}

#[tauri::command]
pub fn read_file_string(path: String) -> Result<String, String> {
    let ws_path = resolve_workspace_path();
    let full_path = safe_join_workspace(&ws_path, &path)?;
    fs::read_to_string(&full_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file_string(path: String, content: String) -> Result<(), String> {
    let ws_path = resolve_workspace_path();
    let full_path = safe_join_workspace(&ws_path, &path)?;
    ensure_not_workspace_root(&ws_path, &full_path)?;
    if let Some(parent) = full_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&full_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let ws_path = resolve_workspace_path();
    let full_path = safe_join_workspace(&ws_path, &path)?;
    ensure_not_workspace_root(&ws_path, &full_path)?;
    if full_path.exists() && full_path.is_file() {
        fs::remove_file(&full_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ──────────────────────────────────────────────────────────────────────────────
// Native ConPTY / PTY Terminal Engine for Tauri
// ──────────────────────────────────────────────────────────────────────────────

struct TauriPtySession {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

static TAURI_PTY_SESSIONS: OnceLock<Mutex<HashMap<String, Arc<TauriPtySession>>>> = OnceLock::new();

fn tauri_sessions() -> &'static Mutex<HashMap<String, Arc<TauriPtySession>>> {
    TAURI_PTY_SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ShellProfile {
    pub id: String,
    pub label: String,
    pub path: String,
    pub args: Vec<String>,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
}

#[tauri::command]
pub fn terminal_get_shells() -> Vec<ShellProfile> {
    let mut shells = Vec::new();
    #[cfg(target_os = "windows")]
    {
        let git_bash_candidates = [
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files\Git\usr\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
        ];
        for candidate in git_bash_candidates {
            if Path::new(candidate).exists() {
                shells.push(ShellProfile {
                    id: "git-bash".to_string(),
                    label: "Git Bash".to_string(),
                    path: candidate.to_string(),
                    args: vec!["--login".to_string(), "-i".to_string()],
                    is_default: true,
                });
                break;
            }
        }
        shells.push(ShellProfile {
            id: "powershell".to_string(),
            label: "PowerShell".to_string(),
            path: "powershell.exe".to_string(),
            args: vec!["-NoLogo".to_string()],
            is_default: shells.is_empty(),
        });
        shells.push(ShellProfile {
            id: "cmd".to_string(),
            label: "Command Prompt".to_string(),
            path: "cmd.exe".to_string(),
            args: vec![],
            is_default: false,
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        let sh = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        shells.push(ShellProfile {
            id: "default".to_string(),
            label: "Shell".to_string(),
            path: sh,
            args: vec!["-l".to_string()],
            is_default: true,
        });
    }
    shells
}

#[tauri::command]
pub fn terminal_spawn(
    app: AppHandle,
    payload: Value,
) -> Result<Value, String> {
    let session_id = payload
        .get("sessionId")
        .and_then(|v| v.as_str())
        .unwrap_or("term-1")
        .to_string();
    let cols = payload.get("cols").and_then(|v| v.as_u64()).unwrap_or(80) as u16;
    let rows = payload.get("rows").and_then(|v| v.as_u64()).unwrap_or(24) as u16;
    let cwd = payload
        .get("cwd")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| resolve_workspace_path().to_string_lossy().to_string());

    let shells = terminal_get_shells();
    let requested_id = payload.get("shellId").or_else(|| payload.get("shell")).and_then(|v| v.as_str());
    let chosen_shell = requested_id
        .and_then(|id| shells.iter().find(|s| s.id == id || s.path == id))
        .or_else(|| shells.iter().find(|s| s.is_default))
        .or_else(|| shells.first())
        .cloned()
        .unwrap_or(ShellProfile {
            id: "powershell".to_string(),
            label: "PowerShell".to_string(),
            path: "powershell.exe".to_string(),
            args: vec![],
            is_default: true,
        });

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(10),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&chosen_shell.path);
    for arg in &chosen_shell.args {
        cmd.arg(arg);
    }
    if Path::new(&cwd).exists() {
        cmd.cwd(&cwd);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let pid = child.process_id().unwrap_or(0);
    let killer = child.clone_killer();
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let session = Arc::new(TauriPtySession {
        master: Mutex::new(pair.master),
        writer: Mutex::new(writer),
        killer: Mutex::new(killer),
    });

    if let Ok(mut map) = tauri_sessions().lock() {
        if let Some(old) = map.remove(&session_id) {
            if let Ok(mut k) = old.killer.lock() {
                let _ = k.kill();
            }
        }
        map.insert(session_id.clone(), session);
    }

    let sid_reader = session_id.clone();
    let app_reader = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let channel = format!("terminal:data:{}", sid_reader);
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 {
                break;
            }
            let text = String::from_utf8_lossy(&buf[..n]).to_string();
            let _ = app_reader.emit(&channel, text);
        }
    });

    let sid_wait = session_id.clone();
    let app_wait = app.clone();
    std::thread::spawn(move || {
        let code = child.wait().map(|s| s.exit_code()).unwrap_or(0);
        if let Ok(mut map) = tauri_sessions().lock() {
            map.remove(&sid_wait);
        }
        let channel = format!("terminal:exit:{}", sid_wait);
        let _ = app_wait.emit(&channel, code);
    });

    Ok(json!({
        "success": true,
        "sessionId": session_id,
        "pid": pid,
        "shell": chosen_shell.label
    }))
}

#[tauri::command]
pub fn pty_write_tauri(session_id: String, data: String) -> Result<bool, String> {
    let sess = tauri_sessions()
        .lock()
        .ok()
        .and_then(|m| m.get(&session_id).cloned());
    if let Some(s) = sess {
        if let Ok(mut w) = s.writer.lock() {
            let _ = w.write_all(data.as_bytes());
            let _ = w.flush();
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
pub fn pty_resize_tauri(session_id: String, cols: u16, rows: u16) -> Result<bool, String> {
    let sess = tauri_sessions()
        .lock()
        .ok()
        .and_then(|m| m.get(&session_id).cloned());
    if let Some(s) = sess {
        if let Ok(m) = s.master.lock() {
            let _ = m.resize(PtySize {
                rows: rows.max(2),
                cols: cols.max(10),
                pixel_width: 0,
                pixel_height: 0,
            });
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
pub fn pty_kill_tauri(session_id: String) -> Result<bool, String> {
    let sess = tauri_sessions()
        .lock()
        .ok()
        .and_then(|mut m| m.remove(&session_id));
    if let Some(s) = sess {
        if let Ok(mut k) = s.killer.lock() {
            let _ = k.kill();
            return Ok(true);
        }
    }
    Ok(false)
}

// ──────────────────────────────────────────────────────────────────────────────
// Google OAuth (Browser Loopback Flow)
// ──────────────────────────────────────────────────────────────────────────────

fn read_google_client_secret() -> String {
    for key in ["GOOGLE_CLIENT_SECRET", "VITE_GOOGLE_CLIENT_SECRET"] {
        if let Ok(val) = std::env::var(key) {
            let trimmed = val.trim().to_string();
            if !trimmed.is_empty() {
                return trimmed;
            }
        }
    }

    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join(".env"));
        candidates.push(cwd.join(".env.local"));
        if let Some(parent) = cwd.parent() {
            candidates.push(parent.join(".env"));
            candidates.push(parent.join(".env.local"));
        }
    }

    for env_path in candidates {
        if let Ok(content) = fs::read_to_string(&env_path) {
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((k, v)) = line.split_once('=') {
                    let k = k.trim();
                    if k == "GOOGLE_CLIENT_SECRET" || k == "VITE_GOOGLE_CLIENT_SECRET" {
                        let v = v.trim().trim_matches('"').trim_matches('\'').to_string();
                        if !v.is_empty() {
                            return v;
                        }
                    }
                }
            }
        }
    }

    String::new()
}

fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let raw = input.as_bytes();
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == b'%' && i + 2 < raw.len() {
            if let Ok(hex) = std::str::from_utf8(&raw[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex, 16) {
                    bytes.push(val);
                    i += 3;
                    continue;
                }
            }
        } else if raw[i] == b'+' {
            bytes.push(b' ');
            i += 1;
            continue;
        }
        bytes.push(raw[i]);
        i += 1;
    }
    String::from_utf8_lossy(&bytes).to_string()
}

#[tauri::command]
pub fn get_google_user() -> Result<Value, String> {
    let user = get_setting(Some("googleUser".to_string()))?;
    if let Some(obj) = user.as_object() {
        if obj.get("token").is_some() && !obj.get("token").unwrap().is_null() {
            return Ok(json!({
                "name": obj.get("name").cloned().unwrap_or(Value::Null),
                "email": obj.get("email").cloned().unwrap_or(Value::Null),
                "picture": obj.get("picture").cloned().unwrap_or(Value::Null),
            }));
        }
    }
    Ok(Value::Null)
}

#[tauri::command]
pub fn logout_from_google() -> Result<Value, String> {
    save_setting("googleUser".to_string(), Value::Null)?;
    Ok(json!({ "success": true }))
}

#[tauri::command]
pub async fn login_with_google(app: tauri::AppHandle, client_id: String) -> Result<Value, String> {
    use tauri::Manager;
    let res = tauri::async_runtime::spawn_blocking(move || -> Value {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

        let trimmed_client = client_id.trim().to_string();
        if !trimmed_client.ends_with(".apps.googleusercontent.com") {
            return json!({ "error": "Invalid Google client id." });
        }

        let listener = match TcpListener::bind("127.0.0.1:3000") {
            Ok(l) => l,
            Err(e) => {
                return json!({ "error": format!("Failed to start local OAuth callback server on port 3000: {}", e) });
            }
        };
        let _ = listener.set_nonblocking(true);

        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(1);
        let oauth_state = format!("{:x}{:x}", nanos, std::process::id());
        let redirect_uri = "http://localhost:3000/oauth2callback";
        let scopes = [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
            "email",
            "profile",
        ]
        .join(" ");

        let auth_url = format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&access_type=offline&prompt=consent&state={}&scope={}",
            percent_encode(&trimmed_client),
            percent_encode(redirect_uri),
            percent_encode(&oauth_state),
            percent_encode(&scopes)
        );

        let _ = open_path_in_os(auth_url);

        let deadline = Instant::now() + Duration::from_secs(120);
        let mut auth_code: Option<String> = None;
        let mut auth_error: Option<String> = None;

        while Instant::now() < deadline {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let mut buf = [0u8; 4096];
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                    if let Ok(n) = stream.read(&mut buf) {
                        let req_str = String::from_utf8_lossy(&buf[..n]);
                        let first_line = req_str.lines().next().unwrap_or("");
                        let path_and_query = first_line.split_whitespace().nth(1).unwrap_or("");
                        if let Some(query) = path_and_query.strip_prefix("/oauth2callback?") {
                            let mut state_param = String::new();
                            let mut code_param = String::new();
                            let mut err_param = String::new();
                            for pair in query.split('&') {
                                if let Some((k, v)) = pair.split_once('=') {
                                    let val = percent_decode(v);
                                    match k {
                                        "state" => state_param = val,
                                        "code" => code_param = val,
                                        "error" => err_param = val,
                                        _ => {}
                                    }
                                }
                            }
                            if state_param != oauth_state {
                                let body = "<html><body><h2>Invalid OAuth state. Please try again from Lumina.</h2></body></html>";
                                let resp = format!("HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                                let _ = stream.write_all(resp.as_bytes());
                                auth_error = Some("Invalid OAuth state.".to_string());
                                break;
                            }
                            if !err_param.is_empty() {
                                let body = format!("<html><body><h2>Google sign-in error: {}</h2></body></html>", err_param);
                                let resp = format!("HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                                let _ = stream.write_all(resp.as_bytes());
                                auth_error = Some(format!("Google returned error: {}", err_param));
                                break;
                            }
                            let body = "<html><body style=\"font-family:system-ui,sans-serif;background:#111118;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0\"><div style=\"text-align:center;padding:32px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;background:#181822\"><h2>Signed in to Lumina</h2><p style=\"color:#94a3b8;margin:8px 0 20px\">Authentication succeeded. You can close this tab or click below to return.</p><button onclick=\"window.close()\" style=\"padding:10px 20px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-weight:600;cursor:pointer\">Return to Lumina</button></div></body></html>";
                            let resp = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                            let _ = stream.write_all(resp.as_bytes());
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.unminimize();
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                            if !code_param.is_empty() {
                                auth_code = Some(code_param);
                            } else {
                                auth_error = Some("Missing authorization code from Google.".to_string());
                            }
                            break;
                        } else {
                            let resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                            let _ = stream.write_all(resp.as_bytes());
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(80));
                }
                Err(e) => {
                    auth_error = Some(format!("OAuth listener error: {}", e));
                    break;
                }
            }
        }

        if let Some(err) = auth_error {
            return json!({ "error": err });
        }
        let code = match auth_code {
            Some(c) => c,
            None => return json!({ "error": "Google sign-in timed out." }),
        };

        let client_secret = read_google_client_secret();
        let mut form_body = format!(
            "code={}&client_id={}&redirect_uri={}&grant_type=authorization_code",
            percent_encode(&code),
            percent_encode(&trimmed_client),
            percent_encode(redirect_uri)
        );
        if !client_secret.is_empty() {
            form_body.push_str(&format!("&client_secret={}", percent_encode(&client_secret)));
        }

        let token_out = match Command::new("curl")
            .args([
                "-s",
                "-X",
                "POST",
                "https://oauth2.googleapis.com/token",
                "-H",
                "Content-Type: application/x-www-form-urlencoded",
                "-d",
                &form_body,
            ])
            .output()
        {
            Ok(o) => o,
            Err(e) => return json!({ "error": format!("Failed to exchange OAuth token: {}", e) }),
        };

        let token_json: Value = match serde_json::from_slice(&token_out.stdout) {
            Ok(v) => v,
            Err(_) => return json!({ "error": "Invalid token response from Google." }),
        };

        if let Some(err) = token_json.get("error").and_then(|v| v.as_str()) {
            let desc = token_json
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or(err);
            return json!({ "error": desc });
        }

        let access_token = match token_json.get("access_token").and_then(|v| v.as_str()) {
            Some(t) if !t.is_empty() => t.to_string(),
            _ => return json!({ "error": "No access token returned by Google." }),
        };

        let user_out = Command::new("curl")
            .args([
                "-s",
                "-H",
                &format!("Authorization: Bearer {}", access_token),
                "https://www.googleapis.com/oauth2/v2/userinfo",
            ])
            .output();

        let profile: Value = user_out
            .ok()
            .and_then(|o| serde_json::from_slice(&o.stdout).ok())
            .unwrap_or_else(|| json!({}));

        let expires_in = token_json.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let stored_user = json!({
            "name": profile.get("name").cloned().unwrap_or(Value::Null),
            "email": profile.get("email").cloned().unwrap_or(Value::Null),
            "picture": profile.get("picture").cloned().unwrap_or(Value::Null),
            "clientId": trimmed_client,
            "token": {
                "access_token": access_token,
                "refresh_token": token_json.get("refresh_token").cloned().unwrap_or(Value::Null),
                "expiry_date": now_ms + expires_in * 1000
            }
        });

        let _ = save_setting("googleUser".to_string(), stored_user.clone());

        json!({
            "name": stored_user.get("name").cloned().unwrap_or(Value::Null),
            "email": stored_user.get("email").cloned().unwrap_or(Value::Null),
            "picture": stored_user.get("picture").cloned().unwrap_or(Value::Null),
        })
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(res)
}

#[tauri::command]
pub async fn get_google_access_token() -> Result<Value, String> {
    let res = tauri::async_runtime::spawn_blocking(move || -> Value {
        use std::time::{SystemTime, UNIX_EPOCH};

        let user = match get_setting(Some("googleUser".to_string())) {
            Ok(v) => v,
            Err(e) => return json!({ "error": e }),
        };
        let obj = match user.as_object() {
            Some(o) => o.clone(),
            None => return json!({ "error": "Not logged in to Google" }),
        };
        let token_obj = match obj.get("token").and_then(|t| t.as_object()) {
            Some(t) => t.clone(),
            None => return json!({ "error": "Not logged in to Google" }),
        };

        let access_token = token_obj
            .get("access_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let refresh_token = token_obj
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let expiry_date = token_obj
            .get("expiry_date")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let email = obj.get("email").cloned().unwrap_or(Value::Null);
        let name = obj.get("name").cloned().unwrap_or(Value::Null);

        if !access_token.is_empty() && (expiry_date == 0 || now_ms + 60_000 < expiry_date) {
            return json!({
                "accessToken": access_token,
                "email": email,
                "name": name
            });
        }

        if refresh_token.is_empty() {
            if !access_token.is_empty() {
                return json!({ "accessToken": access_token, "email": email, "name": name });
            }
            return json!({ "error": "Session expired. Please reconnect your Google account." });
        }

        let client_id = obj
            .get("clientId")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com");
        let client_secret = read_google_client_secret();

        let mut form_body = format!(
            "client_id={}&refresh_token={}&grant_type=refresh_token",
            percent_encode(client_id),
            percent_encode(&refresh_token)
        );
        if !client_secret.is_empty() {
            form_body.push_str(&format!("&client_secret={}", percent_encode(&client_secret)));
        }

        let out = match Command::new("curl")
            .args([
                "-s",
                "-X",
                "POST",
                "https://oauth2.googleapis.com/token",
                "-H",
                "Content-Type: application/x-www-form-urlencoded",
                "-d",
                &form_body,
            ])
            .output()
        {
            Ok(o) => o,
            Err(e) => return json!({ "error": format!("Failed to refresh token: {}", e) }),
        };

        let parsed: Value = serde_json::from_slice(&out.stdout).unwrap_or(Value::Null);
        if let Some(new_token) = parsed.get("access_token").and_then(|v| v.as_str()) {
            let expires_in = parsed.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
            let mut updated = obj;
            updated.insert(
                "token".to_string(),
                json!({
                    "access_token": new_token,
                    "refresh_token": refresh_token,
                    "expiry_date": now_ms + expires_in * 1000
                }),
            );
            let _ = save_setting("googleUser".to_string(), Value::Object(updated));
            return json!({
                "accessToken": new_token,
                "email": email,
                "name": name
            });
        }

        json!({ "error": "Failed to refresh Google access token. Please reconnect your Google account." })
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(res)
}

#[tauri::command]
pub async fn pick_email_attachments() -> Result<Value, String> {
    let res = tauri::async_runtime::spawn_blocking(move || -> Value {
        let paths: Vec<String> = {
            #[cfg(target_os = "windows")]
            {
                let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Multiselect = $true
$dlg.Title = 'Select Email Attachments'
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $dlg.FileNames | ForEach-Object { Write-Output $_ }
}
"#;
                Command::new("powershell")
                    .args(["-NoProfile", "-Command", script])
                    .output()
                    .map(|o| {
                        String::from_utf8_lossy(&o.stdout)
                            .lines()
                            .map(|l| l.trim().to_string())
                            .filter(|l| !l.is_empty())
                            .collect()
                    })
                    .unwrap_or_default()
            }
            #[cfg(not(target_os = "windows"))]
            {
                Vec::new()
            }
        };

        let mut attachments = Vec::new();
        for p in paths {
            let path = PathBuf::from(&p);
            if let Ok(bytes) = fs::read(&path) {
                let filename = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "attachment".to_string());
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let mime = match ext.as_str() {
                    "png" => "image/png",
                    "jpg" | "jpeg" => "image/jpeg",
                    "gif" => "image/gif",
                    "webp" => "image/webp",
                    "pdf" => "application/pdf",
                    "txt" | "md" => "text/plain",
                    "json" => "application/json",
                    "csv" => "text/csv",
                    "zip" => "application/zip",
                    _ => "application/octet-stream",
                };
                attachments.push(json!({
                    "filename": filename,
                    "mimeType": mime,
                    "bytes": bytes
                }));
            }
        }
        json!({ "attachments": attachments })
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(res)
}
