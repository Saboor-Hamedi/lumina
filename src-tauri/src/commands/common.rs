//! Shared infrastructure for Lumina Tauri commands.
//!
//! Provides the blocking task runner, atomic file writes, active workspace
//! path resolution, internal write suppression, background workspace watcher,
//! and process spawning helpers shared across command modules.

use lumina_core::ScannedNote;
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

static LAST_INTERNAL_WRITE_MS: AtomicU64 = AtomicU64::new(0);
static SETTINGS_IO_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static MEMORY_IO_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub(super) fn settings_io_lock() -> &'static Mutex<()> {
    SETTINGS_IO_LOCK.get_or_init(|| Mutex::new(()))
}

pub(super) fn memory_io_lock() -> &'static Mutex<()> {
    MEMORY_IO_LOCK.get_or_init(|| Mutex::new(()))
}

pub(super) fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub(super) fn write_string_atomic(path: &Path, content: &str) -> std::io::Result<()> {
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

pub(super) async fn run_blocking<T, F>(f: F) -> Result<T, String>
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

pub(super) fn get_app_data_dir() -> PathBuf {
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

pub(super) fn read_json_file(path: &Path) -> Value {
    if let Ok(raw) = fs::read_to_string(path) {
        let cleaned = strip_json_comments(&raw);
        if let Ok(val) = serde_json::from_str::<Value>(&cleaned) {
            return val;
        }
    }
    Value::Object(Map::new())
}

pub(super) fn get_app_config_path() -> PathBuf {
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

pub(super) fn set_active_workspace_path_unlocked(new_path: &str) {
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

pub(super) fn set_active_workspace_path(new_path: &str) {
    let _guard = settings_io_lock().lock().unwrap_or_else(|e| e.into_inner());
    set_active_workspace_path_unlocked(new_path);
}

pub(super) fn scanned_note_to_json(n: ScannedNote) -> Value {
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
        "wikilinks": n.wikilinks,
        "properties": n.properties
    })
}

pub(super) fn sanitize_filename(name: &str) -> String {
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

/// Spawns a `Command` without flashing a console window on Windows.
pub(super) fn command_no_window(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}
