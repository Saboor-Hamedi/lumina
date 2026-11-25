mod commands;
mod export;

pub use commands::*;
pub use export::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    static BLUR_TRIM_EPOCH: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .on_window_event(|window, event| {
            #[cfg(target_os = "windows")]
            if let tauri::WindowEvent::Focused(focused) = event {
                use std::sync::atomic::Ordering;
                use tauri::Manager;
                use webview2_com::Microsoft::Web::WebView2::Win32::{
                    ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
                    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
                };
                use windows::core::Interface;

                let epoch = BLUR_TRIM_EPOCH.fetch_add(1, Ordering::SeqCst) + 1;
                let app_handle = window.app_handle().clone();
                let label = window.label().to_string();

                if *focused {
                    if let Some(wv) = app_handle.get_webview_window(&label) {
                        let _ = wv.with_webview(|webview| unsafe {
                            if let Ok(core) = webview.controller().CoreWebView2() {
                                if let Ok(core19) = core.cast::<ICoreWebView2_19>() {
                                    let _ = core19.SetMemoryUsageTargetLevel(
                                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
                                    );
                                }
                            }
                        });
                    }
                } else {
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(5));
                        if BLUR_TRIM_EPOCH.load(Ordering::SeqCst) == epoch {
                            if let Some(wv) = app_handle.get_webview_window(&label) {
                                let _ = wv.with_webview(|webview| unsafe {
                                    if let Ok(core) = webview.controller().CoreWebView2() {
                                        if let Ok(core19) = core.cast::<ICoreWebView2_19>() {
                                            let _ = core19.SetMemoryUsageTargetLevel(
                                                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
                                            );
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            }
            #[cfg(not(target_os = "windows"))]
            let _ = (window, event);
        })
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings5;
                use windows::core::Interface;

                for window in app.webview_windows().values() {
                    let _ = window.with_webview(|webview| unsafe {
                        if let Ok(core) = webview.controller().CoreWebView2() {
                            if let Ok(settings) = core.Settings() {
                                // wry disables IsPinchZoomEnabled when zoom_hotkeys_enabled is false,
                                // which blocks Windows Precision Touchpad pinch gestures from
                                // synthesizing DOM wheel (ctrlKey: true) events. Re-enable pinch
                                // gesture delivery while keeping IsZoomControlEnabled(false) so
                                // Ctrl+Plus/Minus/0 and Ctrl+Wheel never browser-zoom app chrome.
                                if let Ok(settings5) = settings.cast::<ICoreWebView2Settings5>() {
                                    let _ = settings5.SetIsPinchZoomEnabled(true);
                                }
                            }
                        }
                    });
                }
            }
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                for window in app.webview_windows().values() {
                    let _ = window.set_decorations(true);
                }
            }
            commands::start_workspace_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_core_version,
            scan_workspace,
            get_snippets,
            read_snippet,
            save_snippet,
            delete_snippet,
            create_folder,
            rename_folder,
            move_file,
            move_files,
            delete_folder,
            bulk_delete,
            select_workspace,
            open_file_dialog,
            import_external_paths,
            save_image_from_path,
            clean_orphans,
            list_workspace_files,
            build_workspace_zip_bytes,
            cancel_backup,
            open_path_in_os,
            reveal_path_in_os,
            export_pick_save_path,
            export_pick_directory,
            export_unique_path,
            export_write_file,
            export_write_markdown_bundle,
            export_write_zip,
            export_render_pdf,
            save_workspace_image,
            read_asset_bytes,
            get_setting,
            save_setting,
            save_settings,
            set_window_opacity,
            load_memory,
            save_memory,
            search_notes,
            search_workspace,
            build_graph_data,
            read_file_string,
            write_file_string,
            delete_file,
            terminal_get_shells,
            terminal_spawn,
            pty_write_tauri,
            pty_resize_tauri,
            pty_kill_tauri,
            login_with_google,
            get_google_user,
            logout_from_google,
            get_google_access_token,
            pick_email_attachments,
            get_github_releases,
            download_app_update,
            cancel_app_update,
            install_app_update,
            fetch_link_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
