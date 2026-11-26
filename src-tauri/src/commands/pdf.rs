//! Tauri IPC commands for Lumina's invisible SQLite FTS5 + Int8 Hybrid PDF Index.

use super::common::{resolve_workspace_path, run_blocking};
use lumina_core::pdf::{
    workspace_pdf_db_path, PdfChunkEmbeddingInput, PdfDocumentStatus, PdfIndexResult,
    PdfIndexStats, PdfIndexStore, PdfPendingChunk, PdfSearchHit,
};
use std::sync::{Mutex, OnceLock};

static PDF_INDEX_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn pdf_index_lock() -> &'static Mutex<()> {
    PDF_INDEX_LOCK.get_or_init(|| Mutex::new(()))
}

fn open_workspace_pdf_store() -> Result<(std::path::PathBuf, std::path::PathBuf, PdfIndexStore), String> {
    let ws_path = resolve_workspace_path();
    let db_path = workspace_pdf_db_path(&ws_path);
    let store = PdfIndexStore::open(&db_path)?;
    Ok((ws_path, db_path, store))
}

#[tauri::command]
pub async fn pdf_index_file(relative_path: String) -> Result<PdfIndexResult, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (ws_path, _, mut store) = open_workspace_pdf_store()?;
        store.index_pdf_file(&ws_path, &relative_path)
    })
    .await
}

#[tauri::command]
pub async fn pdf_get_pending_chunks(
    relative_path: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<PdfPendingChunk>, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (_, _, store) = open_workspace_pdf_store()?;
        store.get_pending_chunks(relative_path.as_deref(), limit.unwrap_or(12))
    })
    .await
}

#[tauri::command]
pub async fn pdf_save_embeddings(entries: Vec<PdfChunkEmbeddingInput>) -> Result<usize, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (_, _, mut store) = open_workspace_pdf_store()?;
        store.save_chunk_embeddings(&entries)
    })
    .await
}

#[tauri::command]
pub async fn pdf_search(
    query: String,
    query_embedding: Option<Vec<f32>>,
    relative_path: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<PdfSearchHit>, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (_, _, store) = open_workspace_pdf_store()?;
        store.search_hybrid(
            &query,
            query_embedding.as_deref(),
            relative_path.as_deref(),
            limit.unwrap_or(8),
        )
    })
    .await
}

#[tauri::command]
pub async fn pdf_get_status(relative_path: String) -> Result<Option<PdfDocumentStatus>, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (_, _, store) = open_workspace_pdf_store()?;
        store.get_document_status(&relative_path)
    })
    .await
}

#[tauri::command]
pub async fn pdf_list_documents() -> Result<Vec<PdfDocumentStatus>, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (_, _, store) = open_workspace_pdf_store()?;
        store.list_documents()
    })
    .await
}

#[tauri::command]
pub async fn pdf_get_stats() -> Result<PdfIndexStats, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (_, db_path, store) = open_workspace_pdf_store()?;
        store.get_stats(Some(&db_path))
    })
    .await
}

#[tauri::command]
pub async fn pdf_remove_document(relative_path: String) -> Result<bool, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (_, _, mut store) = open_workspace_pdf_store()?;
        store.remove_document(&relative_path)
    })
    .await
}

#[tauri::command]
pub async fn pdf_prune_missing() -> Result<usize, String> {
    run_blocking(move || {
        let _guard = pdf_index_lock().lock().unwrap_or_else(|e| e.into_inner());
        let (ws_path, _, mut store) = open_workspace_pdf_store()?;
        store.prune_missing_documents(&ws_path)
    })
    .await
}
