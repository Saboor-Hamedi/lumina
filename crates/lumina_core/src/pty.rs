use napi::bindgen_prelude::*;
use napi::threadsafe_function::{
    ErrorStrategy, ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use napi::JsFunction;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex, OnceLock};

struct PtySession {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

static SESSIONS: OnceLock<Mutex<HashMap<String, Arc<PtySession>>>> = OnceLock::new();

fn sessions_map() -> &'static Mutex<HashMap<String, Arc<PtySession>>> {
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn split_valid_utf8(buf: &[u8]) -> (&str, &[u8]) {
    match std::str::from_utf8(buf) {
        Ok(s) => (s, &[]),
        Err(e) => {
            let valid_up_to = e.valid_up_to();
            let valid_str = unsafe { std::str::from_utf8_unchecked(&buf[..valid_up_to]) };
            if e.error_len().is_none() {
                // Incomplete multi-byte sequence at the end; hold for next chunk
                (valid_str, &buf[valid_up_to..])
            } else {
                // Invalid byte sequence; we will handle lossy conversion
                (valid_str, &buf[valid_up_to..])
            }
        }
    }
}

pub fn pty_spawn_impl(
    session_id: String,
    shell: String,
    args: Vec<String>,
    cwd: String,
    cols: u16,
    rows: u16,
    on_data: JsFunction,
    on_exit: JsFunction,
) -> Result<u32> {
    let data_tsfn: ThreadsafeFunction<String, ErrorStrategy::Fatal> = on_data
        .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<String>| {
            Ok(vec![ctx.env.create_string(&ctx.value)?])
        })?;
    let exit_tsfn: ThreadsafeFunction<i32, ErrorStrategy::Fatal> = on_exit
        .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<i32>| {
            Ok(vec![ctx.env.create_int32(ctx.value)?])
        })?;

    // If an old session with the same id exists, kill it first
    if let Some(old) = sessions_map()
        .lock()
        .map_err(|e| Error::from_reason(e.to_string()))?
        .remove(&session_id)
    {
        if let Ok(mut killer) = old.killer.lock() {
            let _ = killer.kill();
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| Error::from_reason(format!("Failed to open PTY: {e}")))?;

    let mut cmd = CommandBuilder::new(&shell);
    for arg in &args {
        cmd.arg(arg);
    }
    if !cwd.is_empty() {
        cmd.cwd(&cwd);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "Lumina");

    // Prevent Git Bash `--login` from overriding cwd back to $HOME
    if shell.to_ascii_lowercase().ends_with("bash.exe") {
        cmd.env("CHERE_INVOKING", "1");
    }

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| Error::from_reason(format!("Failed to spawn shell '{shell}': {e}")))?;
    drop(pair.slave);

    let pid = child.process_id().unwrap_or(0);
    let killer = child.clone_killer();

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| Error::from_reason(format!("Failed to clone PTY reader: {e}")))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| Error::from_reason(format!("Failed to take PTY writer: {e}")))?;

    let session = Arc::new(PtySession {
        master: Mutex::new(pair.master),
        writer: Mutex::new(writer),
        killer: Mutex::new(killer),
    });

    sessions_map()
        .lock()
        .map_err(|e| Error::from_reason(e.to_string()))?
        .insert(session_id.clone(), session);

    std::thread::Builder::new()
        .name(format!("lumina-pty-{}", pid))
        .spawn(move || {
            let mut buf = [0u8; 8192];
            let mut pending: Vec<u8> = Vec::new();

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        pending.extend_from_slice(&buf[..n]);

                        let (valid, rest) = split_valid_utf8(&pending);
                        if !valid.is_empty() {
                            data_tsfn.call(valid.to_string(), ThreadsafeFunctionCallMode::NonBlocking);
                        }

                        if rest.is_empty() {
                            pending.clear();
                        } else if rest.len() > 4 {
                            // Contains actual invalid UTF-8, flush lossily
                            let lossy = String::from_utf8_lossy(rest).into_owned();
                            data_tsfn.call(lossy, ThreadsafeFunctionCallMode::NonBlocking);
                            pending.clear();
                        } else {
                            let trailing = rest.to_vec();
                            pending = trailing;
                        }
                    }
                    Err(_) => break,
                }
            }

            if !pending.is_empty() {
                let lossy = String::from_utf8_lossy(&pending).into_owned();
                data_tsfn.call(lossy, ThreadsafeFunctionCallMode::NonBlocking);
            }

            let exit_code = match child.wait() {
                Ok(status) => status.exit_code() as i32,
                Err(_) => 1,
            };

            if let Ok(mut map) = sessions_map().lock() {
                map.remove(&session_id);
            }

            exit_tsfn.call(exit_code, ThreadsafeFunctionCallMode::NonBlocking);
        })
        .map_err(|e| Error::from_reason(format!("Failed to spawn PTY reader thread: {e}")))?;

    Ok(pid)
}

pub fn pty_write_impl(session_id: String, data: String) -> Result<bool> {
    let session = {
        let map = sessions_map()
            .lock()
            .map_err(|e| Error::from_reason(e.to_string()))?;
        map.get(&session_id).cloned()
    };

    let Some(session) = session else {
        return Ok(false);
    };

    let mut writer = session
        .writer
        .lock()
        .map_err(|e| Error::from_reason(e.to_string()))?;
    if writer.write_all(data.as_bytes()).is_err() {
        return Ok(false);
    }
    let _ = writer.flush();
    Ok(true)
}

pub fn pty_resize_impl(session_id: String, cols: u16, rows: u16) -> Result<bool> {
    let session = {
        let map = sessions_map()
            .lock()
            .map_err(|e| Error::from_reason(e.to_string()))?;
        map.get(&session_id).cloned()
    };

    let Some(session) = session else {
        return Ok(false);
    };

    let master = session
        .master
        .lock()
        .map_err(|e| Error::from_reason(e.to_string()))?;
    let res = master.resize(PtySize {
        rows: rows.max(2),
        cols: cols.max(2),
        pixel_width: 0,
        pixel_height: 0,
    });
    Ok(res.is_ok())
}

pub fn pty_kill_impl(session_id: String) -> Result<bool> {
    let removed = {
        let mut map = sessions_map()
            .lock()
            .map_err(|e| Error::from_reason(e.to_string()))?;
        map.remove(&session_id)
    };

    let Some(session) = removed else {
        return Ok(false);
    };

    if let Ok(mut killer) = session.killer.lock() {
        let _ = killer.kill();
    }
    Ok(true)
}

pub fn pty_kill_all_impl() -> Result<()> {
    let drained: Vec<Arc<PtySession>> = {
        let mut map = sessions_map()
            .lock()
            .map_err(|e| Error::from_reason(e.to_string()))?;
        map.drain().map(|(_, v)| v).collect()
    };

    for session in drained {
        if let Ok(mut killer) = session.killer.lock() {
            let _ = killer.kill();
        }
    }
    Ok(())
}
