use lumina_core::zip_util::{build_zip_bytes, ZipEntry};
use lumina_core::{canonicalize_or_normalize, is_same_path, is_within_root};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportAssetInput {
    pub filename: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportZipEntryInput {
    pub name: String,
    pub text: Option<String>,
    pub bytes: Option<Vec<u8>>,
}

static ALLOWED_EXPORT_FILES: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();
static ALLOWED_EXPORT_DIRS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();
static PDF_WORKER_SEQ: AtomicU64 = AtomicU64::new(1);

fn allowed_files() -> &'static Mutex<HashSet<PathBuf>> {
    ALLOWED_EXPORT_FILES.get_or_init(|| Mutex::new(HashSet::new()))
}

fn allowed_dirs() -> &'static Mutex<HashSet<PathBuf>> {
    ALLOWED_EXPORT_DIRS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn normalize_export_path(path: &Path) -> Result<PathBuf, String> {
    let raw = path.to_string_lossy();
    if raw.contains('\0') {
        return Err("Null bytes in export path are not allowed".to_string());
    }
    if !path.is_absolute() {
        return Err("Export path must be absolute".to_string());
    }
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err("Parent traversal segments in export path are not allowed".to_string());
    }

    if path.exists() {
        return Ok(canonicalize_or_normalize(path));
    }

    // Walk up to the nearest existing ancestor so symlinks (e.g., macOS /var -> /private/var)
    // and Windows verbatim prefixes normalize identically before and after file creation.
    let mut missing_segments: Vec<&std::ffi::OsStr> = Vec::new();
    let mut ancestor = path;
    while !ancestor.exists() {
        if let Some(name) = ancestor.file_name() {
            missing_segments.push(name);
        }
        match ancestor.parent() {
            Some(p) => ancestor = p,
            None => break,
        }
    }

    let mut base = canonicalize_or_normalize(ancestor);
    for seg in missing_segments.into_iter().rev() {
        base.push(seg);
    }
    Ok(base)
}

fn allow_export_file(path: &Path) {
    if let Ok(norm) = normalize_export_path(path) {
        if let Ok(mut set) = allowed_files().lock() {
            set.insert(norm);
        }
    }
}

fn allow_export_dir(path: &Path) {
    if let Ok(norm) = normalize_export_path(path) {
        if let Ok(mut set) = allowed_dirs().lock() {
            set.insert(norm);
        }
    }
}

fn ensure_authorized_export_write(path: &Path) -> Result<PathBuf, String> {
    let norm = normalize_export_path(path)?;

    if let Ok(files) = allowed_files().lock() {
        if files.iter().any(|allowed| is_same_path(allowed, &norm)) {
            return Ok(norm);
        }
    }

    if let Ok(dirs) = allowed_dirs().lock() {
        if dirs.iter().any(|dir| is_within_root(dir, &norm) && !is_same_path(dir, &norm)) {
            return Ok(norm);
        }
    }

    Err("Unauthorized export destination path".to_string())
}

pub fn is_allowed_export_open(path: &Path) -> bool {
    let Ok(norm) = normalize_export_path(path) else {
        return false;
    };

    if let Ok(files) = allowed_files().lock() {
        if files.iter().any(|allowed| {
            is_same_path(allowed, &norm)
                || allowed
                    .parent()
                    .map(|p| is_same_path(p, &norm))
                    .unwrap_or(false)
        }) {
            return true;
        }
    }

    if let Ok(dirs) = allowed_dirs().lock() {
        if dirs.iter().any(|dir| is_within_root(dir, &norm)) {
            return true;
        }
    }

    false
}

fn sanitize_filename_segment(name: &str) -> String {
    let mut s: String = name
        .chars()
        .filter(|&c| c != '\0' && (c as u32) >= 32)
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect();
    s = s.trim().trim_end_matches(['.', ' ']).to_string();
    if s.is_empty() || s == "." || s == ".." {
        "Untitled".to_string()
    } else {
        s.chars().take(120).collect()
    }
}

#[cfg(target_os = "windows")]
fn to_wide_null(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
fn path_to_file_url(path: &Path) -> Result<String, String> {
    let stripped = lumina_core::strip_verbatim_prefix(path);
    let forward = stripped.to_string_lossy().replace('\\', "/");
    let mut encoded = String::from("file:///");
    let trimmed = forward.trim_start_matches('/');
    for (idx, b) in trimmed.bytes().enumerate() {
        let is_drive_colon = idx == 1 && b == b':' && trimmed.as_bytes()[0].is_ascii_alphabetic();
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~' | b'/') || is_drive_colon {
            encoded.push(b as char);
        } else {
            encoded.push('%');
            encoded.push_str(&format!("{b:02X}"));
        }
    }
    Ok(encoded)
}

#[cfg(target_os = "windows")]
struct ComApartmentGuard(bool);

#[cfg(target_os = "windows")]
impl Drop for ComApartmentGuard {
    fn drop(&mut self) {
        if self.0 {
            unsafe {
                windows::Win32::System::Com::CoUninitialize();
            }
        }
    }
}

#[tauri::command]
pub async fn export_pick_save_path(
    window: tauri::WebviewWindow,
    title: String,
    default_name: String,
    filter_name: String,
    extensions: Vec<String>,
) -> Result<Option<String>, String> {
    let _ = &window;
    #[cfg(target_os = "windows")]
    let parent_hwnd: Option<isize> = window.hwnd().ok().map(|h| h.0 as isize);

    let picked = tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
        #[cfg(target_os = "windows")]
        {
            use windows::core::PCWSTR;
            use windows::Win32::Foundation::HWND;
            use windows::Win32::System::Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_INPROC_SERVER,
                COINIT_APARTMENTTHREADED,
            };
            use windows::Win32::UI::Shell::Common::COMDLG_FILTERSPEC;
            use windows::Win32::UI::Shell::{
                FileSaveDialog, IFileSaveDialog, FOS_FILEMUSTEXIST, FOS_FORCEFILESYSTEM,
                FOS_NOREADONLYRETURN, FOS_OVERWRITEPROMPT, FOS_PATHMUSTEXIST, SIGDN_FILESYSPATH,
            };

            const HR_CANCELLED: i32 = 0x8007_04C7u32 as i32;

            unsafe {
                let hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
                let _com_guard = ComApartmentGuard(hr.is_ok());

                let dialog: IFileSaveDialog =
                    CoCreateInstance(&FileSaveDialog, None, CLSCTX_INPROC_SERVER)
                        .map_err(|e| format!("Failed to open native save dialog: {e}"))?;

                let opts = dialog.GetOptions().unwrap_or_default();
                let _ = dialog.SetOptions(
                    (opts
                        | FOS_OVERWRITEPROMPT
                        | FOS_FORCEFILESYSTEM
                        | FOS_PATHMUSTEXIST
                        | FOS_NOREADONLYRETURN)
                        & !FOS_FILEMUSTEXIST,
                );

                let title_w = to_wide_null(if title.trim().is_empty() {
                    "Export File"
                } else {
                    title.trim()
                });
                let _ = dialog.SetTitle(PCWSTR(title_w.as_ptr()));

                let ok_w = to_wide_null("Save");
                let _ = dialog.SetOkButtonLabel(PCWSTR(ok_w.as_ptr()));

                let clean_exts: Vec<String> = extensions
                    .iter()
                    .map(|e| e.trim().trim_start_matches('.').to_string())
                    .filter(|e| !e.is_empty())
                    .collect();

                let mut wide_pairs: Vec<(Vec<u16>, Vec<u16>)> = Vec::new();
                if !clean_exts.is_empty() {
                    let pattern = clean_exts
                        .iter()
                        .map(|e| format!("*.{e}"))
                        .collect::<Vec<_>>()
                        .join(";");
                    let name_w = to_wide_null(if filter_name.trim().is_empty() {
                        "Export Files"
                    } else {
                        filter_name.trim()
                    });
                    let pat_w = to_wide_null(&pattern);
                    wide_pairs.push((name_w, pat_w));
                }
                wide_pairs.push((to_wide_null("All Files"), to_wide_null("*.*")));

                let specs: Vec<COMDLG_FILTERSPEC> = wide_pairs
                    .iter()
                    .map(|(name_w, pat_w)| COMDLG_FILTERSPEC {
                        pszName: PCWSTR(name_w.as_ptr()),
                        pszSpec: PCWSTR(pat_w.as_ptr()),
                    })
                    .collect();

                let _ = dialog.SetFileTypes(&specs);
                let _ = dialog.SetFileTypeIndex(1);

                if let Some(first_ext) = clean_exts.first() {
                    let def_ext_w = to_wide_null(first_ext);
                    let _ = dialog.SetDefaultExtension(PCWSTR(def_ext_w.as_ptr()));
                }

                let fname_w = to_wide_null(&default_name);
                let _ = dialog.SetFileName(PCWSTR(fname_w.as_ptr()));

                let owner = parent_hwnd.map(|raw| HWND(raw as *mut std::ffi::c_void));
                if let Err(e) = dialog.Show(owner) {
                    if e.code().0 == HR_CANCELLED {
                        return Ok(None);
                    }
                    return Err(format!("Save dialog error: {e}"));
                }
                drop(wide_pairs);

                let item = dialog
                    .GetResult()
                    .map_err(|e| format!("Failed to read selected save location: {e}"))?;
                let pwstr = item
                    .GetDisplayName(SIGDN_FILESYSPATH)
                    .map_err(|e| format!("Failed to resolve save file path: {e}"))?;
                let path_str = pwstr.to_string().unwrap_or_default();
                CoTaskMemFree(Some(pwstr.0 as _));

                if path_str.trim().is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(path_str))
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            let escaped_title = title.replace('"', "\\\"");
            let escaped_name = default_name.replace('"', "\\\"");
            let script = format!(
                r#"POSIX path of (choose file name with prompt "{escaped_title}" default name "{escaped_name}")"#
            );
            let output = std::process::Command::new("osascript")
                .args(["-e", &script])
                .output()
                .map_err(|e| e.to_string())?;
            if !output.status.success() {
                return Ok(None);
            }
            let p = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(if p.is_empty() { None } else { Some(p) });
        }

        #[cfg(target_os = "linux")]
        {
            let mut cmd = std::process::Command::new("zenity");
            cmd.args([
                "--file-selection",
                "--save",
                "--confirm-overwrite",
                &format!("--title={}", if title.is_empty() { "Export File" } else { &title }),
                &format!("--filename={}", default_name),
            ]);
            let output = cmd.output().map_err(|e| e.to_string())?;
            if !output.status.success() {
                return Ok(None);
            }
            let p = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(if p.is_empty() { None } else { Some(p) });
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Err("Native save dialog is unsupported on this OS".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    if let Some(ref p) = picked {
        allow_export_file(Path::new(p));
    }

    Ok(picked)
}

#[tauri::command]
pub async fn export_pick_directory(
    window: tauri::WebviewWindow,
    title: String,
) -> Result<Option<String>, String> {
    let _ = &window;
    #[cfg(target_os = "windows")]
    let parent_hwnd: Option<isize> = window.hwnd().ok().map(|h| h.0 as isize);

    let picked = tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
        #[cfg(target_os = "windows")]
        {
            use windows::core::PCWSTR;
            use windows::Win32::Foundation::HWND;
            use windows::Win32::System::Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_INPROC_SERVER,
                COINIT_APARTMENTTHREADED,
            };
            use windows::Win32::UI::Shell::{
                FileOpenDialog, IFileOpenDialog, FOS_FILEMUSTEXIST, FOS_FORCEFILESYSTEM,
                FOS_PATHMUSTEXIST, FOS_PICKFOLDERS, SIGDN_FILESYSPATH,
            };

            const HR_CANCELLED: i32 = 0x8007_04C7u32 as i32;

            unsafe {
                let hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
                let _com_guard = ComApartmentGuard(hr.is_ok());

                let dialog: IFileOpenDialog =
                    CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)
                        .map_err(|e| format!("Failed to open native folder dialog: {e}"))?;

                let opts = dialog.GetOptions().unwrap_or_default();
                let _ = dialog.SetOptions(
                    (opts | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST)
                        & !FOS_FILEMUSTEXIST,
                );

                let title_w = to_wide_null(if title.trim().is_empty() {
                    "Choose Export Folder"
                } else {
                    title.trim()
                });
                let _ = dialog.SetTitle(PCWSTR(title_w.as_ptr()));

                let ok_w = to_wide_null("Export Here");
                let _ = dialog.SetOkButtonLabel(PCWSTR(ok_w.as_ptr()));

                let owner = parent_hwnd.map(|raw| HWND(raw as *mut std::ffi::c_void));
                if let Err(e) = dialog.Show(owner) {
                    if e.code().0 == HR_CANCELLED {
                        return Ok(None);
                    }
                    return Err(format!("Folder dialog error: {e}"));
                }

                let item = dialog
                    .GetResult()
                    .map_err(|e| format!("Failed to read selected folder: {e}"))?;
                let pwstr = item
                    .GetDisplayName(SIGDN_FILESYSPATH)
                    .map_err(|e| format!("Failed to resolve selected folder path: {e}"))?;
                let path_str = pwstr.to_string().unwrap_or_default();
                CoTaskMemFree(Some(pwstr.0 as _));

                if path_str.trim().is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(path_str))
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            let escaped_title = title.replace('"', "\\\"");
            let script = format!(
                r#"POSIX path of (choose folder with prompt "{escaped_title}")"#
            );
            let output = std::process::Command::new("osascript")
                .args(["-e", &script])
                .output()
                .map_err(|e| e.to_string())?;
            if !output.status.success() {
                return Ok(None);
            }
            let p = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(if p.is_empty() { None } else { Some(p) });
        }

        #[cfg(target_os = "linux")]
        {
            let output = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--directory",
                    &format!(
                        "--title={}",
                        if title.is_empty() {
                            "Select Export Folder"
                        } else {
                            &title
                        }
                    ),
                ])
                .output()
                .map_err(|e| e.to_string())?;
            if !output.status.success() {
                return Ok(None);
            }
            let p = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(if p.is_empty() { None } else { Some(p) });
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Err("Native folder dialog is unsupported on this OS".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    if let Some(ref p) = picked {
        allow_export_dir(Path::new(p));
    }

    Ok(picked)
}

#[tauri::command]
pub fn export_unique_path(dir: String, base_name: String, ext: String) -> Result<String, String> {
    let dir_path = normalize_export_path(Path::new(&dir))?;
    let is_allowed_dir = allowed_dirs()
        .lock()
        .map(|dirs| dirs.iter().any(|d| is_within_root(d, &dir_path)))
        .unwrap_or(false);
    if !is_allowed_dir {
        return Err("Unauthorized export directory".to_string());
    }

    let safe_base = sanitize_filename_segment(&base_name);
    let clean_ext = ext.trim().trim_start_matches('.');
    let dot_ext = if clean_ext.is_empty() {
        String::new()
    } else {
        format!(".{clean_ext}")
    };

    let mut candidate = dir_path.join(format!("{safe_base}{dot_ext}"));
    let mut counter: usize = 1;
    while candidate.exists() {
        candidate = dir_path.join(format!("{safe_base} ({counter}){dot_ext}"));
        counter += 1;
    }

    Ok(candidate.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_write_file(
    file_path: String,
    content: Option<String>,
    bytes: Option<Vec<u8>>,
) -> Result<Value, String> {
    let target = ensure_authorized_export_write(Path::new(&file_path))?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if let Some(raw_bytes) = bytes {
        fs::write(&target, raw_bytes).map_err(|e| e.to_string())?;
    } else {
        fs::write(&target, content.unwrap_or_default().as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(json!({
        "success": true,
        "filePath": file_path
    }))
}

#[tauri::command]
pub fn export_write_markdown_bundle(
    file_path: String,
    markdown: String,
    assets: Vec<ExportAssetInput>,
) -> Result<Value, String> {
    let target = ensure_authorized_export_write(Path::new(&file_path))?;
    let parent_dir = target
        .parent()
        .ok_or_else(|| "Invalid markdown bundle output path".to_string())?;
    fs::create_dir_all(parent_dir).map_err(|e| e.to_string())?;
    fs::write(&target, markdown.as_bytes()).map_err(|e| e.to_string())?;

    let mut written_assets = 0usize;
    let bundle_dir = if assets.is_empty() {
        None
    } else {
        let assets_dir = parent_dir.join("assets");
        fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
        for asset in assets {
            let safe_asset_name = Path::new(&asset.filename)
                .file_name()
                .and_then(|s| s.to_str())
                .map(sanitize_filename_segment)
                .unwrap_or_else(|| "asset.bin".to_string());
            fs::write(assets_dir.join(safe_asset_name), asset.bytes)
                .map_err(|e| e.to_string())?;
            written_assets += 1;
        }
        Some(parent_dir.to_string_lossy().to_string())
    };

    Ok(json!({
        "success": true,
        "filePath": file_path,
        "bundleDir": bundle_dir,
        "assetCount": written_assets
    }))
}

#[tauri::command]
pub fn export_write_zip(
    file_path: String,
    entries: Vec<ExportZipEntryInput>,
) -> Result<Value, String> {
    let target = ensure_authorized_export_write(Path::new(&file_path))?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let zip_entries: Vec<ZipEntry> = entries
        .into_iter()
        .map(|entry| {
            let data = if let Some(raw) = entry.bytes {
                raw
            } else {
                entry.text.unwrap_or_default().into_bytes()
            };
            ZipEntry {
                name: entry.name,
                data,
            }
        })
        .collect();

    let zip_bytes = build_zip_bytes(&zip_entries)?;
    fs::write(&target, &zip_bytes).map_err(|e| e.to_string())?;

    Ok(json!({
        "success": true,
        "filePath": file_path,
        "totalBytes": zip_bytes.len(),
        "entryCount": zip_entries.len(),
        "isZip": true
    }))
}

#[tauri::command]
pub async fn export_render_pdf(
    app: AppHandle,
    html: String,
    file_path: String,
    landscape: Option<bool>,
) -> Result<Value, String> {
    let target = ensure_authorized_export_write(Path::new(&file_path))?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let seq = PDF_WORKER_SEQ.fetch_add(1, Ordering::Relaxed);
    let temp_html = std::env::temp_dir().join(format!(
        "lumina-pdf-render-{}-{}.html",
        std::process::id(),
        seq
    ));
    fs::write(&temp_html, html.as_bytes()).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let render_res: Result<(), String> = {
        use std::sync::mpsc;
        use std::time::Duration;
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_7, ICoreWebView2Environment6,
            COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
        };
        use webview2_com::{NavigationCompletedEventHandler, PrintToPdfCompletedHandler};
        use windows::core::{Interface, PCWSTR};

        let file_url = path_to_file_url(&temp_html)?;
        let label = format!("lumina-pdf-worker-{}-{seq}", std::process::id());
        let blank_url: tauri::Url = "about:blank".parse().map_err(|e| format!("{e}"))?;

        let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(blank_url))
            .visible(false)
            .skip_taskbar(true)
            .decorations(false)
            .inner_size(794.0, 1123.0)
            .build()
            .map_err(|e| format!("Failed to create PDF render window: {e}"))?;

        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        let target_navigated = Arc::new(AtomicBool::new(false));
        let print_started = Arc::new(AtomicBool::new(false));
        let pdf_dest_str = lumina_core::strip_verbatim_prefix(&target)
            .to_string_lossy()
            .to_string();
        let is_landscape = landscape.unwrap_or(false);
        let err_tx = tx.clone();

        let attach_res = win.with_webview(move |webview| unsafe {
            let setup = (|| -> Result<(), String> {
                let core = webview
                    .controller()
                    .CoreWebView2()
                    .map_err(|e| format!("CoreWebView2 unavailable: {e}"))?;
                let core7: ICoreWebView2_7 = core
                    .cast()
                    .map_err(|e| format!("WebView2 PrintToPdf interface unavailable: {e}"))?;
                let env6: ICoreWebView2Environment6 = webview
                    .environment()
                    .cast()
                    .map_err(|e| format!("WebView2 PrintSettings interface unavailable: {e}"))?;

                let settings = env6
                    .CreatePrintSettings()
                    .map_err(|e| format!("Failed to create WebView2 print settings: {e}"))?;
                let _ = settings.SetPageWidth(8.27);
                let _ = settings.SetPageHeight(11.69);
                let _ = settings.SetMarginTop(0.0);
                let _ = settings.SetMarginBottom(0.0);
                let _ = settings.SetMarginLeft(0.0);
                let _ = settings.SetMarginRight(0.0);
                let _ = settings.SetScaleFactor(1.0);
                let _ = settings.SetShouldPrintBackgrounds(true);
                let _ = settings.SetShouldPrintHeaderAndFooter(false);
                let _ = settings.SetOrientation(if is_landscape {
                    COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE
                } else {
                    COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT
                });

                let nav_flag = Arc::clone(&target_navigated);
                let started_flag = Arc::clone(&print_started);
                let nav_tx = tx.clone();
                let nav_core7 = core7.clone();
                let nav_settings = settings.clone();
                let nav_pdf_dest = pdf_dest_str.clone();

                let nav_handler = NavigationCompletedEventHandler::create(Box::new(move |wv, _| {
                    if !nav_flag.load(Ordering::Acquire) {
                        return Ok(());
                    }
                    let Some(wv) = wv else {
                        return Ok(());
                    };
                    let mut source_pwstr = windows::core::PWSTR::null();
                    if wv.Source(&mut source_pwstr).is_err() {
                        return Ok(());
                    }
                    let source_uri = webview2_com::take_pwstr(source_pwstr);
                    if !source_uri.starts_with("file:") {
                        return Ok(());
                    }
                    if started_flag.swap(true, Ordering::AcqRel) {
                        return Ok(());
                    }

                    let pdf_wide = to_wide_null(&nav_pdf_dest);
                    let done_tx = nav_tx.clone();
                    let print_handler =
                        PrintToPdfCompletedHandler::create(Box::new(move |err, ok| {
                            match err {
                                Ok(()) if ok => {
                                    let _ = done_tx.send(Ok(()));
                                }
                                Ok(()) => {
                                    let _ = done_tx.send(Err(
                                        "WebView2 PrintToPdf returned false".to_string(),
                                    ));
                                }
                                Err(e) => {
                                    let _ = done_tx
                                        .send(Err(format!("WebView2 PrintToPdf failed: {e}")));
                                }
                            }
                            Ok(())
                        }));

                    if let Err(e) = nav_core7.PrintToPdf(
                        PCWSTR(pdf_wide.as_ptr()),
                        &nav_settings,
                        &print_handler,
                    ) {
                        let _ = nav_tx.send(Err(format!("Failed to start PrintToPdf: {e}")));
                    }
                    Ok(())
                }));

                let mut nav_token: i64 = 0;
                core.add_NavigationCompleted(&nav_handler, &mut nav_token)
                    .map_err(|e| format!("Failed to attach navigation listener: {e}"))?;

                target_navigated.store(true, Ordering::Release);
                let url_wide = to_wide_null(&file_url);
                core.Navigate(PCWSTR(url_wide.as_ptr()))
                    .map_err(|e| format!("Failed to navigate PDF render webview: {e}"))?;

                Ok(())
            })();

            if let Err(err) = setup {
                let _ = err_tx.send(Err(err));
            }
        });

        let wait_res = if let Err(e) = attach_res {
            Err(format!("Failed to access PDF render webview: {e}"))
        } else {
            tauri::async_runtime::spawn_blocking(move || {
                rx.recv_timeout(Duration::from_secs(45))
                    .map_err(|_| "Timed out rendering PDF document".to_string())?
            })
            .await
            .map_err(|e| e.to_string())?
        };

        let _ = win.destroy();
        wait_res
    };

    #[cfg(not(target_os = "windows"))]
    let render_res: Result<(), String> = {
        let html_str = temp_html.to_string_lossy().to_string();
        let pdf_str = target.to_string_lossy().to_string();
        tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
            let browsers = [
                "google-chrome",
                "chromium",
                "chromium-browser",
                "microsoft-edge",
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            ];
            for bin in browsers {
                let status = std::process::Command::new(bin)
                    .args([
                        "--headless",
                        "--disable-gpu",
                        "--no-pdf-header-footer",
                        &format!("--print-to-pdf={pdf_str}"),
                        &html_str,
                    ])
                    .status();
                if let Ok(st) = status {
                    if st.success() && Path::new(&pdf_str).exists() {
                        return Ok(());
                    }
                }
            }
            if let Ok(st) = std::process::Command::new("wkhtmltopdf")
                .args([&html_str, &pdf_str])
                .status()
            {
                if st.success() && Path::new(&pdf_str).exists() {
                    return Ok(());
                }
            }
            Err("No headless Chromium/Chrome/wkhtmltopdf found to print PDF".to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    };

    let _ = fs::remove_file(&temp_html);
    render_res?;

    Ok(json!({
        "success": true,
        "filePath": file_path
    }))
}
