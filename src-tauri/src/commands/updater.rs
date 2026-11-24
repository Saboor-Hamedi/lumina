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

#[tauri::command]
pub async fn install_app_update(app: tauri::AppHandle, path: String) -> Result<bool, String> {
    let target = PathBuf::from(path.trim());
    let update_dir = std::env::temp_dir().join("lumina-updates");
    let canon_dir = fs::canonicalize(&update_dir).map_err(|e| e.to_string())?;
    let canon_target = fs::canonicalize(&target).map_err(|e| e.to_string())?;
    if !canon_target.starts_with(&canon_dir) || !canon_target.is_file() {
        return Err("Invalid update installer path".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        // Strip Windows verbatim prefix (\\?\) returned by fs::canonicalize, because
        // cmd.exe, msiexec, and NSIS installers fail on \\?\ paths.
        let strip_verbatim = |p: &Path| -> String {
            let s = p.to_string_lossy();
            if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
                format!(r"\\{}", rest)
            } else if let Some(rest) = s.strip_prefix(r"\\?\") {
                rest.to_string()
            } else {
                s.to_string()
            }
        };

        let is_msi = canon_target
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("msi"))
            .unwrap_or(false);

        let installer_str = strip_verbatim(&canon_target);
        let current_exe = std::env::current_exe()
            .ok()
            .map(|p| strip_verbatim(&p));
        let pid = std::process::id();

        // Write a tiny batch helper in the update temp dir so we completely avoid
        // cmd.exe /C quote-stripping & Rust Command::arg \" escaping bugs, wait for
        // the current Lumina process to release file locks, run the installer, and
        // relaunch Lumina cleanly.
        let runner_path = update_dir.join("run-update.cmd");
        let mut bat = String::new();
        bat.push_str("@echo off\r\n");
        bat.push_str("setlocal\r\n");
        // Wait up to ~10 seconds for the exiting Lumina process to release exe locks
        bat.push_str(&format!(
            "for /L %%i in (1,1,20) do (\r\n  tasklist /FI \"PID eq {pid}\" 2>NUL | find /I \"{pid}\" >NUL || goto :run_installer\r\n  ping -n 1 -w 500 127.0.0.1 >NUL\r\n)\r\n"
        ));
        bat.push_str(":run_installer\r\n");
        if is_msi {
            bat.push_str(&format!(
                "msiexec /i \"{}\" /passive\r\n",
                installer_str
            ));
        } else {
            // Silent NSIS in-place upgrade; if silent fails (e.g. UAC/custom state), fall back to interactive UI
            bat.push_str(&format!(
                "\"{}\" /S\r\nif errorlevel 1 \"{}\"\r\n",
                installer_str, installer_str
            ));
        }
        if let Some(exe) = current_exe {
            bat.push_str(&format!(
                "if exist \"{}\" start \"\" \"{}\"\r\n",
                exe, exe
            ));
        }
        bat.push_str("del /f /q \"%~f0\" >NUL 2>&1\r\n");

        fs::write(&runner_path, bat)
            .map_err(|e| format!("Failed to prepare update runner: {}", e))?;

        let runner_str = strip_verbatim(&runner_path);
        Command::new("cmd")
            .args(["/C", &runner_str])
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
        app.exit(0);
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
        app.exit(0);
    }

    Ok(true)
}

