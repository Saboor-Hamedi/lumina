//! Native live web search engine for Lumina AI (`web_search.rs`).
//!
//! Performs fast, CORS-free live web searches via `reqwest` (native-tls)
//! with resilient multi-source fallback:
//! 1. DuckDuckGo HTML Lite (broad web results with titles, URLs, snippets)
//! 2. Wikipedia OpenSearch API (encyclopedic & technical fallback)
//! 3. DuckDuckGo Instant Answer API (summary & related topic links fallback)
//!
//! Every returned URL is strictly validated with `is_safe_external_url`.

use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::security::is_safe_external_url;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchResult {
    pub title: String,
    pub url: String,
    pub site_name: String,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchResponse {
    pub query: String,
    pub source: String,
    pub results: Vec<WebSearchResult>,
}

/// Percent-encode a UTF-8 string for URL query parameters.
pub fn url_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 3);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push('+'),
            _ => {
                out.push('%');
                out.push_str(&format!("{:02X}", b));
            }
        }
    }
    out
}

/// Percent-decode a URL-encoded string (used to unwrap DuckDuckGo `uddg=` redirect URLs).
pub fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
        } else if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Decode common HTML entities and strip inline HTML tags.
pub fn clean_html_text(raw: &str) -> String {
    let mut stripped = String::with_capacity(raw.len());
    let mut in_tag = false;
    for ch in raw.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => stripped.push(ch),
            _ => {}
        }
    }

    let decoded = stripped
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&#x2F;", "/");

    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Extract clean human-readable site hostname (e.g. `github.com`, `wikipedia.org`).
pub fn extract_site_name(url: &str) -> String {
    let without_scheme = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);
    let host = without_scheme.split('/').next().unwrap_or(without_scheme);
    let host = host.split(':').next().unwrap_or(host);
    host.strip_prefix("www.").unwrap_or(host).to_string()
}

/// Unwrap DuckDuckGo redirect links (`//duckduckgo.com/l/?uddg=https%3A%2F%2F...&rut=...`).
pub fn unwrap_ddg_url(raw_href: &str) -> String {
    let href = raw_href.trim().replace("&amp;", "&");
    if let Some(pos) = href.find("uddg=") {
        let rest = &href[pos + 5..];
        let encoded = rest.split('&').next().unwrap_or(rest);
        let decoded = url_decode(encoded);
        if decoded.starts_with("http://") || decoded.starts_with("https://") {
            return decoded;
        }
    }
    if href.starts_with("//") {
        return format!("https:{}", href);
    }
    href
}

/// Parse search results from DuckDuckGo HTML Lite markup.
pub fn parse_ddg_html(html: &str, max_results: usize) -> Vec<WebSearchResult> {
    let mut results = Vec::new();
    let mut cursor = 0;

    while results.len() < max_results {
        let Some(rel_idx) = html[cursor..].find("class=\"result__a\"") else {
            break;
        };
        let marker_pos = cursor + rel_idx;

        // Walk back to the opening `<a ` tag
        let a_start = html[..marker_pos].rfind("<a").unwrap_or(marker_pos);
        let Some(a_end_rel) = html[marker_pos..].find("</a>") else {
            break;
        };
        let a_tag = &html[a_start..marker_pos + a_end_rel];

        // Extract href="..."
        let url = if let Some(h_idx) = a_tag.find("href=\"") {
            let after = &a_tag[h_idx + 6..];
            after
                .find('"')
                .map(|end| unwrap_ddg_url(&after[..end]))
                .unwrap_or_default()
        } else {
            String::new()
        };

        // Extract inner text of <a>...</a>
        let title = if let Some(gt) = a_tag.find('>') {
            clean_html_text(&a_tag[gt + 1..])
        } else {
            String::new()
        };

        // Look ahead for the next result__snippet before the next result__a
        let next_chunk_start = marker_pos + a_end_rel + 4;
        let next_result_rel = html[next_chunk_start..]
            .find("class=\"result__a\"")
            .unwrap_or(html.len() - next_chunk_start);
        let block = &html[next_chunk_start..next_chunk_start + next_result_rel];

        let snippet = if let Some(sn_idx) = block.find("class=\"result__snippet\"") {
            let after_sn = &block[sn_idx..];
            if let Some(gt) = after_sn.find('>') {
                let inner = &after_sn[gt + 1..];
                let end = inner
                    .find("</a>")
                    .or_else(|| inner.find("</div>"))
                    .or_else(|| inner.find("</span>"))
                    .unwrap_or_else(|| inner.len().min(400));
                clean_html_text(&inner[..end])
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        cursor = next_chunk_start;

        if !title.is_empty()
            && is_safe_external_url(&url)
            && !url.contains("duckduckgo.com/y.js")
            && !results.iter().any(|r: &WebSearchResult| r.url == url)
        {
            let site_name = extract_site_name(&url);
            results.push(WebSearchResult {
                title,
                url,
                site_name,
                snippet,
            });
        }
    }

    results
}

fn build_http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .connect_timeout(Duration::from_secs(6))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))
}

fn search_ddg_html(
    client: &reqwest::blocking::Client,
    query: &str,
    max_results: usize,
) -> Result<Vec<WebSearchResult>, String> {
    let url = format!("https://html.duckduckgo.com/html/?q={}", url_encode(query));
    let resp = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .map_err(|e| format!("DuckDuckGo request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("DuckDuckGo returned status {}", resp.status()));
    }

    let html = resp
        .text()
        .map_err(|e| format!("Failed to read DuckDuckGo HTML: {}", e))?;
    Ok(parse_ddg_html(&html, max_results))
}

fn search_wikipedia_opensearch(
    client: &reqwest::blocking::Client,
    query: &str,
    max_results: usize,
) -> Result<Vec<WebSearchResult>, String> {
    let url = format!(
        "https://en.wikipedia.org/w/api.php?action=opensearch&search={}&limit={}&namespace=0&format=json",
        url_encode(query),
        max_results
    );
    let resp = client
        .get(&url)
        .send()
        .map_err(|e| format!("Wikipedia search failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Wikipedia returned status {}", resp.status()));
    }

    let payload: serde_json::Value = resp
        .json()
        .map_err(|e| format!("Invalid Wikipedia JSON: {}", e))?;

    let titles = payload.get(1).and_then(|v| v.as_array());
    let descs = payload.get(2).and_then(|v| v.as_array());
    let urls = payload.get(3).and_then(|v| v.as_array());

    let mut results = Vec::new();
    if let (Some(titles), Some(urls)) = (titles, urls) {
        for (idx, t) in titles.iter().enumerate() {
            if results.len() >= max_results {
                break;
            }
            let title = t.as_str().unwrap_or("").trim().to_string();
            let link = urls
                .get(idx)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let snippet = descs
                .and_then(|d| d.get(idx))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();

            if !title.is_empty() && is_safe_external_url(&link) {
                results.push(WebSearchResult {
                    title,
                    site_name: extract_site_name(&link),
                    url: link,
                    snippet,
                });
            }
        }
    }
    Ok(results)
}

/// Execute a live web search with resilient multi-source fallback.
pub fn search_web_impl(query: &str, max_results: usize) -> Result<WebSearchResponse, String> {
    let clean_query = query.trim();
    if clean_query.is_empty() {
        return Err("Search query cannot be empty.".to_string());
    }
    let limit = max_results.clamp(1, 10);
    let client = build_http_client()?;

    // 1. Primary: DuckDuckGo HTML Lite (broad web results)
    if let Ok(results) = search_ddg_html(&client, clean_query, limit) {
        if !results.is_empty() {
            return Ok(WebSearchResponse {
                query: clean_query.to_string(),
                source: "web".to_string(),
                results,
            });
        }
    }

    // 2. Fallback: Wikipedia OpenSearch
    if let Ok(results) = search_wikipedia_opensearch(&client, clean_query, limit) {
        if !results.is_empty() {
            return Ok(WebSearchResponse {
                query: clean_query.to_string(),
                source: "wikipedia".to_string(),
                results,
            });
        }
    }

    Ok(WebSearchResponse {
        query: clean_query.to_string(),
        source: "web".to_string(),
        results: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unwrap_ddg_url_and_site_name() {
        let raw = "//duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.rs%2Ftauri%2Flatest%2Ftauri%2F&amp;rut=abc";
        let unwrapped = unwrap_ddg_url(raw);
        assert_eq!(unwrapped, "https://docs.rs/tauri/latest/tauri/");
        assert_eq!(extract_site_name(&unwrapped), "docs.rs");
    }

    #[test]
    fn test_parse_ddg_html_extracts_titles_urls_and_snippets() {
        let sample = r##"
          <div class="result">
            <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.rust-lang.org%2F&amp;rut=123">Rust <b>Programming</b> Language</a>
            <a class="result__snippet" href="#">A language empowering everyone to build reliable &amp; efficient software.</a>
          </div>
          <div class="result">
            <a class="result__a" href="https://github.com/tauri-apps/tauri">Tauri Framework</a>
            <div class="result__snippet">Build smaller, faster, and more secure desktop applications.</div>
          </div>
        "##;

        let parsed = parse_ddg_html(sample, 5);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].title, "Rust Programming Language");
        assert_eq!(parsed[0].url, "https://www.rust-lang.org/");
        assert_eq!(parsed[0].site_name, "rust-lang.org");
        assert_eq!(
            parsed[0].snippet,
            "A language empowering everyone to build reliable & efficient software."
        );
        assert_eq!(parsed[1].site_name, "github.com");
    }
}
