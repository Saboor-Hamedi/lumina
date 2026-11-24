//! Native cross-platform ConPTY / PTY terminal engine commands.
//!
//! Manages shell discovery, PTY session lifecycle, UTF-8-safe streaming over
//! Tauri events, and deduplicated terminal resizing.

use super::common::{resolve_workspace_path, run_blocking};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

// ──────────────────────────────────────────────────────────────────────────────
// Native ConPTY / PTY Terminal Engine for Tauri
// ──────────────────────────────────────────────────────────────────────────────

struct TauriPtySession {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    last_size: Mutex<(u16, u16)>,
}

static TAURI_PTY_SESSIONS: OnceLock<Mutex<HashMap<String, Arc<TauriPtySession>>>> = OnceLock::new();

fn tauri_sessions() -> &'static Mutex<HashMap<String, Arc<TauriPtySession>>> {
    TAURI_PTY_SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ShellProfile {
    pub id: String,
    pub label: String,
    pub path: String,
    pub args: Vec<String>,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
}

static CACHED_SHELLS: OnceLock<Vec<ShellProfile>> = OnceLock::new();

fn terminal_get_shells_sync() -> Vec<ShellProfile> {
    CACHED_SHELLS
        .get_or_init(|| {
            let mut shells = Vec::new();
            #[cfg(target_os = "windows")]
            {
                let git_bash_candidates = [
                    r"C:\Program Files\Git\bin\bash.exe",
                    r"C:\Program Files\Git\usr\bin\bash.exe",
                    r"C:\Program Files (x86)\Git\bin\bash.exe",
                ];
                for candidate in git_bash_candidates {
                    if Path::new(candidate).exists() {
                        shells.push(ShellProfile {
                            id: "git-bash".to_string(),
                            label: "Git Bash".to_string(),
                            path: candidate.to_string(),
                            // Omit --login to skip slow MSYS2 /etc/profile.d probes (3-5x faster startup)
                            args: vec!["-i".to_string()],
                            is_default: true,
                        });
                        break;
                    }
                }
                shells.push(ShellProfile {
                    id: "powershell".to_string(),
                    label: "PowerShell".to_string(),
                    path: "powershell.exe".to_string(),
                    args: vec!["-NoLogo".to_string()],
                    is_default: shells.is_empty(),
                });
                shells.push(ShellProfile {
                    id: "cmd".to_string(),
                    label: "Command Prompt".to_string(),
                    path: "cmd.exe".to_string(),
                    args: vec![],
                    is_default: false,
                });
            }
            #[cfg(not(target_os = "windows"))]
            {
                let sh = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
                shells.push(ShellProfile {
                    id: "default".to_string(),
                    label: "Shell".to_string(),
                    path: sh,
                    args: vec!["-i".to_string()],
                    is_default: true,
                });
            }
            shells
        })
        .clone()
}

#[tauri::command]
pub async fn terminal_get_shells() -> Result<Vec<ShellProfile>, String> {
    run_blocking(|| Ok(terminal_get_shells_sync())).await
}

#[tauri::command]
pub async fn terminal_spawn(
    app: AppHandle,
    payload: Value,
) -> Result<Value, String> {
    run_blocking(move || {
        let session_id = payload
            .get("sessionId")
            .and_then(|v| v.as_str())
            .unwrap_or("term-1")
            .to_string();
        let cols = payload.get("cols").and_then(|v| v.as_u64()).unwrap_or(80) as u16;
        let rows = payload.get("rows").and_then(|v| v.as_u64()).unwrap_or(24) as u16;
        let cwd = payload
            .get("cwd")
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| resolve_workspace_path().to_string_lossy().to_string());

        let shells = terminal_get_shells_sync();
        let requested_id = payload
            .get("shellId")
            .or_else(|| payload.get("shell"))
            .and_then(|v| v.as_str());
        let chosen_shell = requested_id
            .and_then(|id| shells.iter().find(|s| s.id == id || s.path == id))
            .or_else(|| shells.iter().find(|s| s.is_default))
            .or_else(|| shells.first())
            .cloned()
            .unwrap_or(ShellProfile {
                id: "powershell".to_string(),
                label: "PowerShell".to_string(),
                path: "powershell.exe".to_string(),
                args: vec![],
                is_default: true,
            });

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(2),
                cols: cols.max(10),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new(&chosen_shell.path);
        for arg in &chosen_shell.args {
            cmd.arg(arg);
        }
        if Path::new(&cwd).exists() {
            cmd.cwd(&cwd);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("TERM_PROGRAM", "Lumina");
        #[cfg(target_os = "windows")]
        {
            cmd.env("MSYSTEM", "MINGW64");
            cmd.env("CHERE_INVOKING", "1");
        }

        let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        let pid = child.process_id().unwrap_or(0);
        let killer = child.clone_killer();
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        let session = Arc::new(TauriPtySession {
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            killer: Mutex::new(killer),
            last_size: Mutex::new((cols.max(10), rows.max(2))),
        });

        if let Ok(mut map) = tauri_sessions().lock() {
            if let Some(old) = map.remove(&session_id) {
                if let Ok(mut k) = old.killer.lock() {
                    let _ = k.kill();
                }
            }
            map.insert(session_id.clone(), session);
        }

        let sid_reader = session_id.clone();
        let app_reader = app.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 16384];
            let mut pending_utf8: Vec<u8> = Vec::with_capacity(8);
            let channel = format!("terminal:data:{}", sid_reader);
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 {
                    break;
                }
                let slice: &[u8] = if pending_utf8.is_empty() {
                    &buf[..n]
                } else {
                    pending_utf8.extend_from_slice(&buf[..n]);
                    &pending_utf8
                };

                let mut out = String::with_capacity(slice.len());
                let mut rest = slice;
                let mut carry: Option<Vec<u8>> = None;

                while !rest.is_empty() {
                    match std::str::from_utf8(rest) {
                        Ok(valid) => {
                            out.push_str(valid);
                            break;
                        }
                        Err(e) => {
                            let valid_up_to = e.valid_up_to();
                            if valid_up_to > 0 {
                                if let Ok(valid) = std::str::from_utf8(&rest[..valid_up_to]) {
                                    out.push_str(valid);
                                }
                            }
                            if let Some(err_len) = e.error_len() {
                                out.push('\u{FFFD}');
                                rest = &rest[valid_up_to + err_len..];
                            } else {
                                // Incomplete trailing UTF-8 sequence — carry into next read
                                carry = Some(rest[valid_up_to..].to_vec());
                                break;
                            }
                        }
                    }
                }

                pending_utf8.clear();
                if let Some(c) = carry {
                    pending_utf8 = c;
                }

                if !out.is_empty() {
                    let _ = app_reader.emit(&channel, out);
                }
            }
            if !pending_utf8.is_empty() {
                let text = String::from_utf8_lossy(&pending_utf8).to_string();
                let _ = app_reader.emit(&channel, text);
            }
        });

        let sid_wait = session_id.clone();
        let app_wait = app.clone();
        std::thread::spawn(move || {
            let code = child.wait().map(|s| s.exit_code()).unwrap_or(0);
            if let Ok(mut map) = tauri_sessions().lock() {
                map.remove(&sid_wait);
            }
            let channel = format!("terminal:exit:{}", sid_wait);
            let _ = app_wait.emit(&channel, code);
        });

        Ok(json!({
            "success": true,
            "sessionId": session_id,
            "pid": pid,
            "shell": chosen_shell.label
        }))
    })
    .await
}

#[tauri::command]
pub async fn pty_write_tauri(session_id: String, data: String) -> Result<bool, String> {
    run_blocking(move || {
        let sess = tauri_sessions()
            .lock()
            .ok()
            .and_then(|m| m.get(&session_id).cloned());
        if let Some(s) = sess {
            if let Ok(mut w) = s.writer.lock() {
                let _ = w.write_all(data.as_bytes());
                let _ = w.flush();
                return Ok(true);
            }
        }
        Ok(false)
    })
    .await
}

#[tauri::command]
pub async fn pty_resize_tauri(
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<bool, String> {
    run_blocking(move || {
        let sess = tauri_sessions()
            .lock()
            .ok()
            .and_then(|m| m.get(&session_id).cloned());
        if let Some(s) = sess {
            let clamped = (cols.max(10), rows.max(2));
            if let Ok(mut last) = s.last_size.lock() {
                if *last == clamped {
                    return Ok(true);
                }
                *last = clamped;
            }
            if let Ok(m) = s.master.lock() {
                let _ = m.resize(PtySize {
                    rows: clamped.1,
                    cols: clamped.0,
                    pixel_width: 0,
                    pixel_height: 0,
                });
                return Ok(true);
            }
        }
        Ok(false)
    })
    .await
}

#[tauri::command]
pub async fn pty_kill_tauri(session_id: String) -> Result<bool, String> {
    run_blocking(move || {
        let sess = tauri_sessions()
            .lock()
            .ok()
            .and_then(|mut m| m.remove(&session_id));
        if let Some(s) = sess {
            if let Ok(mut k) = s.killer.lock() {
                let _ = k.kill();
                return Ok(true);
            }
        }
        Ok(false)
    })
    .await
}
