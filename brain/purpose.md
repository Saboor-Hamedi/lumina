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

### Responsive Sidebar Behavior & Curtain Mechanic
- Left sidebar clips its stationary content from right-to-left using `overflow: hidden`, behaving like a curtain.
- Right sidebar clips its stationary content from left-to-right using `overflow: hidden`, `align-items: flex-end`, and `margin-left: auto`, docking against the right window edge so it acts as an identical stationary curtain.
- Tab labels and content inside `.shell-sidebar-right` maintain fixed 300px min-width with no container query collapses so tabs do not squish or disappear during drag or closing.
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
- Multi-session chat support with persistent IndexedDB storage (`chatStorage.js`) and localStorage fallback.
- History drawer for creating, switching, and deleting sessions.
- In-flight promise locking (`loadSessionsPromise`) preventing concurrent multi-call race conditions on initial mount.

### F. Surgical In-Place Note Updates & Editor Streamer (`updateFile.js` & `editorStreamer.js`)
- **Targeted Precision Execution**: Instead of rewriting entire notes on edit or refinement requests, `updateFile` performs surgical updates:
  - Updates specific sections via `sectionHeader` (e.g. `## Features`).
  - Isolates opening paragraphs and introductory text via `isIntroRequest` (replacing text strictly between `# Title` and the first `## Subheading` while preserving frontmatter and all other sections).
  - Performs surgical block and word-level search & replace via `search` and `replace`.
- **Zero Typewriter Lag**: Dispatches changes through `streamCodeToEditor` directly to CodeMirror 6 with instant draft synchronization and intelligent vertical centering around the modified lines (`scrollToBottom: false`).

### G. Unified Real-Time Reasoning & Single Thinking Stream (`aiStreamRunner.js` & `ThinkingBlock.jsx`)
- Consolidates all Chain-of-Thought reasoning (initial assessment, tool selection, and post-tool reflection) into a single, unified `<think>` block at the top of the message.
- Eliminates secondary fragmented thinking dropdowns appearing after tool execution.
- Live elapsed timers (`Thinking (12s)`) keep the user visually informed during multi-step model reasoning without sudden delays or UI jumps.

### H. Persistent AI Memory & User Profiling (`luminaMemory.js` & `SettingMemory.jsx`)
- **Three-Tier Memory Pool (`memory.json`)**:
  1. **User Identity**: User name, role/occupation, and bio/context.
  2. **User Preferences**: Explicit styling and interaction rules (e.g. response length, language, preferred tech stack).
  3. **Learned Facts & Knowledge**: Dynamic knowledge points extracted during conversations or manually curated.
- **Natural Personalization**: Automatically addresses the user naturally by name during conversations without robotic repetition. Injects active role and background context into prompts to calibrate explanation depth and recommendations.
- **Dedicated Settings Management**: Full UI in `SettingMemory.jsx` allowing users to view, add, inline-edit, and delete identity, preferences, and learned facts with validation, overflow protection, and keyboard shortcuts (`Ctrl+Enter`).

### I. Multi-Disciplinary Mode System & Open Tab Awareness (`aiPromptBuilder.js`)
- **Domain-Specific Plan Routing**: Plan Mode advises execution modes tailored to the domain:
  - `/research` & Research Mode for academic, thesis, literature, and scholarly work.
  - `/creative` & Creative Mode for narrative essays, prose, and conceptual brainstorming.
  - `/code` & Code Mode for software architecture and codebase implementation.
- **No Code Bias**: Eradicated the false assumption that Code Mode is the sole file-creation mode. All relevant modes can create notes and files.
- **Active Tab & Buffer Context**: Open editor tabs and unsaved memory buffers are treated as immediate, valid workspace context, enabling the assistant to answer questions about in-progress drafts.

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
- **Surgical Updates Over Full Rewrites**: AI updates must never replace entire files on edit or polish requests. Always use targeted selectors (`sectionHeader`, `isIntroRequest`, or `search` & `replace`) to protect frontmatter and surrounding sections.
- **Single Unified Thinking Block**: All AI reasoning tokens must stream into a single `<think>` block at the top of the message. Never generate fragmented or secondary thinking dropdowns across tool calls.
- **Atomic Session Fallback**: When deleting the last chat session, never set `sessions: []` in store state. Always construct and persist the replacement session atomically (`remainingSessions = [freshSession]`) to prevent reactive re-render cascades.

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

---

## 10. Sidebar Resize Refactor — Curtain Mechanic (Session Log)

### Goal
Sidebars previously shrank/compressed their content when dragged inward. The target behavior: dragging inward should **slide a curtain over** the sidebar content — the content stays locked at full width (260px for left sidebar, 300px for right sidebar) and is simply clipped by the outer container, like a sliding door. FileExplorer never compresses, squishes, or shrinks its width. Releasing below the threshold (180px) snaps the sidebar fully closed.

### Files Changed

#### `src/renderer/src/features/Layout/useSidebarResize.js`
- Extracted all sidebar resize logic out of `AppShell.jsx` into a dedicated hook.
- `handleStartResize(side, e)` — attaches `mousemove` / `mouseup` / `blur` listeners imperatively (zero React re-renders during drag, maximum performance).
- **`onMouseMove` — curtain mechanic**: decouples two CSS variables:
  - `--left-sidebar-width` / `--right-sidebar-width` — outer container width, follows the drag handle freely (can go to 0px).
  - `--left-sidebar-content-width` / `--right-sidebar-content-width` — inner content width, locked at `DEFAULT_LEFT_WIDTH` (260px) and `DEFAULT_RIGHT_WIDTH` (300px) when dragging inward, and expanding naturally when dragging outward.
- `onMouseUp` — commits final width to React state + localStorage. If released below `CLOSE_DRAG_THRESHOLD` (180px), sidebar snaps fully closed.
- Constants: `CLOSE_DRAG_THRESHOLD = 180`, `DEFAULT_LEFT_WIDTH = 260`, `DEFAULT_RIGHT_WIDTH = 300`, `MAX_LEFT_WIDTH = 600`, `MAX_RIGHT_WIDTH = 750`.

#### `src/renderer/src/assets/appshell.css`
- **Removed `contain: inline-size layout`** from both `.shell-sidebar-left` and `.shell-sidebar-right`.
- **Switched inner container approach** to `flex-shrink: 0 !important` + `min-width: 260px !important` (300px for right sidebar). Outer clips via `overflow: hidden`, inner remains uncompressed.
- **Fixed blanket `min-width: 0` rule**: only applied to `.app-shell > .shell-main`.
- **Added `display: flex; flex-direction: column;`** to `.shell-sidebar-left` and `.shell-sidebar-right` outer containers.
- **Full 260px Floor Across All 5 Sidebar Components**: Added `flex-shrink: 0 !important; min-width: 260px !important; width: 100% !important; box-sizing: border-box !important;` to `.sidebar-header-section`, `.sidebar-scrollable-content`, `.explorer-embedded-container`, `.explorer-header-container`, `.start-section`, `.start-menu-body`, and `.sidebar-footer-section` so no component squishes during drag.

#### `src/renderer/src/features/Navigation/Sidebar.css`
- `.unified-sidebar`: `min-width: 260px`.
- `.sidebar-header-section`: `min-width: 260px; flex-shrink: 0;`.
- `.sidebar-scrollable-content`: `min-width: 260px; flex-shrink: 0;`.
- `.sidebar-footer-section`: `min-width: 260px; flex-shrink: 0;`.

#### `src/renderer/src/features/Explorer/FileExplorer.css`
- `.explorer-header-container`: `min-width: 260px; flex-shrink: 0; box-sizing: border-box;`.

#### `src/renderer/src/features/Inspector/NoteDetails.css`
- `.inspector-panel`: `min-width: 300px`.

### How the Curtain Works (Architecture)

```
.shell-sidebar-left         ← overflow:hidden, width = --left-sidebar-width (follows drag freely, can be 0)
  └── .unified-sidebar      ← flex-shrink:0, min-width:260px, width = --left-sidebar-content-width (always ≥260px)
        ├── SidebarHeader   ← flex-shrink:0, min-width:260px, width:100%
        ├── FileExplorer    ← flex-shrink:0, min-width:260px, width:100%
        │     ├── ExplorerHeader    ← flex-shrink:0, min-width:260px, width:100%
        │     ├── ExplorerFavorites ← flex-shrink:0, min-width:260px, width:100%
        │     └── FileTree (Virtuoso)
        └── SidebarFooter   ← flex-shrink:0, min-width:260px, width:100%
```

- When dragging inward: outer shell shrinks, inner content stays locked at 260px — outer `overflow: hidden` cleanly masks the inner like a curtain sliding over it. FileExplorer never shrinks.
- When drag is released ≥ 180px: sidebar stays open clamped to at least 260px.
- When drag is released < 180px: sidebar snaps fully closed.

### Key Invariants Added
- **Never use `contain: inline-size` on sidebar outer containers** — it prevents the inner `flex-shrink: 0` / `min-width` lock from working correctly.
- **Inner sidebar content must always have `flex-shrink: 0` + `min-width: 260px`** at every layer of the flex tree.
- **Only `.shell-main` should have `min-width: 0`** among direct children of `.app-shell`.

---

## 11. Recent Enhancements & Bug Fixes (Session Log)

### A. RightSidebar Stationary Curtain Architecture
- **Problem**: Dragging the right sidebar inward previously pushed the entire `.inspector-panel` inward against the right screen edge, causing tabs to visually translate or hide against the window boundary instead of acting as a true stationary curtain.
- **Solution**:
  - Positioned `.shell-sidebar-right .inspector-panel` at `position: absolute !important; right: 0 !important; top: 0 !important; bottom: 0 !important; width: var(--right-sidebar-content-width, 300px) !important;` inside `appshell.css`.
  - When the right sidebar is resized, the outer container clips the content from left-to-right as a stationary curtain docked to the right edge.
  - Tab headers (`Details`, `Outline`, `Chat`) remain pinned to the left edge of the inspector header (`justify-content: flex-start`), matching the left-aligned layout convention.

### B. AI Composer Layout & Aesthetic Refinements (`Composer.jsx` & `Composer.css`)
- **Expanded Dimensions**: Increased minimum textarea height to 48px, line-height to 21px, and font size to 13.5px for improved readability and comfort when composing complex prompts.
- **Subtle, Borderless Aesthetics**: Removed harsh saturated inline borders and bright backgrounds on the active mode pill in the composer footer. Replaced with clean, borderless, theme-integrated pill states with subtle hover styling.

### C. Update Details Modal (`UpdateDetails.jsx`)
- **Escape Key Dismissal**: Added Escape key handler using the global LIFO keyboard shortcut manager (`window.luminaKeyboardShortcuts`) and a window-level fallback to ensure pressing `Esc` reliably closes the update details modal.
- **Clean Release Notes Formatting**: Filtered out raw internal development status strings (e.g. `"You are running the latest development build."`) in favor of clear, non-technical release notes categorizing new features, usability improvements, and stability fixes.

### D. SettingsManager Debounced IPC Resolution Fix
- **Error**: `Uncaught (in promise) Error: Error invoking remote method 'db:saveSetting': reply was never sent`.
- **Root Cause**: In `SettingsManager.js`, `queueSave()` previously overwrote `this.saveTimeout` with `clearTimeout` when multiple `db:saveSetting` calls arrived in the same synchronous tick. The Promise created by the cancelled timeout was never resolved, leaving Electron's IPC handle channel hung until it timed out or was dropped.
- **Fix**:
  - Implemented a `this.pendingResolvers` queue in `SettingsManager.js` that collects all pending Promise resolvers and cleanly resolves every caller once disk write finishes.
  - Ensured no-op cache checks in `set()` and `setMultiple()` immediately return `true` instead of `undefined`.
  - Added `.catch(() => null)` wrappers in `src/preload/index.js` and `.catch?.(() => {})` in `workspaceStore.js` to guard against unhandled rejections during window reloads.

### E. In-Memory Daily Note Seeding & Test Isolation
- Replaced physical starter vault disk seeding in `DailyNotes.jsx` with isolated in-memory templates, preventing unexpected disk file writes during test suite execution and keeping tests reproducible and hermetic.

### F. KaTeX Math Block & Inline Formula Support (`katexExtension.js`)
- **Problem**: Attempting to render block math formulas (e.g., `$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$`) threw `TypeError: state.doc.sliceDoc is not a function at buildKaTeXDecorations (katexExtension.js:140:34)`.
- **Root Cause**: In CodeMirror 6, `sliceDoc` exists on `EditorState` (`state.sliceDoc(from, to)`), whereas `state.doc` is a `Text` instance without a `sliceDoc` method.
- **Fix**: Replaced `state.doc.sliceDoc(item.from, item.to)` with `state.sliceDoc(item.from, item.to)` in `katexExtension.js`. Block and inline KaTeX formulas now render stably without crashing the editor boundary.

### G. Fenced Code Block Geometry & Selection Polish (`codeWrapper.css` & `Editor.css`)
- **Split Backgrounds**:
  - Previously, `.cm-line.cm-atomic-fenced-code.cm-activeLine` applied `background-color: var(--bg-active, #2a2a2a)` (and `#f0f0f0` in light mode), causing the active line inside a code block to appear as an incongruous contrasting stripe across the block.
  - Fix: Updated `.cm-line.cm-atomic-fenced-code.cm-activeLine` and its closing fence selectors to preserve the unified code block background (`rgba(0, 0, 0, 0.15)` in dark theme, `#f7f7f7` in light theme).
  - Suppressed active line `box-shadow` and `outline` on fenced code lines (`html[data-use-active-line-border="true"] .cm-line.cm-atomic-fenced-code`) to prevent the purple indicator notch from leaking into code blocks.
- **Double Selection & Blurry Ghost Halo**:
  - When double-clicking or selecting words in code blocks, both native browser `::selection` and CodeMirror's `.cm-selectionBackground` painted simultaneously. Due to line-height and font metric discrepancies, this produced a blurry "dropdown" ghost shadow with a white text halo.
  - Fix: Silenced native selection inside fenced code (`.cm-line.cm-atomic-fenced-code::selection { background: transparent !important; color: inherit !important; text-shadow: none !important; }`), allowing CodeMirror's `.cm-selectionBackground` to cleanly handle the selection with crisp rounded corners and preserved syntax highlighting.
  - Added direct `display: none !important` to `.cm-cursor` when `.cm-selectionBackground` is present in `Editor.css` to prevent block cursors from clashing with active text selections.

### H. Small-Screen Editor Scroller Margins (`Editor.css`)
- **Problem**: When both the left sidebar and right sidebar were open on smaller screens, the markdown editor scroller lacked horizontal padding, causing text to run flush against the resizer edges.
- **Fix**: Added `padding: 0 16px; box-sizing: border-box;` to `.editor-scroller` in `Editor.css`, providing consistent, comfortable breathing room across all screen widths.

### I. Roadmap & ProgressTracker Visual Polish (`ProgressTracker.jsx`)
- **Problem**: The "Mark as Learned" button previously rendered with a heavy green background and border, clashing with user theme accent colors.
- **Fix**: Removed the prominent green background and border from the learned button state, transitioning to a clean surface and coloring the checkmark icon with `var(--text-accent)` to harmonize with the active theme.

### J. Surgical In-Place AI Note Updates (`updateFile.js` & `editorStreamer.js`)
- **Problem**: When prompted to update or refine specific paragraphs or sections in notes, earlier logic could rewrite the entire document or fail if `sectionHeader` matched the level-1 document title `# Title` and wiped subsequent sections. Furthermore, passing `text` or option selections (e.g. "Go for option B") failed if exact heading selectors were omitted.
- **Solution**:
  - Added support for `text` parameter in `updateFileTool` schema alongside `replace`.
  - Added smart defaulting: calling `updateFile` without selectors defaults to updating the `Opening` section instead of returning an error.
  - Prioritized `isIntroRequest` before general heading searches so requests targeting intro/opening text cleanly isolate lines between `# Title` and the first `## Subheading`, protecting frontmatter, titles, and all subsequent document content.
  - Added a search fallback in `updateFile.js` to automatically update the opening section if the requested search text was not found verbatim.
  - Integrated direct CodeMirror view dispatch via `streamCodeToEditor` with smart vertical centering and `scrollToBottom: false`.

### K. Unified Single Thinking Stream Architecture (`aiStreamRunner.js` & `ThinkingBlock.jsx`)
- **Problem**: Multi-step AI generations (tool execution followed by model reflection) generated two fragmented `<think>` tags — one at the top, and another below the activity card after a 30–40 second model reasoning delay. This caused user confusion and UI jumping.
- **Solution**:
  - Unified all reasoning (`initialReasoning` and `postToolReasoning`) in `buildRealtimeDisplay` into a single `<think>` block positioned at the top of the message.
  - While the model reasons after tool calls, reasoning tokens continue accumulating in the existing top dropdown with active timer feedback.
  - Updated `parseMessageBlocks` in `chatMarkdownParser.js` to merge multiple `<think>` tags into a single top thinking block for backward and historical message compatibility.

### L. Multi-Session Chat Deduplication & Atomic Deletion (`lumina.js` & `chatStorage.js`)
- **Problem**: When deleting the last chat session or on initial startup with empty sessions, two identical "New Chat" sessions appeared in the sidebar.
- **Root Cause**: Deleting the last session set `sessions: []`, which triggered reactive `useEffect` hooks in both `Lumina.jsx` and `LuminaChatContent.jsx` to concurrently invoke `loadSessions()`. Concurrently, `deleteSession` invoked `createNewSession()`, generating duplicate UUIDs and saving two sessions to IndexedDB simultaneously.
- **Solution**:
  - Added `loadSessionsPromise` mutex in `lumina.js` to coalesce concurrent load requests.
  - Updated `deleteSession` to atomically create and persist a single `freshSession` (`remainingSessions = [freshSession]`), preventing `sessions` from ever becoming `[]` and eliminating reactive re-fetch cascades.
  - Added deduplication and consolidation of multiple empty "New Chat" sessions in `chatStorage.js` on load.

### M. Self-Healing IndexedDB & Chromium Manifest Recovery (`src/main/index.js`)
- **Problem**: Chromium console logged `Failed to open LevelDB database... Unable to create sequential file` during dev restarts when `CURRENT` pointed to a missing `MANIFEST-000001` file.
- **Solution**: Implemented `autoRepairIndexedDB()` in `src/main/index.js` invoked before `createWindow()`. It detects corrupted dev LevelDB manifests and purges broken partitions so Chromium cleanly re-initializes a healthy IndexedDB store on boot.

### N. Google Drive Push Button Polish & Toolbar Stability (`DrivePushButton.jsx`)
- **Problem**: The Push button previously disappeared when unauthenticated, shifted adjacent editor metadata buttons when toggling states ("Pushing...", "Pushed"), and had a sticky green hover background after successful push.
- **Solution**:
  - Maintained constant visibility whenever an active note exists; clicking while unauthenticated shows a clean toast: `"Log in to Google Drive first"`.
  - Fixed button label strictly to `"Push"` with fixed height (21px), preventing toolbar jittering or button shifts.
  - Removed disruptive background and border coloring on pushing and success states (remains transparent).
  - Used button ref to actively clear inline hover background on success, preventing sticky hover states.
  - Implemented push timestamp tracking (`lastPushedAt`), displaying human-readable timestamps in tooltips (e.g. `"Pushed 10:45 AM"`).

### O. AI Memory Profile Management & UI Polish (`SettingMemory.jsx`)
- **Three-Tier Architecture**: Built a dedicated settings pane allowing users to inspect, modify, and manage their AI memory (`memory.json`): User Identity (Name, Role, Bio), Preferences, and Learned Facts & Knowledge.
- **Form Layout & Auto-Save as You Type**: Structured User Identity with a single-line input for Name, and matching 2-row non-resizable textareas for Role and Bio. Eliminated manual Save buttons in favor of debounced auto-saving on input with subtle non-intrusive status feedback (`Saving...` / `Saved automatically`).
- **Inline Editing & Robust Validation**: Added inline item editing (`Edit2`, `Check`, `X`) with Enter/Escape keyboard handling, duplicate prevention, whitespace trimming, and `wordBreak: 'break-word'` to prevent UI overflow on long strings.

### Q. Unified Unsaved State Architecture (`unsave.js` & `unsave.css`)
- **Centralized Extraction**: Extracted the unsaved / dirty indicator logic and styling into dedicated modular files:
  - [`unsave.css`](file:///b:/electron/lumina/src/renderer/src/assets/unsave.css): Definitive styling for the `.dirty-indicator` blob with pulsating warning amber animation (`#eab308`).
  - [`unsave.js`](file:///b:/electron/lumina/src/renderer/src/core/hooks/unsave.js): `useUnsaved(snippetId)` hook providing `isUnsaved`, `markUnsaved()`, and `clearUnsaved()`, plus the `<UnsavedIndicator />` component.
- **Three-Way Cohesion**: Applied identically across:
  1. **FileExplorer**: [`SidebarItem.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Navigation/components/SidebarItem.jsx)
  2. **Workspace Tab Bar**: [`TabBar.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Layout/TabBar.jsx)
  3. **Editor Push Button**: [`DrivePushButton.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Editor/components/DrivePushButton.jsx)
- **Synchronized Clearance**: Pushing a note or saving it to disk immediately clears the dirty state across all three UI locations simultaneously.

### R. Zero-Latency Draggable Modal Architecture & Guide Parity (`Theme.jsx` & `IconPicker.jsx`)
- **Direct GPU-Accelerated Dragging**: Modal headers act as hardware-accelerated drag handles with `cursor: grab` (switching to `grabbing` during active movement). Drag movements update `translate3d(Xpx, Ypx, 0)` directly with zero React re-renders, delivering 0ms latency.
- **Position State Preservation**: Fixed a snap-back bug where selecting or previewing items triggered `useEffect` resets that snapped modal windows back to the center of the screen. Coordinated via `wasOpenRef` so position resets only occur on initial modal open transitions.
- **Guide Layout & Aesthetic Parity**: Unified both modals with the design language of `Guide.jsx`:
  - Consistent dimensions: `width: 86vw; max-width: 740px; height: 76vh; min-height: 480px; max-height: 78vh; border-radius: 12px;`.
  - Clean breadcrumb navigation headers (`Title / Subtitle`) with live available item counter badges.
  - Minimal rounded close button with bottom-positioned tooltips.
  - Zero backdrop blur (`backdrop-filter: none`) with high-contrast solid dark backdrops (`rgba(0, 0, 0, 0.72)`) for instant rendering and clean readability.
  - Ultra-slim 5px scrollbars with transparent tracks and rounded pill thumbs.

### S. Theme Ergonomics & UI Control Polish (`themeDefinitions.js` & `toggle-theme.css`)
- **Theme Palette Refinement**:
  - Softened Gruvbox Dark into a soothing retro amber palette (`#d79921` accent, `#a89984` secondary text, warm olive and brick red syntax) to eliminate eye fatigue.
  - Replaced harsh OLED blacks (`#000000`) in Dark theme with a balanced slate background (`#0c0d10` editor, `#08080a` sidebar, `#13151a` panel).
  - Fine-tuned Minimal Light, One Monokai, and Cyberpunk for optimal contrast and long-session comfort.
- **Switch Knob Centering & Stability**:
  - Scaled Quick Controls toggle switches to `38px × 22px` with a prominent centered `18px` circular knob.
  - Centered vertically using `top: 50%; transform: translateY(-50%)`.
  - Removed unwanted click shrink/stretch distortion animations so the knob slides cleanly without deforming.
- **Drive Push Runtime Reference Error**: Removed an undefined `setWasPushedSinceEdit` call inside `DrivePushButton.jsx` that previously threw an unhandled runtime error on successful push completion.

### T. World-Class Multilingual Typography, RTL/Bidi, and Resilient Wikilinks (`src/renderer/src/core/i18n/`)
- **Centralized Single-Folder Architecture**: All internationalization, Unicode text normalization, Bidi/RTL detection, font cascade builders, and IME guards are consolidated into a single solid module directory: [`src/renderer/src/core/i18n/`](file:///b:/electron/lumina/src/renderer/src/core/i18n).
- **Viewport-Scoped CodeMirror 6 Bidi Line Extension (`bidiExtension.ts`)**:
  - Dynamically assigns per-line `dir="rtl"` / `dir="ltr"` attributes using Unicode Bidirectional Algorithm ("first strong" character heuristic).
  - Strictly scoped to visible lines inside `view.visibleRanges` and recomputed only on viewport/document/geometry changes. Never scans the full document on keystrokes, guaranteeing solid 60 FPS typing even on 10,000+ line notes.
  - Skips weak and neutral characters before evaluating direction: wikilink syntax `[[` / `]]`, inline code `` ` ``, punctuation, whitespace, and both ASCII (`0-9`) and Persian/Arabic-Indic digits (`۰-۹`, `٠-٩`). Lines like `۱۲۳ سلام` and `[[یادداشت جدید]]` correctly resolve to RTL.
- **Resilient Wikilinks & Autocomplete (`useWikilinkCompletion.js` & `luminaWikiLinks.js`)**:
  - **Syntax Bidi Isolation**: Enforced `unicode-bidi: isolate; direction: ltr;` on `.cm-wikilink-syntax` and `.cm-atomic-wiki-link`, preventing bracket mirroring/inversion in RTL paragraphs.
  - **Canonical Key vs. Display Title Invariant**: Never mutates user note titles or filenames on disk. Builds a deterministic canonical key via `normalizeWikilinkTarget(title)` (unifying Arabic `ي/ك` to Persian `ی/ک`, stripping tashkeel diacritics, removing ZWNJ, folding case) exclusively for indexing and lookup. Notes like `[[یادداشت فارسی]]` and `[[يادداشت فارسي]]` resolve to the exact same note without rewriting titles.
  - **CJK IME Composition Guard (`wikilinkImeGuard.ts`)**: Checks `view.composing` before triggering autocomplete and wraps `Tab`, `Shift-Tab`, `Enter`, and `Escape` keybindings so Chinese (Pinyin) and Japanese (Kana/Romaji) candidate selection is never interrupted.
- **World-Class Typography & Fallback Cascades (`fontStack.ts`, `useFontSettings.js`, `index.html`)**:
  - Automatically wraps any user-selected font with the tier-1 multilingual fallback cascade: `'Vazirmatn'`, `'Segoe UI Variable Text'`, `'Segoe UI'`, `'Geeza Pro'`, `'Tahoma'`, `'PingFang SC'`, `'Hiragino Sans'`, `'Microsoft YaHei'`, `'Yu Gothic UI'`, `'Malgun Gothic'`.
  - Added **Vazirmatn** (the modern gold-standard Persian/Arabic font) to Google Fonts and settings.
  - Increased line-height to `1.65` across the editor and preview, ensuring comfortable breathing room for tashkeel, high dots, and CJK ideograms.
- **Knowledge Graph & Command Palette Search Integration**:
  - `graphBuilder.js` resolves wikilink targets via canonical keys, eliminating disconnected ghost nodes caused by Persian vs. Arabic keyboard variations.
  - `searchRanker.js` integrates `matchesNormalized()`, enabling instant search across Persian, Arabic, and CJK text in the sidebar and Command Palette (`Ctrl+P`).
- **Infinite Spatial Canvas Multi-Script Support (`CanvasNodeCard.tsx` & `canvas.css`)**:
  - Added `dir="auto"` to note card title inputs, title spans, markdown preview containers, and inline editing textareas with matching `[dir="rtl"]` alignment and 1.65 line-height.

### U. Rich Word/HTML Paste Engine (`htmlToMarkdown.js`)
- **Paste with Formatting (`Ctrl + V`)**: Converts HTML/Word clipboard content into clean Markdown — tables, headings, bold/italic, TOC, references, and figure captions.
- **Paste as Plain Text (`Ctrl + Shift + V`)**: Bypasses all HTML conversion and inserts raw unformatted text. Voice dictation moved to `Shift + Alt + V`.
- **Word Image Extraction**: Detects `<v:imagedata>`, `<img src="file:///...">`, and `<base href="...">` in Word HTML. Local image paths are copied from Windows temp (`%LOCALAPPDATA%\Temp\msohtmlclip1\...`) into `.lumina/assets/` via secure IPC (`window.api.saveImageFromPath`), with system clipboard buffer as fallback.
- **VML Conditional Comment Regex Hardening**: Replaced greedy `[\s\S]*?` with a negative lookahead `(?:(?!<![endif]-->)[\s\S])*?` so VML blocks terminate strictly at their own closing `<![endif]-->` without bridging across multiple figures and consuming inter-figure text.
- **`<v:textbox>` Caption Preservation**: VML textbox content (figure captions inside drawing shapes) is unwrapped before comment stripping so captions are preserved.
- **Jump Anchor Elimination**: Internal Word `href="#_Ref..."` anchor links are flattened to plain text, preventing `[1](#_Ref...)` clickable jumps in pasted content.
- **Table Cell Sanitization**: Strips `<u>`, `<span>`, `<font>`, `<br>` from table cells so names like `<u>Dr. Sajarwo Anggai., S.ST., M.T.</u>` paste as clean plain text.
- **TOC & Reference Formatting**: Word TOC dot leaders stripped, hierarchical indent levels preserved. Plain text URLs in references auto-linked as `[url](url)`.
- **Paragraph Justification**: Ragged mid-sentence line breaks from Word normalized into continuous sentences.
- **Unit Tests**: 28 passing tests in `test/renderer/src/features/Editor/utils/htmlToMarkdown.test.js`.

### V. YAML Title Reversion Fix (`workspaceScanner.js` & `workspaceOperations.js`)
- **Root Cause**: `safeParseFrontmatter` in `workspaceScanner.js` wrapped `title: >-` in quotes (`title: ">-"`), mistaking YAML block scalar indicators for literal values. `sanitizeTitleForFilename` then stripped `>` as an invalid Windows filename character, leaving `-`, which was written back into the frontmatter.
- **Fix in `workspaceScanner.js`**: Excluded YAML block scalars (`>`, `|`, `>-`, `|-`, `>+`, `|+`) from the quote-wrapping logic. Added fallback recovery for corrupted `>-`, `>`, `|`, `-` titles using `# Heading` or filename.
- **Fix in `workspaceOperations.js`**: Sanitized only the disk `fileName` while preserving `rawTitle` in frontmatter `title` field. Added automatic title recovery from `# Heading` when title is a YAML indicator artifact.
- **Unit Tests**: 27 passing tests in `test/main/noteTitleRename.test.js`.

### W. Breadcrumbs Long-Title Truncation (`Breadcrumbs.jsx` & `Breadcrumbs.css`)
- **Problem**: Note titles of 80+ words stretched the breadcrumbs bar beyond the screen with no truncation.
- **Fix**:
  - Folder `<span>` elements capped at `max-width: 140px` with `text-overflow: ellipsis; overflow: hidden; white-space: nowrap`.
  - Active note title `<span className="breadcrumb-title-text">` limited to `max-width: clamp(140px, 32vw, 380px)` — scales responsively with the viewport.
  - Active `.breadcrumb-item` gains `flex-shrink: 1; min-width: 0` to compress gracefully under layout pressure.
  - `.breadcrumb-icon` gets `flex-shrink: 0` so icons never collapse.
  - Tooltip on the active note shows the full title + *(Click to copy path)* on hover.
- **Unit Tests**: 3 passing tests including a new 80-word-title case in `test/renderer/src/features/Breadcrumbs/Breadcrumbs.test.jsx`.
- **Full Suite**: 96 test files · 818 tests · 0 failures.

### X. Interactive Breadcrumb Navigation & Sibling Dropdown Picker (`Breadcrumbs.jsx`, `BreadcrumbDropdown.jsx`, `breadcrumbUtils.js`)
- **VS Code-Superior Navigation Architecture**: Re-engineered breadcrumb navigation from passive path labels into an interactive exploration suite. Clicking Workspace, any folder segment, or the active note opens a portal dropdown showing sibling items at that directory level for instantaneous lateral navigation.
- **Interactive Breadcrumb Trail Header**: The dropdown header displays the active folder hierarchy (`Workspace › folder › subfolder`) with clickable ancestry buttons. Users can jump directly back to any ancestor folder in one click or use the Back arrow button (`ChevronLeft`).
- **Instant Search & Filter**: Integrated search bar with case-insensitive instant filtering across both folders and notes.
- **Zero-Shrink Layout & Completely Invisible Scrollbars**: Generous responsive card width (`clamp(320px, 35vw, 460px)`) ensures long file names never aggressively truncate or shrink. Applied `scrollbar-width: none; -ms-overflow-style: none; ::-webkit-scrollbar { display: none; }` across all dropdown lists and trails.
- **Unified Path Traversal Engine (`breadcrumbUtils.js`)**: Resolves directory hierarchies seamlessly across both string path representations (`"src/features/Breadcrumbs"`) and object-based trees. Provides deterministic child folder and note resolution with `Intl.Collator` sorting.
- **Dedicated Copy Path Action**: Extracted path copying out of the note title into an independent icon button with instant `<Check />` confirmation feedback and tooltip.
- **Full Keyboard Mastery**: Full arrow key navigation (`Up`/`Down`), `Enter` to open notes or drill in, `ArrowRight` to drill into folders, `ArrowLeft`/`Backspace` to drill out, and `Escape` to dismiss.
- **Unit Tests**: 25/25 passing tests across `Breadcrumbs.test.jsx`, `BreadcrumbDropdown.test.jsx`, and `breadcrumbUtils.test.js`.

