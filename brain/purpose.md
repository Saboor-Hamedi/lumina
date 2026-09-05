# Lumina — Comprehensive Project Architecture, Purpose & Developer Reference

> **Developer & Agent Notice**: This document is the single source of truth for understanding Lumina's design philosophy, codebase architecture, state flow, AI tool execution pipelines, layout system, and critical development invariants. Read this entire file to quickly onboard into any aspect of the codebase.

---

## 1. Executive Summary & Core Purpose

**Lumina** is a modern, local-first knowledge management workspace and AI-assisted thinking environment designed for researchers, engineers, writers, and thinkers.

Built on **Electron** and **React**, Lumina combines the privacy, speed, and ownership of local plaintext Markdown files with graph analytics, bidirectional wikilinking, and multi-provider AI copilot capabilities capable of contextual reasoning, planning, and safe workspace file execution.

---

## 2. Architectural Pillars & Core Philosophy

### A. Local-First Data Sovereignty
- All notes and folders are stored directly on the user's filesystem as plain `.md` files within user-chosen vaults.
- No proprietary database locks: files can be edited, backed up, or read by external editors (Obsidian, VS Code, etc.).
- Robust file-watching (`chokidar` in main process) detects external changes and keeps the renderer state synchronized in real time.

### B. Connected Thinking & Knowledge Graph
- Double-bracket wikilinks (`[[Note Title]]` and `[[Note Title|Alias]]`) establish bidirectional links between notes.
- 2D and 3D interactive force-directed graph visualizers reveal note clusters, orphan notes, and knowledge density.
- Graph topology extraction provides 1-2 hop neighborhood context to the AI assistant for contextual answers.

### C. Multi-Provider AI Copilot & Modes
- Pluggable intelligence engine supporting **DeepSeek** (V3/R1), **OpenAI** (GPT-4o), **Anthropic** (Claude 3.5), and local offline **Ollama** models.
- Modular AI operation modes:
  - **Plan Mode**: Focuses on structured roadmaps, architectural blueprints, and outlines inside chat without altering workspace files.
  - **Code Mode**: Principal engineer mode with execution tools to scaffold folder structures, create notes, and execute updates on disk.
  - **Deep Mode**: Chain-of-Thought reasoning for complex multi-step technical or analytical problem solving.
  - **Creative Mode**: High-velocity divergent brainstorming, storytelling, and conceptual synthesis.
- Fast note mentions (`@note`) and slash commands (`/plan`, `/code`, etc.) within a unified prompt composer.

---

## 3. Three-Pane Layout System

### Overview
Lumina uses a **flex-row three-pane layout** inside `AppShell.jsx`:

```
[Left Sidebar] [Left Resizer] [Main Editor] [Right Resizer] [Right Sidebar]
```

All three panes are direct children of `.app-shell` (a flex container). The resizers are also **direct flex siblings** — not nested inside the sidebars.

### Key Layout Files
- `src/renderer/src/features/Layout/AppShell.jsx` — Central orchestrator managing the 3-pane layout, modals, tabs, sidebar state, and resizing engine.
- `src/renderer/src/assets/appshell.css` — Layout, sidebar widths, transitions, resizer knob styles.
- `src/renderer/src/features/Navigation/Sidebar.jsx` — Left sidebar shell (header + FileExplorer + footer).
- `src/renderer/src/features/Navigation/Sidebar.css` — Left sidebar styles including `.sidebar-header-section` (32px).
- `src/renderer/src/features/Inspector/RightSidebar.jsx` — Right sidebar with Details/Outline/Chat tabs.
- `src/renderer/src/features/Inspector/NoteDetails.css` — Inspector panel, tab bar, and property row styles.

### Sidebar Open/Close State — Source of Truth
**Local React state + localStorage** is the sole source of truth for sidebar open/closed state. The settings store is a secondary persistence target only.

- State initialized from `localStorage` (`lumina_left_sidebar_open`, `lumina_right_sidebar_open`) on mount.
- `updateLeftSidebarOpen(valOrFn)` / `updateRightSidebarOpen(valOrFn)` in `AppShell.jsx`:
  - Read current value from a `ref` (avoids stale closures).
  - Call `setIsLeftSidebarOpen(next)` directly — **never inside a setState updater callback**.
  - Persist to `localStorage` immediately.
  - Persist to `useSettingsStore` inside `setTimeout(..., 0)` to avoid synchronous Zustand dispatch during React rendering.
- The old "reactive sync effect" (`useEffect` watching `sidebarSetting`) is **removed** — it caused circular updates.
- The `sidebarSetting` and `rightSidebarSetting` store subscriptions are **removed** from `AppShell` — they caused unnecessary re-renders on every sidebar state write.

### Sidebar Width Resizing
- Resize is driven by `mousemove` events written directly to CSS custom properties (`--left-sidebar-width`, `--right-sidebar-width`) on both `appShellRef.current` and `document.documentElement`.
- On `mouseup`, the final width is committed to React state and `localStorage`. Settings store write is deferred with `setTimeout(..., 0)`.
- A `blur` event listener on `window` also calls `handleMouseUp` to prevent stuck resizing if the user alt-tabs.
- Sidebars close if dragged below 70px threshold.

### Resizer Knob — Critical Architecture Rule
The `.sidebar-resizer` divs are **direct flex children of `.app-shell`**, NOT nested inside the sidebar `<aside>` elements.

**WHY THIS MATTERS**: The sidebar `<aside>` elements have `contain: inline-size layout`, which creates an independent layout containment context. Any absolutely-positioned children inside a `contain: layout` element are trapped inside the box, regardless of `overflow: visible`. Putting the resizer inside the sidebar causes the knob to appear inside the sidebar content instead of in the gap.

**DOM order:**
```jsx
<aside className="shell-sidebar-left" />     // left sidebar
<div className="sidebar-resizer left" />     // 5px gap + draggable knob
<main className="shell-main" />              // editor
<div className="sidebar-resizer right" />    // 5px gap + draggable knob
<aside className="shell-sidebar-right" />    // right sidebar
```

The resizer div IS the 5px gap (sidebars have no margins). Width: `5px`, `flex-shrink: 0`, `align-self: stretch`. Knob dots centered inside via flexbox.

### Header Alignment — 32px Rule
All three header bars must be exactly **32px tall** to stay perfectly aligned:
- Left sidebar: `.sidebar-header-section` in `Sidebar.css` → `height: 32px`.
- Tab bar: `TabBar.jsx` / `TabBar.css` → `height: 32px`.
- Right sidebar: `.panel-header-tabs` in `NoteDetails.css` → `height: 32px !important`.

### Responsive Sidebar Behavior
- Left sidebar uses container queries (`@container sidebar (max-width: Xpx)`) to shrink button labels at small widths.
- Right sidebar uses `@container inspector (max-width: 250px)` to collapse tab labels to icon-only.
- Sidebar closes automatically when window width crosses below 700px (handled in `AppShell.jsx` resize event).

---

## 4. Deep Dive: Lumina Chat Architecture & Ecosystem

### A. Dual Display Interfaces
1. **Docked Right Sidebar (`aiChatDisplayMode: 'sidebar'`)**: Integrated into AppShell.jsx, allowing side-by-side editing and AI collaboration.
2. **Floating Draggable Modal (`aiChatDisplayMode: 'modal'`)**: Draggable, resizable, and maximizable window overlaying the workspace.

### B. The Unified Composer & Slash Command Architecture
Located in `src/renderer/src/features/AI/Composer.jsx`:
- Auto-expanding textarea, slash commands (`/`), note mentions (`@`), and mode selector.

### C. Context Engine & Prompt Assembly
When a message is sent, context is assembled in a multi-tier hierarchy:
1. Explicit `@-Mentions` — user-selected notes injected as highest-priority context.
2. Active Open Note — the file currently active in the markdown editor.
3. Open Tabs Context — content snippets from all open tabs.
4. Graph Topology Context — 1-2 hop backlinks and forward links from `graphContext.js`.
5. Intent Detection & Dynamic Exemplars — detected user intent injects few-shot guidance via `intentRouter.js`.

### D. Streaming & Real-Time Tool Execution Pipeline
- Uses Vercel AI SDK (`aiSdk.streamText`) with streaming token delivery and tool call execution.
- Tool calls render active progress indicators in chat.
- XML Tag Fallback: If non-tool models output raw XML tags, regex handlers parse and execute them.

### E. Session Management & History
- Multi-session chat support with persistent storage in `localStorage` (`lumina-chat-sessions`).
- History drawer for creating, switching, and deleting sessions.

---

## 5. State Management Architecture

### Stores
- **`useSettingsStore.js`** (Zustand): Global settings — theme, fonts, AI provider keys, sidebar widths, sort preferences, pinned folders, expanded folders.
  - `updateSetting(key, value)`: Updates a single setting and persists to `settings.json` via IPC.
  - `updateSettings(obj)`: Batch-updates multiple settings.
  - `init()`: Loads settings from `settings.json` on startup.
- **`workspaceStore.js`** (Zustand): Vault state — snippets, folders, folder colors, open tabs, selected snippet, pinned tab IDs.
  - `loadVault()`: Reads vault from disk via IPC.
  - `saveSnippet(snippet)`: Persists a note to disk.
  - `restoreSession(openTabs, lastSnippetId, pinnedTabIds)`: Restores previous session on startup.

### Critical Zustand Rules — Learned from Bugs

**Rule 1: Never call `useSettingsStore.getState().updateSettings()` inside a React `setState` updater callback.**
```js
// WRONG - causes "Cannot update FileExplorer while rendering AppShell"
setIsLeftSidebarOpen((prev) => {
  const next = !prev
  useSettingsStore.getState().updateSettings({ sidebar: { isLeftOpen: next } }) // BAD
  return next
})

// CORRECT - separate the two operations
const next = !isLeftSidebarOpenRef.current
setIsLeftSidebarOpen(next)
setTimeout(() => {
  useSettingsStore.getState().updateSettings({ sidebar: { isLeftOpen: next } })
}, 0)
```

**Rule 2: Never create a new object inside `useShallow`.**
```js
// WRONG - creates new object every render → infinite re-render loop
useSettingsStore(useShallow(state => ({
  settings: { sortBy: state.settings.sortBy }  // BAD - new object every time
})))

// CORRECT - individual primitive selectors
const sortBy = useSettingsStore((state) => state.settings.sortBy)
const settings = React.useMemo(() => ({ sortBy }), [sortBy])
```

**Rule 3: Scope subscriptions narrowly in FileExplorer.**
`FileExplorer` must only subscribe to the exact settings fields it uses, not the entire `settings` object. Use individual selectors (`sortBy`, `sortDirection`, `noteOrder`, `pinnedFolders`, `folderOrder`, `expandedFolders`, `startMenuPinnedOrder`).

**Rule 4: Same pattern in `useExplorerOperations.js`.**
```js
// CORRECT
const expandedFoldersSetting = useSettingsStore((state) => state.settings?.expandedFolders)
const folderOrder = useSettingsStore((state) => state.settings?.folderOrder)
const updateSetting = useSettingsStore((state) => state.updateSetting)
```

---

## 6. Directory & File Address Architecture

### Application Core & Main Process
- `src/main/index.js` — Application lifecycle, window creation, IPC handlers, protocol handlers.
- `src/main/SettingsManager.js` — Persists settings to `.lumina/settings.json`.
- `src/preload/index.js` — Secure context bridge exposing filesystem, dialog, and settings APIs.

### UI Shell & Workspace Layout
- `src/renderer/src/App.jsx` — Root component, global error handler, theme loader.
- `src/renderer/src/features/Layout/AppShell.jsx` — Central orchestrator (3-pane layout, modals, tabs, sidebar state, resizing engine).
- `src/renderer/src/features/Layout/TabBar.jsx` — Tabbed document navigation, 32px height, pinned tabs, graph view tab.
- `src/renderer/src/features/Layout/StatusBar.jsx` — Bottom status bar with invisible horizontal scroll.
- `src/renderer/src/features/Layout/Breadcrumbs.jsx` — Note breadcrumb path below TabBar.
- `src/renderer/src/features/Navigation/Sidebar.jsx` — Left sidebar shell.
- `src/renderer/src/features/Navigation/Sidebar.css` — Left sidebar styles.
- `src/renderer/src/features/Navigation/components/SidebarHeader.jsx` — New Note, Daily Note, Graph buttons — 32px aligned header.
- `src/renderer/src/assets/appshell.css` — App shell layout, sidebar transitions, resizer knob styles.

### Editor & Document Workspace
- `src/renderer/src/features/Editor/Editor.jsx` — Markdown editor with live preview, syntax highlighting, callouts, checklists.
- `src/renderer/src/core/store/workspaceStore.js` — Vault state store.

### Right Inspector Sidebar
- `src/renderer/src/features/Inspector/RightSidebar.jsx` — Tab bar (Details / Outline / Chat) + panel content switcher.
- `src/renderer/src/features/Inspector/NoteDetails.jsx` — Note metadata properties.
- `src/renderer/src/features/Inspector/NoteOutline.jsx` — Live heading outline extracted from active note.
- `src/renderer/src/features/Inspector/NoteDetails.css` — Inspector panel, tab bar, and property row styles.

### File Explorer
- `src/renderer/src/features/Explorer/FileExplorer.jsx` — Left sidebar file tree with DnD, virtual list, search, folder colors.
- `src/renderer/src/features/Explorer/hooks/useExplorerSelection.js` — Multi-select, keyboard navigation, auto-scroll.
- `src/renderer/src/features/Explorer/hooks/useExplorerOperations.js` — Folder create/rename, note creation, expand/collapse state.
- `src/renderer/src/features/Explorer/hooks/useExplorerDnd.js` — Drag-and-drop reordering logic.
- `src/renderer/src/features/Explorer/hooks/useFileSearch.js` — Fuse.js fuzzy search, ranking, pinned items.
- `src/renderer/src/features/Explorer/hooks/useFileTree.js` — Flat tree generation for the virtual list.

### AI Engine, Modes & Execution Tools
- `src/renderer/src/features/AI/Lumina.jsx` — AI chat interface (sidebar and floating window modes).
- `src/renderer/src/features/AI/Composer.jsx` — AI prompt composer with slash commands and note mentions.
- `src/renderer/src/features/AI/tools/lumina.js` — Core AI streaming pipeline, context injection, prompt engineering.
- Tool registry (`src/renderer/src/features/AI/tools/index.js`): `createFile`, `createFolder`, `updateFile`, `appendToFile`, `renameFile`, `renameFolder`, `deleteFile`, `deleteFolder`, `moveFile`, `readFile`, `openFile`.

### Graph & Analytics
- `src/renderer/src/features/Graph/Graph.jsx` — 2D/3D force-directed interactive knowledge graph.
- `src/renderer/src/features/AI/services/graphContext.js` — Graph topology scanner for AI context.

### State & Settings
- `src/renderer/src/core/store/useSettingsStore.js` — Settings store.
- `src/renderer/src/features/Settings/Settings.jsx` — Settings modal.

---

## 7. Bugs Fixed (Session Log)

### A. React setState-during-render warning
**Error**: `Cannot update a component (FileExplorer) while rendering a different component (AppShell)`
**Root cause**: `updateSettings()` called inside React `setState` updater callback → synchronous Zustand dispatch re-renders FileExplorer while AppShell renders.
**Fix**: Separated operations — React state set directly, store write deferred via `setTimeout(..., 0)`.

### B. Infinite re-render loop
**Error**: `The result of getSnapshot should be cached to avoid an infinite loop`
**Root cause**: `useShallow(state => ({ settings: { ...constructed object... } }))` — new object reference every render fails snapshot cache.
**Fix**: Individual per-field selectors + `useMemo`.

### C. Resizer knob inside sidebar content
**Root cause**: Resizer was nested inside `<aside>` with `contain: inline-size layout`. CSS containment traps absolutely-positioned children inside the box.
**Fix**: Moved resizers to be direct flex siblings of `<main>` in app-shell. Resizer IS the gap (5px flex item).

### D. `settings is not defined` in `useExplorerOperations`
**Root cause**: After store refactor, `settings.folderOrder` was still referenced in a `useCallback` dep array.
**Fix**: Added individual `folderOrder` selector directly in the hook.

### E. TitleBar Navigation & Inspector Toggle Buttons
- Relocated both the left sidebar toggle and right sidebar/chat toggle into `TitleBar.jsx`, styled to span the full height of the title bar.
- Removed duplicate right sidebar toggle button from `TabBar.jsx`, freeing horizontal space for tab chips.
- Integrated `Ctrl + Shift + \` keyboard shortcut as a smart toggle for the right sidebar (opens chat tab or toggles open/close).

### F. StatusBar Interactive Metric Toggles
- Enabled click handlers on word count, character count, and reading time in `StatusBar.jsx`.
- Clicking any metric toggles the right sidebar: if closed, opens to the "Details" tab; if open on Outline or Chat, switches directly to the "Details" tab; if already on "Details", toggles the sidebar closed.

### G. ChatActions & Activity Card Polishing
- Chat action buttons (Copy, Like, Dislike) are now hidden during message generation/streaming and only display once the assistant finishes.
- Created `luminaTimer.jsx` with seconds/minutes formatter (`1s`, `2s`, `1m 5s`) to replace the generic pulsing working animation in `ActivityCard.jsx`.
- Fixed `<lumina-activity>` tag leakage in `MessageContent.jsx`: updated regex from a single match to `matchAll` to capture multiple activity blocks and strip stray tags from markdown outputs.
- Enhanced `ActivityCard.jsx` to recognize markdown-formatted wikilinks (`[Title](wikilink:...)`) in action items alongside `[[Title]]`.
- Added CSS safety rule in `lumina.css` to prevent custom `<lumina-activity>` elements from rendering as unstyled text if passed to the DOM.

---

## 8. Critical Developer Invariants

- **Never nest the sidebar resizer inside the sidebar `<aside>` elements** — `contain: layout` traps it. Keep resizers as direct flex children of `.app-shell`.
- **Never call Zustand `updateSettings()` inside React `setState` updater callbacks** — always defer with `setTimeout(..., 0)`.
- **Never use `useShallow` with an inline object literal selector** — always use individual primitive selectors or stable references.
- **Sidebar open/close source of truth is `localStorage`** — the Zustand settings store is write-through only. Never read `sidebarSetting.isLeftOpen` from the store for rendering.
- **All three header bars must be exactly 32px**: left sidebar header, TabBar, right sidebar tab bar.
- **`src/renderer/src/components/Indexing.jsx` must never be modified** under any circumstances.
- **No Git commits or pushes unless explicitly requested by the user.**
- **Zero Code Comments Rule**: Never add code comments in modified or newly created files unless explicitly requested.
- **Natural File Names**: Lumina supports spaces in file names. Do not force underscores or kebab-case.
- **Local Settings Resilience**: AI keys and `activeAIMode` are dual-persisted to `settings.json` and `localStorage`.

---

## 9. Comprehensive Feature Catalog

### A. Global Command Palette & Spotlight Experience (`CommandPalette.jsx`)
- **System-Wide Spotlight (`Ctrl+P` / `Cmd+K`)**: Rapid floating launcher to search notes, run application commands, switch themes, open settings, or toggle views.
- **Dual Engine Search (Fuzzy + Semantic AI)**:
  - High-velocity fuzzy text matching via **Fuse.js** and `searchRanker.js` over note titles, tags, and document content.
  - On-demand **Semantic AI Search** allowing conceptual note discovery even when query terms are not in the document title.
- **Search Modifiers & Prefixes**:
  - `#` filters by note tags (e.g. `#todo`, `#ideas`, `#work`).
  - `@` filters by mentions and note links.
  - `>` or `/` filters system commands and workspace actions.
  - `+` provides instant creation of a new note directly seeded with the search query.
- **Live Document Quick-Look Preview (`PreviewCommandPalette.jsx`)**: Instant split-pane markdown preview on the right when navigating search results with keyboard arrow keys.
- **Direct Application Control**: Trigger graph view, open settings, toggle themes, open documentation, or create folders without touching the mouse.
- **Inline AI Prompting**: Send AI prompts or trigger prompt workflows directly from the palette input field.
- **Virtualized & Responsive**: Built with `useDeferredValue` and memoized highlight text rendering to maintain 60 FPS in massive vaults.

### B. Core Editor & Markdown Engine
- **CodeMirror 6 Powered**: Enterprise-grade extensible editor with responsive syntax highlighting and fluid caret movement.
- **Inline Slash (`/`) Commands**: Quick action popover menu inside the editor to insert headings, tables, callouts, checklist items, code blocks, or trigger AI actions right under the cursor.
- **Wikilinks & Bidirectional Graph Links (`[[...]]`)**: Note cross-referencing with autocomplete dropdowns, live preview hover cards, and seamless caret positioning.
- **Rich Markdown Elements**: Full support for bold, italic, strikethrough, highlights, code blocks, blockquotes, callouts, and mathematical formulas (KaTeX).
- **Interactive Markdown Tables**: Intelligent table editing with row/column insertion, cell navigation, and column sorting (`tableSort.js`).
- **Mechanical Typing Audio Feedback**: Optional realistic typewriter and mechanical keyboard sounds (`useTypingSound`) with customizable volume and audio switch.
- **Multi-Tab Workspace**: Tab bar with reordering, tab pinning, tab closing, and fast keyboard tab navigation (`Ctrl+Tab`).

### C. File Organization & Vault Management
- **Local-First Plaintext Architecture**: 100% data privacy and ownership—all notes and folders are standard files on disk watched by `chokidar`.
- **Drag-and-Drop Explorer (`@dnd-kit`)**: Smooth, animated reordering and nesting of notes and folders with optimistic state updates.
- **Multi-Item Selection**: Multi-select notes and folders using Shift+Click, Ctrl+Click, or drag-selection for batch actions (move, delete, export).
- **Omnipresent Context Menus**: Context menus on notes, folders, and editor text supporting Cut, Copy, Paste, Rename, Delete, Duplicate, and Set Icon.
- **Custom Note & Folder Icons**: Built-in icon picker allowing custom Lucide icons and accent colors per note or folder.
- **Vault Insights & Live Metrics**: Explorer counter revealing total notes, folders, word count, character count, and disk footprint.
- **Daily Notes & Templates**: One-click daily note creation with pre-configured note templates (`TemplateModal.jsx`).

### D. Visual Knowledge Graph (2D & 3D)
- **Interactive 2D Graph (D3 Force / HTML Canvas)**: Real-time force-directed network diagram displaying note connections, tag links, and knowledge clusters.
- **Immersive 3D Graph (Three.js / Force-Graph 3D)**: Full 3D sphere-node orbit view with orbit controls, rotation, zoom, and pulsating nodes.
- **Dedicated Physics Web Worker**: Calculations are offloaded to `physics.worker.js` to eliminate frame drops and keep the renderer interface fluid.
- **Graph Filters & Tuning**: Controls for node size, link distance, charge strength, toggling orphan notes, hiding ghost notes, and tag filtering.
- **MiniMap & Performance Panel**: Integrated MiniMap and performance overlay reporting real-time FPS, node count, and edge count.

### E. Lumina AI Copilot & Multi-Provider Architecture
- **Multi-Provider LLM Integration**: Connects to OpenAI, Anthropic Claude, Groq, Google Gemini, Ollama (offline local models), and DeepSeek.
- **Inline Lumina Assistant**: Popover prompt tool in the editor for instant text rewriting, grammar fixes, expansion, or inline code generation.
- **Sidebar AI Chat Assistant**: Dedicated conversation drawer with streaming responses, markdown formatting, syntax highlighted code blocks with one-click copy, and chat history.
- **Agentic File Tools**: AI tools capable of reading files, searching notes, creating new notes, and restructuring folders with user visibility.
- **Local Embeddings**: Powered by `@xenova/transformers` for on-device vector search without transmitting private vaults to external servers.

### F. Media & Asset Management
- **Image Drag-and-Drop & Clipboard Paste**: Direct clipboard pasting and desktop drag-and-drop to embed images into notes.
- **Image Extension & Widgets**: Custom inline image preview widgets with customizable image captions (`imageCaption.js`, `imageExtension.js`).
- **Fullscreen Lightbox / Media Viewer**: Zoom, pan, inspect, rotate, and copy images to clipboard without leaving the app (`ImageViewerTab.jsx`, `imageLightbox.js`).

### G. Roadmap & Progress Tracking
- **ProgressTracker & LearningTrackBadge**: Visual progress badge on notes displaying the completion percentage of learned material.
- **Mark as Learned (`LearnedButton`)**: One-click status toggle on notes to track curriculum and personal learning progress.
- **Editor Progress Bar Plugin**: Live progress indicators rendered directly inside markdown files for task lists and roadmaps.

### H. Theming, Typography & UI Polish
- **21 Custom Built-In Themes**: Comprehensive dark and light themes crafted for ergonomic contrast and long-session comfort.
- **Custom Typography & Caret Controls**: Font family selector (monospace, sans, serif), font size, line height, and custom caret color synced with the active theme.
- **Global Error Boundaries**: Graceful crash protection via `GlobalErrorHandler`, preventing white-screen freezes and providing one-click reload.
- **Built-in Auto Updater**: Compact titlebar update widget with changelog viewer, release notes breakdown (New, Improved, Fixed), channel switcher (Stable / Beta), and background download & install.
