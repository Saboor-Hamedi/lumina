## Lumina v2.3.1 — Smart PDF Hybrid Index, AI-to-Canvas Visual Thinking, Note Properties & Visual Polish

Lumina **v2.3.1** introduces a built-in **Smart PDF Knowledge Index**, **AI-to-Canvas Visual Thinking** for generating editable diagrams, **Notion-style Note Properties** with drag-and-drop layouts, refreshed **Note Covers & Export Previews**, built-in **How to Ask Lumina** guides, and a cleaner File Explorer and AI chat experience.

---

### 🏷️ Note Properties, Covers & Export Polish
- **Notion-Style Note Properties**: Organize every note with custom fields—Status, Priority, Due Date, Author, links, numbers, and checkboxes—right below the title. Pick dates with Lumina's built-in calendar, drag and drop properties smoothly into any order, and switch between 1, 2, or 3 columns with instant, effortless typing.
- **Refreshed Note Covers & Profile Icon**: Updated the cover menu with 11 curated abstract wallpapers, live link previews, and drag-and-drop uploads, alongside a centered circular note icon and a frosted timestamp badge that stays clear over any banner.
- **Unified Export & Batch Export Previews**: Refined the Export and Batch Export dialogs to match Lumina's interface, giving every format (PDF, Word, HTML, Markdown, ZIP, and Plain Text) the same crisp page preview that follows your active theme.

### 📄 Smart PDF Knowledge Index
- **Invisible Local Hybrid Engine**: Dropping or opening any PDF automatically extracts text per page in Rust (`lopdf`) into an embedded SQLite FTS5 store (`.lumina/pdf-index/index.db`) and lazily computes compact Int8-quantized `all-MiniLM-L6-v2` embeddings in the background (4× smaller on disk, SHA-256 deduplicated).
- **Lumina AI PDF Retrieval**: `@mentioning` a PDF, viewing an active PDF tab, or invoking `searchPdf` automatically retrieves top relevant passages via Reciprocal Rank Fusion (BM25 + semantic vectors) with exact `[p. X]` citations.
- **Plain-English Toolbar Status**: The PDF viewer toolbar shows a subtle `Indexing…` / `N pages` status pill with zero technical jargon.

### 🎨 AI-to-Canvas Visual Thinking & Canvas Fixes
- **Native `.canvas` Diagram Generation (`createCanvasDiagram`)**: Lumina AI compiles semantic flowcharts, system architectures, mindmaps, concept maps, and timelines into 100% native `.canvas` files with balanced studio shape proportions, auto-sized flat `frame` groups, smart-routed arrows, and zero-overlap layouts.
- **Cross-Canvas Copy/Paste & Active-Tab Shortcuts**: Shared the Canvas clipboard across open tabs and scoped keyboard shortcuts strictly to the active Canvas tab so `Ctrl+C` → `Ctrl+V` pastes cleanly into the currently open diagram.
- **Always-New Canvas & `Ctrl+N` Context**: Clicking the Right Activity Bar Canvas button or pressing `Ctrl+N` while on a Canvas always creates and opens a fresh `.canvas` tab.
- **Reliable Hand (`H`) Panning**: Fixed Hand tool and `Space+Drag` panning so dragging anywhere over zoomed-in shapes, frames, or edges pans smoothly.

### ✨ Explorer, Lumina AI & Documentation Polish
- **IDE-Style File Explorer**: Aligned loose root files with folder icon columns, centered vertical hierarchy guide lines, added subtle `.pdf`/`.canvas`/image extension hints and muted icon surfaces, and smoothed hover/active/chevron transitions.
- **Cleaner AI Composer & Chat Mentions**: Attached PDFs/files render as small, truncated chips in the composer and a compact strip above sent prompts, inline mentions flow seamlessly like paragraph wording without overflowing, and Activity Card file titles truncate cleanly beside green `+Nw` badges.
- **Instant Lumina AI Tab**: Pre-warms the Lumina AI bundle on idle and shows a clean loader fallback instead of a blank screen.
- **Built-in Guides**: Added **Smart PDFs & AI Canvas** and **How to Ask Lumina** (prompt engineering guide) to `brain/` and the in-app Documentation modal.

### 🛠️ Input, Table & Editor Fixes
- **Single-Press `Alt` Tab Close-Others & `Ctrl + P` Shortcuts**: Disabled Windows WebView2's native browser accelerator interception (`SetAreBrowserAcceleratorKeysEnabled(false)`), guarded bare `Alt` presses from activating hidden menu-bar focus, synced Tab Bar `Alt` state across pointer/keyboard events, and unified `Ctrl + P` / `Ctrl + Shift + P` Command Palette toggling so both respond on the very first press regardless of focus.
- **Smooth Table Mouse-Wheel Scrolling**: Fixed vertical mouse-wheel scrolling when hovering over Markdown tables by allowing vertical scroll chaining (`overscroll-behavior-y: auto`) and updating the table wheel handler so plain vertical scrolling moves through tall tables and seamlessly into the note body (reserving `Shift + Wheel` for horizontal table scrolling).
- **Preserved Note Creation Timestamps**: Fixed note saving and scanning so editing a note keeps its original `createdAt` timestamp intact instead of overwriting it.
- **Spatial Canvas Label & Grid Persistence**: Fixed Canvas label font scaling, edge width/height resizing, always-visible `1px` borders, stationary selection toolbar positioning, and `snapToGrid` persistence across refreshes.

---

## Lumina v2.2.2 — Next-Gen Spatial Canvas, Live Web Search AI, Chat Mermaid Previews & Unified Link Cards

Lumina **v2.2.2** delivers a ground-up overhaul of the **Spatial Canvas** (freehand drawing, 34 drag-and-drop shapes, smart auto-routing connectors, frameless typography with font-size/title scaling, native OS PNG/SVG export, and 120Hz rAF performance), upgrades **Lumina AI** with a centered-to-bottom welcome composer, live multi-source web search (`luminWebSearch.ts`), live Mermaid diagram previews matching the Editor, and clickable inline `@mention` links, unifies link card grids across the Editor and Chat, polishes the **Knowledge Graph** with instant initial rendering and high-contrast sliders, and brings full cross-platform touchscreen support (Windows, macOS, Linux).

---

### 🎨 Spatial Canvas Overhaul

- **Freehand Drawing, Highlighter & Eraser**
  - Added smooth quadratic Bézier **Pencil (`P`)**, **Highlighter**, and **Eraser (`E`)** tools (`canvasStroke.ts`, `CanvasStrokesLayer.tsx`) with `Shift` 15° straight-line snapping, color & width controls, and silent Clear Ink / Clear Canvas actions.
  - Drawing or erasing directly over shapes, text boxes, notes, or wires suppresses node/edge pointer interference and double-click triggers; switching back to **Select (`V`)** immediately lets you move elements underneath strokes.
  - Expanded Undo/Redo history to 100 deep snapshots covering nodes, connectors, and freehand strokes, with silent delete/undo/clear actions (no distracting toast spam).
- **34 Shapes, Cursor-Attached Drag-from-Sidebar & Quick Diagram Templates**
  - Expanded the shape library from 22 to **34** flowchart, system architecture, polygon, and symbol shapes (`ConvasShapes.tsx`, `StudioShapesTab.tsx`) with live shape search and 1-click **Flowchart**, **System Architecture**, and **Mind Map** templates.
  - Added smooth GPU-accelerated (`translate3d`, portaled to `document.body`) pointer drag-and-drop so you can drag any shape from the sidebar right on the tip of your cursor and drop it anywhere on the board (works natively in Tauri WebView2 on Windows, macOS, Linux, and touchscreens).
  - Redesigned the **Frame** container into a clean, flat, shadow-free dashed section box with free independent width/height resizing (also enabled for rectangles and pills; hold `Shift` for proportional scaling).
  - Upgraded **Sticky Notes** with tinted paper gradients and folded corners, and made **Frameless Text Boxes (`T`)** pure borderless canvas typography with zero scrollbars, hidden rest ports, and a **`− / 15 / +` font-size stepper (`12–48px`)** on the selection toolbar (`22px+` auto-styles as a crisp bold Canvas Title).
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

- **Native Rust Multi-Source Live Web Search (`luminWebSearch.ts` & `web_search.rs`)**
  - Built a CORS-free native Rust live search engine (`crates/lumina_core/src/web_search.rs`, `src-tauri/src/commands/web_search.rs`) powered by **Yahoo Web Search**, **arXiv Academic Papers**, **YouTube Videos**, **GitHub Repositories** (with direct repo lookup & `.gi`/`.git` typo tolerance), and **Wikipedia Full-Text** fallback.
  - Enabled across **Planning**, **Execution**, and **Research** modes (including default DeepSeek) with seamless workspace-to-web fallback and categorized clickable citations (`🌐 Web`, `🎬 Video`, `🎓 Scholar`, `💻 Repo`).
- **Live Mermaid Diagram Previews in Chat (`LuminaChatPreBlock.tsx`)**
  - Wired ```` ```mermaid ```` code blocks in Lumina AI chat directly to Lumina's `core/mermaid` engine (`renderMermaidToElement`, `applyMermaidFit`, `copyMermaidAsImage`, `openMermaidLightbox`) with the exact same Editor header controls (View Code / Preview toggle, Copy Code, Copy as Image), left-aligned source view, theme sync, and click-to-open fullscreen Lightbox.
- **Centered-to-Bottom Welcome Composer & Fixed Mode Dropdown**
  - Empty chats now display a clean `Welcome, how can I help you?` header with the Composer centered on screen, transitioning smoothly to the bottom dock as soon as you send a message (with `sessionsLoaded` hydration tracking to eliminate startup bounce and a borderless inner footer).
  - Fixed the Composer mode/plan dropdown pill so clicking it always resets stale slash filters and shows all available modes, with click-outside dismissal.
- **Clickable Inline `@mention` Links & Explorer-to-Composer Drag**
  - Wired `@dnd-kit` pointer dragging in `ExplorerDnd.ts` with Priority-1 `.composer-card` hit-testing and `Composer.tsx` drop handling so dragging single or multi-selected notes from Explorer onto the Composer highlights the card, suppresses the pane split overlay, and attaches them as `@mention` context.
  - Styled `@mention` tokens in both the Composer (via a synchronized highlight backdrop) and chat messages as inline links matching surrounding text size with an accent link background—clicking opens the referenced note directly.
- **Auto-Memory, Text Selection & Cleaner Responses**
  - Enhanced automatic context memory persistence (`luminaMemory.ts`), enabled standard cursor text selection across AI responses, and removed `"Workspace context: unknown"` from message rows.

---

### 🗂️ Editor Link Cards, Workspace, Knowledge Graph & Touch

- **Unified Link Card Grids in Editor & Lumina AI**
  - Aligned `.cols-2` and `.cols-3` bookmark grids (`linkWrapper.css`, `linkEmbed.css`) to share the exact same vertical 16:9 cover card layout, `10px` radius, and hover lift across both Lumina AI and the Editor.
  - Auto-grouped consecutive pasted URLs in the Editor (`linkEmbedExtension.ts`) into sleek 2–3 column card grids matching ```` ```links ```` blocks.
- **Native Tauri v2 Drag-and-Drop & Editor-Bounded Drop Overlay**
  - Wired Tauri v2 `getCurrentWebview().onDragDropEvent(...)` in `useWorkspaceDrop.ts` so dragging external PDFs, Markdown files, images, or folders works reliably across Windows, macOS, and Linux.
  - Scoped `<ExternalDropOverlay>` inside `.workspace-pane-body` (`WorkspacePane.tsx`) with a clean borderless accent tint so drop placeholders fill only the active editor, Canvas, or Lumina view—never covering the TabBar.
- **Fixed Closed PDF Tabs Reopening**
  - Synced `panes.primary` across all tab-mutation actions in `workspaceStore.ts` (`closeTab`, `setActiveTabId`, `reorderTabs`, `closeOtherTabs`, `closeTabsToRight`, `closeAllTabs`, `togglePinTab`, `openGraphTab`, `openLuminaTab`) so closing tabs can never resurrect previously closed PDF tabs.
- **Instant Knowledge Graph Rendering & Polished Sidebar**
  - Removed the opaque `.graph-initializer` overlay in `Graph.tsx` in favor of a transparent global `<PulseLoader>` while building, keyed `<Graph2D>`/`<Graph3D>` on populated node state, re-attached `ResizeObserver` on open/sidebar toggle, and added first-tick `zoomToFit` in `Graph2D.tsx` so the Graph renders immediately on open without toggling 2D/3D.
  - Redesigned `GraphSidebar.tsx` and `GraphSidebar.css` with a search icon + clear button, grouped **Filters** and **Forces & Display** cards, high-contrast theme-aware slider tracks visible on both Dark and Light/Porcelain themes, live numeric readouts with a 1-click **Reset** link, and an Animate/Paused footer with node count.
  - Fixed the Right Activity Bar dual-active bug where Outline and Graph could appear selected simultaneously.
- **Cross-Platform Multi-Touch Support & Stability**
  - Added unified Pointer Events and 2-finger pinch-to-zoom / pan gestures across Canvas, sidebar/split resizers, and workspace chrome for smooth touchscreen use on Windows, macOS, and Linux.
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
