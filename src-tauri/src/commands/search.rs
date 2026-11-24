//! Full-text workspace search, knowledge graph construction, and workspace-scoped file I/O.

use super::common::{mark_internal_workspace_write, resolve_workspace_path, run_blocking};
use lumina_core::{
    build_graph_data_impl, ensure_not_workspace_root, safe_join_workspace, scan_vault_impl,
    search_notes_impl, GraphData, NoteInput, SearchHit, SearchIndexItem,
};
use std::fs;

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
