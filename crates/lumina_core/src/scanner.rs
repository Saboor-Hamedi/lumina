use napi_derive::napi;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[napi(object)]
pub struct ScannedNote {
    pub id: String,
    pub title: String,
    pub code: String,
    pub language: String,
    pub tags: String,
    pub timestamp: f64,
    pub created_at: Option<String>,
    pub is_pinned: bool,
    pub is_learned: bool,
    pub custom_icon: Option<String>,
    pub color: Option<String>,
    pub note_type: String, // "snippet", "canvas", "image", "pdf"
    pub is_draft: u32,
    pub file_name: String,
    pub folder_id: String,
    pub relative_path: String,
    pub size: f64,
    pub is_oversized: bool,
    pub ext: String,
    pub wikilinks: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[napi(object)]
pub struct ScanResult {
    pub notes: Vec<ScannedNote>,
    pub folders: Vec<String>,
    pub total_scanned: u32,
    pub elapsed_ms: f64,
}

#[derive(Default, Debug, Clone)]
pub struct ParsedFrontmatter {
    pub id: Option<String>,
    pub title: Option<String>,
    pub language: Option<String>,
    pub tags: Vec<String>,
    pub timestamp: Option<f64>,
    pub created_at: Option<String>,
    pub is_pinned: bool,
    pub is_learned: bool,
    pub custom_icon: Option<String>,
    pub color: Option<String>,
}

fn is_known_metadata_key(key: &str) -> bool {
    matches!(
        key.to_lowercase().as_str(),
        "id" | "title" | "language" | "tags" | "selection" | "ispinned" | "pinned"
            | "islearned" | "learned" | "customicon" | "icon" | "createdat"
            | "created_at" | "timestamp" | "color" | "type" | "folderid" | "folder_id"
    )
}

fn parse_yaml_line(line: &str, fm: &mut ParsedFrontmatter) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return false;
    }

    if let Some((k, v)) = trimmed.split_once(':') {
        let key = k.trim().to_lowercase();
        let raw_val = v.trim().trim_matches('"').trim_matches('\'').to_string();

        match key.as_str() {
            "id" => {
                if !raw_val.is_empty() && raw_val != "null" {
                    fm.id = Some(raw_val);
                }
            }
            "title" => {
                if !raw_val.is_empty() && raw_val != "null" {
                    fm.title = Some(raw_val);
                }
            }
            "language" => {
                if !raw_val.is_empty() && raw_val != "null" {
                    fm.language = Some(raw_val);
                }
            }
            "pinned" | "ispinned" => {
                fm.is_pinned = raw_val == "true" || raw_val == "1";
            }
            "learned" | "islearned" => {
                fm.is_learned = raw_val == "true" || raw_val == "1";
            }
            "color" => {
                if !raw_val.is_empty() && raw_val != "null" {
                    fm.color = Some(raw_val);
                }
            }
            "icon" | "customicon" => {
                if !raw_val.is_empty() && raw_val != "null" && raw_val != "undefined" {
                    fm.custom_icon = Some(raw_val);
                }
            }
            "createdat" | "created_at" => {
                if !raw_val.is_empty() && raw_val != "null" {
                    fm.created_at = Some(raw_val);
                }
            }
            "timestamp" => {
                if let Ok(ts) = raw_val.parse::<f64>() {
                    fm.timestamp = Some(ts);
                }
            }
            "tags" => {
                let clean = raw_val.trim_start_matches('[').trim_end_matches(']');
                for t in clean.split(',') {
                    let t = t.trim().trim_matches('"').trim_matches('\'');
                    if !t.is_empty() {
                        fm.tags.push(t.to_string());
                    }
                }
            }
            _ => {}
        }
        return is_known_metadata_key(&key);
    }
    false
}

/// Robust frontmatter extractor:
/// 1. Strips UTF-8 BOM
/// 2. Handles standard `---...---` blocks (including CRLF, whitespace, repeated blocks)
/// 3. Detects and strips loose metadata key-value blocks at the start of files
pub fn extract_and_strip_frontmatter(raw: &str) -> (ParsedFrontmatter, &str) {
    let mut fm = ParsedFrontmatter::default();
    let mut content = raw.strip_prefix('\u{feff}').unwrap_or(raw);

    // 1. Strip any standard `---...---` blocks
    loop {
        let trimmed_leading = content.trim_start_matches(|c| c == '\r' || c == '\n' || c == ' ' || c == '\t');
        if !trimmed_leading.starts_with("---") {
            break;
        }

        let after_first_dashes = &trimmed_leading[3..];
        let newline_pos = match after_first_dashes.find('\n') {
            Some(pos) => pos,
            None => break,
        };
        let first_line_tail = after_first_dashes[..newline_pos].trim();
        if !first_line_tail.is_empty() {
            break;
        }

        let inner_and_rest = &after_first_dashes[newline_pos + 1..];
        let mut closing_found = None;
        let mut search_idx = 0;

        while let Some(pos) = inner_and_rest[search_idx..].find("\n---") {
            let abs_pos = search_idx + pos;
            let after_closing_dash = &inner_and_rest[abs_pos + 4..];
            let line_end = after_closing_dash.find('\n').unwrap_or(after_closing_dash.len());
            let line_tail = after_closing_dash[..line_end].trim();
            if line_tail.is_empty() {
                closing_found = Some((abs_pos, abs_pos + 4 + line_end));
                break;
            }
            search_idx = abs_pos + 4;
        }

        if let Some((yaml_end, next_content_start)) = closing_found {
            let yaml_block = &inner_and_rest[..yaml_end];
            for line in yaml_block.lines() {
                parse_yaml_line(line, &mut fm);
            }
            let mut next = &inner_and_rest[next_content_start..];
            if next.starts_with('\n') {
                next = &next[1..];
            }
            content = next;
        } else {
            break;
        }
    }

    // 2. Strip any loose metadata block at the top of content
    let mut byte_offset = 0;
    let mut in_loose_metadata = false;

    for line in content.split_inclusive('\n') {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if in_loose_metadata {
                byte_offset += line.len();
                continue;
            } else {
                byte_offset += line.len();
                continue;
            }
        }

        if let Some((k, _)) = trimmed.split_once(':') {
            let key = k.trim();
            if is_known_metadata_key(key) {
                in_loose_metadata = true;
                parse_yaml_line(trimmed, &mut fm);
                byte_offset += line.len();
                continue;
            }
        }

        break;
    }

    if in_loose_metadata {
        content = &content[byte_offset..];
    }

    let clean_body = content.trim_start_matches(|c| c == '\r' || c == '\n');
    (fm, clean_body)
}

/// Extract first markdown H1 (# Title)
fn extract_first_heading(body: &str) -> Option<String> {
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return Some(trimmed[2..].trim().to_string());
        }
    }
    None
}

/// Extract [[wikilinks]] from content
fn extract_wikilinks(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut start = 0;
    while let Some(open) = content[start..].find("[[") {
        let open_idx = start + open + 2;
        if let Some(close) = content[open_idx..].find("]]") {
            let target = &content[open_idx..open_idx + close];
            // Handle piped links: [[Target|Alias]]
            let link = target.split('|').next().unwrap_or(target).trim();
            if !link.is_empty() {
                links.push(link.to_string());
            }
            start = open_idx + close + 2;
        } else {
            break;
        }
    }
    links
}

/// Multithreaded parallel vault scanner using Rayon
pub fn scan_vault_impl(vault_path_str: &str, max_bytes: usize) -> ScanResult {
    let start_time = std::time::Instant::now();
    let root = Path::new(vault_path_str);

    if !root.exists() || !root.is_dir() {
        return ScanResult {
            notes: Vec::new(),
            folders: Vec::new(),
            total_scanned: 0,
            elapsed_ms: 0.0,
        };
    }

    // 1. Fast directory entry collection ignoring hidden / junk paths
    let mut file_entries = Vec::new();
    let mut folders = Vec::new();

    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy();
            !name.starts_with('.') 
                && name != "node_modules" 
                && name != "dist" 
                && name != "out" 
                && name != "$RECYCLE.BIN"
        })
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_dir() {
            if entry.path() != root {
                if let Ok(rel) = entry.path().strip_prefix(root) {
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    if !rel_str.is_empty() {
                        folders.push(rel_str);
                    }
                }
            }
        } else if entry.file_type().is_file() {
            file_entries.push(entry.into_path());
        }
    }

    // 2. Multithreaded parsing across all CPU cores with Rayon
    let notes: Vec<ScannedNote> = file_entries
        .par_iter()
        .filter_map(|path| {
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();

            let file_name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            let note_type = match ext.as_str() {
                "md" | "markdown" | "txt" => "snippet",
                "canvas" => "canvas",
                "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp" | "ico" | "avif" => "image",
                "pdf" => "pdf",
                _ => return None, // ignore unrecognized extensions
            };

            let metadata = fs::metadata(path).ok()?;
            let size = metadata.len();
            let is_oversized = size > max_bytes as u64;

            let mtime_ms = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as f64)
                .unwrap_or(0.0);

            // Calculate relative path and folder_id
            let rel_path = path
                .strip_prefix(root)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");

            let folder_id = if let Some(parent) = path.parent().and_then(|p| p.strip_prefix(root).ok()) {
                let p = parent.to_string_lossy().replace('\\', "/");
                if p.is_empty() {
                    String::new()
                } else {
                    p
                }
            } else {
                String::new()
            };

            let ext_with_dot = if ext.is_empty() {
                String::new()
            } else {
                format!(".{}", ext)
            };

            // Non-text files return lightweight metadata
            if note_type != "snippet" && note_type != "canvas" {
                let prefix = if note_type == "image" { "img" } else { "pdf" };
                let id = format!("{}-{:032x}", prefix, md5_hash(&rel_path));
                let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(&file_name).to_string();

                return Some(ScannedNote {
                    id,
                    title: stem,
                    code: String::new(),
                    language: ext.clone(),
                    tags: String::new(),
                    timestamp: mtime_ms,
                    created_at: None,
                    is_pinned: false,
                    is_learned: false,
                    custom_icon: None,
                    color: None,
                    note_type: note_type.to_string(),
                    is_draft: 0,
                    file_name,
                    folder_id,
                    relative_path: rel_path,
                    size: size as f64,
                    is_oversized,
                    ext: ext_with_dot,
                    wikilinks: Vec::new(),
                });
            }

            // Read text content
            let content = if is_oversized {
                String::new()
            } else {
                fs::read_to_string(path).unwrap_or_default()
            };

            let (fm, body) = extract_and_strip_frontmatter(&content);

            let title = fm
                .title
                .or_else(|| extract_first_heading(body))
                .unwrap_or_else(|| {
                    path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or(&file_name)
                        .to_string()
                });

            let id = fm.id.unwrap_or_else(|| format!("note-{:032x}", md5_hash(&rel_path)));
            let wikilinks = extract_wikilinks(&content);
            let tags_str = fm.tags.join(", ");
            let final_timestamp = fm.timestamp.unwrap_or(mtime_ms);
            let final_language = fm.language.unwrap_or_else(|| {
                if ext == "canvas" {
                    "canvas".to_string()
                } else if ext == "txt" {
                    "text".to_string()
                } else {
                    "markdown".to_string()
                }
            });

            Some(ScannedNote {
                id,
                title,
                code: body.to_string(),
                language: final_language,
                tags: tags_str,
                timestamp: final_timestamp,
                created_at: fm.created_at,
                is_pinned: fm.is_pinned,
                is_learned: fm.is_learned,
                custom_icon: fm.custom_icon,
                color: fm.color,
                note_type: note_type.to_string(),
                is_draft: 0,
                file_name,
                folder_id,
                relative_path: rel_path,
                size: size as f64,
                is_oversized,
                ext: ext_with_dot,
                wikilinks,
            })
        })
        .collect();

    let total = notes.len() as u32;
    let elapsed = start_time.elapsed().as_secs_f64() * 1000.0;

    ScanResult {
        notes,
        folders,
        total_scanned: total,
        elapsed_ms: elapsed,
    }
}

fn md5_hash(data: &str) -> u128 {
    let mut hash: u128 = 0xcbf29ce484222325;
    for byte in data.bytes() {
        hash ^= byte as u128;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
