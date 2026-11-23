mod commands;
mod export;

pub use commands::*;
pub use export::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
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
            download_app_update,
            cancel_app_update,
            install_app_update
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
