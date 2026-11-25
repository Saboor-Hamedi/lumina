## Lumina v2.2.1 — Next-Gen Spatial Canvas, Live Web Search AI, Explorer-to-Composer Mentions & Cross-Platform Touch

Lumina **v2.2.1** delivers a ground-up overhaul of the **Spatial Canvas** (freehand drawing, 34 drag-and-drop shapes, smart auto-routing connectors, frameless typography, native OS PNG/SVG export, and 120Hz rAF performance), upgrades **Lumina AI** with a centered-to-bottom welcome composer, native Rust CORS-free live web search across all modes, and drag-to-`@mention` notes from Explorer, polishes the **Knowledge Graph** sidebar, and brings full cross-platform touchscreen support (Windows, macOS, Linux).

---

### 🎨 Spatial Canvas Overhaul

- **Freehand Drawing, Highlighter & Eraser**
  - Added smooth quadratic Bézier **Pencil (`P`)**, **Highlighter**, and **Eraser (`E`)** tools (`canvasStroke.ts`, `CanvasStrokesLayer.tsx`) with `Shift` 15° straight-line snapping, color & width controls, and silent Clear Ink / Clear Canvas actions.
  - Drawing or erasing directly over shapes, text boxes, notes, or wires suppresses node/edge pointer interference and double-click triggers; switching back to **Select (`V`)** immediately lets you move elements underneath strokes.
  - Expanded Undo/Redo history to 100 deep snapshots covering nodes, connectors, and freehand strokes, with silent delete/undo/clear actions (no distracting toast spam).
- **34 Shapes, Drag-from-Sidebar & Quick Diagram Templates**
  - Expanded the shape library from 22 to **34** flowchart, system architecture, polygon, and symbol shapes (`ConvasShapes.tsx`, `StudioShapesTab.tsx`) with live shape search and 1-click **Flowchart**, **System Architecture**, and **Mind Map** templates.
  - Added smooth GPU-accelerated (`translate3d`, portaled to `document.body`) pointer drag-and-drop so you can drag any shape from the sidebar directly on the tip of your cursor and drop it anywhere on the board (works natively in Tauri WebView2 on Windows, macOS, Linux, and touchscreens).
  - Redesigned the **Frame** container into a clean, flat, shadow-free dashed section box with free independent width/height resizing (also enabled for rectangles and pills; hold `Shift` for proportional scaling).
  - Upgraded **Sticky Notes** with tinted paper gradients and folded corners, and separated **Frameless Text Boxes (`T`)** into sleek borderless canvas typography with zero scrollbars and a subtle dashed outline only on hover/selection/editing.
- **Smarter Connectors, Crisp Arrowheads & Borderless Labels**
  - Enabled dynamic smart auto-routing ports (`canvasRouting.ts`, `CanvasEdgeItem.tsx`) so moving a shape automatically flips connected wires to the closest facing sides (`top`/`right`/`bottom`/`left`).
  - Upgraded live wire dragging (`getDragBezierCurve`) to eliminate awkward backwards loops and refined SVG directional arrowheads (`CanvasEdgesLayer.tsx`) across Solid, Dashed, and Dotted line styles.
  - Fixed a CSS `marker-end` override in `canvas-base.css` so **both** start and end arrowheads always update cleanly when changing a connector's color.
  - Removed background boxes from edge labels in favor of crisp `paint-order="stroke"` text halos with 1-click inline renaming, and moved edge hover controls above labels so they never block editing.
- **Cleaner Canvas Workspace, Center-Edge Knob & Native OS Export**
  - Replaced the sidebar header/collapse clutter with a single **center-edge toggle knob** (`<` to open, `>` to close) pinned cleanly outside the scrolling dock, and removed the redundant `"Snap to Grid"` icon from the floating selection toolbar.
  - Separated **Select (`V`)** (drag on empty canvas for Marquee Box Selection; click/drag shapes to move) from **Hand (`H`)** (drag anywhere to pan, plus `Space + Drag` and middle-mouse pan).
  - Suppressed the default browser/Tauri right-click menu on the canvas while preserving native copy/paste inside text inputs and textareas.
  - Wired **Export as PNG** and **Export as SVG** (`canvasExport.ts`) to Tauri's native OS Save File dialog (`export_pick_save_path` + `export_write_file`) with cancel-safe notifications.
- **120Hz Canvas Performance**
  - Replaced frame-starving `cancelAnimationFrame` calls with a vsync-aligned `latestPointerRef` rAF loop in `useCanvasGestures.ts` for silky-smooth panning, node dragging, resizing, and marquee selection.
  - Memoized node/stroke callbacks in `ConvasContainer.tsx`, split `SavedStrokesList` from live `activeStroke` in `CanvasStrokesLayer.tsx`, and hoisted static `<defs>` markers into `EdgeArrowDefs` in `CanvasEdgesLayer.tsx`.

---

### 🤖 Lumina AI Upgrades

- **Centered-to-Bottom Welcome Composer**
  - Empty chats now display a clean `Welcome, how can I help you?` header with the Composer centered on screen, transitioning smoothly to the bottom dock as soon as you send a message.
  - Added `sessionsLoaded` hydration tracking to eliminate the startup center-bounce flash and removed the inner footer border on the Composer card.
- **Native Rust Live Web Search Across All Modes**
  - Built a CORS-free native Rust web search backend (`crates/lumina_core/src/web_search.rs`, `src-tauri/src/commands/web_search.rs`) and dedicated AI `web_search` tool (`src/renderer/src/features/AI/tools/webSearch.ts`).
  - Enabled across **Planning**, **Execution**, and **Research** modes (including default DeepSeek) with automatic workspace fallback and clickable website links.
- **Drag Notes from Explorer Directly into Composer as `@mention`**
  - Wired `@dnd-kit` pointer dragging in `ExplorerDnd.ts` with Priority-1 `.composer-card` hit-testing and `Composer.tsx` drop handling so dragging single or multi-selected notes from Explorer onto the Lumina Composer highlights the card, suppresses the pane split overlay, and attaches them cleanly as `@mention` context.
- **Auto-Memory, Text Selection & Cleaner Responses**
  - Enhanced automatic context memory persistence (`luminaMemory.ts`), enabled standard cursor text selection across AI responses, and removed the `"Workspace context: unknown"` noise from message rows.

---

### 🗂️ Workspace, PDF Drag-and-Drop, Graph Sidebar & Touch

- **Native Tauri v2 Drag-and-Drop & Editor-Bounded Drop Overlay**
  - Wired Tauri v2 `getCurrentWebview().onDragDropEvent(...)` in `useWorkspaceDrop.ts` so dragging external PDFs, Markdown files, images, or folders works reliably across Windows, macOS, and Linux.
  - Scoped `<ExternalDropOverlay>` inside `.workspace-pane-body` (`WorkspacePane.tsx`) with a clean borderless accent tint so drop placeholders fill only the active editor, Canvas, or Lumina view—never covering the TabBar.
- **Fixed Closed PDF Tabs Reopening**
  - Synced `panes.primary` across all tab-mutation actions in `workspaceStore.ts` (`closeTab`, `setActiveTabId`, `reorderTabs`, `closeOtherTabs`, `closeTabsToRight`, `closeAllTabs`, `togglePinTab`, `openGraphTab`, `openLuminaTab`) so closing tabs can never resurrect previously closed PDF tabs.
- **Polished Knowledge Graph Sidebar & Right Activity Bar**
  - Redesigned `GraphSidebar.tsx` and `GraphSidebar.css` with a search icon + clear button, grouped **Filters** and **Forces & Display** surface cards, live numeric slider readouts with a 1-click **Reset** link, theme-tokenized export/action chips, and an Animate/Paused footer with node count.
  - Fixed the Right Activity Bar dual-active bug where Outline and Graph could appear selected simultaneously.
- **Cross-Platform Multi-Touch Support**
  - Added unified Pointer Events and 2-finger pinch-to-zoom / pan gestures across Canvas, sidebar/split resizers, and workspace chrome for smooth touchscreen use on Windows, macOS, and Linux.
- **Modal Dismissal, Metadata Font & Test Suite Stability**
  - Fixed outside-click dismissal for camera/cover background and note action modals, kept note timestamps in the standard UI font while distinguished from theme covers, and fixed `Version.jsx` null-guarding so the full test suite passes cleanly.

---

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
