//! Lumina PDF Knowledge Index subsystem.
//!
//! Cleanly separated into three focused modules:
//! - `extractor` — Pure-Rust per-page PDF text extraction, normalization, SHA-256 hashing, and chunking.
//! - `vectors`   — Compact Int8 symmetric vector quantization (~4x smaller) and RRF rank fusion.
//! - `store`     — Embedded SQLite + FTS5 persistence and hybrid (BM25 + vector) search.

pub mod extractor;
pub mod store;
pub mod vectors;

use serde::{Deserialize, Serialize};

pub use store::{workspace_pdf_db_path, PdfIndexStore, PDF_INDEX_REL_PATH};

/// Status and metadata for a single indexed PDF document.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfDocumentStatus {
    pub relative_path: String,
    pub title: String,
    pub file_hash: String,
    pub file_size: u64,
    pub page_count: u32,
    pub chunk_count: u32,
    pub embedded_count: u32,
    pub indexed_at: i64,
}

/// Result returned when indexing a PDF file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfIndexResult {
    pub document: PdfDocumentStatus,
    pub already_indexed: bool,
}

/// A chunk awaiting background vector embedding.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfPendingChunk {
    pub chunk_id: i64,
    pub relative_path: String,
    pub page_number: u32,
    pub chunk_index: u32,
    pub content: String,
}

/// Input payload for saving a computed embedding for a chunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfChunkEmbeddingInput {
    pub chunk_id: i64,
    pub embedding: Vec<f32>,
}

/// A ranked page-cited hit returned by hybrid PDF search.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfSearchHit {
    pub chunk_id: i64,
    pub relative_path: String,
    pub title: String,
    pub page_number: u32,
    pub chunk_index: u32,
    pub content: String,
    pub score: f64,
    pub match_kind: String,
}

/// Aggregate statistics across the workspace's PDF index.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfIndexStats {
    pub total_documents: u32,
    pub total_pages: u32,
    pub total_chunks: u32,
    pub embedded_chunks: u32,
    pub db_size_bytes: u64,
}
