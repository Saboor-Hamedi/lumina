use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const GITHUB_RELEASES_API_URL: &str =
    "https://api.github.com/repos/Saboor-Hamedi/lumina/releases?per_page=25";
pub const GITHUB_RELEASES_CACHE_FILENAME: &str = "github_releases_cache.json";

const ALLOWED_DOWNLOAD_PREFIXES: &[&str] = &[
    "https://github.com/Saboor-Hamedi/lumina/releases/download/",
    "https://objects.githubusercontent.com/",
    "https://release-assets.githubusercontent.com/",
    "https://github-releases.githubusercontent.com/",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseAssetInfo {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
    pub download_count: u64,
    pub content_type: Option<String>,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseNoteEntry {
    pub id: u64,
    pub tag_name: String,
    pub version: String,
    pub name: String,
    pub body: String,
    pub html_url: String,
    pub published_at: Option<String>,
    pub prerelease: bool,
    pub is_latest: bool,
    pub is_installed: bool,
    pub is_newer_than_current: bool,
    pub assets: Vec<ReleaseAssetInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubReleasesResponse {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub update_available: bool,
    pub releases: Vec<ReleaseNoteEntry>,
    pub from_cache: bool,
    pub cached_at: u64,
    pub etag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedReleasesFile {
    pub etag: Option<String>,
    pub cached_at: u64,
    pub raw_body: String,
}

#[derive(Debug, Clone, Deserialize)]
struct RawGitHubAsset {
    #[serde(default)]
    name: String,
    #[serde(default)]
    browser_download_url: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    download_count: u64,
    #[serde(default)]
    content_type: Option<String>,
    #[serde(default)]
    digest: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RawGitHubRelease {
    #[serde(default)]
    id: u64,
    #[serde(default)]
    tag_name: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    html_url: String,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<RawGitHubAsset>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressInfo {
    pub percent: u8,
    pub transferred: u64,
    pub total: u64,
}

pub fn normalize_version_str(raw: &str) -> String {
    raw.trim().trim_start_matches(['v', 'V']).trim().to_string()
}

pub fn parse_semver_lenient(raw: &str) -> Option<semver::Version> {
    let cleaned = normalize_version_str(raw);
    if cleaned.is_empty() {
        return None;
    }
    if let Ok(v) = semver::Version::parse(&cleaned) {
        return Some(v);
    }
    // Handle 2-part versions like "2.1" -> "2.1.0"
    let (core, suffix) = match cleaned.find(['-', '+']) {
        Some(idx) => (&cleaned[..idx], &cleaned[idx..]),
        None => (cleaned.as_str(), ""),
    };
    let parts: Vec<&str> = core.split('.').collect();
    let normalized = match parts.len() {
        1 => format!("{}.0.0{}", parts[0], suffix),
        2 => format!("{}.{}.0{}", parts[0], parts[1], suffix),
        _ => return None,
    };
    semver::Version::parse(&normalized).ok()
}

pub fn is_version_newer(candidate: &str, current: &str) -> bool {
    match (parse_semver_lenient(candidate), parse_semver_lenient(current)) {
        (Some(cand), Some(curr)) => cand > curr,
        _ => false,
    }
}

pub fn is_same_version(a: &str, b: &str) -> bool {
    match (parse_semver_lenient(a), parse_semver_lenient(b)) {
        (Some(va), Some(vb)) => va == vb,
        _ => normalize_version_str(a) == normalize_version_str(b),
    }
}

pub fn validate_release_download_url(url: &str) -> Result<(), String> {
    let trimmed = url.trim();
    if ALLOWED_DOWNLOAD_PREFIXES
        .iter()
        .any(|prefix| trimmed.starts_with(prefix))
    {
        Ok(())
    } else {
        Err(
            "Blocked untrusted update URL: Only official Lumina GitHub release assets are allowed"
                .to_string(),
        )
    }
}

pub fn extract_sha256_digest(digest: Option<&str>) -> Option<String> {
    let raw = digest?.trim();
    let hex_part = raw
        .strip_prefix("sha256:")
        .or_else(|| raw.strip_prefix("SHA256:"))
        .unwrap_or(raw)
        .trim();
    if hex_part.len() == 64 && hex_part.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(hex_part.to_ascii_lowercase())
    } else {
        None
    }
}

fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn cache_file_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(GITHUB_RELEASES_CACHE_FILENAME)
}

pub fn load_cached_releases(app_data_dir: &Path) -> Option<CachedReleasesFile> {
    let path = cache_file_path(app_data_dir);
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str::<CachedReleasesFile>(&content).ok()
}

pub fn save_cached_releases(app_data_dir: &Path, cache: &CachedReleasesFile) -> Result<(), String> {
    fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create app data dir for release cache: {e}"))?;
    let path = cache_file_path(app_data_dir);
    let tmp_path = app_data_dir.join(format!("{GITHUB_RELEASES_CACHE_FILENAME}.tmp"));
    let serialized = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize release cache: {e}"))?;
    fs::write(&tmp_path, serialized)
        .map_err(|e| format!("Failed to write temp release cache: {e}"))?;
    fs::rename(&tmp_path, &path).or_else(|_| {
        fs::copy(&tmp_path, &path)
            .map(|_| {
                let _ = fs::remove_file(&tmp_path);
            })
            .map_err(|e| format!("Failed to persist release cache: {e}"))
    })
}

pub fn build_releases_response_from_json(
    raw_json: &str,
    current_version: &str,
    from_cache: bool,
    cached_at: u64,
    etag: Option<String>,
) -> Result<GitHubReleasesResponse, String> {
    let raw_list: Vec<RawGitHubRelease> = serde_json::from_str(raw_json)
        .map_err(|e| format!("Failed to parse GitHub releases JSON: {e}"))?;

    let normalized_current = normalize_version_str(current_version);
    let current_semver = parse_semver_lenient(&normalized_current);

    let mut non_draft: Vec<RawGitHubRelease> = raw_list
        .into_iter()
        .filter(|r| !r.draft && !r.tag_name.trim().is_empty())
        .collect();

    // Sort highest semver first so index 0 is accurately the latest release
    non_draft.sort_by(|a, b| {
        let va = parse_semver_lenient(&a.tag_name);
        let vb = parse_semver_lenient(&b.tag_name);
        match (vb, va) {
            (Some(sb), Some(sa)) => sb.cmp(&sa),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => b.published_at.cmp(&a.published_at),
        }
    });

    // Latest stable release (or first release if all are prereleases)
    let latest_version: Option<String> = non_draft
        .iter()
        .find(|r| !r.prerelease)
        .or_else(|| non_draft.first())
        .map(|r| normalize_version_str(&r.tag_name));

    let update_available = match (&latest_version, &current_semver) {
        (Some(latest), Some(curr)) => parse_semver_lenient(latest)
            .map(|lat| lat > *curr)
            .unwrap_or(false),
        (Some(latest), None) => is_version_newer(latest, &normalized_current),
        _ => false,
    };

    let releases: Vec<ReleaseNoteEntry> = non_draft
        .into_iter()
        .map(|r| {
            let ver = normalize_version_str(&r.tag_name);
            let is_latest = latest_version
                .as_deref()
                .map(|lat| is_same_version(lat, &ver))
                .unwrap_or(false);
            let is_installed = is_same_version(&ver, &normalized_current);
            let is_newer_than_current = is_version_newer(&ver, &normalized_current);
            let title = r
                .name
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| format!("Lumina v{ver}"));
            let body = r
                .body
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| format!("Release notes for Lumina v{ver}."));

            // Parse any inline SHA-256 lines from the release body as fallback if asset.digest is null
            let assets: Vec<ReleaseAssetInfo> = r
                .assets
                .into_iter()
                .filter(|a| !a.name.is_empty() && !a.browser_download_url.is_empty())
                .map(|a| {
                    let sha256 = extract_sha256_digest(a.digest.as_deref())
                        .or_else(|| extract_sha256_from_body(&body, &a.name));
                    ReleaseAssetInfo {
                        name: a.name,
                        browser_download_url: a.browser_download_url,
                        size: a.size,
                        download_count: a.download_count,
                        content_type: a.content_type,
                        sha256,
                    }
                })
                .collect();

            ReleaseNoteEntry {
                id: r.id,
                tag_name: r.tag_name,
                version: ver,
                name: title,
                body,
                html_url: r.html_url,
                published_at: r.published_at,
                prerelease: r.prerelease,
                is_latest,
                is_installed,
                is_newer_than_current,
                assets,
            }
        })
        .collect();

    Ok(GitHubReleasesResponse {
        current_version: normalized_current,
        latest_version,
        update_available,
        releases,
        from_cache,
        cached_at,
        etag,
    })
}

fn extract_sha256_from_body(body: &str, asset_name: &str) -> Option<String> {
    for line in body.lines() {
        if !line.contains(asset_name) {
            continue;
        }
        for token in line.split(|c: char| c.is_whitespace() || c == '`' || c == ':' || c == '|') {
            if token.len() == 64 && token.chars().all(|c| c.is_ascii_hexdigit()) {
                return Some(token.to_ascii_lowercase());
            }
        }
    }
    None
}

pub fn get_github_releases_impl(
    app_data_dir: &Path,
    current_version: &str,
    force_refresh: bool,
) -> Result<GitHubReleasesResponse, String> {
    let cached = load_cached_releases(app_data_dir);

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .connect_timeout(Duration::from_secs(6))
        .user_agent(format!(
            "Lumina-Desktop/{} (+https://github.com/Saboor-Hamedi/lumina)",
            normalize_version_str(current_version)
        ))
        .build()
        .map_err(|e| format!("Failed to construct HTTP client: {e}"))?;

    let mut request = client
        .get(GITHUB_RELEASES_API_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28");

    if !force_refresh {
        if let Some(ref cache_entry) = cached {
            if let Some(ref etag_val) = cache_entry.etag {
                if !etag_val.trim().is_empty() {
                    request = request.header("If-None-Match", etag_val.trim());
                }
            }
        }
    }

    match request.send() {
        Ok(resp) => {
            let status = resp.status();
            if status == reqwest::StatusCode::NOT_MODIFIED {
                if let Some(cache_entry) = cached {
                    return build_releases_response_from_json(
                        &cache_entry.raw_body,
                        current_version,
                        true,
                        cache_entry.cached_at,
                        cache_entry.etag,
                    );
                }
            }

            if status.is_success() {
                let new_etag = resp
                    .headers()
                    .get("etag")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let raw_body = resp
                    .text()
                    .map_err(|e| format!("Failed to read GitHub releases payload: {e}"))?;
                let now = now_unix_secs();
                let parsed = build_releases_response_from_json(
                    &raw_body,
                    current_version,
                    false,
                    now,
                    new_etag.clone(),
                )?;
                let _ = save_cached_releases(
                    app_data_dir,
                    &CachedReleasesFile {
                        etag: new_etag,
                        cached_at: now,
                        raw_body,
                    },
                );
                return Ok(parsed);
            }

            // Rate-limited (403/429) or server error: return cached data if available
            if let Some(cache_entry) = cached {
                if let Ok(fallback) = build_releases_response_from_json(
                    &cache_entry.raw_body,
                    current_version,
                    true,
                    cache_entry.cached_at,
                    cache_entry.etag,
                ) {
                    return Ok(fallback);
                }
            }
            Err(format!("GitHub Releases API returned HTTP {status}"))
        }
        Err(network_err) => {
            if let Some(cache_entry) = cached {
                if let Ok(fallback) = build_releases_response_from_json(
                    &cache_entry.raw_body,
                    current_version,
                    true,
                    cache_entry.cached_at,
                    cache_entry.etag,
                ) {
                    return Ok(fallback);
                }
            }
            Err(format!("Failed to query GitHub Releases API: {network_err}"))
        }
    }
}

pub fn download_release_asset_with_progress<F>(
    url: &str,
    dest_path: &Path,
    expected_sha256: Option<&str>,
    cancel_flag: &AtomicBool,
    mut on_progress: F,
) -> Result<String, String>
where
    F: FnMut(DownloadProgressInfo),
{
    validate_release_download_url(url)?;

    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create update download directory: {e}"))?;
    }

    let part_path = dest_path.with_extension("part");
    let _ = fs::remove_file(&part_path);

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(600))
        .connect_timeout(Duration::from_secs(15))
        .user_agent(format!(
            "Lumina-Desktop/{} (+https://github.com/Saboor-Hamedi/lumina)",
            env!("CARGO_PKG_VERSION")
        ))
        .build()
        .map_err(|e| format!("Failed to initialize download HTTP client: {e}"))?;

    let mut resp = client
        .get(url)
        .header("Accept", "application/octet-stream")
        .send()
        .map_err(|e| format!("Failed to request release asset: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Release asset download failed with HTTP {}",
            resp.status()
        ));
    }

    let total_bytes = resp.content_length().unwrap_or(0);
    on_progress(DownloadProgressInfo {
        percent: 0,
        transferred: 0,
        total: total_bytes,
    });

    let mut file = fs::File::create(&part_path)
        .map_err(|e| format!("Failed to create temporary update file: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    let mut transferred: u64 = 0;
    let mut last_percent: u8 = 0;

    loop {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = fs::remove_file(&part_path);
            return Err("Update download cancelled".to_string());
        }

        let n = resp
            .read(&mut buffer)
            .map_err(|e| format!("Network read error while downloading update: {e}"))?;
        if n == 0 {
            break;
        }

        file.write_all(&buffer[..n])
            .map_err(|e| format!("Failed to write update chunk to disk: {e}"))?;
        hasher.update(&buffer[..n]);
        transferred += n as u64;

        let percent = if total_bytes > 0 {
            ((transferred.saturating_mul(100)) / total_bytes).min(99) as u8
        } else {
            50
        };

        if percent != last_percent || total_bytes == 0 {
            last_percent = percent;
            on_progress(DownloadProgressInfo {
                percent,
                transferred,
                total: total_bytes,
            });
        }
    }

    file.flush()
        .map_err(|e| format!("Failed to flush downloaded update file: {e}"))?;
    drop(file);

    if transferred == 0 {
        let _ = fs::remove_file(&part_path);
        return Err("Downloaded update package was empty (0 bytes)".to_string());
    }

    if let Some(expected) = expected_sha256.and_then(|s| extract_sha256_digest(Some(s))) {
        let actual = hex::encode(hasher.finalize());
        if actual != expected {
            let _ = fs::remove_file(&part_path);
            return Err(format!(
                "Update SHA-256 checksum mismatch (expected {expected}, got {actual})"
            ));
        }
    }

    if dest_path.exists() {
        let _ = fs::remove_file(dest_path);
    }
    fs::rename(&part_path, dest_path).map_err(|e| {
        let _ = fs::remove_file(&part_path);
        format!("Failed to finalize update package file: {e}")
    })?;

    on_progress(DownloadProgressInfo {
        percent: 100,
        transferred,
        total: total_bytes.max(transferred),
    });

    Ok(dest_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_semver_lenient_and_comparison() {
        assert!(is_version_newer("v2.1.1", "1.4.1"));
        assert!(is_version_newer("2.1.1", "v2.1.0"));
        assert!(!is_version_newer("1.4.1", "2.1.1"));
        assert!(!is_version_newer("2.1.1", "2.1.1"));
        assert!(is_same_version("v2.1.1", "2.1.1"));
        assert!(is_version_newer("2.2", "2.1.9"));
    }

    #[test]
    fn test_build_releases_response_from_json_orders_and_flags() {
        let sample_val = serde_json::json!([
            {
                "id": 101,
                "tag_name": "v1.4.2",
                "name": "Lumina v1.4.2",
                "body": "### Fixes\n- Fixed startup",
                "html_url": "https://github.com/Saboor-Hamedi/lumina/releases/tag/v1.4.2",
                "published_at": "2026-03-01T12:00:00Z",
                "draft": false,
                "prerelease": false,
                "assets": []
            },
            {
                "id": 102,
                "tag_name": "v2.1.1",
                "name": "Lumina v2.1.1",
                "body": "### What's New\n- Islands UI\n- `Lumina_2.1.1_x64-setup.exe` `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`",
                "html_url": "https://github.com/Saboor-Hamedi/lumina/releases/tag/v2.1.1",
                "published_at": "2026-04-15T12:00:00Z",
                "draft": false,
                "prerelease": false,
                "assets": [
                    {
                        "name": "Lumina_2.1.1_x64-setup.exe",
                        "browser_download_url": "https://github.com/Saboor-Hamedi/lumina/releases/download/v2.1.1/Lumina_2.1.1_x64-setup.exe",
                        "size": 10485760,
                        "download_count": 42,
                        "content_type": "application/x-msdownload",
                        "digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                    }
                ]
            },
            {
                "id": 103,
                "tag_name": "v2.2.0-draft",
                "draft": true,
                "prerelease": false,
                "assets": []
            }
        ]);
        let sample_json = sample_val.to_string();

        let res = build_releases_response_from_json(&sample_json, "1.4.2", false, 1700000000, Some("etag1".into()))
            .expect("should parse sample releases");

        assert_eq!(res.current_version, "1.4.2");
        assert_eq!(res.latest_version.as_deref(), Some("2.1.1"));
        assert!(res.update_available);
        assert_eq!(res.releases.len(), 2);
        assert_eq!(res.releases[0].version, "2.1.1");
        assert!(res.releases[0].is_latest);
        assert!(res.releases[0].is_newer_than_current);
        assert!(!res.releases[0].is_installed);
        assert_eq!(
            res.releases[0].assets[0].sha256.as_deref(),
            Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        );

        assert_eq!(res.releases[1].version, "1.4.2");
        assert!(res.releases[1].is_installed);
        assert!(!res.releases[1].is_newer_than_current);
    }

    #[test]
    fn test_validate_release_download_url() {
        assert!(validate_release_download_url(
            "https://github.com/Saboor-Hamedi/lumina/releases/download/v2.1.1/Lumina_2.1.1_x64-setup.exe"
        )
        .is_ok());
        assert!(validate_release_download_url(
            "https://release-assets.githubusercontent.com/github-production-release-asset/12345"
        )
        .is_ok());
        assert!(validate_release_download_url("https://evil.example.com/Lumina.exe").is_err());
    }
}
