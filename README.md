# lumina

![banner](./banner.png?v=2)

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.69-blue" alt="version">
  <img src="https://img.shields.io/badge/unit%20tests-1181%20tests-success" alt="unit tests">
  <img src="https://img.shields.io/badge/e2e%20tests-78%20tests-blue" alt="e2e tests">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
</p>

lumina is a premium, AI-powered thinking environment and personal intelligence cockpit. Features a multi-tab workspace, infinite spatial 2D canvas, modular interactive knowledge graph, theme-synchronized PDF & multi-format export, AI semantic search (local + cloud), 64 ergonomic themes, persistent AI Memory profiles, Google Drive sync mirroring, draggable modals, and a beautiful editor with wikilinks, mermaid diagrams, KaTeX math formulas, code blocks with image export, callouts, and progressive disclosure formatting.

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
- **gmail integration** — read, search, label, and compose email from a unified inbox.
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
- **voice dictation** — speech-to-text capture and transcription via Groq Whisper.
- **local embeddings** — `all-minilm-l6-v2` via @xenova/transformers in a web worker.

### ui & ergonomics

- **64 curated themes** — dark, light, high-contrast, and retro amber palettes with calibrated contrast for long sessions.
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

- node.js 20+ (lts)
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
│   └── lumina_core/             # N-API native bindings (Rayon parallel walker & scanner)
├── resources/                   # application icons (.png, .ico) and desktop packaging assets
├── src/
│   ├── main/                    # electron main process
│   │   ├── index.js             # main entry point, IPC registry, window lifecycle
│   │   ├── AppUpdater.js        # background auto-update engine
│   │   ├── indexer-worker.js    # semantic vector indexing worker
│   │   ├── app/                 # window, protocol, lifecycle & crash management
│   │   ├── settings/            # settings & app_config persistence (.lumina/settings.json)
│   │   ├── workspace/           # workspace operations, file watcher, scanner, indexer, search, media
│   │   ├── auth/                # Google OAuth authentication & token exchange
│   │   ├── backup/              # Google Drive cloud backup & recovery engine
│   │   ├── email/               # Gmail API integration
│   │   ├── lumina/              # native LLM streaming bridge (Ollama)
│   │   ├── shortcuts/           # global shortcut registration
│   │   └── handlers/            # IPC handlers: windows, tray, launcher, export, system
│   ├── export/                  # note & vault export subsystem (PDF, DOCX, Markdown, HTML)
│   │   ├── exportPDF.ts         # print-optimized A4 PDF generator with theme styles & auto-TOC
│   │   ├── exportHTML.ts        # self-contained themed HTML export
│   │   ├── exportBundle.ts      # clean self-contained HTML and Markdown asset bundles
│   │   ├── exportDocs.ts        # Word-compatible (.doc) formatted documents
│   │   ├── exportMarkdown.ts    # plain Markdown exporter
│   │   ├── exportText.ts        # plain text stripper
│   │   ├── exportBatch.ts       # recursive folder & multi-note batch export
│   │   ├── exportCombined.ts    # multi-document single-volume synthesis
│   │   ├── exportUtils.ts       # TOC generator, base64 image & asset:// packager
│   │   ├── imageOptimizer.ts    # embedded image downscaling & compression
│   │   ├── zipExporter.ts       # zip packaging for batch exports
│   │   ├── mermaidRuntime.ts    # offline Mermaid diagram script injector
│   │   ├── renderWindow.ts      # offscreen headless browser window for SVG diagram rasterization
│   │   └── preview/             # sandboxed live IPC preview generators & theme token synchronizer
│   ├── preload/                 # secure context bridge (IPC exposed APIs)
│   │   └── index.js
│   └── renderer/                # react 19 frontend application
│       └── src/
│           ├── core/            # core state, hooks, and client infrastructure
│           │   ├── store/       # zustand stores (workspaceStore, SettingStore, etc.)
│           │   ├── hooks/       # keyboard shortcuts, font settings, cursor & unsaved state
│           │   ├── ai/          # AI provider adapters, tool registry, token streaming
│           │   ├── editor/      # CodeMirror 6 extension assembly
│           │   ├── code/        # syntax highlighting & code-block rendering
│           │   ├── mermaid/     # mermaid diagram extension & lightbox
│           │   ├── notification/# in-app banner, toast & status notifications
│           │   ├── shortcuts/   # keyboard shortcut registry
│           │   ├── i18n/        # text normalization, bidi & IME helpers
│           │   ├── utils/       # helper utilities, search rankers, graph builders, starters
│           │   └── db/          # client database models (Dexie / IndexedDB)
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
│           │   ├── table/       # interactive markdown table editor & column sorting
│           │   ├── media/       # media viewer, lightbox, and clipboard image pasting
│           │   ├── email/       # Gmail inbox, threads, and composition UI
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
│           │   ├── theme/       # 64 custom themes, draggable Theme modal & grid selector
│           │   └── Icons/       # 190+ curated icons & draggable IconPicker modal
│           ├── components/      # shared UI primitives, atoms, error boundaries, and update banner
│           │   └── update/      # update notification banner, release notes dropdown (UpdateDetails)
│           └── assets/          # global styles, base fonts, and layout rules
├── test/
│   ├── main/                    # unit tests — main process, export engines, workspace manager
│   ├── renderer/                # unit tests — react components, hooks, stores, modals
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
npm run e2e              # run all 78 e2e tests
npm run e2e:list         # list all e2e tests without running
npm run e2e:debug        # open playwright inspector

# combined
npm run test:all         # unit tests + e2e back to back
```

### tech stack

**native core:**
rust 2021 · napi-rs 2.16 · rayon 1.10 · walkdir 2.5 · serde 1.0

**main process:**
electron 39.8 · chokidar 5 · gray-matter 4

**renderer:**
react 19.1.1 · codemirror 6 · zustand 5 · dexie 4 · marked 17 · highlight.js 11 · lucide-react · @xenova/transformers 2 · react-force-graph-2d · three.js · d3-force-3d · flexsearch

**build:**
vite 7 · electron-vite · vitest · tailwindcss 3 · electron-builder 26

---

## testing

lumina has two test layers that run independently:

### unit tests — 1181 tests across 143 test files

covers components, hooks, stores, utils, and main-process modules. uses **vitest** with jsdom.

```bash
npm test                        # watch mode
npm run test:run                # single run (ci)
npm run test:coverage           # with v8 coverage report
```

### e2e tests — 78 tests across 17 files

launches the **real electron app** against a fresh temp vault per test. covers the full user flow — app launch, workspace operations, note crud, search, editor, tabs, export, and settings — against the real filesystem. uses **playwright**.

> ⚠️ requires a build first: `npm run build`

```bash
npm run e2e                     # run all 78 e2e tests
npm run e2e:list                # list tests without running
npm run e2e:debug               # open playwright inspector
```

| suite                          | what's tested                                          |
| ------------------------------ | ------------------------------------------------------ |
| app.e2e.test.js                | launches · no js errors · title bar · welcome page     |
| workspace.e2e.test.js          | writable vault · note persistence · multi-note         |
| note.e2e.test.js               | create · frontmatter · rename · delete · bulk          |
| noteTitleRename.e2e.test.js    | rename propagation to title & wikilinks                |
| editor.e2e.test.js             | editing · formatting · autosave                        |
| search.e2e.test.js             | quick search & spotlight results                       |
| commandpalette-and-sidebar.e2e.test.js | command palette & sidebar navigation           |
| tabs.e2e.test.js               | open · switch · pin · close tabs                       |
| explorer.e2e.test.js           | file tree · create · folder operations                 |
| dailynotes.e2e.test.js         | journal creation & dated notes                         |
| dragdrop.e2e.test.js           | note drag & drop reordering                            |
| export.e2e.test.js             | PDF / HTML / Markdown export                           |
| settings.e2e.test.js           | settings persistence                                   |
| settings-modal.e2e.test.js     | settings dialog controls                               |
| voice.e2e.test.js              | voice dictation controls                               |
| update.e2e.test.js             | update banner & channel controls                       |
| documentation-and-template.e2e.test.js | in-app docs & note templates                   |

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
| `bugs.md`               | runtime error log and debugging notes                                          |

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
