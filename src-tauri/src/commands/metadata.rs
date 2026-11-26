//! Tauri IPC commands for per-note structured metadata backed by Rust SQLite.

use super::common::{resolve_workspace_path, run_blocking};
use lumina_core::{workspace_metadata_db_path, NoteMetadataEntry, NoteMetadataStore};
use std::sync::{Mutex, OnceLock};

static METADATA_DB_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn metadata_db_lock() -> &'static Mutex<()> {
    METADATA_DB_LOCK.get_or_init(|| Mutex::new(()))
}

fn open_workspace_metadata_store() -> Result<NoteMetadataStore, String> {
    let ws_path = resolve_workspace_path();
    let db_path = workspace_metadata_db_path(&ws_path);
    NoteMetadataStore::open(&db_path)
}

#[tauri::command]
pub async fn metadata_get(note_id: String) -> Result<Vec<NoteMetadataEntry>, String> {
    run_blocking(move || {
        let _guard = metadata_db_lock().lock().unwrap_or_else(|e| e.into_inner());
        let store = open_workspace_metadata_store()?;
        store.get_note_metadata(&note_id)
    })
    .await
}

#[tauri::command]
pub async fn metadata_upsert(
    note_id: String,
    key: String,
    prop_type: String,
    value: String,
    position: Option<i64>,
) -> Result<Vec<NoteMetadataEntry>, String> {
    run_blocking(move || {
        let _guard = metadata_db_lock().lock().unwrap_or_else(|e| e.into_inner());
        let store = open_workspace_metadata_store()?;
        store.upsert_note_metadata(&note_id, &key, &prop_type, &value, position)
    })
    .await
}

#[tauri::command]
pub async fn metadata_delete(
    note_id: String,
    key: String,
) -> Result<Vec<NoteMetadataEntry>, String> {
    run_blocking(move || {
        let _guard = metadata_db_lock().lock().unwrap_or_else(|e| e.into_inner());
        let store = open_workspace_metadata_store()?;
        store.delete_note_metadata(&note_id, &key)
    })
    .await
}

#[tauri::command]
pub async fn metadata_clear_note(note_id: String) -> Result<usize, String> {
    run_blocking(move || {
        let _guard = metadata_db_lock().lock().unwrap_or_else(|e| e.into_inner());
        let store = open_workspace_metadata_store()?;
        store.clear_note_metadata(&note_id)
    })
    .await
}

#[tauri::command]
pub async fn metadata_reorder(
    note_id: String,
    ordered_keys: Vec<String>,
) -> Result<Vec<NoteMetadataEntry>, String> {
    run_blocking(move || {
        let _guard = metadata_db_lock().lock().unwrap_or_else(|e| e.into_inner());
        let mut store = open_workspace_metadata_store()?;
        store.reorder_note_metadata(&note_id, &ordered_keys)
    })
    .await
}

#[tauri::command]
pub async fn metadata_get_layout(note_id: String) -> Result<i64, String> {
    run_blocking(move || {
        let _guard = metadata_db_lock().lock().unwrap_or_else(|e| e.into_inner());
        let store = open_workspace_metadata_store()?;
        store.get_note_layout_columns(&note_id)
    })
    .await
}

#[tauri::command]
pub async fn metadata_set_layout(note_id: String, columns: i64) -> Result<i64, String> {
    run_blocking(move || {
        let _guard = metadata_db_lock().lock().unwrap_or_else(|e| e.into_inner());
        let store = open_workspace_metadata_store()?;
        store.set_note_layout_columns(&note_id, columns)
    })
    .await
}
