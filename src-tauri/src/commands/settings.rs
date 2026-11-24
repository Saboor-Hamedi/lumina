//! Encrypted application settings and persistent AI memory commands.

use super::common::{
    get_app_config_path, get_app_data_dir, memory_io_lock, read_json_file, resolve_workspace_path,
    run_blocking, set_active_workspace_path_unlocked, settings_io_lock, write_string_atomic,
};
use serde_json::{json, Map, Value};
use std::fs;

// ──────────────────────────────────────────────────────────────────────────────
// Settings & Memory Tauri Commands
// ──────────────────────────────────────────────────────────────────────────────

fn settings_master_key() -> [u8; 32] {
    lumina_core::secrets::load_or_create_master_key(&get_app_data_dir())
}

pub(super) fn get_setting_sync(key: Option<String>) -> Result<Value, String> {
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

pub(super) fn save_setting_sync(key: String, value: Value) -> Result<bool, String> {
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
