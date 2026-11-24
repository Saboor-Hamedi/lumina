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
fn ps_single_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

#[cfg(any(target_os = "windows", test))]
fn build_windows_update_script(
    pid: u32,
    installer_str: &str,
    is_msi: bool,
    current_exe: Option<&str>,
    log_path: &str,
) -> String {
    let ps_log = ps_single_quote(log_path);
    let ps_installer = ps_single_quote(installer_str);
    let mut ps = String::new();
    ps.push_str("$ErrorActionPreference = 'Continue'\r\n");
    ps.push_str(&format!("$log = {ps_log}\r\n"));
    ps.push_str(&format!(
        "\"[Lumina Updater] Waiting for PID {pid} to exit...\" | Set-Content -Path $log -Encoding UTF8\r\n"
    ));
    // Native Win32 WaitForSingleObject on the exiting Lumina PID (up to 20s).
    ps.push_str(&format!(
        "try {{ Wait-Process -Id {pid} -Timeout 20 -ErrorAction SilentlyContinue }} catch {{}}\r\n"
    ));
    // Brief 2-second settle so WebView2 child processes release all file handles cleanly.
    ps.push_str("Start-Sleep -Seconds 2\r\n");

    if is_msi {
        ps.push_str("\"[Lumina Updater] Running MSI installer...\" | Add-Content -Path $log -Encoding UTF8\r\n");
        ps.push_str(&format!(
            "$p = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', {ps_installer}, '/passive') -Wait -PassThru\r\n"
        ));
        ps.push_str("\"[Lumina Updater] MSI installer exited with code $($p.ExitCode)\" | Add-Content -Path $log -Encoding UTF8\r\n");
    } else {
        // VS Code-style silent NSIS in-place upgrade (/S) with -Wait so relaunch never races
        // against file replacement; falls back to interactive installer if silent returns non-zero.
        ps.push_str("\"[Lumina Updater] Running silent NSIS installer...\" | Add-Content -Path $log -Encoding UTF8\r\n");
        ps.push_str(&format!(
            "$p = Start-Process -FilePath {ps_installer} -ArgumentList '/S' -Wait -PassThru\r\n"
        ));
        ps.push_str("\"[Lumina Updater] Silent installer exited with code $($p.ExitCode)\" | Add-Content -Path $log -Encoding UTF8\r\n");
        ps.push_str("if ($null -eq $p -or $p.ExitCode -ne 0) {\r\n");
        ps.push_str("  \"[Lumina Updater] Launching interactive installer fallback...\" | Add-Content -Path $log -Encoding UTF8\r\n");
        ps.push_str(&format!(
            "  Start-Process -FilePath {ps_installer} -Wait\r\n"
        ));
        ps.push_str("}\r\n");
    }

    ps.push_str("Start-Sleep -Seconds 1\r\n");
    if let Some(exe) = current_exe {
        let ps_exe = ps_single_quote(exe);
        ps.push_str(&format!("$targetExe = {ps_exe}\r\n"));
        ps.push_str("if (-not (Test-Path -LiteralPath $targetExe)) {\r\n");
        ps.push_str("  $targetExe = Join-Path $env:LOCALAPPDATA 'Lumina\\Lumina.exe'\r\n");
        ps.push_str("}\r\n");
    } else {
        ps.push_str("$targetExe = Join-Path $env:LOCALAPPDATA 'Lumina\\Lumina.exe'\r\n");
    }
    ps.push_str("if (Test-Path -LiteralPath $targetExe) {\r\n");
    ps.push_str("  \"[Lumina Updater] Relaunching $targetExe\" | Add-Content -Path $log -Encoding UTF8\r\n");
    ps.push_str("  Start-Process -FilePath $targetExe\r\n");
    ps.push_str("}\r\n");
    ps.push_str("Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue\r\n");
    ps
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
        // CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP keeps the updater runner hidden
        // and independent of Lumina's process group so it survives app.exit(0).
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

        let runner_path = update_dir.join("run-update.ps1");
        let log_path = strip_windows_verbatim(&update_dir.join("last-update.log"));
        let script = build_windows_update_script(
            pid,
            &installer_str,
            is_msi,
            current_exe.as_deref(),
            &log_path,
        );

        fs::write(&runner_path, script)
            .map_err(|e| format!("Failed to prepare update runner: {}", e))?;

        let runner_str = strip_windows_verbatim(&runner_path);
        Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-File",
                &runner_str,
            ])
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
        assert!(script.contains("Wait-Process -Id 4242"));
        assert!(script.contains("Start-Process -FilePath 'C:\\Temp\\Lumina_1.4.7_x64-setup.exe' -ArgumentList '/S' -Wait -PassThru"));
        assert!(script.contains("if ($null -eq $p -or $p.ExitCode -ne 0)"));
        assert!(script.contains("C:\\Users\\Alice\\AppData\\Local\\Lumina\\Lumina.exe"));
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
        assert!(script.contains("Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', 'C:\\Temp\\Lumina_1.4.7_x64.msi', '/passive') -Wait -PassThru"));
        assert!(script.contains("Join-Path $env:LOCALAPPDATA 'Lumina\\Lumina.exe'"));
    }
}

