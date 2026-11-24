//! Lightweight CORS-free URL metadata & oEmbed fetcher for website, YouTube, Pinterest & social links.

use super::common::run_blocking;
use serde::Serialize;
use serde_json::Value;
use std::process::Command;

const MAX_URL_LENGTH: usize = 2048;
const MAX_PATH_SEGMENTS: usize = 64;
const HEAD_SCAN_BYTES: usize = 196_608; // 192KB covers large social/SPA <head> sections

#[derive(Debug, Clone, Serialize)]
pub struct LinkMetadata {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub favicon: Option<String>,
    pub site_name: Option<String>,
    pub author: Option<String>,
}

fn decode_numeric_entities(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(idx) = rest.find("&#") {
        out.push_str(&rest[..idx]);
        let after = &rest[idx + 2..];
        if let Some(semi) = after.find(';') {
            if semi <= 8 {
                let code_str = &after[..semi];
                let parsed = if let Some(hex) = code_str.strip_prefix('x').or_else(|| code_str.strip_prefix('X')) {
                    u32::from_str_radix(hex, 16).ok()
                } else {
                    code_str.parse::<u32>().ok()
                };
                if let Some(ch) = parsed.and_then(char::from_u32) {
                    out.push(ch);
                    rest = &after[semi + 1..];
                    continue;
                }
            }
        }
        out.push_str("&#");
        rest = after;
    }
    out.push_str(rest);
    out
}

fn clean_text(input: &str, max_chars: usize) -> Option<String> {
    let named = input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ");
    let decoded = decode_numeric_entities(&named);
    let collapsed = decoded.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        return None;
    }
    if collapsed.chars().count() > max_chars {
        let truncated: String = collapsed.chars().take(max_chars.saturating_sub(1)).collect();
        Some(format!("{}…", truncated.trim_end()))
    } else {
        Some(collapsed)
    }
}

fn url_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

fn extract_tag_content(html: &str, open_tag: &str, close_tag: &str, max_chars: usize) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let start = lower.find(open_tag)?;
    let after_open = html.get(start + open_tag.len()..)?;
    let gt_offset = after_open.find('>')?;
    let body_start = start + open_tag.len() + gt_offset + 1;
    let rest_lower = lower.get(body_start..)?;
    let end_rel = rest_lower.find(close_tag)?;
    let raw = html.get(body_start..body_start + end_rel)?;
    clean_text(raw, max_chars)
}

fn extract_attr(tag: &str, attr_name: &str, max_chars: usize) -> Option<String> {
    let lower = tag.to_ascii_lowercase();
    let needle = format!("{}=", attr_name);
    let mut search_from = 0;
    while let Some(rel) = lower.get(search_from..)?.find(&needle) {
        let idx = search_from + rel;
        // Ensure attribute name is preceded by whitespace (not a suffix like `data-content=`)
        if idx > 0 {
            let prev = tag.as_bytes()[idx - 1];
            if !prev.is_ascii_whitespace() {
                search_from = idx + needle.len();
                continue;
            }
        }
        let rest = tag.get(idx + needle.len()..)?.trim_start();
        let quote = rest.chars().next()?;
        if quote == '"' || quote == '\'' {
            let inner = rest.get(1..)?;
            let end = inner.find(quote)?;
            return clean_text(inner.get(..end)?, max_chars);
        } else {
            let end = rest
                .find(|c: char| c.is_whitespace() || c == '>' || c == '/')
                .unwrap_or(rest.len());
            return clean_text(rest.get(..end)?, max_chars);
        }
    }
    None
}

fn extract_meta_content(html: &str, keys: &[&str], max_chars: usize) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let mut pos = 0;
    while let Some(rel) = lower.get(pos..)?.find("<meta") {
        let start = pos + rel;
        let end_rel = lower.get(start..)?.find('>')?;
        let tag = html.get(start..=start + end_rel)?;
        let prop = extract_attr(tag, "property", 64)
            .or_else(|| extract_attr(tag, "name", 64))
            .or_else(|| extract_attr(tag, "itemprop", 64));
        if let Some(p) = prop {
            let p_lower = p.to_ascii_lowercase();
            if keys.iter().any(|k| *k == p_lower) {
                if let Some(content) = extract_attr(tag, "content", max_chars) {
                    return Some(content);
                }
            }
        }
        pos = start + end_rel + 1;
    }
    None
}

fn resolve_relative_url(raw: &str, origin: Option<&str>) -> Option<String> {
    let resolved = if raw.starts_with("//") {
        format!("https:{}", raw)
    } else if raw.starts_with('/') {
        origin.map(|o| format!("{}{}", o, raw))?
    } else {
        raw.to_string()
    };
    if (resolved.starts_with("http://") || resolved.starts_with("https://"))
        && resolved.len() <= MAX_URL_LENGTH
    {
        Some(resolved)
    } else {
        None
    }
}

fn extract_link_icon(html: &str, origin: Option<&str>) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let mut pos = 0;
    while let Some(rel) = lower.get(pos..)?.find("<link") {
        let start = pos + rel;
        let end_rel = lower.get(start..)?.find('>')?;
        let tag = html.get(start..=start + end_rel)?;
        if let Some(rel_attr) = extract_attr(tag, "rel", 64) {
            let rel_lower = rel_attr.to_ascii_lowercase();
            if rel_lower.contains("icon") {
                if let Some(href) = extract_attr(tag, "href", MAX_URL_LENGTH) {
                    if let Some(resolved) = resolve_relative_url(&href, origin) {
                        return Some(resolved);
                    }
                }
            }
        }
        pos = start + end_rel + 1;
    }
    None
}

fn host_of(url: &str) -> Option<String> {
    let scheme_end = url.find("://")?;
    let rest = &url[scheme_end + 3..];
    let authority_end = rest
        .find(|c: char| c == '/' || c == '?' || c == '#')
        .unwrap_or(rest.len());
    let authority = &rest[..authority_end];
    let host = authority.split(':').next()?.to_ascii_lowercase();
    Some(host.trim_start_matches("www.").to_string())
}

fn origin_of(url: &str) -> Option<String> {
    let scheme_end = url.find("://")?;
    let after_scheme = &url[scheme_end + 3..];
    let host_end = after_scheme
        .find(|c: char| c == '/' || c == '?' || c == '#')
        .unwrap_or(after_scheme.len());
    Some(format!("{}{}", &url[..scheme_end + 3], &after_scheme[..host_end]))
}

/// Validates that a URL is safe to fetch remotely (public HTTP/HTTPS host, bounded length & depth).
fn is_valid_fetchable_url(url: &str) -> bool {
    if url.is_empty() || url.len() > MAX_URL_LENGTH {
        return false;
    }
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return false;
    }
    if url.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return false;
    }
    if url.to_ascii_lowercase().contains("%00") {
        return false;
    }
    if !lumina_core::is_safe_external_url(url) {
        return false;
    }

    let scheme_end = match url.find("://") {
        Some(idx) => idx,
        None => return false,
    };
    let rest = &url[scheme_end + 3..];
    let authority_end = rest
        .find(|c: char| c == '/' || c == '?' || c == '#')
        .unwrap_or(rest.len());
    let authority = &rest[..authority_end];
    if authority.is_empty() || authority.contains('@') {
        return false;
    }

    let host = if authority.starts_with('[') {
        return false;
    } else {
        authority.split(':').next().unwrap_or("").to_ascii_lowercase()
    };

    if host.is_empty()
        || host.len() > 253
        || host == "localhost"
        || host.ends_with(".local")
        || host == "0.0.0.0"
        || host.chars().all(|c| c.is_ascii_digit())
        || host.starts_with("127.")
        || host.starts_with("10.")
        || host.starts_with("192.168.")
        || host.starts_with("169.254.")
        || !host.contains('.')
        || host.contains("..")
        || host.starts_with('.')
        || host.ends_with('.')
    {
        return false;
    }

    let path_and_more = &rest[authority_end..];
    let path_end = path_and_more
        .find(|c: char| c == '?' || c == '#')
        .unwrap_or(path_and_more.len());
    let path = &path_and_more[..path_end];
    let segment_count = path.split('/').filter(|s| !s.is_empty()).count();
    segment_count <= MAX_PATH_SEGMENTS
}

fn curl_fetch(url: &str, user_agent: &str, max_time: &str) -> Result<String, String> {
    let mut cmd = Command::new("curl");
    cmd.args([
        "-sL",
        "--compressed",
        "--max-redirs",
        "6",
        "--max-time",
        max_time,
        "-A",
        user_agent,
        "-H",
        "Accept: text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "-H",
        "Accept-Language: en-US,en;q=0.9",
        url,
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to fetch metadata: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn is_social_preview_host(host: &str) -> bool {
    host == "pin.it"
        || host.contains("pinterest.")
        || host == "x.com"
        || host == "twitter.com"
        || host.ends_with(".twitter.com")
        || host == "instagram.com"
        || host.ends_with(".instagram.com")
        || host == "threads.net"
        || host == "facebook.com"
        || host == "fb.watch"
        || host == "linkedin.com"
        || host == "tiktok.com"
        || host.ends_with(".tiktok.com")
        || host == "reddit.com"
        || host.ends_with(".reddit.com")
        || host == "redd.it"
}

fn oembed_endpoint_for(host: &str, url: &str) -> Option<String> {
    let encoded = url_encode(url);
    if host == "youtube.com" || host == "youtu.be" || host == "m.youtube.com" || host == "music.youtube.com" {
        Some(format!("https://www.youtube.com/oembed?format=json&url={}", encoded))
    } else if host.contains("pinterest.") {
        Some(format!("https://www.pinterest.com/oembed.json?url={}", encoded))
    } else if host == "x.com" || host == "twitter.com" || host == "mobile.twitter.com" {
        Some(format!("https://publish.twitter.com/oembed?omit_script=true&url={}", encoded))
    } else if host == "tiktok.com" || host.ends_with(".tiktok.com") {
        Some(format!("https://www.tiktok.com/oembed?url={}", encoded))
    } else if host == "reddit.com" || host.ends_with(".reddit.com") || host == "redd.it" {
        Some(format!("https://www.reddit.com/oembed?url={}", encoded))
    } else if host == "open.spotify.com" {
        Some(format!("https://open.spotify.com/oembed?url={}", encoded))
    } else if host == "vimeo.com" {
        Some(format!("https://vimeo.com/api/oembed.json?url={}", encoded))
    } else {
        None
    }
}

fn try_fetch_oembed(endpoint: &str) -> Option<(Option<String>, Option<String>, Option<String>, Option<String>)> {
    let body = curl_fetch(endpoint, "Mozilla/5.0 (compatible; Lumina/1.5)", "4").ok()?;
    let json: Value = serde_json::from_str(&body).ok()?;
    let title = json
        .get("title")
        .and_then(Value::as_str)
        .and_then(|s| clean_text(s, 200));
    let author = json
        .get("author_name")
        .and_then(Value::as_str)
        .and_then(|s| clean_text(s, 100));
    let provider = json
        .get("provider_name")
        .and_then(Value::as_str)
        .and_then(|s| clean_text(s, 80));
    let thumb = json
        .get("thumbnail_url")
        .and_then(Value::as_str)
        .and_then(|s| resolve_relative_url(s, None));

    if title.is_some() || thumb.is_some() || author.is_some() {
        Some((title, author, provider, thumb))
    } else {
        None
    }
}

#[tauri::command]
pub async fn fetch_link_metadata(url: String) -> Result<LinkMetadata, String> {
    let trimmed = url.trim().to_string();
    if !is_valid_fetchable_url(&trimmed) {
        return Err("Unsupported or invalid URL".to_string());
    }

    run_blocking(move || {
        let origin = origin_of(&trimmed);
        let host = host_of(&trimmed).unwrap_or_default();
        let default_favicon = origin.as_ref().map(|o| format!("{}/favicon.ico", o));

        let mut title: Option<String> = None;
        let mut description: Option<String> = None;
        let mut image: Option<String> = None;
        let mut site_name: Option<String> = None;
        let mut author: Option<String> = None;
        let mut favicon: Option<String> = default_favicon;

        // 1. Try native oEmbed first for YouTube, Pinterest, X, TikTok, Reddit, Spotify, Vimeo
        if let Some(oembed_url) = oembed_endpoint_for(&host, &trimmed) {
            if let Some((oe_title, oe_author, oe_provider, oe_thumb)) = try_fetch_oembed(&oembed_url) {
                title = oe_title;
                author = oe_author;
                site_name = oe_provider;
                image = oe_thumb;
            }
        }

        // 2. Fetch HTML OpenGraph metadata when we still need title, description, or thumbnail
        //    (Always runs for pin.it, Instagram, general websites, or when oEmbed lacked an image)
        let needs_html = title.is_none() || image.is_none() || description.is_none();
        // Skip heavy HTML fetch for YouTube when oEmbed already succeeded (thumbnail is deterministic)
        let is_youtube = host == "youtube.com" || host == "youtu.be" || host == "m.youtube.com" || host == "music.youtube.com";
        if needs_html && !(is_youtube && title.is_some()) {
            let ua = if is_social_preview_host(&host) {
                "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
            } else {
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            };

            if let Ok(raw) = curl_fetch(&trimmed, ua, "5") {
                let head = if raw.len() > HEAD_SCAN_BYTES {
                    let mut cut = HEAD_SCAN_BYTES;
                    while cut > 0 && !raw.is_char_boundary(cut) {
                        cut -= 1;
                    }
                    &raw[..cut]
                } else {
                    &raw
                };

                if title.is_none() {
                    title = extract_meta_content(head, &["og:title", "twitter:title"], 200)
                        .or_else(|| extract_tag_content(head, "<title", "</title>", 200));
                }
                if description.is_none() {
                    description = extract_meta_content(
                        head,
                        &["og:description", "twitter:description", "description"],
                        320,
                    );
                }
                if image.is_none() {
                    image = extract_meta_content(
                        head,
                        &[
                            "og:image:secure_url",
                            "og:image",
                            "twitter:image:src",
                            "twitter:image",
                            "image",
                        ],
                        MAX_URL_LENGTH,
                    )
                    .and_then(|img| resolve_relative_url(&img, origin.as_deref()));
                }
                if site_name.is_none() {
                    site_name = extract_meta_content(head, &["og:site_name"], 80);
                }
                if author.is_none() {
                    author = extract_meta_content(head, &["author", "twitter:creator"], 80);
                }
                if let Some(icon) = extract_link_icon(head, origin.as_deref()) {
                    favicon = Some(icon);
                }
            }
        }

        // For X/Twitter when title is missing, promote author as readable headline
        if title.is_none() && author.is_some() {
            title = author.clone();
        }

        Ok(LinkMetadata {
            url: trimmed,
            title,
            description,
            image,
            favicon,
            site_name,
            author,
        })
    })
    .await
}
