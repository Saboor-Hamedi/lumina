//! In-app GitHub release downloader, cancellation, and cross-platform installer runner.

use super::common::run_blocking;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::Emitter;

// ──────────────────────────────────────────────────────────────────────────────
// In-App Release Downloader & Installer
// ──────────────────────────────────────────────────────────────────────────────

static UPDATE_DOWNLOAD_CANCELLED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

fn sanitize_update_filename(name: &str) -> String {
    let base = Path::new(name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("lumina-update.exe");
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if cleaned.is_empty() {
        "lumina-update.exe".to_string()
    } else {
        cleaned
    }
}


#[tauri::command]
pub async fn download_app_update(
    app: tauri::AppHandle,
    url: String,
    file_name: String,
    total_bytes: Option<u64>,
) -> Result<String, String> {
    let trimmed_url = url.trim().to_string();
    let allowed = trimmed_url.starts_with("https://github.com/Saboor-Hamedi/lumina/releases/download/")
        || trimmed_url.starts_with("https://objects.githubusercontent.com/");
    if !allowed {
        return Err("Untrusted update download URL".to_string());
    }

    UPDATE_DOWNLOAD_CANCELLED.store(false, std::sync::atomic::Ordering::SeqCst);

    run_blocking(move || {
        let update_dir = std::env::temp_dir().join("lumina-updates");
        fs::create_dir_all(&update_dir).map_err(|e| e.to_string())?;

        let safe_name = sanitize_update_filename(&file_name);
        let final_path = update_dir.join(&safe_name);
        let part_path = update_dir.join(format!("{}.part", safe_name));
        let _ = fs::remove_file(&part_path);

        let mut cmd = Command::new("curl");
        cmd.args([
            "-fSL",
            "--silent",
            "--show-error",
            "-o",
            &part_path.to_string_lossy(),
            &trimmed_url,
        ]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start download: {}", e))?;

        let total = total_bytes.unwrap_or(0);
        loop {
            if UPDATE_DOWNLOAD_CANCELLED.load(std::sync::atomic::Ordering::SeqCst) {
                let _ = child.kill();
                let _ = child.wait();
                let _ = fs::remove_file(&part_path);
                return Err("cancelled".to_string());
            }

            let transferred = fs::metadata(&part_path).map(|m| m.len()).unwrap_or(0);
            let percent = if total > 0 {
                ((transferred as f64 / total as f64) * 100.0).min(99.0)
            } else {
                0.0
            };
            let _ = app.emit(
                "update-download-progress",
                json!({
                    "percent": percent,
                    "transferred": transferred,
                    "total": total
                }),
            );

            match child.try_wait() {
                Ok(Some(status)) => {
                    if !status.success() {
                        let _ = fs::remove_file(&part_path);
                        return Err(format!("Download failed with exit status {}", status));
                    }
                    break;
                }
                Ok(None) => std::thread::sleep(Duration::from_millis(200)),
                Err(e) => {
                    let _ = fs::remove_file(&part_path);
                    return Err(format!("Download wait error: {}", e));
                }
            }
        }

        if final_path.exists() {
            let _ = fs::remove_file(&final_path);
        }
        fs::rename(&part_path, &final_path).map_err(|e| e.to_string())?;

        let final_size = fs::metadata(&final_path).map(|m| m.len()).unwrap_or(total);
        let _ = app.emit(
            "update-download-progress",
            json!({
                "percent": 100.0,
                "transferred": final_size,
                "total": if total > 0 { total } else { final_size }
            }),
        );

        Ok(final_path.to_string_lossy().to_string())
    })
    .await
}

#[tauri::command]
pub fn cancel_app_update() -> Result<(), String> {
    UPDATE_DOWNLOAD_CANCELLED.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[cfg(any(target_os = "windows", test))]
fn strip_windows_verbatim(path: &Path) -> String {
    let s = path.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{}", rest)
    } else if let Some(rest) = s.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        s.to_string()
    }
}

#[tauri::command]
pub async fn install_app_update(_app: tauri::AppHandle, path: String) -> Result<bool, String> {
    let target = PathBuf::from(path.trim());
    let update_dir = std::env::temp_dir().join("lumina-updates");
    let canon_dir = fs::canonicalize(&update_dir).map_err(|e| e.to_string())?;
    let canon_target = fs::canonicalize(&target).map_err(|e| e.to_string())?;
    if !canon_target.starts_with(&canon_dir) || !canon_target.is_file() {
        return Err("Invalid update installer path".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let is_msi = canon_target
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("msi"))
            .unwrap_or(false);

        // Strip `\\?\` verbatim prefix so Windows Explorer, msiexec, and NSIS never fail on the path.
        let installer_str = strip_windows_verbatim(&canon_target);

        // Launch the interactive Setup Wizard modal ("Next -> Next -> Install") visibly on top of
        // Lumina without closing/hiding the app prematurely.
        if is_msi {
            Command::new("msiexec.exe")
                .args(["/i", &installer_str])
                .spawn()
                .map(|_| ())
                .or_else(|_| open::that(&installer_str))
                .map_err(|e| format!("Failed to launch MSI installer: {}", e))?;
        } else {
            Command::new(&installer_str)
                .spawn()
                .map(|_| ())
                .or_else(|_| open::that(&installer_str))
                .map_err(|e| format!("Failed to launch installer: {}", e))?;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        #[cfg(target_os = "linux")]
        if canon_target
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("AppImage"))
            .unwrap_or(false)
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(&canon_target) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&canon_target, perms);
            }
        }
        open::that(&canon_target).map_err(|e| format!("Failed to open installer: {}", e))?;
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_windows_verbatim_prefixes() {
        assert_eq!(
            strip_windows_verbatim(Path::new(r"\\?\C:\Users\Alice\setup.exe")),
            r"C:\Users\Alice\setup.exe"
        );
        assert_eq!(
            strip_windows_verbatim(Path::new(r"\\?\UNC\server\share\setup.exe")),
            r"\\server\share\setup.exe"
        );
        assert_eq!(
            strip_windows_verbatim(Path::new(r"C:\Temp\setup.exe")),
            r"C:\Temp\setup.exe"
        );
    }

    #[test]
    fn sanitizes_update_filenames() {
        assert_eq!(
            sanitize_update_filename("Lumina_1.4.7_x64-setup.exe"),
            "Lumina_1.4.7_x64-setup.exe"
        );
    }
}

