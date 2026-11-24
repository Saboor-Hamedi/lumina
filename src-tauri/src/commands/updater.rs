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

#[cfg(any(target_os = "windows", test))]
fn build_windows_update_script(
    pid: u32,
    installer_str: &str,
    is_msi: bool,
    current_exe: Option<&str>,
    log_path: &str,
) -> String {
    let mut bat = String::new();
    bat.push_str("@echo off\r\n");
    bat.push_str("setlocal\r\n");
    bat.push_str(&format!(
        "echo [Lumina Updater] Waiting for PID {pid} to exit... > \"{log_path}\"\r\n"
    ));
    // Wait up to ~20 seconds for the exiting Lumina process to fully terminate.
    // `ping -n 2 127.0.0.1` waits ~1 second per iteration (unlike `-n 1`, which exits immediately).
    bat.push_str(&format!(
        "for /L %%i in (1,1,20) do (\r\n  tasklist /FI \"PID eq {pid}\" 2>NUL | find /I \"{pid}\" >NUL || goto :settled\r\n  ping -n 2 127.0.0.1 >NUL\r\n)\r\n"
    ));
    bat.push_str(":settled\r\n");
    // Brief 2-second settle so WebView2 child processes release all file handles cleanly.
    bat.push_str("ping -n 3 127.0.0.1 >NUL\r\n");
    if is_msi {
        bat.push_str(&format!(
            "echo [Lumina Updater] Running MSI installer... >> \"{log_path}\"\r\n"
        ));
        bat.push_str(&format!(
            "start \"\" /wait msiexec /i \"{installer_str}\" /passive\r\n"
        ));
    } else {
        // VS Code-style silent NSIS in-place upgrade (/S) with `start "" /wait` so cmd.exe
        // actually waits for the GUI-subsystem installer before relaunching Lumina.
        // Falls back to the interactive installer if silent returns a non-zero exit code.
        bat.push_str(&format!(
            "echo [Lumina Updater] Running silent NSIS installer... >> \"{log_path}\"\r\n"
        ));
        bat.push_str(&format!(
            "start \"\" /wait \"{installer_str}\" /S\r\n"
        ));
        bat.push_str(&format!(
            "if errorlevel 1 (\r\n  echo [Lumina Updater] Silent install returned %ERRORLEVEL%, launching interactive installer... >> \"{log_path}\"\r\n  start \"\" /wait \"{installer_str}\"\r\n)\r\n"
        ));
    }
    // Wait 1 second for installer file flush before relaunching.
    bat.push_str("ping -n 2 127.0.0.1 >NUL\r\n");
    if let Some(exe) = current_exe {
        bat.push_str(&format!(
            "if exist \"{exe}\" (\r\n  echo [Lumina Updater] Relaunching {exe} >> \"{log_path}\"\r\n  start \"\" \"{exe}\"\r\n) else if exist \"%LOCALAPPDATA%\\Lumina\\Lumina.exe\" (\r\n  echo [Lumina Updater] Relaunching default install >> \"{log_path}\"\r\n  start \"\" \"%LOCALAPPDATA%\\Lumina\\Lumina.exe\"\r\n)\r\n"
        ));
    } else {
        bat.push_str(&format!(
            "if exist \"%LOCALAPPDATA%\\Lumina\\Lumina.exe\" (\r\n  echo [Lumina Updater] Relaunching default install >> \"{log_path}\"\r\n  start \"\" \"%LOCALAPPDATA%\\Lumina\\Lumina.exe\"\r\n)\r\n"
        ));
    }
    bat.push_str("del /f /q \"%~f0\" >NUL 2>&1\r\n");
    bat
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
        // Note: CREATE_NO_WINDOW and DETACHED_PROCESS are mutually exclusive in Win32
        // CreateProcessW. Use CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP so the runner
        // stays hidden, detached from our process group, and survives app.exit(0).
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

        let is_msi = canon_target
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("msi"))
            .unwrap_or(false);

        let installer_str = strip_windows_verbatim(&canon_target);
        let current_exe = std::env::current_exe()
            .ok()
            .map(|p| strip_windows_verbatim(&p));
        let pid = std::process::id();

        let runner_path = update_dir.join("run-update.cmd");
        let log_path = strip_windows_verbatim(&update_dir.join("last-update.log"));
        let bat = build_windows_update_script(
            pid,
            &installer_str,
            is_msi,
            current_exe.as_deref(),
            &log_path,
        );

        fs::write(&runner_path, bat)
            .map_err(|e| format!("Failed to prepare update runner: {}", e))?;

        let runner_str = strip_windows_verbatim(&runner_path);
        Command::new("cmd")
            .args(["/D", "/C", &runner_str])
            .creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP)
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
    fn builds_silent_nsis_script_with_wait_and_fallback() {
        let script = build_windows_update_script(
            4242,
            r"C:\Temp\Lumina_1.4.7_x64-setup.exe",
            false,
            Some(r"C:\Users\Alice\AppData\Local\Lumina\Lumina.exe"),
            r"C:\Temp\last-update.log",
        );
        assert!(script.contains("PID eq 4242"));
        assert!(script.contains("ping -n 2 127.0.0.1"));
        assert!(script.contains("start \"\" /wait \"C:\\Temp\\Lumina_1.4.7_x64-setup.exe\" /S"));
        assert!(script.contains("if errorlevel 1"));
        assert!(script.contains("start \"\" \"C:\\Users\\Alice\\AppData\\Local\\Lumina\\Lumina.exe\""));
    }

    #[test]
    fn builds_msi_script_with_wait() {
        let script = build_windows_update_script(
            9001,
            r"C:\Temp\Lumina_1.4.7_x64.msi",
            true,
            None,
            r"C:\Temp\last-update.log",
        );
        assert!(script.contains("start \"\" /wait msiexec /i \"C:\\Temp\\Lumina_1.4.7_x64.msi\" /passive"));
        assert!(script.contains("%LOCALAPPDATA%\\Lumina\\Lumina.exe"));
    }
}

