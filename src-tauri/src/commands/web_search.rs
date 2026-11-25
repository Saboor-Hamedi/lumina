//! Native Tauri IPC command for Lumina AI live web search.

use lumina_core::web_search::{search_web_impl, WebSearchResponse};

use super::common::run_blocking;

/// Perform a live CORS-free web search from the native Rust backend.
#[tauri::command]
pub async fn web_search(
    query: String,
    max_results: Option<u32>,
) -> Result<WebSearchResponse, String> {
    let limit = max_results.unwrap_or(6) as usize;
    run_blocking(move || search_web_impl(&query, limit)).await
}
