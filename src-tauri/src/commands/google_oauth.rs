//! Google OAuth loopback authentication, token refresh, and email attachment picker.

use super::common::{command_no_window, run_blocking};
use super::settings::{get_setting_sync, save_setting_sync};
use super::workspace::open_path_in_os_sync;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

// ──────────────────────────────────────────────────────────────────────────────
// Google OAuth (Browser Loopback Flow)
// ──────────────────────────────────────────────────────────────────────────────

fn read_google_client_secret() -> String {
    for key in ["GOOGLE_CLIENT_SECRET", "VITE_GOOGLE_CLIENT_SECRET"] {
        if let Ok(val) = std::env::var(key) {
            let trimmed = val.trim().to_string();
            if !trimmed.is_empty() {
                return trimmed;
            }
        }
    }

    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join(".env"));
        candidates.push(cwd.join(".env.local"));
        if let Some(parent) = cwd.parent() {
            candidates.push(parent.join(".env"));
            candidates.push(parent.join(".env.local"));
        }
    }

    for env_path in candidates {
        if let Ok(content) = fs::read_to_string(&env_path) {
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((k, v)) = line.split_once('=') {
                    let k = k.trim();
                    if k == "GOOGLE_CLIENT_SECRET" || k == "VITE_GOOGLE_CLIENT_SECRET" {
                        let v = v.trim().trim_matches('"').trim_matches('\'').to_string();
                        if !v.is_empty() {
                            return v;
                        }
                    }
                }
            }
        }
    }

    // Fall back to the compile-time secret injected by build.rs (for packaged release builds)
    for built_in in [
        option_env!("LUMINA_GOOGLE_CLIENT_SECRET"),
        option_env!("GOOGLE_CLIENT_SECRET"),
        option_env!("VITE_GOOGLE_CLIENT_SECRET"),
    ] {
        if let Some(val) = built_in {
            let trimmed = val.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    String::new()
}

fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let raw = input.as_bytes();
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == b'%' && i + 2 < raw.len() {
            if let Ok(hex) = std::str::from_utf8(&raw[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex, 16) {
                    bytes.push(val);
                    i += 3;
                    continue;
                }
            }
        } else if raw[i] == b'+' {
            bytes.push(b' ');
            i += 1;
            continue;
        }
        bytes.push(raw[i]);
        i += 1;
    }
    String::from_utf8_lossy(&bytes).to_string()
}

#[tauri::command]
pub async fn get_google_user() -> Result<Value, String> {
    run_blocking(move || {
        let user = get_setting_sync(Some("googleUser".to_string()))?;
        if let Some(obj) = user.as_object() {
            if obj.get("token").is_some() && !obj.get("token").unwrap().is_null() {
                return Ok(json!({
                    "name": obj.get("name").cloned().unwrap_or(Value::Null),
                    "email": obj.get("email").cloned().unwrap_or(Value::Null),
                    "picture": obj.get("picture").cloned().unwrap_or(Value::Null),
                }));
            }
        }
        Ok(Value::Null)
    })
    .await
}

#[tauri::command]
pub async fn logout_from_google() -> Result<Value, String> {
    run_blocking(move || {
        save_setting_sync("googleUser".to_string(), Value::Null)?;
        Ok(json!({ "success": true }))
    })
    .await
}

#[tauri::command]
pub async fn login_with_google(app: tauri::AppHandle, client_id: String) -> Result<Value, String> {
    use tauri::Manager;
    let res = tauri::async_runtime::spawn_blocking(move || -> Value {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

        let trimmed_client = client_id.trim().to_string();
        if !trimmed_client.ends_with(".apps.googleusercontent.com") {
            return json!({ "error": "Invalid Google client id." });
        }

        let listener = match TcpListener::bind("127.0.0.1:3000") {
            Ok(l) => l,
            Err(e) => {
                return json!({ "error": format!("Failed to start local OAuth callback server on port 3000: {}", e) });
            }
        };
        let _ = listener.set_nonblocking(true);

        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(1);
        let oauth_state = format!("{:x}{:x}", nanos, std::process::id());
        let redirect_uri = "http://localhost:3000/oauth2callback";
        let scopes = [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
            "email",
            "profile",
        ]
        .join(" ");

        let auth_url = format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&access_type=offline&prompt=consent&state={}&scope={}",
            percent_encode(&trimmed_client),
            percent_encode(redirect_uri),
            percent_encode(&oauth_state),
            percent_encode(&scopes)
        );

        let _ = open_path_in_os_sync(auth_url);

        let deadline = Instant::now() + Duration::from_secs(120);
        let mut auth_code: Option<String> = None;
        let mut auth_error: Option<String> = None;

        while Instant::now() < deadline {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let mut buf = [0u8; 4096];
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                    if let Ok(n) = stream.read(&mut buf) {
                        let req_str = String::from_utf8_lossy(&buf[..n]);
                        let first_line = req_str.lines().next().unwrap_or("");
                        let path_and_query = first_line.split_whitespace().nth(1).unwrap_or("");
                        if let Some(query) = path_and_query.strip_prefix("/oauth2callback?") {
                            let mut state_param = String::new();
                            let mut code_param = String::new();
                            let mut err_param = String::new();
                            for pair in query.split('&') {
                                if let Some((k, v)) = pair.split_once('=') {
                                    let val = percent_decode(v);
                                    match k {
                                        "state" => state_param = val,
                                        "code" => code_param = val,
                                        "error" => err_param = val,
                                        _ => {}
                                    }
                                }
                            }
                            if state_param != oauth_state {
                                let body = "<html><body><h2>Invalid OAuth state. Please try again from Lumina.</h2></body></html>";
                                let resp = format!("HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                                let _ = stream.write_all(resp.as_bytes());
                                auth_error = Some("Invalid OAuth state.".to_string());
                                break;
                            }
                            if !err_param.is_empty() {
                                let body = format!("<html><body><h2>Google sign-in error: {}</h2></body></html>", err_param);
                                let resp = format!("HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                                let _ = stream.write_all(resp.as_bytes());
                                auth_error = Some(format!("Google returned error: {}", err_param));
                                break;
                            }
                            let body = "<html><body style=\"font-family:system-ui,sans-serif;background:#111118;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0\"><div style=\"text-align:center;padding:32px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;background:#181822\"><h2>Signed in to Lumina</h2><p style=\"color:#94a3b8;margin:8px 0 20px\">Authentication succeeded. You can close this tab or click below to return.</p><button onclick=\"window.close()\" style=\"padding:10px 20px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-weight:600;cursor:pointer\">Return to Lumina</button></div></body></html>";
                            let resp = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                            let _ = stream.write_all(resp.as_bytes());
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.unminimize();
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                            if !code_param.is_empty() {
                                auth_code = Some(code_param);
                            } else {
                                auth_error = Some("Missing authorization code from Google.".to_string());
                            }
                            break;
                        } else {
                            let resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                            let _ = stream.write_all(resp.as_bytes());
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(80));
                }
                Err(e) => {
                    auth_error = Some(format!("OAuth listener error: {}", e));
                    break;
                }
            }
        }

        if let Some(err) = auth_error {
            return json!({ "error": err });
        }
        let code = match auth_code {
            Some(c) => c,
            None => return json!({ "error": "Google sign-in timed out." }),
        };

        let client_secret = read_google_client_secret();
        let mut form_body = format!(
            "code={}&client_id={}&redirect_uri={}&grant_type=authorization_code",
            percent_encode(&code),
            percent_encode(&trimmed_client),
            percent_encode(redirect_uri)
        );
        if !client_secret.is_empty() {
            form_body.push_str(&format!("&client_secret={}", percent_encode(&client_secret)));
        }

        let token_out = match command_no_window("curl")
            .args([
                "-s",
                "-X",
                "POST",
                "https://oauth2.googleapis.com/token",
                "-H",
                "Content-Type: application/x-www-form-urlencoded",
                "-d",
                &form_body,
            ])
            .output()
        {
            Ok(o) => o,
            Err(e) => return json!({ "error": format!("Failed to exchange OAuth token: {}", e) }),
        };

        let token_json: Value = match serde_json::from_slice(&token_out.stdout) {
            Ok(v) => v,
            Err(_) => return json!({ "error": "Invalid token response from Google." }),
        };

        if let Some(err) = token_json.get("error").and_then(|v| v.as_str()) {
            let desc = token_json
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or(err);
            return json!({ "error": desc });
        }

        let access_token = match token_json.get("access_token").and_then(|v| v.as_str()) {
            Some(t) if !t.is_empty() => t.to_string(),
            _ => return json!({ "error": "No access token returned by Google." }),
        };

        let user_out = command_no_window("curl")
            .args([
                "-s",
                "-H",
                &format!("Authorization: Bearer {}", access_token),
                "https://www.googleapis.com/oauth2/v2/userinfo",
            ])
            .output();

        let profile: Value = user_out
            .ok()
            .and_then(|o| serde_json::from_slice(&o.stdout).ok())
            .unwrap_or_else(|| json!({}));

        let expires_in = token_json.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let stored_user = json!({
            "name": profile.get("name").cloned().unwrap_or(Value::Null),
            "email": profile.get("email").cloned().unwrap_or(Value::Null),
            "picture": profile.get("picture").cloned().unwrap_or(Value::Null),
            "clientId": trimmed_client,
            "token": {
                "access_token": access_token,
                "refresh_token": token_json.get("refresh_token").cloned().unwrap_or(Value::Null),
                "expiry_date": now_ms + expires_in * 1000
            }
        });

        let _ = save_setting_sync("googleUser".to_string(), stored_user.clone());

        json!({
            "name": stored_user.get("name").cloned().unwrap_or(Value::Null),
            "email": stored_user.get("email").cloned().unwrap_or(Value::Null),
            "picture": stored_user.get("picture").cloned().unwrap_or(Value::Null),
        })
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(res)
}

#[tauri::command]
pub async fn get_google_access_token(force_refresh: Option<bool>) -> Result<Value, String> {
    let force = force_refresh.unwrap_or(false);
    let res = tauri::async_runtime::spawn_blocking(move || -> Value {
        use std::time::{SystemTime, UNIX_EPOCH};

        let user = match get_setting_sync(Some("googleUser".to_string())) {
            Ok(v) => v,
            Err(e) => return json!({ "error": e }),
        };
        let obj = match user.as_object() {
            Some(o) => o.clone(),
            None => return json!({ "error": "Not logged in to Google" }),
        };
        let token_obj = match obj.get("token").and_then(|t| t.as_object()) {
            Some(t) => t.clone(),
            None => return json!({ "error": "Not logged in to Google" }),
        };

        let access_token = token_obj
            .get("access_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let refresh_token = token_obj
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let expiry_date = token_obj
            .get("expiry_date")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let email = obj.get("email").cloned().unwrap_or(Value::Null);
        let name = obj.get("name").cloned().unwrap_or(Value::Null);

        if !force
            && !access_token.is_empty()
            && (expiry_date == 0 || now_ms + 60_000 < expiry_date)
        {
            return json!({
                "accessToken": access_token,
                "email": email,
                "name": name
            });
        }

        if refresh_token.is_empty() {
            if !access_token.is_empty() {
                return json!({ "accessToken": access_token, "email": email, "name": name });
            }
            return json!({ "error": "Session expired. Please reconnect your Google account." });
        }

        let client_id = obj
            .get("clientId")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com");
        let client_secret = read_google_client_secret();

        let mut form_body = format!(
            "client_id={}&refresh_token={}&grant_type=refresh_token",
            percent_encode(client_id),
            percent_encode(&refresh_token)
        );
        if !client_secret.is_empty() {
            form_body.push_str(&format!("&client_secret={}", percent_encode(&client_secret)));
        }

        let out = match command_no_window("curl")
            .args([
                "-s",
                "-X",
                "POST",
                "https://oauth2.googleapis.com/token",
                "-H",
                "Content-Type: application/x-www-form-urlencoded",
                "-d",
                &form_body,
            ])
            .output()
        {
            Ok(o) => o,
            Err(e) => return json!({ "error": format!("Failed to refresh token: {}", e) }),
        };

        let parsed: Value = serde_json::from_slice(&out.stdout).unwrap_or(Value::Null);
        if let Some(new_token) = parsed.get("access_token").and_then(|v| v.as_str()) {
            let expires_in = parsed.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
            let next_refresh = parsed
                .get("refresh_token")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or(&refresh_token);
            let mut updated = obj;
            updated.insert(
                "token".to_string(),
                json!({
                    "access_token": new_token,
                    "refresh_token": next_refresh,
                    "expiry_date": now_ms + expires_in * 1000
                }),
            );
            let _ = save_setting_sync("googleUser".to_string(), Value::Object(updated));
            return json!({
                "accessToken": new_token,
                "email": email,
                "name": name
            });
        }

        json!({ "error": "Failed to refresh Google access token. Please reconnect your Google account." })
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(res)
}

#[tauri::command]
pub async fn pick_email_attachments(window: tauri::WebviewWindow) -> Result<Value, String> {
    let _ = &window;
    #[cfg(target_os = "windows")]
    let parent_hwnd: Option<isize> = window.hwnd().ok().map(|h| h.0 as isize);
    #[cfg(not(target_os = "windows"))]
    let parent_hwnd: Option<isize> = None;

    let res = tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let paths = crate::export::pick_open_files_native(
            parent_hwnd,
            "Select Email Attachments".to_string(),
            true,
            String::new(),
            Vec::new(),
        )?;

        let mut attachments = Vec::new();
        for p in paths {
            let path = PathBuf::from(&p);
            if let Ok(bytes) = fs::read(&path) {
                let filename = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "attachment".to_string());
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let mime = match ext.as_str() {
                    "png" => "image/png",
                    "jpg" | "jpeg" => "image/jpeg",
                    "gif" => "image/gif",
                    "webp" => "image/webp",
                    "pdf" => "application/pdf",
                    "txt" | "md" => "text/plain",
                    "json" => "application/json",
                    "csv" => "text/csv",
                    "zip" => "application/zip",
                    _ => "application/octet-stream",
                };
                attachments.push(json!({
                    "filename": filename,
                    "mimeType": mime,
                    "bytes": bytes
                }));
            }
        }
        Ok(json!({ "attachments": attachments }))
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(res)
}
