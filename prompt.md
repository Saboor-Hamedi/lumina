Prompt for your agent:

"We want to lower Lumina's WebView2 GPU and Renderer RAM footprint without breaking startup, tab switching, image visibility, or animations. Please apply these three safe, non-destructive optimizations:

1. Safe Image Decoding & GPU Texture Sizing (src/renderer/src/):

Audit all <img> tags used for note cover banners, inline pasted Markdown images, and URL preview cards.

Add decoding="async" and loading="lazy" (for below-the-fold images) so large PNG/JPG files do not block the main thread on open.

Do not alter or compress the user's original files on disk. Instead, ensure cover banners and preview thumbnails use object-fit: cover with bounded container dimensions, or generate an in-memory/cache-dir display thumbnail (max width 1200px for covers, 400px for thumbnails) so WebView2's GPU process does not decode multi-megabyte screenshots into massive raw RGBA textures.

2. Safe Windows WebView2 Idle Cache Trimming on Blur (crates/lumina_core/src/):

In our Tauri 2.0 WindowEvent::Focused(focused) handler on Windows, use webview.with_webview(...) to call ICoreWebView2_19::SetMemoryUsageTargetLevel:

When focused == false (after a short 5-second debounce so quick Alt-Tabbing stays instant), set COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW.

Immediately on focused == true, cancel any pending timer and set COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL before the user interacts.

Do not unmount active editor tabs or destroy user scroll/cursor state—only let Chromium trim its internal idle V8/Skia caches when backgrounded.

3. Safe WebGL & Terminal Cleanup Only on Explicit Tab Close:

Keep active/open tabs working identically to today. Only run renderer.dispose() / forceContextLoss() (for the 3D graph) and terminal.dispose() (for xterm.js) inside the cleanup handler when a user explicitly closes that tab or terminal pane, and cap xterm.js scrollback at 1500 lines.

Verification Criteria:

Launch Lumina, open a note with cover banners and pasted images, open and close the 3D graph, and unfocus the window for 10 seconds. Verify zero broken images, instant tab switching, and noticeably lower WebView2 GPU + Renderer memory in Task Manager."
