use lumina_core::zip_util::{build_zip_bytes, ZipEntry};
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
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

static LAST_INTERNAL_WRITE_MS: AtomicU64 = AtomicU64::new(0);
static BACKUP_CANCELLED: AtomicBool = AtomicBool::new(false);
static SETTINGS_IO_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static MEMORY_IO_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn settings_io_lock() -> &'static Mutex<()> {
    SETTINGS_IO_LOCK.get_or_init(|| Mutex::new(()))
}

fn memory_io_lock() -> &'static Mutex<()> {
    MEMORY_IO_LOCK.get_or_init(|| Mutex::new(()))
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn write_string_atomic(path: &Path, content: &str) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let tmp = path.with_extension(format!("tmp.{}.{}", std::process::id(), now_epoch_ms()));
    if fs::write(&tmp, content).is_ok() {
        if fs::rename(&tmp, path).is_ok() {
            return Ok(());
        }
        let _ = fs::remove_file(&tmp);
    }
    fs::write(path, content)
}

async fn run_blocking<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

pub fn mark_internal_workspace_write() {
    LAST_INTERNAL_WRITE_MS.store(now_epoch_ms(), Ordering::SeqCst);
}

fn collect_workspace_fingerprint(root: &Path) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        let mut children: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        children.sort_by_key(|e| e.file_name());
        for entry in children {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" {
                continue;
            }
            let path = entry.path();
            for b in name.as_bytes() {
                hash ^= *b as u64;
                hash = hash.wrapping_mul(0x100000001b3);
            }
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    stack.push(path);
                } else {
                    hash ^= meta.len();
                    hash = hash.wrapping_mul(0x100000001b3);
                    if let Ok(modified) = meta.modified() {
                        let nanos = modified
                            .duration_since(UNIX_EPOCH)
                            .map(|d| d.as_nanos() as u64)
                            .unwrap_or(0);
                        hash ^= nanos;
                        hash = hash.wrapping_mul(0x100000001b3);
                    }
                }
            }
        }
    }
    hash
}

pub fn start_workspace_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_ws: Option<PathBuf> = None;
        let mut last_hash: u64 = 0;

        loop {
            std::thread::sleep(Duration::from_millis(1500));
            let ws_path = resolve_workspace_path();
            if !ws_path.exists() {
                continue;
            }
            let current_hash = collect_workspace_fingerprint(&ws_path);
            let same_ws = last_ws.as_ref().map(|p| p == &ws_path).unwrap_or(false);
            if same_ws && current_hash != last_hash {
                let since_write = now_epoch_ms().saturating_sub(LAST_INTERNAL_WRITE_MS.load(Ordering::SeqCst));
                if since_write > 1200 {
                    let _ = app.emit("workspace:updated", ());
                }
            }
            last_ws = Some(ws_path);
            last_hash = current_hash;
        }
    });
}

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

fn set_active_workspace_path_unlocked(new_path: &str) {
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
        let _ = write_string_atomic(&cfg_path, &serialized);
    }
}

fn set_active_workspace_path(new_path: &str) {
    let _guard = settings_io_lock().lock().unwrap_or_else(|e| e.into_inner());
    set_active_workspace_path_unlocked(new_path);
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

fn open_path_in_os_sync(path: String) -> Result<bool, String> {
    let trimmed = path.trim().to_string();
    if is_safe_external_url(&trimmed) {
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", &trimmed])
                .spawn();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("open").arg(&trimmed).spawn();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = Command::new("xdg-open").arg(&trimmed).spawn();
        }
        return Ok(true);
    }

    let target = resolve_allowed_open_target(&trimmed)?;
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

// ──────────────────────────────────────────────────────────────────────────────
// Settings & Memory Tauri Commands
// ──────────────────────────────────────────────────────────────────────────────

fn settings_master_key() -> [u8; 32] {
    lumina_core::secrets::load_or_create_master_key(&get_app_data_dir())
}

fn get_setting_sync(key: Option<String>) -> Result<Value, String> {
    let _guard = settings_io_lock().lock().unwrap_or_else(|e| e.into_inner());
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
pub async fn get_setting(key: Option<String>) -> Result<Value, String> {
    run_blocking(move || get_setting_sync(key)).await
}

fn save_settings_sync(new_settings: Value) -> Result<bool, String> {
    let Some(updates) = new_settings.as_object() else {
        return Ok(false);
    };

    let _guard = settings_io_lock().lock().unwrap_or_else(|e| e.into_inner());

    if let Some(new_ws) = updates.get("workspacePath").and_then(|v| v.as_str()) {
        if !new_ws.trim().is_empty() {
            set_active_workspace_path_unlocked(new_ws);
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
        let _ = write_string_atomic(&settings_file, &s);
    }
    if let Ok(c) = serde_json::to_string_pretty(&app_cfg) {
        let _ = write_string_atomic(&cfg_path, &c);
    }
    Ok(true)
}

#[tauri::command]
pub async fn save_settings(new_settings: Value) -> Result<bool, String> {
    run_blocking(move || save_settings_sync(new_settings)).await
}

fn save_setting_sync(key: String, value: Value) -> Result<bool, String> {
    let mut map = Map::new();
    map.insert(key, value);
    save_settings_sync(Value::Object(map))
}

#[tauri::command]
pub async fn save_setting(key: String, value: Value) -> Result<bool, String> {
    run_blocking(move || save_setting_sync(key, value)).await
}

#[tauri::command]
pub async fn load_memory() -> Result<Value, String> {
    run_blocking(move || {
        let _guard = memory_io_lock().lock().unwrap_or_else(|e| e.into_inner());
        let mem_path = get_app_data_dir().join("user-memory.json");
        if mem_path.exists() {
            Ok(read_json_file(&mem_path))
        } else {
            Ok(json!({ "facts": [], "preferences": {} }))
        }
    })
    .await
}

#[tauri::command]
pub async fn save_memory(memory: Value) -> Result<bool, String> {
    run_blocking(move || {
        let _guard = memory_io_lock().lock().unwrap_or_else(|e| e.into_inner());
        let mem_path = get_app_data_dir().join("user-memory.json");
        if let Ok(s) = serde_json::to_string_pretty(&memory) {
            let _ = write_string_atomic(&mem_path, &s);
        }
        Ok(true)
    })
    .await
}

// ──────────────────────────────────────────────────────────────────────────────
// Search & Graph Commands
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn search_notes(
    items: Vec<SearchIndexItem>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
    run_blocking(move || {
        let hit_limit = limit.unwrap_or(50);
        Ok(search_notes_impl(&items, &query, hit_limit))
    })
    .await
}

#[tauri::command]
pub async fn search_workspace(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
    run_blocking(move || {
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
    })
    .await
}

#[tauri::command]
pub async fn build_graph_data(notes: Vec<NoteInput>) -> Result<GraphData, String> {
    run_blocking(move || Ok(build_graph_data_impl(&notes))).await
}

#[tauri::command]
pub async fn read_file_string(path: String) -> Result<String, String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let full_path = safe_join_workspace(&ws_path, &path)?;
        fs::read_to_string(&full_path).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn write_file_string(path: String, content: String) -> Result<(), String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let full_path = safe_join_workspace(&ws_path, &path)?;
        ensure_not_workspace_root(&ws_path, &full_path)?;
        if let Some(parent) = full_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&full_path, content).map_err(|e| e.to_string())?;
        mark_internal_workspace_write();
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    run_blocking(move || {
        let ws_path = resolve_workspace_path();
        let full_path = safe_join_workspace(&ws_path, &path)?;
        ensure_not_workspace_root(&ws_path, &full_path)?;
        if full_path.exists() && full_path.is_file() {
            fs::remove_file(&full_path).map_err(|e| e.to_string())?;
            mark_internal_workspace_write();
        }
        Ok(())
    })
    .await
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

fn terminal_get_shells_sync() -> Vec<ShellProfile> {
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
pub async fn terminal_get_shells() -> Result<Vec<ShellProfile>, String> {
    run_blocking(|| Ok(terminal_get_shells_sync())).await
}

#[tauri::command]
pub async fn terminal_spawn(
    app: AppHandle,
    payload: Value,
) -> Result<Value, String> {
    run_blocking(move || {
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

        let shells = terminal_get_shells_sync();
        let requested_id = payload
            .get("shellId")
            .or_else(|| payload.get("shell"))
            .and_then(|v| v.as_str());
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
    })
    .await
}

#[tauri::command]
pub async fn pty_write_tauri(session_id: String, data: String) -> Result<bool, String> {
    run_blocking(move || {
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
    })
    .await
}

#[tauri::command]
pub async fn pty_resize_tauri(
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<bool, String> {
    run_blocking(move || {
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
    })
    .await
}

#[tauri::command]
pub async fn pty_kill_tauri(session_id: String) -> Result<bool, String> {
    run_blocking(move || {
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
    })
    .await
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
pub async fn get_google_user() -> Result<Value, String> {
    run_blocking(move || {
        let user = get_setting_sync(Some("googleUser".to_string()))?;
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
    })
    .await
}

#[tauri::command]
pub async fn logout_from_google() -> Result<Value, String> {
    run_blocking(move || {
        save_setting_sync("googleUser".to_string(), Value::Null)?;
        Ok(json!({ "success": true }))
    })
    .await
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

        let _ = open_path_in_os_sync(auth_url);

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

        let _ = save_setting_sync("googleUser".to_string(), stored_user.clone());

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
pub async fn get_google_access_token(force_refresh: Option<bool>) -> Result<Value, String> {
    let force = force_refresh.unwrap_or(false);
    let res = tauri::async_runtime::spawn_blocking(move || -> Value {
        use std::time::{SystemTime, UNIX_EPOCH};

        let user = match get_setting_sync(Some("googleUser".to_string())) {
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

        if !force
            && !access_token.is_empty()
            && (expiry_date == 0 || now_ms + 60_000 < expiry_date)
        {
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
            let _ = save_setting_sync("googleUser".to_string(), Value::Object(updated));
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
pub async fn pick_email_attachments(window: tauri::WebviewWindow) -> Result<Value, String> {
    let _ = &window;
    #[cfg(target_os = "windows")]
    let parent_hwnd: Option<isize> = window.hwnd().ok().map(|h| h.0 as isize);
    #[cfg(not(target_os = "windows"))]
    let parent_hwnd: Option<isize> = None;

    let res = tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let paths = crate::export::pick_open_files_native(
            parent_hwnd,
            "Select Email Attachments".to_string(),
            true,
            String::new(),
            Vec::new(),
        )?;

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
        Ok(json!({ "attachments": attachments }))
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(res)
}
