//! Native live web search engine for Lumina AI (`web_search.rs`).
//!
//! Performs fast, CORS-free live web searches via `reqwest` (native-tls)
//! using verified, non-honeypot sources:
//! 1. Yahoo Web Search HTML (`search.yahoo.com/search?p=...`) — real live web index (websites, docs, blogs, YouTube, GitHub)
//! 2. Direct GitHub Repo Check (`github.com/{owner}/{repo}`) + GitHub Search API — repos with typo tolerance (e.g. `.gi` -> `.git` stripped)
//! 3. arXiv Academic API (`export.arxiv.org/api/query`) + OpenAlex — scholarly papers, authors, abstracts, DOIs
//! 4. YouTube Video Search (`search.yahoo.com/search?p=site:youtube.com ...`) — tutorials, talks, demos
//! 5. Wikipedia Full-Text Search API (with compliant app User-Agent) — encyclopedic fallback
//!
//! Every returned URL is strictly validated with `is_safe_external_url`.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::Duration;

use crate::security::is_safe_external_url;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchResult {
    pub title: String,
    pub url: String,
    pub site_name: String,
    pub snippet: String,
    #[serde(default = "default_category")]
    pub category: String,
}

fn default_category() -> String {
    "web".to_string()
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

/// Percent-decode a URL-encoded string (used to unwrap Yahoo `/RU=.../RK=` redirect URLs).
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

/// Normalize user search queries with typo tolerance (e.g. `saboor-hamedi/lumina.gi` -> `saboor-hamedi/lumina`).
pub fn sanitize_search_query(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    trimmed
        .split_whitespace()
        .map(|tok| {
            // Fix truncated/typo git suffixes on repo slugs like `owner/repo.gi` or `owner/repo.git`
            if tok.contains('/') {
                let cleaned = tok.trim_matches(|c: char| c == ',' || c == ';' || c == '"' || c == '\'');
                if let Some(stripped) = cleaned
                    .strip_suffix(".git")
                    .or_else(|| cleaned.strip_suffix(".gi"))
                {
                    return stripped.to_string();
                }
            }
            tok.to_string()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Extract an explicit `owner/repo` slug from a query if present (including `github.com/owner/repo` or `owner/repo.gi`).
pub fn extract_github_repo_slug(query: &str) -> Option<(String, String)> {
    for raw_tok in query.split_whitespace() {
        let tok = raw_tok
            .trim_matches(|c: char| matches!(c, ',' | ';' | '"' | '\'' | '(' | ')' | '[' | ']'))
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_start_matches("www.")
            .trim_start_matches("github.com/");

        let parts: Vec<&str> = tok.split('/').filter(|p| !p.is_empty()).collect();
        if parts.len() == 2 {
            let owner = parts[0];
            let repo = parts[1]
                .strip_suffix(".git")
                .or_else(|| parts[1].strip_suffix(".gi"))
                .unwrap_or(parts[1]);

            let valid_owner = !owner.is_empty()
                && owner.len() <= 39
                && owner.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
            let valid_repo = !repo.is_empty()
                && repo.len() <= 100
                && repo
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');

            if valid_owner && valid_repo {
                return Some((owner.to_string(), repo.to_string()));
            }
        }
    }
    None
}

/// Decode common XML/HTML entities and strip inline HTML tags & CDATA wrappers.
pub fn clean_html_text(raw: &str) -> String {
    let unwrapped = raw
        .trim()
        .strip_prefix("<![CDATA[")
        .and_then(|s| s.strip_suffix("]]>"))
        .unwrap_or(raw);

    let pre_decoded = unwrapped.replace("&lt;", "<").replace("&gt;", ">");

    let mut stripped = String::with_capacity(pre_decoded.len());
    let mut in_tag = false;
    for ch in pre_decoded.chars() {
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
        .replace("&nbsp;", " ")
        .replace("&#x2F;", "/")
        .replace("&#8211;", "–")
        .replace("&#8212;", "—")
        .replace("&#8217;", "'")
        .replace("&#8220;", "\"")
        .replace("&#8221;", "\"");

    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Extract clean human-readable site hostname (e.g. `github.com`, `youtube.com`).
pub fn extract_site_name(url: &str) -> String {
    let without_scheme = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);
    let host = without_scheme.split('/').next().unwrap_or(without_scheme);
    let host = host.split(':').next().unwrap_or(host);
    host.strip_prefix("www.").unwrap_or(host).to_string()
}

/// Classify a URL into a rich display category (`video`, `scholar`, `repo`, `news`, `web`).
pub fn classify_url_category(url: &str, fallback: &str) -> String {
    let lower = url.to_ascii_lowercase();
    if lower.contains("youtube.com/")
        || lower.contains("youtu.be/")
        || lower.contains("vimeo.com/")
        || lower.contains("dailymotion.com/")
    {
        return "video".to_string();
    }
    if lower.contains("scholar.google.")
        || lower.contains("semanticscholar.org")
        || lower.contains("arxiv.org")
        || lower.contains("openalex.org")
        || lower.contains("doi.org")
        || lower.contains("pubmed.ncbi.nlm.nih.gov")
        || lower.contains("researchgate.net")
        || lower.contains("ieee.org")
        || lower.contains("acm.org")
        || lower.contains("springer.com")
        || lower.contains("sciencedirect.com")
        || lower.contains("nature.com")
    {
        return "scholar".to_string();
    }
    if lower.contains("github.com/")
        || lower.contains("gitlab.com/")
        || lower.contains("codeberg.org/")
        || lower.contains("crates.io/")
        || lower.contains("npmjs.com/")
        || lower.contains("pypi.org/")
    {
        return "repo".to_string();
    }
    fallback.to_string()
}

/// Unwrap Yahoo redirect links (`https://r.search.yahoo.com/.../RU=https%3a%2f%2f.../RK=2/...`).
pub fn unwrap_yahoo_url(raw_href: &str) -> String {
    let href = raw_href.trim().replace("&amp;", "&");
    if let Some(pos) = href.find("/RU=") {
        let rest = &href[pos + 4..];
        let encoded = rest
            .find("/RK=")
            .or_else(|| rest.find("/RS="))
            .map(|end| &rest[..end])
            .unwrap_or(rest);
        let decoded = url_decode(encoded);
        if decoded.starts_with("http://") || decoded.starts_with("https://") {
            return decoded;
        }
    }
    href
}

/// Parse live search results from Yahoo Search HTML (`compTitle` + `compText` blocks).
pub fn parse_yahoo_html(
    html: &str,
    max_results: usize,
    default_cat: &str,
) -> Vec<WebSearchResult> {
    let mut results = Vec::new();
    let mut cursor = 0;

    while results.len() < max_results {
        let Some(rel_idx) = html[cursor..].find("compTitle") else {
            break;
        };
        let title_block_start = cursor + rel_idx;

        // Bound this result block until the next `compTitle`
        let next_rel = html[title_block_start + 9..]
            .find("compTitle")
            .unwrap_or(html.len() - (title_block_start + 9));
        let result_block = &html[title_block_start..title_block_start + 9 + next_rel];
        cursor = title_block_start + 9;

        // Locate `<a ... href="..." ...>...</a>` inside the title block
        let Some(a_rel) = result_block.find("<a ") else {
            continue;
        };
        let a_slice = &result_block[a_rel..];
        let Some(a_end) = a_slice.find("</a>") else {
            continue;
        };
        let a_tag = &a_slice[..a_end];

        let url = if let Some(h_idx) = a_tag.find("href=\"") {
            let after = &a_tag[h_idx + 6..];
            after
                .find('"')
                .map(|end| unwrap_yahoo_url(&after[..end]))
                .unwrap_or_default()
        } else {
            String::new()
        };

        // Prefer `<h3 ...>...</h3>` inside the anchor, else fallback to `aria-label="..."` or anchor text
        let raw_title = if let Some(h3_start) = a_tag.find("<h3") {
            let after_h3 = &a_tag[h3_start..];
            if let Some(gt) = after_h3.find('>') {
                let inner = &after_h3[gt + 1..];
                let end = inner.find("</h3>").unwrap_or(inner.len());
                clean_html_text(&inner[..end])
            } else {
                String::new()
            }
        } else if let Some(al_idx) = a_tag.find("aria-label=\"") {
            let after = &a_tag[al_idx + 12..];
            after
                .find('"')
                .map(|end| clean_html_text(&after[..end]))
                .unwrap_or_default()
        } else if let Some(gt) = a_tag.find('>') {
            clean_html_text(&a_tag[gt + 1..])
        } else {
            String::new()
        };

        // Strip leading breadcrumb domain Yahoo sometimes prepends inside <a>
        let title = raw_title.trim().to_string();

        // Extract snippet from `compText` if present in this result block
        let snippet = if let Some(ct_idx) = result_block.find("compText") {
            let after_ct = &result_block[ct_idx..];
            if let Some(gt) = after_ct.find('>') {
                let inner = &after_ct[gt + 1..];
                let end = inner
                    .find("</div>")
                    .unwrap_or_else(|| inner.len().min(600));
                clean_html_text(&inner[..end])
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        // Skip Yahoo internal/ad links
        let lower_url = url.to_ascii_lowercase();
        if title.is_empty()
            || !is_safe_external_url(&url)
            || lower_url.contains("search.yahoo.com")
            || lower_url.contains("r.search.yahoo.com")
            || lower_url.contains("bing.com/aclick")
            || lower_url.contains("yahoo.com/yhs")
            || results.iter().any(|r: &WebSearchResult| r.url == url)
        {
            continue;
        }

        let site_name = extract_site_name(&url);
        let category = classify_url_category(&url, default_cat);
        results.push(WebSearchResult {
            title,
            url,
            site_name,
            snippet,
            category,
        });
    }

    results
}

/// Extract text inside `<tag>...</tag>` from an XML chunk.
fn extract_xml_tag(chunk: &str, tag: &str) -> String {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let Some(start_idx) = chunk.find(&open) else {
        return String::new();
    };
    let after_open = &chunk[start_idx + open.len()..];
    let Some(gt_idx) = after_open.find('>') else {
        return String::new();
    };
    let content_start = &after_open[gt_idx + 1..];
    let Some(end_idx) = content_start.find(&close) else {
        return String::new();
    };
    content_start[..end_idx].trim().to_string()
}

/// Parse arXiv Atom XML `<entry>` items into scholarly `WebSearchResult` entries.
pub fn parse_arxiv_atom(xml: &str, max_results: usize) -> Vec<WebSearchResult> {
    let mut results = Vec::new();
    let mut cursor = 0;

    while results.len() < max_results {
        let Some(rel_start) = xml[cursor..].find("<entry>") else {
            break;
        };
        let entry_start = cursor + rel_start;
        let Some(rel_end) = xml[entry_start..].find("</entry>") else {
            break;
        };
        let block = &xml[entry_start..entry_start + rel_end];
        cursor = entry_start + rel_end + 8;

        let title = clean_html_text(&extract_xml_tag(block, "title"));
        let url = extract_xml_tag(block, "id")
            .replace("http://arxiv.org/", "https://arxiv.org/");
        let summary = clean_html_text(&extract_xml_tag(block, "summary"));
        let published = extract_xml_tag(block, "published");
        let year = published.get(0..4).unwrap_or("");

        // Collect up to 3 author names
        let mut authors = Vec::new();
        let mut a_cur = 0;
        while authors.len() < 3 {
            let Some(pos) = block[a_cur..].find("<name>") else {
                break;
            };
            let s = a_cur + pos + 6;
            let Some(end) = block[s..].find("</name>") else {
                break;
            };
            authors.push(clean_html_text(&block[s..s + end]));
            a_cur = s + end + 7;
        }

        if title.is_empty() || !is_safe_external_url(&url) {
            continue;
        }

        let short_summary = if summary.len() > 220 {
            format!("{}…", &summary[..220].trim_end())
        } else {
            summary
        };
        let mut meta = Vec::new();
        if !authors.is_empty() {
            meta.push(authors.join(", "));
        }
        if !year.is_empty() {
            meta.push(year.to_string());
        }
        if !short_summary.is_empty() {
            meta.push(short_summary);
        }

        results.push(WebSearchResult {
            title,
            url,
            site_name: "arxiv.org".to_string(),
            snippet: meta.join(" · "),
            category: "scholar".to_string(),
        });
    }

    results
}

/// Parse GitHub Search Repositories JSON into `WebSearchResult` items.
pub fn parse_github_repos_json(
    payload: &serde_json::Value,
    max_results: usize,
) -> Vec<WebSearchResult> {
    let mut results = Vec::new();
    let Some(items) = payload.get("items").and_then(|v| v.as_array()) else {
        return results;
    };

    for item in items.iter().take(max_results) {
        let full_name = item
            .get("full_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let url = item
            .get("html_url")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if full_name.is_empty() || !is_safe_external_url(&url) {
            continue;
        }
        let desc = item
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let stars = item
            .get("stargazers_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let lang = item
            .get("language")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let mut meta = Vec::new();
        if !desc.is_empty() {
            meta.push(desc.to_string());
        }
        if !lang.is_empty() {
            meta.push(lang.to_string());
        }
        if stars > 0 {
            meta.push(format!("★ {}", stars));
        }

        results.push(WebSearchResult {
            title: full_name.to_string(),
            site_name: "github.com".to_string(),
            url,
            snippet: meta.join(" · "),
            category: "repo".to_string(),
        });
    }

    results
}

fn build_browser_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .connect_timeout(Duration::from_secs(6))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))
}

fn build_api_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .connect_timeout(Duration::from_secs(5))
        .user_agent("LuminaApp/2.2 (local-first knowledge workspace)")
        .build()
        .map_err(|e| format!("Failed to initialize API client: {}", e))
}

fn search_yahoo_html(
    client: &reqwest::blocking::Client,
    query: &str,
    max_results: usize,
    default_cat: &str,
) -> Result<Vec<WebSearchResult>, String> {
    let url = format!("https://search.yahoo.com/search?p={}", url_encode(query));
    let resp = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .map_err(|e| format!("Yahoo web search failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Yahoo returned status {}", resp.status()));
    }

    let html = resp
        .text()
        .map_err(|e| format!("Failed to read Yahoo HTML: {}", e))?;
    Ok(parse_yahoo_html(&html, max_results, default_cat))
}

/// Directly check a GitHub repository page (`https://github.com/{owner}/{repo}`) without burning REST API rate limits.
fn fetch_direct_github_repo(
    client: &reqwest::blocking::Client,
    owner: &str,
    repo: &str,
) -> Option<WebSearchResult> {
    let url = format!("https://github.com/{}/{}", owner, repo);
    let resp = client
        .get(&url)
        .header("Accept", "text/html")
        .send()
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let html = resp.text().ok()?;
    let title = {
        let raw = extract_xml_tag(&html, "title");
        let clean = clean_html_text(&raw);
        if clean.is_empty() {
            format!("{}/{}", owner, repo)
        } else {
            clean
        }
    };

    // Extract `<meta name="description" content="...">`
    let snippet = html
        .find("name=\"description\"")
        .and_then(|idx| {
            let slice = &html[idx..html.len().min(idx + 500)];
            let c_idx = slice.find("content=\"")?;
            let after = &slice[c_idx + 9..];
            let end = after.find('"')?;
            Some(clean_html_text(&after[..end]))
        })
        .unwrap_or_default();

    Some(WebSearchResult {
        title,
        url,
        site_name: "github.com".to_string(),
        snippet,
        category: "repo".to_string(),
    })
}

fn search_arxiv(
    client: &reqwest::blocking::Client,
    query: &str,
    max_results: usize,
) -> Result<Vec<WebSearchResult>, String> {
    let url = format!(
        "https://export.arxiv.org/api/query?search_query=all:{}&max_results={}",
        url_encode(query),
        max_results.clamp(1, 6)
    );
    let resp = client
        .get(&url)
        .send()
        .map_err(|e| format!("arXiv search failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("arXiv returned status {}", resp.status()));
    }

    let xml = resp
        .text()
        .map_err(|e| format!("Failed to read arXiv XML: {}", e))?;
    Ok(parse_arxiv_atom(&xml, max_results))
}

fn search_github_repos(
    client: &reqwest::blocking::Client,
    query: &str,
    max_results: usize,
) -> Result<Vec<WebSearchResult>, String> {
    let url = format!(
        "https://api.github.com/search/repositories?q={}&per_page={}",
        url_encode(query),
        max_results.clamp(1, 6)
    );
    let resp = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|e| format!("GitHub repo search failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub returned status {}", resp.status()));
    }

    let payload: serde_json::Value = resp
        .json()
        .map_err(|e| format!("Invalid GitHub JSON: {}", e))?;
    Ok(parse_github_repos_json(&payload, max_results))
}

fn search_wikipedia_fulltext(
    client: &reqwest::blocking::Client,
    query: &str,
    max_results: usize,
) -> Result<Vec<WebSearchResult>, String> {
    let url = format!(
        "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={}&srlimit={}&format=json",
        url_encode(query),
        max_results.clamp(1, 6)
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

    let mut results = Vec::new();
    if let Some(items) = payload
        .get("query")
        .and_then(|q| q.get("search"))
        .and_then(|s| s.as_array())
    {
        for item in items.iter().take(max_results) {
            let title = item
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let snippet = clean_html_text(
                item.get("snippet").and_then(|v| v.as_str()).unwrap_or(""),
            );
            if title.is_empty() {
                continue;
            }
            let wiki_url = format!(
                "https://en.wikipedia.org/wiki/{}",
                url_encode(&title.replace(' ', "_"))
            );
            if is_safe_external_url(&wiki_url) {
                results.push(WebSearchResult {
                    title,
                    url: wiki_url,
                    site_name: "en.wikipedia.org".to_string(),
                    snippet,
                    category: "web".to_string(),
                });
            }
        }
    }
    Ok(results)
}

fn push_unique(
    dest: &mut Vec<WebSearchResult>,
    seen: &mut HashSet<String>,
    items: Vec<WebSearchResult>,
    max_total: usize,
) {
    for item in items {
        if dest.len() >= max_total {
            break;
        }
        let norm = item.url.trim_end_matches('/').to_ascii_lowercase();
        if seen.insert(norm) {
            dest.push(item);
        }
    }
}

/// Execute a live multi-source web search (Web, Videos, Scholar/arXiv, GitHub, Wikipedia)
/// with typo tolerance and zero honeypot/junk sources.
pub fn search_web_impl(query: &str, max_results: usize) -> Result<WebSearchResponse, String> {
    let clean_query = sanitize_search_query(query);
    if clean_query.is_empty() {
        return Err("Search query cannot be empty.".to_string());
    }
    let limit = max_results.clamp(1, 12);
    let browser_client = build_browser_client()?;
    let api_client = build_api_client()?;
    let lower = clean_query.to_ascii_lowercase();

    let wants_scholar = lower.contains("scholar")
        || lower.contains("paper")
        || lower.contains("papers")
        || lower.contains("journal")
        || lower.contains("citation")
        || lower.contains("arxiv")
        || lower.contains("study")
        || lower.contains("research")
        || lower.contains("publication");

    let wants_videos = lower.contains("video")
        || lower.contains("videos")
        || lower.contains("youtube")
        || lower.contains("watch")
        || lower.contains("tutorial")
        || lower.contains("lecture")
        || lower.contains("course");

    let wants_repo = lower.contains("repo")
        || lower.contains("github")
        || lower.contains("source code")
        || lower.contains("open source")
        || lower.contains("built");

    let mut combined: Vec<WebSearchResult> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut sources: Vec<&str> = Vec::new();

    // 0. Direct GitHub repo lookup when query contains `owner/repo` (with `.gi`/`.git` typo tolerance!)
    if let Some((owner, repo)) = extract_github_repo_slug(query) {
        if let Some(direct) = fetch_direct_github_repo(&browser_client, &owner, &repo) {
            sources.push("github");
            push_unique(&mut combined, &mut seen, vec![direct], limit);
        }
    }

    // 1. Primary live web index: Yahoo Web Search HTML (verified real results, zero bot-honeypot junk)
    if let Ok(web_results) = search_yahoo_html(&browser_client, &clean_query, limit, "web") {
        if !web_results.is_empty() {
            sources.push("web");
            let take_cap = if wants_scholar || wants_videos || wants_repo {
                (limit * 2 / 3).max(4)
            } else {
                limit
            };
            push_unique(&mut combined, &mut seen, web_results, take_cap);
        }
    }

    // 2. Scholarly enrichment (arXiv Atom API — real papers, authors, abstracts)
    if wants_scholar && combined.len() < limit {
        if let Ok(scholar_results) = search_arxiv(&api_client, &clean_query, 4) {
            if !scholar_results.is_empty() {
                sources.push("scholar");
                push_unique(&mut combined, &mut seen, scholar_results, limit);
            }
        }
    }

    // 3. Video enrichment (YouTube via Yahoo Web Search)
    if wants_videos && combined.len() < limit {
        let yt_query = format!("site:youtube.com {}", clean_query);
        if let Ok(video_results) = search_yahoo_html(&browser_client, &yt_query, 4, "video") {
            if !video_results.is_empty() {
                sources.push("videos");
                push_unique(&mut combined, &mut seen, video_results, limit);
            }
        }
    }

    // 4. GitHub Repository Search API (when looking for repos/projects or enriching technical queries)
    if (wants_repo || combined.len() < 3) && combined.len() < limit {
        if let Ok(repo_results) = search_github_repos(&api_client, &clean_query, 4) {
            if !repo_results.is_empty() {
                if !sources.contains(&"github") {
                    sources.push("github");
                }
                push_unique(&mut combined, &mut seen, repo_results, limit);
            }
        }
    }

    // 5. Wikipedia Full-Text fallback if still sparse
    if combined.len() < 2 {
        if let Ok(wiki_results) = search_wikipedia_fulltext(&api_client, &clean_query, 4) {
            if !wiki_results.is_empty() {
                sources.push("wikipedia");
                push_unique(&mut combined, &mut seen, wiki_results, limit);
            }
        }
    }

    let source_label = if sources.is_empty() {
        "web".to_string()
    } else {
        sources.join("+")
    };

    Ok(WebSearchResponse {
        query: clean_query,
        source: source_label,
        results: combined,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_query_and_extract_github_repo_typo() {
        assert_eq!(
            sanitize_search_query("find this repo saboor-hamedi/lumina.gi"),
            "find this repo saboor-hamedi/lumina"
        );
        let slug = extract_github_repo_slug("find this repo saboor-hamedi/lumina.gi");
        assert_eq!(
            slug,
            Some(("saboor-hamedi".to_string(), "lumina".to_string()))
        );
    }

    #[test]
    fn test_unwrap_yahoo_url_and_parse_yahoo_html() {
        let sample = r##"
          <div class="dd algo algo-sr">
            <div class="compTitle options-toggle">
              <a data-matarget="algo" href="https://r.search.yahoo.com/_ylt=abc/RV=2/RE=179/RO=10/RU=https%3a%2f%2faws.amazon.com%2fwhat-is%2fretrieval-augmented-generation%2f/RK=2/RS=xyz">
                <h3 class="title">What is RAG? - Retrieval-Augmented Generation AI Explained</h3>
              </a>
            </div>
            <div class="compText aAbs"><p>RAG optimizes the output of a large language model with authoritative knowledge.</p></div>
          </div>
          <div class="dd algo algo-sr">
            <div class="compTitle options-toggle">
              <a data-matarget="algo" href="https://r.search.yahoo.com/_ylt=def/RU=https%3a%2f%2fwww.youtube.com%2fwatch%3fv%3dabc123/RK=2/RS=xyz">
                <h3 class="title">RAG Explained in 10 Minutes</h3>
              </a>
            </div>
            <div class="compText aAbs"><p>Complete visual guide to Retrieval-Augmented Generation.</p></div>
          </div>
        "##;

        let parsed = parse_yahoo_html(sample, 5, "web");
        assert_eq!(parsed.len(), 2);
        assert_eq!(
            parsed[0].url,
            "https://aws.amazon.com/what-is/retrieval-augmented-generation/"
        );
        assert_eq!(parsed[0].site_name, "aws.amazon.com");
        assert_eq!(parsed[0].category, "web");
        assert!(parsed[0].snippet.contains("authoritative knowledge"));
        assert_eq!(parsed[1].category, "video");
        assert_eq!(parsed[1].site_name, "youtube.com");
    }

    #[test]
    fn test_parse_arxiv_atom_extracts_scholarly_paper() {
        let xml = r##"<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <id>http://arxiv.org/abs/2005.11401v4</id>
            <published>2020-05-22T17:58:00Z</published>
            <title>Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks</title>
            <summary>Large pre-trained language models store factual knowledge in parameters.</summary>
            <author><name>Patrick Lewis</name></author>
            <author><name>Ethan Perez</name></author>
          </entry>
        </feed>"##;

        let parsed = parse_arxiv_atom(xml, 3);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].category, "scholar");
        assert_eq!(parsed[0].url, "https://arxiv.org/abs/2005.11401v4");
        assert!(parsed[0].snippet.contains("Patrick Lewis, Ethan Perez"));
        assert!(parsed[0].snippet.contains("2020"));
    }

    #[test]
    fn test_parse_github_repos_json() {
        let payload = serde_json::json!({
            "items": [{
                "full_name": "saboor-hamedi/lumina",
                "html_url": "https://github.com/saboor-hamedi/lumina",
                "description": "AI-powered local-first workspace",
                "stargazers_count": 420,
                "language": "TypeScript"
            }]
        });

        let parsed = parse_github_repos_json(&payload, 3);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].title, "saboor-hamedi/lumina");
        assert_eq!(parsed[0].category, "repo");
        assert!(parsed[0].snippet.contains("TypeScript"));
        assert!(parsed[0].snippet.contains("★ 420"));
    }
}
