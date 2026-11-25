## Lumina v2.1.3 — Islands UI, In-App Release Notes & Native Performance Suite

Lumina **v2.1.3** introduces an in-app **What's New** release center with offline ETag caching, a detached one-click TitleBar update & restart button with toast notifications, native Win32 window transparency, WebView2 GPU/RAM optimizations below 200 MB, theme-synchronized PDF & Breadcrumbs UI, and terminal emoji/Nerd Font ligature isolation.

---

### ✨ What's New

- **In-App Release Notes & Changelog Tab (`What's New`)**
  - Dedicated virtual editor tab (`release-notes`) in `src/renderer/src/components/update/ReleaseNotesTab.tsx` with a split-pane version rail, live Markdown changelog viewer, and collapsible **Release Assets & SHA-256 Checksums** drawer.
  - Powered by a native Rust GitHub Releases client (`get_github_releases`) using `reqwest` (`native-tls`) with local ETag caching (`github_releases_cache.json`), `semver` version comparison, and two-layer offline fallback.
  - Auto-opens on startup after an update and is accessible anytime via the **Command Palette** (`Release Notes: Show What's New`), the dynamic **Status Bar** version badge (`Version.jsx`), or **Settings → Updates**.
- **Detached TitleBar Update Button (`UpdateButton.tsx`) & Streamed Rust Updater**
  - Replaced the old update dropdown with a single unified TitleBar button (`UpdateButton.tsx`) that dispatches toast notifications on check (`Update vX.Y.Z is available` or `You are up to date`), downloads directly in-app on click, displays live percentage progress, and transforms into a matching **Restart** button when ready.
  - Replaced external `curl` process spawning with native Rust 64 KB chunk streaming, atomic `.part` file finalization, SHA-256 checksum verification, and automatic OS browser fallback.
- **Native Win32 Layered Window Transparency**
  - Live window opacity slider (`20% – 100%`) in **Appearance → Accent Color** backed by Win32 `WS_EX_LAYERED` and `SetLayeredWindowAttributes` (`set_window_opacity`).
- **Command Palette Mode Separation (`Ctrl + P` vs `Ctrl + Shift + P`)**
  - `Ctrl + P` searches strictly workspace notes, `#tags`, and `@mentions`.
  - `Ctrl + Shift + P` (or typing `>`) opens the dedicated **Settings & Commands** mode with active row fade highlights and instant inline setting pickers.

---

### 🎨 UI & Theme Refinements

- **Theme-Synchronized PDF Viewer & Islands Breadcrumbs**
  - PDF viewer tabs automatically follow your active light or dark application theme instead of defaulting to parchment, with an Islands UI floating toolbar and aligned badge controls.
  - Breadcrumbs bar restyled to match Lumina's Islands UI tokens with smooth hover states and responsive title truncation.
- **Note Header & Cover Metadata (`MetaBackground`)**
  - Removed background pills from the `...` menu button and creation timestamp, dynamically linked the timestamp text to your active `--accent-color`, added a crisp zero-blur contrast halo so the date/time stays sharp and distinguished over any cover image, and locked action bar positions so layout never shifts with or without a cover image.
  - Made the floating note creation time badge (`EditorCreatedAt`) solid and opaque on hover.
- **Editor Find & Replace (`Find.tsx`) & Wikilink Popup**
  - Migrated `Find` to TypeScript with locked `256px × 30px` search and replace inputs so toggling Replace mode never shifts layout.
  - Refined the Wikilink autocomplete popup with a `5px` border radius and a more compact width (`-30px`).
- **Canvas Button in Right Activity Bar**
  - Moved the Spatial Canvas trigger from the left Activity Bar into the **Right Activity Bar** for balanced dual-dock navigation.

---

### ⚡ Performance, Memory (<200 MB) & Platform Fixes

- **Safe Image Decoding & GPU Texture Sizing**
  - Added `decoding="async"` across note cover banners, inline Markdown images, workspace image viewer tabs, URL preview cards, hover popovers, and media peek modals (and `loading="lazy"` on below-the-fold link preview thumbnails).
  - Added in-memory display downscaling (max width `1200px`) for uploaded note cover banners and bounded `object-fit: cover` container dimensions (`1200px` max cover width, `400px` max thumbnail width) without altering original files on disk.
- **Windows WebView2 Idle Cache Trimming on Blur**
  - Added a 5-second debounced `WindowEvent::Focused(false)` handler in `src-tauri/src/lib.rs` calling `ICoreWebView2_19::SetMemoryUsageTargetLevel(COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW)` when backgrounded and restoring `NORMAL` immediately on focus without unmounting open tabs or losing scroll/cursor state.
- **WebGL, KaTeX & Terminal Memory Cleanup**
  - Added explicit `renderer.dispose()` and `renderer.forceContextLoss()` when the 3D Knowledge Graph tab is closed, lazy-loaded KaTeX on demand only when math blocks are rendered, removed idle startup preloads of closed Terminal and Settings bundles, and capped xterm.js scrollback at `1,500` lines.
- **Zen Mode `Alt + Click` Window Dragging**
  - Fixed `Alt + Left Click + Drag` across the entire Zen Mode workspace (including inside the editor) using a DPI-aware synchronous position accumulator in `tauriBridge.ts`.
- **Terminal Emoji & Nerd Font Ligature Isolation**
  - Added `@font-face` `unicode-range` emoji isolation (`Lumina Terminal Emoji`), a prioritized Nerd Font + programming ligature stack, and a custom xterm character joiner so profile emojis never break Powerline prompt bricks or coding ligatures.
