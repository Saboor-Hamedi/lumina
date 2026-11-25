use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

use super::common::{get_app_data_dir, run_blocking};

static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);

fn sanitize_update_file_name(file_name: &str) -> Result<String, String> {
    let basename = std::path::Path::new(file_name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .trim();
    let cleaned: String = basename
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
        .collect();
    if cleaned.is_empty() || cleaned.starts_with('.') {
        return Err("Invalid update package filename".to_string());
    }
    Ok(cleaned)
}

fn get_updates_dir() -> PathBuf {
    std::env::temp_dir().join("lumina-updates")
}

#[tauri::command]
pub async fn get_github_releases(
    force: Option<bool>,
) -> Result<lumina_core::GitHubReleasesResponse, String> {
    let app_data_dir = get_app_data_dir();
    let force_refresh = force.unwrap_or(false);
    run_blocking(move || {
        lumina_core::updater::get_github_releases_impl(
            &app_data_dir,
            env!("CARGO_PKG_VERSION"),
            force_refresh,
        )
    })
    .await
}

#[tauri::command]
pub async fn download_app_update(
    app: AppHandle,
    url: String,
    file_name: String,
    expected_sha256: Option<String>,
) -> Result<String, String> {
    lumina_core::updater::validate_release_download_url(&url)?;
    let safe_name = sanitize_update_file_name(&file_name)?;
    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);

    run_blocking(move || {
        let updates_dir = get_updates_dir();
        let dest_path = updates_dir.join(&safe_name);
        lumina_core::updater::download_release_asset_with_progress(
            &url,
            &dest_path,
            expected_sha256.as_deref(),
            &DOWNLOAD_CANCELLED,
            |progress| {
                let _ = app.emit("update-download-progress", progress);
            },
        )
    })
    .await
}

#[tauri::command]
pub fn cancel_app_update() -> Result<bool, String> {
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);
    Ok(true)
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle, file_path: String) -> Result<bool, String> {
    run_blocking(move || {
        let updates_dir = get_updates_dir()
            .canonicalize()
            .map_err(|_| "Updates directory does not exist".to_string())?;
        let canonical = PathBuf::from(&file_path)
            .canonicalize()
            .map_err(|_| "Downloaded update package not found".to_string())?;

        if !canonical.starts_with(&updates_dir) || !canonical.is_file() {
            return Err(
                "Refusing to execute update package outside lumina-updates directory".to_string(),
            );
        }

        #[cfg(target_os = "windows")]
        {
            let ext = canonical
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if ext == "msi" {
                Command::new("msiexec")
                    .arg("/i")
                    .arg(&canonical)
                    .spawn()
                    .map_err(|e| format!("Failed to launch MSI installer: {e}"))?;
            } else {
                Command::new(&canonical)
                    .spawn()
                    .map_err(|e| format!("Failed to launch Windows installer: {e}"))?;
            }
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&canonical)
                .spawn()
                .map_err(|e| format!("Failed to open macOS update package: {e}"))?;
        }

        #[cfg(target_os = "linux")]
        {
            let ext = canonical
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if ext == "appimage" {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Ok(meta) = std::fs::metadata(&canonical) {
                        let mut perms = meta.permissions();
                        perms.set_mode(0o755);
                        let _ = std::fs::set_permissions(&canonical, perms);
                    }
                }
                Command::new(&canonical)
                    .spawn()
                    .map_err(|e| format!("Failed to launch AppImage update: {e}"))?;
            } else if let Some(parent) = canonical.parent() {
                Command::new("xdg-open")
                    .arg(parent)
                    .spawn()
                    .map_err(|e| format!("Failed to reveal downloaded Linux update: {e}"))?;
            }
        }

        app.exit(0);
        Ok(true)
    })
    .await
}
