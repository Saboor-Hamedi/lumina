# lumina

![banner](./banner.png?v=2)

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.65-blue" alt="version">
  <img src="https://img.shields.io/badge/unit%20tests-757%20passed-success" alt="unit tests">
  <img src="https://img.shields.io/badge/e2e%20tests-23%20tests-blue" alt="e2e tests">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
</p>

lumina is a premium, AI-powered thinking environment and personal intelligence cockpit. Features a multi-tab workspace, infinite spatial 2D canvas, modular interactive knowledge graph, theme-synchronized PDF & multi-format export, AI semantic search (local + cloud), 21 ergonomic themes, persistent AI Memory profiles, Google Drive sync mirroring, draggable modals, and a beautiful editor with wikilinks, mermaid diagrams, KaTeX math formulas, code blocks with image export, callouts, and progressive disclosure formatting.

---

## features

### core

- **workspace-first** — all notes are stored locally as plain text files on disk. you own 100% of your data.
- **native rust core engine** — ultra-fast file scanning, regex parsing, and parallel disk traversal powered by `crates/lumina_core` (N-API & Rayon).
- **"Ask Anything" bar (spotlight)** — press `ctrl+space` anywhere (even when the window is hidden) to search notes or ask the AI from one place.
- **global spotlight** — summon the command palette from anywhere on your computer, even when lumina is in the background.
- **multi-tab workspace** — open many notes at once with pinned tabs, drag reorder, dirty indicators, and caret memory.
- **spatial infinite canvas (.canvas)** — 2D infinite spatial whiteboard with pan/zoom (10% to 500%), dot-grid canvas, 12+ geometric vector shapes, dynamic shape ports, magnetic snapping, and 90° orthogonal connector routing.
- **theme-true document & PDF export** — export notes or entire vaults into publication-ready PDFs, Word (.doc), or HTML bundles with live sandboxed IPC previews, auto-generated Tables of Contents, and pixel-perfect theme color preservation.
- **interactive knowledge graph** — force-directed graph visualization of note connections in 2D Canvas & 3D WebGL with high-res PNG/SVG export, coordinate persistence, and elastic central node physics.
- **google drive sync & push** — seamless git-like cloud backup with real-time push timestamps, auto-zip or folder sync, and non-blocking uploads.
- **live preview** — wysiwym editing with intelligent syntax hiding.
- **wikilinks** — `[[link]]` and `[[link|display]]` with auto-update on rename and hover preview cards.
- **ai semantic search** — local embeddings via onnx (privacy-first) or cloud providers.
- **daily notes** — one-click journal creation with auto-date and starter templates.
- **multi-workspace** — instantly switch between workspace directories.

### editor

- **codemirror 6** — advanced text editor with 100+ language syntax highlighting.
- **mathematical formulas (KaTeX)** — render block (`$$...$$`) and inline (`$...$`) math formulas with seamless click-to-edit.
- **fenced code blocks** — unified themes, crisp selection without ghost halos, copy-to-clipboard, and copy-as-image.
- **mermaid diagrams** — render inline diagrams with zoom and full lightbox view.
- **callouts** — `> [!note]`, `> [!warning]`, `> [!tip]`, `> [!important]`, `> [!caution]`.
- **wikilinks** — autocomplete, preview, bidirectional linking.
- **image paste** — drag-and-drop images, auto-saved to `.lumina/assets/`.
- **responsive layout** — padded scroller with comfortable margins across compact and widescreen displays.
- **auto-save** — debounced write to disk on every change.
- **caret persistence** — remembers exact cursor line and column per file across restarts.

### ai & memory

- **multi-model** — deepseek (v3 / r1), openai (gpt-4o), anthropic (claude), ollama (local).
- **ai memory profile** — persistent `memory.json` store tracking user identity, bio, preferences, and learned facts with inline editor in Settings.
- **natural context addressing** — lumina naturally addresses you by name and weaves your background, role, and active projects smoothly into chat and recommendations.
- **multi-mode plan intelligence** — plan mode intelligently routes to specialized disciplines (Research Mode, Creative Mode, Code Mode).
- **chat panel + modal** — sidebar chat or floating draggable modal overlay.
- **composer with slash commands** — `/fast`, `/think`, `/creative`, `/code`, `/image`, `/clear`.
- **rag context** — semantic search over your workspace as real-time context for every query.
- **open editor tab context** — ai prompt engine treats active unsaved buffers as immediate workspace context.
- **image generation** — huggingface inference api integration.
- **local embeddings** — `all-minilm-l6-v2` via @xenova/transformers in a web worker.

### ui & ergonomics

- **21 curated themes** — dark, light, high-contrast, and retro amber palettes with calibrated contrast for long sessions.
- **zero-latency draggable modals** — theme selector and icon picker feature direct GPU-accelerated header drag handling with position memory.
- **crisp zero-blur backdrops** — high-contrast dark backdrops for instant rendering and readability.
- **curtain sidebars** — smooth sliding curtain resize mechanic that protects notes and tabs from squishing.
- **glassmorphism** — mirror mode with backdrop blur and translucency.
- **resizable sidebars** — left explorer + right panels, fully configurable.
- **quick search / spotlight** — `ctrl+space` for global spotlight; `ctrl/cmd+p` for instant note search.
- **keyboard-first** — comprehensive shortcuts across all modes and dialogs.
- **tab management** — pin, reorder, close to right, close others.
- **tactile controls** — smooth centered toggle switches without click distortion.

---

## getting started

### prerequisites

- node.js 18+ (lts)
- npm
- git

### install

```bash
git clone https://github.com/Saboor-Hamedi/lumina.git
cd lumina
npm install
```

### dev

```bash
npm run dev
```

### build

```bash
npm run build:win    # windows
npm run build:mac    # macOS
npm run build:linux  # linux
```

---

## usage

### create a note

`ctrl/cmd + n` → start typing → auto-saves.

### ask anything (spotlight)

`ctrl/cmd + space` opens the global **Ask Anything** bar — it works from anywhere on
your computer, even when lumina is hidden in the background.

- type a note title → live results with a preview; press enter to open it
- type a question → press enter and the AI answers right in the bar
- use the `Search` / `Ask AI` toggle to switch between finding notes and chatting

### link notes

```markdown
this references [[another note]] and [[yet another note|display text]].
```

renaming a note auto-updates all `[[links]]` across the workspace.

### use the ai

- `ctrl/cmd + space` — ask anything from the global spotlight bar
- `ctrl/cmd + shift + \` — open the full ai chat panel
- `ctrl/cmd + k` — open inline ai
- click the ai icon in the title bar — full chat panel
- type `/` in the composer — slash commands

### graph view

click the graph icon in the activity bar. nodes are notes, edges are wikilinks. drag to explore, click to navigate.

---

## development

### project structure

```
lumina/
├── crates/                      # native high-performance Rust core modules
│   └── lumina_core/             # N-API native bindings (Rayon parallel walker, regex scanner, memchr)
├── resources/                   # application icons (.png, .ico) and desktop packaging assets
├── src/
│   ├── main/                    # electron main process
│   │   ├── index.js             # main entry point, IPC registry, window lifecycle
│   │   ├── SettingsManager.js   # settings persistence (.lumina/settings.json)
│   │   ├── FloatingWindowManager.js # draggable floating AI chat window manager
│   │   ├── AppUpdater.js        # background auto-update engine
│   │   ├── indexer-worker.js    # semantic vector indexing worker
│   │   ├── workspace/           # workspace operations, file watcher, scanner, indexer, search, media
│   │   ├── auth/                # Google OAuth authentication & token exchange
│   │   ├── backup/              # Google Drive cloud backup & recovery engine
│   │   └── handlers/            # shortcuts, tray icon, auto-launcher, window resize & opacity
│   ├── export/                  # note & vault export subsystem (PDF, DOCX, Markdown, HTML)
│   │   ├── exportPDF.js         # print-optimized A4 PDF generator with theme styles & auto-TOC
│   │   ├── exportBundle.js      # clean self-contained HTML and Markdown asset bundles
│   │   ├── exportDocs.js        # Word-compatible (.doc) formatted documents
│   │   ├── exportMarkdown.js    # plain Markdown exporter
│   │   ├── exportText.js        # plain text stripper
│   │   ├── exportBatch.js       # recursive folder & multi-note batch export
│   │   ├── exportCombined.js    # multi-document single-volume synthesis
│   │   ├── exportUtils.js       # TOC generator, base64 image & asset:// packager
│   │   ├── mermaidRuntime.js    # offline Mermaid diagram script injector
│   │   ├── renderWindow.js      # offscreen headless browser window for SVG diagram rasterization
│   │   └── preview/             # sandboxed live IPC preview generators & theme token synchronizer
│   ├── preload/                 # secure context bridge (IPC exposed APIs)
│   │   └── index.js
│   └── renderer/                # react 19 frontend application
│       └── src/
│           ├── core/            # core state, hooks, and client infrastructure
│           │   ├── store/       # zustand stores (workspaceStore, SettingStore, UpdateSetting, etc.)
│           │   ├── hooks/       # keyboard shortcuts, font settings, theme hooks, unsaved state
│           │   ├── ai/          # AI provider adapters, tool registry, token streaming
│           │   ├── notification/# in-app banner, toast & status notifications
│           │   ├── themes/      # theme definitions, 21 color palettes, CSS variable injector
│           │   ├── utils/       # helper utilities, search rankers, graph builders, starters
│           │   └── db/          # client database & local storage models (Dexie / IndexedDB)
│           ├── features/        # domain feature modules
│           │   ├── Editor/      # CodeMirror 6 markdown editor, KaTeX math, callouts, wikilinks, Drive push
│           │   ├── AI/          # Lumina AI copilot, session history, composer, prompt modes, InlineLumina
│           │   ├── Layout/      # AppShell 3-pane layout, curtain resizing, TabBar, StatusBar, TitleBar
│           │   ├── Navigation/  # ActivityBar (notes, canvas, journal, graph, mail), Sidebar file tree
│           │   ├── Explorer/    # virtualized file explorer, drag & drop, favorites, folder colors
│           │   ├── Inspector/   # right sidebar (Note Details, Outline, Backlinks, Chat panels)
│           │   ├── canvas/      # 2D infinite spatial whiteboard (.canvas), shapes, connectors, radar minimap
│           │   ├── export/      # ExportContainer, BatchExportDialog, live previews (PDF, DOCS, HTML, MD, TXT)
│           │   ├── graph/       # modular knowledge graph subsystem
│           │   │   ├── 2d/      # HTML5 canvas renderer (Graph2D), radar HUD (GraphMiniMap), InlineGraph
│           │   │   ├── 3d/      # hardware-accelerated WebGL force-directed space (Graph3D)
│           │   │   ├── utils/   # high-res PNG & vector SVG export (graphExport), layout persistence
│           │   │   ├── css/     # low-profile stylesheets (Graph.css, GraphSidebar.css)
│           │   │   ├── Graph.tsx # main graph container, elastic central node dynamics, modal & tab views
│           │   │   ├── GraphSidebar.tsx # sleek search & graph controls sidebar
│           │   │   ├── PerformancePanel.tsx # real-time FPS & node telemetry HUD with recenter target
│           │   │   └── physics.worker.ts # off-thread d3-force physics simulation worker
│           │   ├── commandpalette/ # global spotlight, fuzzy & semantic search, quick actions
│           │   ├── codeBlock/   # syntax-highlighted code blocks, copy-to-clipboard, image export
│           │   ├── table/       # interactive markdown table editor & column sorting
│           │   ├── mermaid/     # inline mermaid diagram renderer & lightbox
│           │   ├── media/       # media viewer, lightbox, and clipboard image pasting
│           │   ├── profile/     # unified Google user profile, avatar tooltip, and auth actions
│           │   ├── roadmap/     # learning curriculum tracker & progress indicators
│           │   ├── Settings/    # settings dialog & configuration panels (AI Memory, Appearance, etc.)
│           │   ├── Docs/        # in-app documentation & guides
│           │   ├── Breadcrumbs/ # active note path and hierarchy breadcrumb navigation
│           │   ├── voice/       # voice recording, transcription & speech recognition (Groq Whisper)
│           │   ├── preview/     # markdown live preview rendering components
│           │   ├── modals/      # modal dialogs (Guide, About, Prompts, Confirmations, Rename)
│           │   ├── slash/       # slash command registry and interactive palette
│           │   ├── template/    # note templates & creation wizard
│           │   ├── theme/       # 21 custom themes, draggable Theme modal & grid selector
│           │   └── Icons/       # 190+ curated icons & draggable IconPicker modal
│           ├── components/      # shared UI primitives, atoms, error boundaries, and update banner
│           │   └── update/      # update notification banner, release notes dropdown (UpdateDetails)
│           └── assets/          # global styles, base fonts, and layout rules
├── test/
│   ├── main/                    # unit tests — main process, export engines, workspace manager
│   ├── renderer/                # unit tests — react components, hooks, stores, modals (757 tests)
│   └── e2e/                     # end-to-end tests (playwright test suites)
├── brain/                       # system design specifications, memory docs, and roadmap
└── scripts/                     # build, package, native rust bootstrap, and release scripts
```

### scripts

```bash
# development
npm run dev              # dev server with hot reload
npm run build            # build for current platform
npm run lint             # eslint
npm run format           # prettier
npm run workbench        # performance + health dashboard

# unit tests (vitest)
npm test                 # watch mode
npm run test:run         # single run (ci)
npm run test:coverage    # with v8 coverage report
npm run test:watch       # alias for watch mode

# e2e tests (playwright — requires npm run build first)
npm run e2e              # run all 23 e2e tests
npm run e2e:list         # list all e2e tests without running
npm run e2e:debug        # open playwright inspector

# combined
npm run test:all         # unit tests + e2e back to back
```

### tech stack

**native core:**
rust 2021 · napi-rs 2.16 · rayon 1.10 · walkdir 2.5 · regex 1.11 · memchr 2.7

**main process:**
electron 39.2.4 · chokidar 5 · gray-matter 4

**renderer:**
react 19.1.1 · codemirror 6 · zustand 5 · dexie 4 · marked 17 · highlight.js 11 · lucide-react · @xenova/transformers 2 · react-force-graph-2d · three.js · d3-force-3d · flexsearch

**build:**
vite 7 · electron-vite · vitest · tailwindcss 3 · electron-builder 26

---

## testing

lumina has two test layers that run independently:

### unit tests — 757 tests across 90 test suites (100% passing)

covers components, hooks, stores, utils, and main-process modules. uses **vitest** with jsdom.

```bash
npm test                        # watch mode
npm run test:run                # single run (ci)
npm run test:coverage           # with v8 coverage report
```

### e2e tests — 23 tests across 3 files

launches the **real electron app** against a fresh temp vault per test. covers the full user flow — app launch, vault operations, and note crud — against the real filesystem. uses **playwright**.

> ⚠️ requires a build first: `npm run build`

```bash
npm run e2e                     # run all 23 e2e tests
npm run e2e:list                # list tests without running
npm run e2e:debug               # open playwright inspector
```

| suite             | what's tested                                                  |
| ----------------- | -------------------------------------------------------------- |
| app.e2e.test.js   | launches · no js errors · title bar · welcome page             |
| vault.e2e.test.js | writable vault · note persistence · multi-note                 |
| note.e2e.test.js  | create · frontmatter · rename · delete · bulk · timestamp sort |

---

## documentation

the `brain/` directory contains the core project documentation:

| path                    | covers                                                                         |
| ----------------------- | ------------------------------------------------------------------------------ |
| `brain/introduction.md` | entry point, table of contents                                                 |
| `brain/purpose.md`      | comprehensive architecture, state flow, layout system, and developer reference |
| `brain/lumina.md`       | high-level system guide, theme definitions, and UX principles                  |
| `brain/specs/scope.md`  | feature specifications, roadmap deliverables, and phased milestones            |
| `brain/shortcuts.md`    | complete keyboard shortcuts and navigation map                                 |
| `bugs.md`               | master Life & Work Cockpit roadmap and upcoming feature specs                  |

---

## contributing

questions and ideas? start a [discussion](https://github.com/Saboor-Hamedi/lumina/discussions).

1. fork the repo
2. `git checkout -b feature/amazing-feature`
3. make changes
4. `npm test`
5. commit (`git commit -m 'add amazing feature'`)
6. push → open a pr

---

## license

mit — see [license.md](./license.md)

---

## acknowledgments

- [electron](https://www.electronjs.org/)
- [react](https://react.dev/)
- [codemirror](https://codemirror.net/)
- [lucide](https://lucide.dev/)
