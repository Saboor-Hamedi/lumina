use napi_derive::napi;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[napi(object)]
pub struct SearchHit {
    pub id: String,
    pub title: String,
    pub relative_path: String,
    pub snippet: String,
    pub score: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[napi(object)]
pub struct SearchIndexItem {
    pub id: String,
    pub title: String,
    pub relative_path: String,
    pub tags: String,
    pub content: String,
}

/// Instant in-memory search matcher
pub fn search_notes_impl(items: &[SearchIndexItem], query: &str, limit: usize) -> Vec<SearchHit> {
    if query.trim().is_empty() {
        return Vec::new();
    }

    let q_lower = query.to_lowercase();
    let q_tokens: Vec<&str> = q_lower.split_whitespace().collect();

    let mut hits: Vec<SearchHit> = items
        .iter()
        .filter_map(|item| {
            let title_lower = item.title.to_lowercase();
            let path_lower = item.relative_path.to_lowercase();
            let tags_lower = item.tags.to_lowercase();

            let mut score = 0.0;

            // 1. Exact title match
            if title_lower == q_lower {
                score += 100.0;
            } else if title_lower.starts_with(&q_lower) {
                score += 60.0;
            } else if title_lower.contains(&q_lower) {
                score += 40.0;
            }

            // 2. Relative path match
            if path_lower.contains(&q_lower) {
                score += 20.0;
            }

            // 3. Tag match
            if tags_lower.contains(&q_lower) {
                score += 30.0;
            }

            // 4. Token matches
            for token in &q_tokens {
                if title_lower.contains(token) {
                    score += 15.0;
                }
                if path_lower.contains(token) {
                    score += 5.0;
                }
            }

            // 5. Content match if no title match
            let mut snippet = String::new();
            if score == 0.0 {
                let content_lower = item.content.to_lowercase();
                if let Some(pos) = content_lower.find(&q_lower) {
                    score += 10.0;
                    let start = pos.saturating_sub(40);
                    let end = (pos + q_lower.len() + 60).min(item.content.len());
                    snippet = safe_utf8_slice(&item.content, start, end).replace('\n', " ");
                }
            }

            if score > 0.0 {
                Some(SearchHit {
                    id: item.id.clone(),
                    title: item.title.clone(),
                    relative_path: item.relative_path.clone(),
                    snippet,
                    score,
                })
            } else {
                None
            }
        })
        .collect();

    // Sort descending by score
    hits.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    hits.truncate(limit);
    hits
}

fn safe_utf8_slice(s: &str, mut start: usize, mut end: usize) -> &str {
    let len = s.len();
    if start >= len {
        return "";
    }
    if end > len {
        end = len;
    }
    while start > 0 && !s.is_char_boundary(start) {
        start -= 1;
    }
    while end < len && !s.is_char_boundary(end) {
        end += 1;
    }
    if start >= end {
        return "";
    }
    &s[start..end]
}

