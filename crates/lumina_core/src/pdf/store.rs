//! Embedded SQLite + FTS5 storage and Hybrid Search (BM25 + Int8 Vector RRF)
//! for Lumina's invisible PDF knowledge index.
//!
//! Stored automatically at `<workspace>/.lumina/pdf-index/index.db`.

use super::extractor::{
    chunk_pdf_pages, compute_bytes_sha256, extract_pdf_pages_from_bytes, DEFAULT_CHUNK_MAX_CHARS,
    DEFAULT_CHUNK_OVERLAP_CHARS,
};
use super::vectors::{cosine_similarity_i8_vs_f32, fuse_ranked_lists, quantize_f32_to_i8};
use super::{
    PdfChunkEmbeddingInput, PdfDocumentStatus, PdfIndexResult, PdfIndexStats, PdfPendingChunk,
    PdfSearchHit,
};
use crate::security::safe_join_workspace;
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Relative path inside a Lumina workspace where the invisible SQLite PDF index lives.
pub const PDF_INDEX_REL_PATH: &str = ".lumina/pdf-index/index.db";

fn now_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Normalizes a workspace-relative path to forward slashes without leading slashes.
pub fn normalize_rel_path(path: &str) -> String {
    path.trim()
        .replace('\\', "/")
        .trim_start_matches("./")
        .trim_start_matches('/')
        .to_string()
}

/// Derives a human-readable document title from a relative file path.
fn title_from_rel_path(rel_path: &str) -> String {
    let base = rel_path.rsplit('/').next().unwrap_or(rel_path);
    base.strip_suffix(".pdf")
        .or_else(|| base.strip_suffix(".PDF"))
        .unwrap_or(base)
        .to_string()
}

/// Converts arbitrary plain-English user input into a safe FTS5 MATCH expression.
/// Non-technical users never see SQL or FTS5 syntax; punctuation, quotes, and
/// boolean keywords are sanitized automatically.
pub fn build_safe_fts5_query(raw: &str) -> Option<String> {
    let tokens: Vec<String> = raw
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .map(|t| t.trim())
        .filter(|t| t.chars().count() >= 2)
        .take(12)
        .map(|t| format!("\"{}\"", t.replace('"', "")))
        .collect();

    if tokens.is_empty() {
        return None;
    }

    // Use OR across tokens so multi-word natural-language questions recall relevant pages,
    // while BM25 naturally ranks pages containing MORE matching terms higher!
    Some(tokens.join(" OR "))
}

/// Resolves the SQLite database path for a given workspace root.
pub fn workspace_pdf_db_path(workspace_root: &Path) -> PathBuf {
    workspace_root.join(PDF_INDEX_REL_PATH)
}

/// Dedicated SQLite + FTS5 store for PDF documents, page chunks, and Int8 vectors.
pub struct PdfIndexStore {
    conn: Connection,
}

impl PdfIndexStore {
    /// Opens (or creates) the SQLite database at `db_path` and applies schema migrations.
    pub fn open(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create PDF index directory: {e}"))?;
        }
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open PDF index database: {e}"))?;
        let store = Self { conn };
        store.init_schema()?;
        Ok(store)
    }

    /// Opens an in-memory SQLite database (useful for unit tests).
    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
        let store = Self { conn };
        store.init_schema()?;
        Ok(store)
    }

    fn init_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                r#"
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA foreign_keys = ON;
                PRAGMA busy_timeout = 5000;

                CREATE TABLE IF NOT EXISTS pdf_documents (
                    relative_path TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    file_hash TEXT NOT NULL,
                    file_size INTEGER NOT NULL DEFAULT 0,
                    page_count INTEGER NOT NULL DEFAULT 0,
                    chunk_count INTEGER NOT NULL DEFAULT 0,
                    embedded_count INTEGER NOT NULL DEFAULT 0,
                    indexed_at INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS pdf_chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    relative_path TEXT NOT NULL,
                    page_number INTEGER NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    embedding BLOB,
                    embedding_scale REAL,
                    FOREIGN KEY (relative_path) REFERENCES pdf_documents(relative_path) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_pdf_chunks_path
                    ON pdf_chunks(relative_path, page_number, chunk_index);

                CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pending
                    ON pdf_chunks(relative_path) WHERE embedding IS NULL;

                CREATE VIRTUAL TABLE IF NOT EXISTS pdf_chunks_fts USING fts5(
                    content,
                    relative_path UNINDEXED,
                    page_number UNINDEXED,
                    content='pdf_chunks',
                    content_rowid='id',
                    tokenize='unicode61 remove_diacritics 2'
                );

                CREATE TRIGGER IF NOT EXISTS pdf_chunks_ai AFTER INSERT ON pdf_chunks BEGIN
                    INSERT INTO pdf_chunks_fts(rowid, content, relative_path, page_number)
                    VALUES (new.id, new.content, new.relative_path, new.page_number);
                END;

                CREATE TRIGGER IF NOT EXISTS pdf_chunks_ad AFTER DELETE ON pdf_chunks BEGIN
                    INSERT INTO pdf_chunks_fts(pdf_chunks_fts, rowid, content, relative_path, page_number)
                    VALUES ('delete', old.id, old.content, old.relative_path, old.page_number);
                END;

                CREATE TRIGGER IF NOT EXISTS pdf_chunks_au AFTER UPDATE OF content ON pdf_chunks BEGIN
                    INSERT INTO pdf_chunks_fts(pdf_chunks_fts, rowid, content, relative_path, page_number)
                    VALUES ('delete', old.id, old.content, old.relative_path, old.page_number);
                    INSERT INTO pdf_chunks_fts(rowid, content, relative_path, page_number)
                    VALUES (new.id, new.content, new.relative_path, new.page_number);
                END;
                "#,
            )
            .map_err(|e| format!("Failed to initialize PDF index schema: {e}"))
    }

    /// Indexes a PDF file from disk (Stage 1: instant text extraction + FTS5).
    /// If the file's SHA-256 hash matches what is already stored, returns immediately
    /// without re-extracting or discarding existing embeddings.
    pub fn index_pdf_file(
        &mut self,
        workspace_root: &Path,
        relative_path: &str,
    ) -> Result<PdfIndexResult, String> {
        let norm_rel = normalize_rel_path(relative_path);
        if norm_rel.is_empty() {
            return Err("Empty PDF relative path".to_string());
        }

        let full_path = safe_join_workspace(workspace_root, &norm_rel)?;
        let bytes = fs::read(&full_path)
            .map_err(|e| format!("Failed to read PDF file '{}': {e}", norm_rel))?;

        self.index_pdf_bytes(&norm_rel, &bytes)
    }

    /// Indexes raw PDF bytes under `relative_path`. Skips work if SHA-256 matches.
    pub fn index_pdf_bytes(
        &mut self,
        relative_path: &str,
        bytes: &[u8],
    ) -> Result<PdfIndexResult, String> {
        let norm_rel = normalize_rel_path(relative_path);
        let file_hash = compute_bytes_sha256(bytes);
        let file_size = bytes.len() as i64;
        let title = title_from_rel_path(&norm_rel);

        // Fast path: unchanged file already indexed
        if let Some(existing) = self.get_document_status(&norm_rel)? {
            if existing.file_hash == file_hash {
                return Ok(PdfIndexResult {
                    document: existing,
                    already_indexed: true,
                });
            }
        }

        let (page_count, pages) = extract_pdf_pages_from_bytes(bytes)?;
        let chunks = chunk_pdf_pages(&pages, DEFAULT_CHUNK_MAX_CHARS, DEFAULT_CHUNK_OVERLAP_CHARS);
        let chunk_count = chunks.len() as u32;
        let indexed_at = now_epoch_ms();

        let tx = self
            .conn
            .transaction()
            .map_err(|e| format!("Failed to start PDF index transaction: {e}"))?;

        // Deleting old document cascades to pdf_chunks + FTS5 delete trigger
        tx.execute(
            "DELETE FROM pdf_documents WHERE relative_path = ?1",
            params![norm_rel],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO pdf_documents
                (relative_path, title, file_hash, file_size, page_count, chunk_count, embedded_count, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)",
            params![
                norm_rel,
                title,
                file_hash,
                file_size,
                page_count,
                chunk_count,
                indexed_at
            ],
        )
        .map_err(|e| e.to_string())?;

        {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO pdf_chunks (relative_path, page_number, chunk_index, content)
                     VALUES (?1, ?2, ?3, ?4)",
                )
                .map_err(|e| e.to_string())?;

            for chunk in &chunks {
                stmt.execute(params![
                    norm_rel,
                    chunk.page_number,
                    chunk.chunk_index,
                    chunk.content
                ])
                .map_err(|e| e.to_string())?;
            }
        }

        tx.commit().map_err(|e| e.to_string())?;

        let status = PdfDocumentStatus {
            relative_path: norm_rel,
            title,
            file_hash,
            file_size: file_size as u64,
            page_count,
            chunk_count,
            embedded_count: 0,
            indexed_at,
        };

        Ok(PdfIndexResult {
            document: status,
            already_indexed: false,
        })
    }

    /// Returns chunks that do not yet have embeddings stored (for lazy Stage 2 indexing).
    pub fn get_pending_chunks(
        &self,
        relative_path: Option<&str>,
        limit: usize,
    ) -> Result<Vec<PdfPendingChunk>, String> {
        let cap = limit.clamp(1, 200) as i64;
        let mut results = Vec::new();

        if let Some(rel) = relative_path.map(normalize_rel_path).filter(|s| !s.is_empty()) {
            let mut stmt = self
                .conn
                .prepare(
                    "SELECT id, relative_path, page_number, chunk_index, content
                     FROM pdf_chunks
                     WHERE relative_path = ?1 AND embedding IS NULL
                     ORDER BY page_number ASC, chunk_index ASC
                     LIMIT ?2",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![rel, cap], |row| {
                    Ok(PdfPendingChunk {
                        chunk_id: row.get(0)?,
                        relative_path: row.get(1)?,
                        page_number: row.get(2)?,
                        chunk_index: row.get(3)?,
                        content: row.get(4)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for r in rows {
                results.push(r.map_err(|e| e.to_string())?);
            }
        } else {
            let mut stmt = self
                .conn
                .prepare(
                    "SELECT id, relative_path, page_number, chunk_index, content
                     FROM pdf_chunks
                     WHERE embedding IS NULL
                     ORDER BY id ASC
                     LIMIT ?1",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![cap], |row| {
                    Ok(PdfPendingChunk {
                        chunk_id: row.get(0)?,
                        relative_path: row.get(1)?,
                        page_number: row.get(2)?,
                        chunk_index: row.get(3)?,
                        content: row.get(4)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for r in rows {
                results.push(r.map_err(|e| e.to_string())?);
            }
        }

        Ok(results)
    }

    /// Saves a batch of `f32` chunk embeddings quantized to compact Int8 BLOBs,
    /// updating each affected document's `embedded_count` atomically.
    pub fn save_chunk_embeddings(
        &mut self,
        entries: &[PdfChunkEmbeddingInput],
    ) -> Result<usize, String> {
        if entries.is_empty() {
            return Ok(0);
        }

        let tx = self.conn.transaction().map_err(|e| e.to_string())?;
        let mut updated = 0usize;

        {
            let mut stmt = tx
                .prepare(
                    "UPDATE pdf_chunks
                     SET embedding = ?1, embedding_scale = ?2
                     WHERE id = ?3",
                )
                .map_err(|e| e.to_string())?;

            for entry in entries {
                if entry.embedding.is_empty() {
                    continue;
                }
                let (blob, scale) = quantize_f32_to_i8(&entry.embedding);
                let changed = stmt
                    .execute(params![blob, scale as f64, entry.chunk_id])
                    .map_err(|e| e.to_string())?;
                updated += changed;
            }
        }

        // Refresh embedded_count for all documents in one fast aggregate update
        tx.execute(
            "UPDATE pdf_documents
             SET embedded_count = (
                 SELECT COUNT(*) FROM pdf_chunks
                 WHERE pdf_chunks.relative_path = pdf_documents.relative_path
                   AND pdf_chunks.embedding IS NOT NULL
             )",
            [],
        )
        .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
        Ok(updated)
    }

    /// Hybrid retrieval: combines SQLite FTS5 BM25 keyword search with Int8
    /// cosine similarity via Reciprocal Rank Fusion (RRF).
    ///
    /// - Works instantaneously even before embeddings finish (pure FTS5 fallback).
    /// - When `query_embedding` is provided, seamlessly fuses semantic + keyword hits.
    pub fn search_hybrid(
        &self,
        query: &str,
        query_embedding: Option<&[f32]>,
        relative_path_filter: Option<&str>,
        limit: usize,
    ) -> Result<Vec<PdfSearchHit>, String> {
        let max_results = limit.clamp(1, 50);
        let candidate_cap = (max_results * 4).max(24);
        let rel_filter = relative_path_filter
            .map(normalize_rel_path)
            .filter(|s| !s.is_empty());

        // 1. Keyword candidates via FTS5 BM25
        let mut keyword_ids: Vec<i64> = Vec::new();
        if let Some(fts_query) = build_safe_fts5_query(query) {
            if let Some(ref rel) = rel_filter {
                let mut stmt = self
                    .conn
                    .prepare(
                        "SELECT c.id
                         FROM pdf_chunks_fts f
                         JOIN pdf_chunks c ON c.id = f.rowid
                         WHERE pdf_chunks_fts MATCH ?1 AND c.relative_path = ?2
                         ORDER BY bm25(pdf_chunks_fts) ASC
                         LIMIT ?3",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![fts_query, rel, candidate_cap as i64], |r| r.get(0))
                    .map_err(|e| e.to_string())?;
                for r in rows.flatten() {
                    keyword_ids.push(r);
                }
            } else {
                let mut stmt = self
                    .conn
                    .prepare(
                        "SELECT c.id
                         FROM pdf_chunks_fts f
                         JOIN pdf_chunks c ON c.id = f.rowid
                         WHERE pdf_chunks_fts MATCH ?1
                         ORDER BY bm25(pdf_chunks_fts) ASC
                         LIMIT ?2",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![fts_query, candidate_cap as i64], |r| r.get(0))
                    .map_err(|e| e.to_string())?;
                for r in rows.flatten() {
                    keyword_ids.push(r);
                }
            }
        }

        // 2. Semantic candidates via Int8 cosine similarity
        let mut semantic_scored: Vec<(i64, f32)> = Vec::new();
        if let Some(q_vec) = query_embedding.filter(|v| !v.is_empty()) {
            if let Some(ref rel) = rel_filter {
                let mut stmt = self
                    .conn
                    .prepare(
                        "SELECT id, embedding, embedding_scale
                         FROM pdf_chunks
                         WHERE relative_path = ?1 AND embedding IS NOT NULL AND embedding_scale IS NOT NULL",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![rel], |r| {
                        Ok((r.get::<_, i64>(0)?, r.get::<_, Vec<u8>>(1)?, r.get::<_, f64>(2)?))
                    })
                    .map_err(|e| e.to_string())?;
                for row in rows.flatten() {
                    let sim = cosine_similarity_i8_vs_f32(&row.1, row.2 as f32, q_vec);
                    if sim >= 0.22 {
                        semantic_scored.push((row.0, sim));
                    }
                }
            } else {
                let mut stmt = self
                    .conn
                    .prepare(
                        "SELECT id, embedding, embedding_scale
                         FROM pdf_chunks
                         WHERE embedding IS NOT NULL AND embedding_scale IS NOT NULL",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map([], |r| {
                        Ok((r.get::<_, i64>(0)?, r.get::<_, Vec<u8>>(1)?, r.get::<_, f64>(2)?))
                    })
                    .map_err(|e| e.to_string())?;
                for row in rows.flatten() {
                    let sim = cosine_similarity_i8_vs_f32(&row.1, row.2 as f32, q_vec);
                    if sim >= 0.22 {
                        semantic_scored.push((row.0, sim));
                    }
                }
            }

            semantic_scored.sort_by(|a, b| {
                b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal)
            });
            semantic_scored.truncate(candidate_cap);
        }

        let semantic_ids: Vec<i64> = semantic_scored.iter().map(|(id, _)| *id).collect();
        let fused = fuse_ranked_lists(&keyword_ids, &semantic_ids, max_results);

        if fused.is_empty() {
            return Ok(Vec::new());
        }

        // 3. Hydrate top fused chunk metadata + text
        let mut hydrated: HashMap<i64, (String, String, u32, u32, String)> = HashMap::new();
        let mut stmt = self
            .conn
            .prepare(
                "SELECT c.id, c.relative_path, d.title, c.page_number, c.chunk_index, c.content
                 FROM pdf_chunks c
                 JOIN pdf_documents d ON d.relative_path = c.relative_path
                 WHERE c.id = ?1",
            )
            .map_err(|e| e.to_string())?;

        for &(chunk_id, _, _) in &fused {
            if let Some(row) = stmt
                .query_row(params![chunk_id], |r| {
                    Ok((
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, u32>(3)?,
                        r.get::<_, u32>(4)?,
                        r.get::<_, String>(5)?,
                    ))
                })
                .optional()
                .map_err(|e| e.to_string())?
            {
                hydrated.insert(chunk_id, row);
            }
        }

        let mut hits = Vec::with_capacity(fused.len());
        for (chunk_id, score, match_kind) in fused {
            if let Some((relative_path, title, page_number, chunk_index, content)) =
                hydrated.remove(&chunk_id)
            {
                hits.push(PdfSearchHit {
                    chunk_id,
                    relative_path,
                    title,
                    page_number,
                    chunk_index,
                    content,
                    score,
                    match_kind: match_kind.as_str().to_string(),
                });
            }
        }

        Ok(hits)
    }

    /// Returns indexing status for a single PDF document, if indexed.
    pub fn get_document_status(
        &self,
        relative_path: &str,
    ) -> Result<Option<PdfDocumentStatus>, String> {
        let norm_rel = normalize_rel_path(relative_path);
        self.conn
            .query_row(
                "SELECT relative_path, title, file_hash, file_size, page_count, chunk_count, embedded_count, indexed_at
                 FROM pdf_documents
                 WHERE relative_path = ?1",
                params![norm_rel],
                |r| {
                    Ok(PdfDocumentStatus {
                        relative_path: r.get(0)?,
                        title: r.get(1)?,
                        file_hash: r.get(2)?,
                        file_size: r.get::<_, i64>(3)?.max(0) as u64,
                        page_count: r.get(4)?,
                        chunk_count: r.get(5)?,
                        embedded_count: r.get(6)?,
                        indexed_at: r.get(7)?,
                    })
                },
            )
            .optional()
            .map_err(|e| e.to_string())
    }

    /// Lists all indexed PDF documents ordered by most recently indexed.
    pub fn list_documents(&self) -> Result<Vec<PdfDocumentStatus>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT relative_path, title, file_hash, file_size, page_count, chunk_count, embedded_count, indexed_at
                 FROM pdf_documents
                 ORDER BY indexed_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok(PdfDocumentStatus {
                    relative_path: r.get(0)?,
                    title: r.get(1)?,
                    file_hash: r.get(2)?,
                    file_size: r.get::<_, i64>(3)?.max(0) as u64,
                    page_count: r.get(4)?,
                    chunk_count: r.get(5)?,
                    embedded_count: r.get(6)?,
                    indexed_at: r.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut docs = Vec::new();
        for r in rows {
            docs.push(r.map_err(|e| e.to_string())?);
        }
        Ok(docs)
    }

    /// Returns aggregate index statistics across all indexed PDFs.
    pub fn get_stats(&self, db_path: Option<&Path>) -> Result<PdfIndexStats, String> {
        let (total_documents, total_pages, total_chunks, embedded_chunks): (u32, u32, u32, u32) =
            self.conn
                .query_row(
                    "SELECT
                        COUNT(*),
                        COALESCE(SUM(page_count), 0),
                        COALESCE(SUM(chunk_count), 0),
                        COALESCE(SUM(embedded_count), 0)
                     FROM pdf_documents",
                    [],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
                )
                .map_err(|e| e.to_string())?;

        let db_size_bytes = db_path
            .and_then(|p| fs::metadata(p).ok())
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(PdfIndexStats {
            total_documents,
            total_pages,
            total_chunks,
            embedded_chunks,
            db_size_bytes,
        })
    }

    /// Removes a PDF and all its chunks/FTS5 entries from the index.
    pub fn remove_document(&mut self, relative_path: &str) -> Result<bool, String> {
        let norm_rel = normalize_rel_path(relative_path);
        let deleted = self
            .conn
            .execute(
                "DELETE FROM pdf_documents WHERE relative_path = ?1",
                params![norm_rel],
            )
            .map_err(|e| e.to_string())?;
        Ok(deleted > 0)
    }

    /// Removes index entries whose backing PDF files no longer exist in `workspace_root`.
    pub fn prune_missing_documents(&mut self, workspace_root: &Path) -> Result<usize, String> {
        let docs = self.list_documents()?;
        let mut removed = 0usize;
        for doc in docs {
            let exists = safe_join_workspace(workspace_root, &doc.relative_path)
                .map(|p| p.exists())
                .unwrap_or(false);
            if !exists && self.remove_document(&doc.relative_path)? {
                removed += 1;
            }
        }
        Ok(removed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, Stream};

    fn make_pdf(pages: &[&str]) -> Vec<u8> {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! { "F1" => font_id },
        });
        let mut kids = Vec::new();
        for text in pages {
            let content = Content {
                operations: vec![
                    Operation::new("BT", vec![]),
                    Operation::new("Tf", vec!["F1".into(), 12.into()]),
                    Operation::new("Td", vec![50.into(), 700.into()]),
                    Operation::new("Tj", vec![Object::string_literal(*text)]),
                    Operation::new("ET", vec![]),
                ],
            };
            let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content_id,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            });
            kids.push(page_id.into());
        }
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => kids,
                "Count" => pages.len() as i64,
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        let mut out = Vec::new();
        doc.save_to(&mut out).unwrap();
        out
    }

    #[test]
    fn indexes_deduplicates_and_searches_hybrid() {
        let mut store = PdfIndexStore::open_in_memory().unwrap();
        let pdf = make_pdf(&[
            "Transformers replace recurrence with multi-head self-attention.",
            "Table 3 reports BLEU score 28.4 on WMT14 English-to-German.",
        ]);

        let first = store.index_pdf_bytes("papers/attention.pdf", &pdf).unwrap();
        assert!(!first.already_indexed);
        assert_eq!(first.document.page_count, 2);
        assert_eq!(first.document.chunk_count, 2);
        assert_eq!(first.document.embedded_count, 0);

        // Re-indexing identical bytes skips work
        let second = store.index_pdf_bytes("papers/attention.pdf", &pdf).unwrap();
        assert!(second.already_indexed);

        // Keyword FTS5 search works immediately with punctuation/symbols
        let kw_hits = store
            .search_hybrid("What is in Table 3? (BLEU!)", None, None, 5)
            .unwrap();
        assert_eq!(kw_hits.len(), 1);
        assert_eq!(kw_hits[0].page_number, 2);
        assert_eq!(kw_hits[0].match_kind, "keyword");

        // Save Int8 embeddings for pending chunks
        let pending = store
            .get_pending_chunks(Some("papers/attention.pdf"), 10)
            .unwrap();
        assert_eq!(pending.len(), 2);

        let saved = store
            .save_chunk_embeddings(&[
                PdfChunkEmbeddingInput {
                    chunk_id: pending[0].chunk_id,
                    embedding: vec![1.0, 0.0, 0.0, 0.0],
                },
                PdfChunkEmbeddingInput {
                    chunk_id: pending[1].chunk_id,
                    embedding: vec![0.0, 1.0, 0.0, 0.0],
                },
            ])
            .unwrap();
        assert_eq!(saved, 2);

        let status = store
            .get_document_status("papers/attention.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(status.embedded_count, 2);

        // Hybrid search combines semantic + keyword hits
        let hybrid_hits = store
            .search_hybrid("self-attention", Some(&[0.98, 0.05, 0.0, 0.0]), None, 5)
            .unwrap();
        assert!(!hybrid_hits.is_empty());
        assert_eq!(hybrid_hits[0].page_number, 1);
        assert_eq!(hybrid_hits[0].match_kind, "hybrid");

        // Semantic-only query (no keyword overlap) still finds the right page
        let sem_hits = store
            .search_hybrid("translation benchmark", Some(&[0.0, 0.99, 0.0, 0.0]), None, 5)
            .unwrap();
        assert_eq!(sem_hits.len(), 1);
        assert_eq!(sem_hits[0].page_number, 2);
        assert_eq!(sem_hits[0].match_kind, "semantic");

        // Delete cascades cleanly
        assert!(store.remove_document("papers/attention.pdf").unwrap());
        let after = store
            .search_hybrid("Table 3", Some(&[0.0, 1.0, 0.0, 0.0]), None, 5)
            .unwrap();
        assert!(after.is_empty());
    }

    #[test]
    fn fts5_query_sanitizer_handles_special_characters() {
        assert_eq!(
            build_safe_fts5_query("What's Eq. (4.2) & NOT: foo-bar?"),
            Some("\"What\" OR \"Eq\" OR \"NOT\" OR \"foo\" OR \"bar\"".to_string())
        );
        assert_eq!(build_safe_fts5_query("??? --- !"), None);
    }
}
