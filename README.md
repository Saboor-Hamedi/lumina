https://github.com/user-attachments/assets/401b0c3b-976c-4578-bc70-2fd9216b0747

# Lumina — Local-First Markdown, AI Copilot & Terminal

<!-- ![banner](./banner.png?v=2) -->

<p align="center">
  <a href="https://github.com/Saboor-Hamedi/lumina/releases/latest">
    <img src="https://img.shields.io/badge/version-1.4.0-blue?style=flat-square" alt="version 1.4.0">
  </a>
  <img src="https://img.shields.io/badge/runtime-Tauri%202.0-24C8DB?style=flat-square" alt="Tauri 2.0">
  <img src="https://img.shields.io/badge/tests-1242%20Vitest%20%2B%2016%20Rust-brightgreen?style=flat-square" alt="1242 Vitest and 16 Rust tests passing">
  <img src="https://img.shields.io/badge/rust%20core-Async%20IPC%20%2B%20ConPTY-orange?style=flat-square" alt="Rust core Async IPC + ConPTY">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT license">
</p>

<h3 align="center">
  Local-first Markdown, Infinite Canvas, AI Copilot, and a Real Terminal — in a native Tauri 2.0 + Rust desktop workspace.
</h3>

<p align="center">
  <a href="https://github.com/Saboor-Hamedi/lumina/releases/latest"><strong>Download Latest Release (Windows / macOS / Linux)</strong></a>
  ·
  <a href="#highlights">Features</a>
  ·
  <a href="#essential-shortcuts">Shortcuts</a>
  ·
  <a href="#build-from-source">Build from Source</a>
  ·
  <a href="#migrated-from-electron-to-tauri-20">Why Tauri 2.0</a>
</p>

**Lumina** is built for developers, researchers, and writers who are tired of bouncing between Obsidian, VS Code, a whiteboard app, and an external terminal.

Your notes stay on your disk as **100% plain-text `.md` and `.canvas` files**. Powered by a native **Tauri 2.0 + Rust** backend directly linked with `crates/lumina_core` for parallel vault indexing, instant fuzzy search, and a real **ConPTY/PTY terminal engine**, paired with a **React 19 + CodeMirror 6** editor.

---

## Download & Install (v1.4.0)

Download the installer for your platform from the [Latest GitHub Release](https://github.com/Saboor-Hamedi/lumina/releases/latest):

| Platform | Installer | Notes |
| --- | --- | --- |
| **Windows** | `Lumina_1.4.0_x64-setup.exe` or `Lumina_1.4.0_x64_en-US.msi` | If Windows SmartScreen appears, click **More info → Run anyway**. |
| **macOS (Apple Silicon & Intel)** | `Lumina_1.4.0_universal.dmg` | Drag **Lumina.app** to **Applications**. Because builds are not yet Apple-notarized, run `xattr -cr /Applications/Lumina.app` once in Terminal if Gatekeeper blocks opening. |
| **Linux (Debian / Ubuntu)** | `Lumina_1.4.0_amd64.deb` | Install via `sudo apt install ./Lumina_1.4.0_amd64.deb` |
| **Linux (Portable)** | `Lumina_1.4.0_amd64.AppImage` | Make executable via `chmod +x Lumina_1.4.0_amd64.AppImage` |

---

## Highlights

- **100% Local-First Markdown** — Notes live as standard `.md` files on your filesystem. Zero lock-in, full privacy, and instant disk sync.
- **Native Rust Core (`crates/lumina_core`)** — Multithreaded Rayon disk scanning, sub-millisecond fuzzy search, and knowledge graph construction compiled directly into the Tauri binary.
- **Integrated ConPTY / PTY Terminal (`Ctrl + J`)** — Real native pseudoterminal powered by `portable-pty` in Rust. Run **Git Bash**, **PowerShell**, **CMD**, **Zsh**, `vim`, `ssh`, `python`, and interactive CLIs with full `Tab` completion, `Ctrl+C`, and resizing right inside your workspace.
- **Multi-Pane Split Views** — Drag tabs to split horizontally or vertically (`Ctrl + \` / `Ctrl + Alt + \`) with persistent pane layouts.
- **AI Copilot with Safety Controls** — Works offline with **Ollama** or with cloud providers (DeepSeek, OpenAI, Claude) across 3 focused modes (_Planning & Strategy_, _Execution & Action_, _Research & Analysis_). File edits include inline **Approve / Reject** diff cards and **multi-file Undo**.
- **Spatial Infinite Canvas (`.canvas`)** — Freeform 2D whiteboard with shapes, magnetic ports, and orthogonal routing.
- **2D & 3D Knowledge Graph** — Interactive force-directed 2D Canvas and 3D WebGL graph views with cluster physics and persistent node positions.
- **Global Spotlight (`Ctrl + Space`)** — Instant note search and quick AI chat command palette.
- **Zen Mode (`Ctrl + .`)** — Hides chrome and toolbars while preserving running terminal sessions, with layered `Escape` handling that dismisses open dialogs, menus, or drawers before exiting Zen Mode.
- **Theme-Accurate Exports** — Export notes across **50 curated themes** to website-style self-contained **HTML**, **Markdown**, **Plain Text**, print-ready **PDF** (with auto-generated TOC), **Word (`.doc`)**, or **ZIP** archives.
- **Direct Google Drive Push** — Push a **Single note**, **Bulk folder mirror**, or compressed **ZIP** workspace backup directly to Google Drive.

---

## Essential Shortcuts

| Shortcut           | Action                                                 |
| ------------------ | ------------------------------------------------------ |
| `Ctrl + Space`     | Global Spotlight (Search notes & open command palette) |
| `Ctrl + P`         | Quick note & command search palette                    |
| `Ctrl + N`         | Create new note                                        |
| `Ctrl + J`         | Toggle integrated ConPTY / PTY terminal                |
| `Ctrl + .`         | Toggle Zen Mode                                        |
| `Ctrl + B`         | Toggle Left Sidebar                                    |
| `Ctrl + \`         | Split editor right                                     |
| `Ctrl + Alt + \`   | Split editor down                                      |
| `Ctrl + K`         | Inline AI edit / prompt inside editor                  |
| `F2` / `Ctrl + R`  | Rename active note or folder                           |
| `Ctrl + W`         | Close active tab                                       |
| `Double-click Tab` | Rename note from tab bar                               |

---

## Build from Source

### Prerequisites

- **Node.js 20+** (LTS) and **npm**
- **Rust toolchain** (`rustc` 1.90+ and `cargo`)
- **Tauri 2.0 OS prerequisites**:
  - **Windows**: Microsoft Edge WebView2 + Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: WebKitGTK (`libwebkit2gtk-4.1-dev`) and standard build essentials

```bash
# 1. Clone the repository
git clone https://github.com/Saboor-Hamedi/lumina.git
cd lumina

# 2. Install frontend dependencies
npm install

# 3. Start full Tauri 2.0 desktop development mode (Vite HMR + Rust backend)
npm run dev

# Or run only the Vite frontend renderer during UI work
npm run dev:renderer
```

### Packaging Installers

```bash
npm run build:win    # Windows (.exe / MSI installer)
npm run build:mac    # macOS (Universal .dmg)
npm run build:linux  # Linux (AppImage / .deb)
```

---

## Migrated from Electron to Tauri 2.0

Lumina moved off Electron + N-API onto **Tauri 2.0** to keep the app lean, native, and responsive:

- **OS Native WebView** — Renders via WebView2 on Windows and WebKit on macOS/Linux instead of bundling Chromium and Node.js.
- **Direct Rust Linking** — `crates/lumina_core` compiles straight into `src-tauri` with zero Node.js runtime or N-API bridge overhead.
- **Non-Blocking Async & Raw Binary IPC** — Tauri commands offload disk scans, fuzzy search, exports, and ConPTY I/O via `spawn_blocking`, while images, PDFs, and ZIP archives stream as raw binary `tauri::ipc::Response` buffers instead of JSON byte arrays.
- **Lean Boot & Paper-and-Ink UI** — Uses a curated Lucide icon registry, curated `highlight.js/lib/core` languages, lazy-loaded non-boot surfaces (~629 kB / 188 kB gzip boot JS), and zero-blur **"Precision Paper & Ink"** tokens + 6 DRY UI primitives (`src/renderer/src/ui/`).

---

## Architecture

```text
lumina/
├── crates/lumina_core/        # Native Rust core (Rayon scanner, fuzzy search, graph builder)
├── src-tauri/                 # Tauri 2.0 Rust backend
│   ├── tauri.conf.json        # Window, bundle, and CSP configuration
│   └── src/
│       ├── commands.rs        # Async Tauri IPC commands, ConPTY engine, Google OAuth
│       ├── export.rs          # Async export, Markdown bundle, and ZIP builders
│       └── lib.rs             # App setup & command registration
└── src/renderer/src/          # React 19 UI
    ├── assets/tokens.css      # Paper & Ink design tokens and motion/elevation variables
    ├── ui/                    # 6 DRY UI primitives (Button, Popover/Menu, Dialog, Field/SearchInput, Tooltip, PulseLoader)
    ├── core/                  # Tauri IPC bridge, Zustand stores, CodeMirror 6 extensions, shortcuts
    └── features/              # Feature modules (Editor, AI + Safety, Terminal, Canvas, Graph, Explorer, Layout)
```

---

## Testing

Lumina includes TypeScript checks, Vitest unit/integration tests, and Rust core tests:

```bash
npm run test:all    # Run typecheck, Rust core tests, and Vitest suite
npm run typecheck   # TypeScript verification
npm run test:run    # Vitest unit & integration suite
npm run test:rust   # Cargo core unit tests
```

---

## Documentation

Design specs and architecture notes live in [`brain/`](./brain/):

- [`brain/purpose.md`](./brain/purpose.md) — Architectural overview, state flow, and layout system.
- [`brain/lumina.md`](./brain/lumina.md) — System guide, theme engine, and UX principles.
- [`brain/shortcuts.md`](./brain/shortcuts.md) — Complete keyboard shortcuts map.
- [`brain/specs/scope.md`](./brain/specs/scope.md) — Technical specifications and deliverables.

---

## Contributing & License

Contributions, bug reports, and feature ideas are welcome! Open an [issue](https://github.com/Saboor-Hamedi/lumina/issues) or submit a pull request.

Released under the [MIT License](./LICENSE.md).
