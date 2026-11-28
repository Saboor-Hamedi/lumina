use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

/// Converts Unix epoch milliseconds to an ISO-8601 UTC string (e.g. `2026-09-25T05:02:06.906Z`).
pub fn epoch_ms_to_iso8601(ms: u64) -> String {
    let secs = (ms / 1000) as i64;
    let millis = ms % 1000;
    let days = secs.div_euclid(86_400);
    let secs_of_day = secs.rem_euclid(86_400);
    let hour = secs_of_day / 3600;
    let minute = (secs_of_day % 3600) / 60;
    let second = secs_of_day % 60;

    // Howard Hinnant's civil_from_days algorithm (days since 1970-01-01)
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = y + if m <= 2 { 1 } else { 0 };

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        year, m, d, hour, minute, second, millis
    )
}

pub fn system_time_to_iso8601(t: SystemTime) -> Option<String> {
    t.duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| epoch_ms_to_iso8601(d.as_millis() as u64))
}
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Clone, Debug)]
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
    #[serde(default)]
    pub properties: BTreeMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
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
    pub properties: BTreeMap<String, String>,
}

fn is_known_metadata_key(key: &str) -> bool {
    matches!(
        key.to_lowercase().as_str(),
        "id" | "title" | "language" | "tags" | "tag" | "selection" | "ispinned" | "pinned"
            | "islearned" | "learned" | "customicon" | "icon" | "emoji" | "createdat"
            | "created_at" | "created" | "date" | "timestamp" | "color" | "type"
            | "folderid" | "folder_id"
    )
}

/// Infer Lumina Note Property type (`text` | `select` | `date` | `checkbox` | `url` | `number`)
/// from an external YAML/TOML property key and string value.
pub fn infer_metadata_prop_type(key: &str, value: &str) -> &'static str {
    let lower_key = key.trim().to_lowercase();
    let trimmed = value.trim();

    if matches!(lower_key.as_str(), "status" | "priority" | "stage") {
        return "select";
    }
    if trimmed.eq_ignore_ascii_case("true") || trimmed.eq_ignore_ascii_case("false") {
        return "checkbox";
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return "url";
    }
    // ISO date (YYYY-MM-DD or YYYY-MM-DDTHH:MM...)
    if trimmed.len() >= 10 {
        let b = trimmed.as_bytes();
        if b[0..4].iter().all(|c| c.is_ascii_digit())
            && b[4] == b'-'
            && b[5..7].iter().all(|c| c.is_ascii_digit())
            && b[7] == b'-'
            && b[8..10].iter().all(|c| c.is_ascii_digit())
        {
            return "date";
        }
    }
    if !trimmed.is_empty()
        && !trimmed.contains(' ')
        && trimmed.parse::<f64>().is_ok()
        && !lower_key.contains("id")
        && !lower_key.contains("phone")
    {
        return "number";
    }
    "text"
}

fn clean_yaml_scalar(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
    {
        return trimmed[1..trimmed.len() - 1].trim().to_string();
    }
    trimmed.to_string()
}

fn normalize_external_prop_key(raw_key: &str) -> Option<String> {
    let trimmed = raw_key.trim().trim_matches('"').trim_matches('\'').trim();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return None;
    }
    // Allow letters, digits, _, -, ., and spaces (Notion / Obsidian keys like "Due Date")
    if !trimmed
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.' || c == ' ')
    {
        return None;
    }
    Some(trimmed.to_string())
}

fn apply_frontmatter_kv(orig_key: &str, raw_val: &str, fm: &mut ParsedFrontmatter) -> bool {
    let key = orig_key.trim().to_lowercase();
    let val = clean_yaml_scalar(raw_val);

    match key.as_str() {
        "id" => {
            if !val.is_empty() && val != "null" {
                fm.id = Some(val);
            }
        }
        "title" => {
            if !val.is_empty() && val != "null" {
                fm.title = Some(val);
            }
        }
        "language" => {
            if !val.is_empty() && val != "null" {
                fm.language = Some(val);
            }
        }
        "pinned" | "ispinned" => {
            fm.is_pinned = val.eq_ignore_ascii_case("true") || val == "1";
        }
        "learned" | "islearned" => {
            fm.is_learned = val.eq_ignore_ascii_case("true") || val == "1";
        }
        "color" => {
            if !val.is_empty() && val != "null" {
                fm.color = Some(val);
            }
        }
        "icon" | "customicon" | "emoji" => {
            if !val.is_empty() && val != "null" && val != "undefined" {
                fm.custom_icon = Some(val);
            }
        }
        "createdat" | "created_at" | "created" | "date" => {
            if !val.is_empty() && val != "null" && fm.created_at.is_none() {
                fm.created_at = Some(val);
            }
        }
        "timestamp" => {
            if let Ok(ts) = val.parse::<f64>() {
                fm.timestamp = Some(ts);
            }
        }
        "tags" | "tag" => {
            let clean = val.trim_start_matches('[').trim_end_matches(']');
            for t in clean.split(',') {
                let t = clean_yaml_scalar(t).trim_start_matches('#').to_string();
                if !t.is_empty() && !fm.tags.contains(&t) {
                    fm.tags.push(t);
                }
            }
        }
        _ => {
            if let Some(clean_key) = normalize_external_prop_key(orig_key) {
                if !is_known_metadata_key(&key) && val != "null" && val != "~" {
                    // Normalize inline YAML arrays like `[a, b]` to `a, b`
                    let display_val = if val.starts_with('[') && val.ends_with(']') {
                        val[1..val.len() - 1]
                            .split(',')
                            .map(clean_yaml_scalar)
                            .filter(|s| !s.is_empty())
                            .collect::<Vec<_>>()
                            .join(", ")
                    } else {
                        val
                    };
                    if !display_val.is_empty() {
                        fm.properties.insert(clean_key, display_val);
                    }
                }
            }
        }
    }
    is_known_metadata_key(&key)
}

fn parse_yaml_block(yaml_block: &str, fm: &mut ParsedFrontmatter) {
    let mut active_list_key: Option<String> = None;
    let mut active_list_items: Vec<String> = Vec::new();

    let flush_list = |key_opt: &mut Option<String>,
                      items: &mut Vec<String>,
                      fm: &mut ParsedFrontmatter| {
        if let Some(list_key) = key_opt.take() {
            if !items.is_empty() {
                let joined = items.join(", ");
                apply_frontmatter_kv(&list_key, &joined, fm);
            }
            items.clear();
        }
    };

    for line in yaml_block.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Indented list item (e.g. `  - tag1` or `- item`)
        if let Some(rest) = trimmed.strip_prefix("- ") {
            if active_list_key.is_some() {
                let item = clean_yaml_scalar(rest);
                if !item.is_empty() {
                    active_list_items.push(item);
                }
                continue;
            }
        }

        // Skip deeply indented nested YAML continuation lines
        if (line.starts_with("  ") || line.starts_with('\t')) && active_list_key.is_some() {
            continue;
        }

        flush_list(&mut active_list_key, &mut active_list_items, fm);

        if let Some((k, v)) = trimmed.split_once(':') {
            let v_trimmed = v.trim();
            if v_trimmed.is_empty() || v_trimmed == "|" || v_trimmed == ">" {
                // Start of a multi-line YAML list or block scalar
                active_list_key = Some(k.trim().to_string());
            } else {
                apply_frontmatter_kv(k, v_trimmed, fm);
            }
        }
    }

    flush_list(&mut active_list_key, &mut active_list_items, fm);
}

fn parse_toml_block(toml_block: &str, fm: &mut ParsedFrontmatter) {
    for line in toml_block.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            apply_frontmatter_kv(k, v.trim(), fm);
        }
    }
}

fn parse_yaml_line(line: &str, fm: &mut ParsedFrontmatter) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return false;
    }
    if let Some((k, v)) = trimmed.split_once(':') {
        return apply_frontmatter_kv(k, v, fm);
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
    let mut has_yaml_frontmatter = false;

    // 1. Strip any standard `---...---` (YAML) or `+++...+++` (TOML) frontmatter blocks
    loop {
        let trimmed_leading = content.trim_start_matches(|c| c == '\r' || c == '\n' || c == ' ' || c == '\t');
        let (delim, is_toml) = if trimmed_leading.starts_with("---") {
            ("---", false)
        } else if trimmed_leading.starts_with("+++") {
            ("+++", true)
        } else {
            break;
        };

        let after_first_delim = &trimmed_leading[3..];
        let newline_pos = match after_first_delim.find('\n') {
            Some(pos) => pos,
            None => break,
        };
        let first_line_tail = after_first_delim[..newline_pos].trim();
        if !first_line_tail.is_empty() {
            break;
        }

        let inner_and_rest = &after_first_delim[newline_pos + 1..];
        let closing_needle = if is_toml { "\n+++" } else { "\n---" };
        let mut closing_found = None;
        let mut search_idx = 0;

        while let Some(pos) = inner_and_rest[search_idx..].find(closing_needle) {
            let abs_pos = search_idx + pos;
            let after_closing_delim = &inner_and_rest[abs_pos + 4..];
            let line_end = after_closing_delim.find('\n').unwrap_or(after_closing_delim.len());
            let line_tail = after_closing_delim[..line_end].trim();
            if line_tail.is_empty() {
                closing_found = Some((abs_pos, abs_pos + 4 + line_end));
                break;
            }
            search_idx = abs_pos + 4;
        }

        if let Some((block_end, next_content_start)) = closing_found {
            let _ = delim;
            has_yaml_frontmatter = true;
            let fm_block = &inner_and_rest[..block_end];
            if is_toml {
                parse_toml_block(fm_block, &mut fm);
            } else {
                parse_yaml_block(fm_block, &mut fm);
            }
            let mut next = &inner_and_rest[next_content_start..];
            if next.starts_with("\r\n") {
                next = &next[2..];
            } else if next.starts_with('\n') {
                next = &next[1..];
            }
            content = next;
        } else {
            break;
        }
    }

    // 2. Only check for loose metadata `key: value` lines if NO standard YAML was present
    // and the very first line is non-empty (to preserve intentional leading blank lines).
    if !has_yaml_frontmatter {
        let mut byte_offset = 0;
        let mut in_loose_metadata = false;

        for (idx, line) in content.split_inclusive('\n').enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                if idx == 0 {
                    break;
                }
                if in_loose_metadata {
                    byte_offset += line.len();
                    continue;
                }
                break;
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
    }

    (fm, content)
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

            let os_created_at = metadata.created().ok().and_then(system_time_to_iso8601);

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
                    created_at: os_created_at,
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
                    properties: BTreeMap::new(),
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
                created_at: fm.created_at.or(os_created_at),
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
                properties: fm.properties,
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

pub fn md5_hash(data: &str) -> u128 {
    let mut hash: u128 = 0xcbf29ce484222325;
    for byte in data.bytes() {
        hash ^= byte as u128;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
