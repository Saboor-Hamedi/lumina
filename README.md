https://github.com/user-attachments/assets/f641f391-95f5-4b3f-9209-ffa6124f30cd

# Lumina

<!-- ![banner](./banner.png?v=2) -->

<p align="center">
  <a href="https://github.com/Saboor-Hamedi/lumina/releases/latest">
    <img src="https://img.shields.io/badge/version-1.1.0-blue?style=flat-square" alt="version 1.1.0">
  </a>
  <img src="https://img.shields.io/badge/unit%20tests-1429%20passing-brightgreen?style=flat-square" alt="1429 unit tests passing">
  <img src="https://img.shields.io/badge/e2e%20tests-playwright%20verified-blue?style=flat-square" alt="e2e tests">
  <img src="https://img.shields.io/badge/rust%20core-N--API%20%2B%20ConPTY-orange?style=flat-square" alt="Rust core">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT license">
</p>

<h3 align="center">
  Local-first Markdown, Infinite Canvas, AI Copilot, and a Real Terminal — in one fast desktop workspace.
</h3>

<p align="center">
  <a href="https://github.com/Saboor-Hamedi/lumina/releases/latest"><strong>Download Latest Release (Windows / macOS / Linux)</strong></a>
  ·
  <a href="#highlights">Features</a>
  ·
  <a href="#essential-shortcuts">Shortcuts</a>
  ·
  <a href="#build-from-source">Build from Source</a>
</p>

---

**Lumina** is built for developers, researchers, and writers who are tired of bouncing between Obsidian, VS Code, a whiteboard app, and an external terminal.

Your notes stay on your disk as **100% plain-text `.md` and `.canvas` files**. A compiled **Rust native core** (`crates/lumina_core`) handles parallel vault indexing, instant fuzzy search, and a real **ConPTY/PTY terminal engine**, paired with a **React 19 + CodeMirror 6** editor.

---

## Highlights

- **100% Local-First Markdown** — Notes live as standard `.md` files on your filesystem. Zero lock-in, full privacy, and instant disk sync.
- **Native Rust Core (`crates/lumina_core`)** — Multithreaded Rayon disk scanning, sub-millisecond fuzzy search, and graph construction via N-API bindings.
- **Integrated ConPTY / PTY Terminal (`Ctrl + J`)** — Real native pseudoterminal powered by `portable-pty` in Rust. Run **Git Bash**, **PowerShell**, **CMD**, **Zsh**, `vim`, `ssh`, `python`, and interactive CLIs with full `Tab` completion, `Ctrl+C`, and resizing right inside your workspace.
- **Multi-Pane Split Views** — Drag tabs to split horizontally or vertically (`Ctrl + \` / `Ctrl + Alt + \`) with persistent pane layouts.
- **AI Copilot with Safety Controls** — Works offline with **Ollama** or with cloud providers (DeepSeek, OpenAI, Claude) across 3 focused modes (_Planning & Strategy_, _Execution & Action_, _Research & Analysis_). File edits include inline **Approve / Reject** diff cards and **multi-file Undo**.
- **Spatial Infinite Canvas (`.canvas`)** — Freeform 2D whiteboard with shapes, magnetic ports, and orthogonal routing.
- **2D & 3D Knowledge Graph** — Interactive force-directed 2D Canvas and 3D WebGL graph views with cluster physics and persistent node positions.
- **Global Spotlight (`Ctrl + Space`)** — Instant note search and quick AI chat from anywhere on your OS.
- **Zen Mode (`Ctrl + .`)** — Smoothly hides chrome and toolbars (preserving running terminal sessions) while letting you pull up any pane whenever you need it.
- **Theme-Accurate Exports** — Export to print-ready **PDF** (with auto-generated TOC), **Word (`.doc`)**, or self-contained **HTML** across **64+ curated themes**.
- **Google Drive Sync** — Optional on-demand or scheduled workspace backup to Google Drive.

---

## Essential Shortcuts

| Shortcut           | Action                                                 |
| ------------------ | ------------------------------------------------------ |
| `Ctrl + Space`     | Global Spotlight (Search notes & ask AI from anywhere) |
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
- **Rust toolchain** (`cargo` / `rustc`, optional unless rebuilding `crates/lumina_core`)

```bash
# 1. Clone the repository
git clone https://github.com/Saboor-Hamedi/lumina.git
cd lumina

# 2. Install dependencies
npm install

# 3. Start development mode
npm run dev
```

### Packaging Installers

```bash
npm run build:win    # Windows (.exe installer & portable)
npm run build:mac    # macOS (.dmg)
npm run build:linux  # Linux (AppImage / .deb)
```

---

## Architecture

```text
lumina/
├── crates/lumina_core/      # Native Rust core (Rayon scanner, fuzzy search, graph builder)
├── src-tauri/               # Tauri 2.0 Rust backend (IPC commands, portable-pty ConPTY engine, Google OAuth)
└── src/renderer/            # React 19 UI
    ├── core/                # Zustand stores, CodeMirror 6 extensions, keyboard & terminal hooks
    └── features/            # Feature modules (Editor, AI + Safety, Terminal, Canvas, Graph, Explorer, Layout)
```

---

## Testing

Lumina includes unit, integration, and Rust core tests:

```bash
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

Released under the [MIT License](./license.md).
