//! Lightweight CORS-free URL metadata fetcher for website & YouTube link preview cards.

use super::common::run_blocking;
use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct LinkMetadata {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub favicon: Option<String>,
    pub site_name: Option<String>,
}

fn decode_html_entities(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&#x27;", "'")
        .replace("&nbsp;", " ")
        .trim()
        .to_string()
}

fn extract_tag_content(html: &str, open_tag: &str, close_tag: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let start = lower.find(open_tag)?;
    let after_open = html.get(start + open_tag.len()..)?;
    let gt_offset = after_open.find('>')?;
    let body_start = start + open_tag.len() + gt_offset + 1;
    let rest_lower = lower.get(body_start..)?;
    let end_rel = rest_lower.find(close_tag)?;
    let raw = html.get(body_start..body_start + end_rel)?;
    let cleaned = decode_html_entities(raw);
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn extract_attr(tag: &str, attr_name: &str) -> Option<String> {
    let lower = tag.to_ascii_lowercase();
    let needle = format!("{}=", attr_name);
    let idx = lower.find(&needle)?;
    let rest = tag.get(idx + needle.len()..)?.trim_start();
    let quote = rest.chars().next()?;
    if quote == '"' || quote == '\'' {
        let inner = rest.get(1..)?;
        let end = inner.find(quote)?;
        let val = decode_html_entities(inner.get(..end)?);
        if val.is_empty() { None } else { Some(val) }
    } else {
        let end = rest
            .find(|c: char| c.is_whitespace() || c == '>' || c == '/')
            .unwrap_or(rest.len());
        let val = decode_html_entities(rest.get(..end)?);
        if val.is_empty() { None } else { Some(val) }
    }
}

fn extract_meta_content(html: &str, keys: &[&str]) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let mut pos = 0;
    while let Some(rel) = lower.get(pos..)?.find("<meta") {
        let start = pos + rel;
        let end_rel = lower.get(start..)?.find('>')?;
        let tag = html.get(start..=start + end_rel)?;
        let prop = extract_attr(tag, "property").or_else(|| extract_attr(tag, "name"));
        if let Some(p) = prop {
            let p_lower = p.to_ascii_lowercase();
            if keys.iter().any(|k| *k == p_lower) {
                if let Some(content) = extract_attr(tag, "content") {
                    return Some(content);
                }
            }
        }
        pos = start + end_rel + 1;
    }
    None
}

fn origin_of(url: &str) -> Option<String> {
    let scheme_end = url.find("://")?;
    let after_scheme = &url[scheme_end + 3..];
    let host_end = after_scheme.find('/').unwrap_or(after_scheme.len());
    Some(format!("{}{}", &url[..scheme_end + 3], &after_scheme[..host_end]))
}

#[tauri::command]
pub async fn fetch_link_metadata(url: String) -> Result<LinkMetadata, String> {
    let trimmed = url.trim().to_string();
    if !lumina_core::is_safe_external_url(&trimmed)
        || !(trimmed.starts_with("http://") || trimmed.starts_with("https://"))
    {
        return Err("Unsupported URL".to_string());
    }

    run_blocking(move || {
        let origin = origin_of(&trimmed);
        let default_favicon = origin
            .as_ref()
            .map(|o| format!("{}/favicon.ico", o));

        let mut cmd = Command::new("curl");
        cmd.args([
            "-sL",
            "--max-time",
            "4",
            "--max-filesize",
            "327680",
            "-A",
            "Mozilla/5.0 (compatible; Lumina/1.5)",
            &trimmed,
        ]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to fetch metadata: {}", e))?;

        let raw = String::from_utf8_lossy(&output.stdout);
        // Only scan the first 64KB (head section) to stay fast.
        let head = if raw.len() > 65536 {
            &raw[..raw.floor_char_boundary(65536)]
        } else {
            &raw
        };

        let title = extract_meta_content(head, &["og:title", "twitter:title"])
            .or_else(|| extract_tag_content(head, "<title", "</title>"));
        let description =
            extract_meta_content(head, &["og:description", "twitter:description", "description"]);
        let image = extract_meta_content(head, &["og:image", "twitter:image"]).map(|img| {
            if img.starts_with("//") {
                format!("https:{}", img)
            } else if img.starts_with('/') {
                if let Some(o) = &origin {
                    format!("{}{}", o, img)
                } else {
                    img
                }
            } else {
                img
            }
        });
        let site_name = extract_meta_content(head, &["og:site_name"]);

        Ok(LinkMetadata {
            url: trimmed,
            title,
            description,
            image,
            favicon: default_favicon,
            site_name,
        })
    })
    .await
}
