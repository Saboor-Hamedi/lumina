//! Pure-Rust per-page PDF text extraction, normalization, content hashing,
//! and page-aware chunking.

use lopdf::Document;
use sha2::{Digest, Sha256};

/// Default chunk size (~300–400 tokens for MiniLM / modern LLMs).
pub const DEFAULT_CHUNK_MAX_CHARS: usize = 1200;
/// Overlap between consecutive chunks on the same page to preserve context.
pub const DEFAULT_CHUNK_OVERLAP_CHARS: usize = 180;

/// Extracted text for a single 1-based PDF page.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractedPage {
    pub page_number: u32,
    pub text: String,
}

/// A single page-tagged text chunk ready for SQLite FTS5 indexing and embedding.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PdfChunkInput {
    pub page_number: u32,
    pub chunk_index: u32,
    pub content: String,
}

/// Computes a hex-encoded SHA-256 digest of raw file bytes so unchanged PDFs
/// are skipped instantaneously on re-index.
pub fn compute_bytes_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

/// Cleans raw PDF-extracted text by removing NUL/control noise, collapsing
/// excessive spaces, and normalizing line endings while preserving paragraphs.
pub fn normalize_page_text(raw: &str) -> String {
    let mut cleaned = String::with_capacity(raw.len());
    let mut prev_space = false;
    let mut newline_run = 0usize;

    for ch in raw.chars() {
        if ch == '\0' {
            continue;
        }
        if ch == '\r' {
            continue;
        }
        if ch == '\n' {
            newline_run += 1;
            if newline_run <= 2 {
                cleaned.push('\n');
            }
            prev_space = true;
            continue;
        }
        if ch.is_control() && ch != '\t' {
            continue;
        }
        if ch.is_whitespace() {
            if !prev_space && !cleaned.is_empty() {
                cleaned.push(' ');
                prev_space = true;
            }
            continue;
        }
        newline_run = 0;
        prev_space = false;
        cleaned.push(ch);
    }

    cleaned.trim().to_string()
}

/// Extracts text page-by-page from raw PDF bytes using `lopdf`.
/// Pages with no extractable text (e.g. image-only cover pages) are skipped in
/// the chunk list while `page_count` still reflects the full PDF page count.
pub fn extract_pdf_pages_from_bytes(bytes: &[u8]) -> Result<(u32, Vec<ExtractedPage>), String> {
    let doc = Document::load_mem(bytes).map_err(|e| format!("Failed to parse PDF: {e}"))?;
    let pages_map = doc.get_pages();
    let total_pages = pages_map.len() as u32;
    let mut extracted = Vec::with_capacity(pages_map.len());

    for &page_num in pages_map.keys() {
        if let Ok(raw_text) = doc.extract_text(&[page_num]) {
            let text = normalize_page_text(&raw_text);
            if !text.is_empty() {
                extracted.push(ExtractedPage {
                    page_number: page_num,
                    text,
                });
            }
        }
    }

    Ok((total_pages, extracted))
}

/// Splits extracted pages into clean, page-aware chunks with sentence/word
/// boundary snapping and configurable overlap.
pub fn chunk_pdf_pages(
    pages: &[ExtractedPage],
    max_chars: usize,
    overlap_chars: usize,
) -> Vec<PdfChunkInput> {
    let max_len = max_chars.max(200);
    let overlap = overlap_chars.min(max_len / 3);
    let mut chunks = Vec::new();

    for page in pages {
        let text = page.text.trim();
        if text.is_empty() {
            continue;
        }

        let chars: Vec<char> = text.chars().collect();
        if chars.len() <= max_len {
            chunks.push(PdfChunkInput {
                page_number: page.page_number,
                chunk_index: 0,
                content: text.to_string(),
            });
            continue;
        }

        let mut start = 0usize;
        let mut chunk_idx = 0u32;

        while start < chars.len() {
            let target_end = (start + max_len).min(chars.len());
            let end = if target_end < chars.len() {
                find_clean_break(&chars, start, target_end)
            } else {
                target_end
            };

            let slice: String = chars[start..end].iter().collect();
            let trimmed = slice.trim();
            if !trimmed.is_empty() {
                chunks.push(PdfChunkInput {
                    page_number: page.page_number,
                    chunk_index: chunk_idx,
                    content: trimmed.to_string(),
                });
                chunk_idx += 1;
            }

            if end >= chars.len() {
                break;
            }

            let next_start = end.saturating_sub(overlap);
            start = if next_start <= start { end } else { next_start };
        }
    }

    chunks
}

/// Prefers breaking at a paragraph, sentence end, or whitespace within the
/// final 25% of the chunk window so chunks read cleanly.
fn find_clean_break(chars: &[char], start: usize, target_end: usize) -> usize {
    let min_break = start + ((target_end - start) * 3) / 4;

    // 1. Prefer paragraph / newline break
    for i in (min_break..target_end).rev() {
        if chars[i] == '\n' {
            return i + 1;
        }
    }

    // 2. Prefer sentence boundary
    for i in (min_break..target_end).rev() {
        if matches!(chars[i], '.' | '!' | '?')
            && i + 1 < chars.len()
            && chars[i + 1].is_whitespace()
        {
            return i + 1;
        }
    }

    // 3. Fallback to word whitespace
    for i in (min_break..target_end).rev() {
        if chars[i].is_whitespace() {
            return i + 1;
        }
    }

    target_end
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Object, Stream};

    fn build_sample_pdf_bytes(page_texts: &[&str]) -> Vec<u8> {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });

        let mut kids = Vec::new();
        for text in page_texts {
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

        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => page_texts.len() as i64,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages));
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
    fn extracts_multiple_pages_in_order() {
        let bytes = build_sample_pdf_bytes(&[
            "Quantum error correction relies on stabilizer codes.",
            "Surface codes achieve high fault tolerance thresholds.",
        ]);
        let (total, pages) = extract_pdf_pages_from_bytes(&bytes).unwrap();
        assert_eq!(total, 2);
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0].page_number, 1);
        assert!(pages[0].text.contains("Quantum error correction"));
        assert_eq!(pages[1].page_number, 2);
        assert!(pages[1].text.contains("Surface codes"));
    }

    #[test]
    fn chunks_long_pages_with_overlap_and_page_metadata() {
        let long_text = "Attention mechanisms allow models to focus on relevant tokens. ".repeat(40);
        let pages = vec![ExtractedPage {
            page_number: 7,
            text: long_text,
        }];
        let chunks = chunk_pdf_pages(&pages, 500, 80);
        assert!(chunks.len() >= 4);
        assert!(chunks.iter().all(|c| c.page_number == 7));
        assert_eq!(chunks[0].chunk_index, 0);
        assert_eq!(chunks[1].chunk_index, 1);
    }

    #[test]
    fn normalizes_whitespace_and_control_chars() {
        let cleaned = normalize_page_text("  Hello\0   world\r\n\r\n\r\nSecond\t\tline  ");
        assert_eq!(cleaned, "Hello world\n\nSecond line");
    }
}
