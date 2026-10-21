# Lumina

![banner](./banner.png?v=2)

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.75-blue" alt="version">
  <img src="https://img.shields.io/badge/unit%20tests-1330%2B%20passing-success" alt="unit tests">
  <img src="https://img.shields.io/badge/e2e%20tests-playwright%20verified-blue" alt="e2e tests">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
</p>

**Lumina** is a fast, local-first markdown thinking environment and personal intelligence cockpit. Built with **Rust**, **React 19**, and **Electron**, Lumina unites plain-text note taking, infinite spatial whiteboarding, and multi-model AI into a private workspace.

---

## Highlights

- 📁 **100% Local-First** — Your notes live on your disk as standard markdown files. Zero lock-in, full privacy.
- ⚡ **Native Rust Core** — Ultra-fast parallel disk traversal and indexing powered by Rayon and N-API bindings (`crates/lumina_core`).
- 🧭 **Global Spotlight (`Ctrl+Space`)** — Instant search and quick AI chat accessible from anywhere on your OS, even when Lumina is hidden.
- 🎨 **Spatial Infinite Canvas (`.canvas`)** — Freeform 2D whiteboard with geometric shapes, magnetic ports, and orthogonal connection routing.
- 🕸️ **Interactive Knowledge Graph** — Force-directed 2D Canvas & 3D WebGL graph views with cluster physics, high-res export, and persistent positions.
- 🤖 **Hybrid AI Copilot** — Connects to local models via Ollama or cloud providers (DeepSeek, OpenAI, Claude). Features persistent user memory profiles and real-time workspace context.
- 📄 **Theme-Accurate Document Export** — Print-ready PDFs with auto-generated Tables of Contents, Word (.doc), and self-contained HTML bundles with pixel-perfect theme synchronization.
- 🎨 **64 Ergonomic Themes** — Curated dark, light, and high-contrast palettes with glassmorphism support.
- ☁️ **Google Drive Backup** — Mirror workspace files to Google Drive on-demand or on schedule with ancestor tree auto-creation.

---

## Quick Start

### Prerequisites
- Node.js 20+ (LTS)
- npm
- Rust toolchain (optional, for compiling `crates/lumina_core`)

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/Saboor-Hamedi/lumina.git
cd lumina

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Packaging

```bash
npm run build:win    # Windows installer & portable
npm run build:mac    # macOS (.dmg)
npm run build:linux  # Linux (AppImage / .deb)
```

---

## Essential Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + Space` | Global Spotlight (Search notes & ask AI from anywhere) |
| `Ctrl + N` | Create new note |
| `F2` / `Ctrl + R` | Quick rename active note or folder |
| `Ctrl + K` | Inline AI prompt within editor |
| `Ctrl + \` | Toggle Live Preview mode |
| `Ctrl + P` | Fast note search palette |
| `Ctrl + W` | Close active tab |
| `Double-click Tab` | Rename note from tab bar |

---

## Architecture

Lumina is organized into three clean layers:

```text
lumina/
├── crates/lumina_core/      # Native Rust core (parallel disk scanner & regex indexer)
├── src/main/                # Electron main process (IPC, window lifecycle, cloud backup)
├── src/export/              # Export engines (PDF, DOC, HTML, Markdown, image optimization)
└── src/renderer/            # React 19 UI
    ├── core/                # Zustand stores, CodeMirror 6 extensions, keyboard hooks
    └── features/            # Feature modules (Editor, AI, Canvas, Graph, Explorer, Layout)
```

---

## Quality & Testing

Lumina maintains an extensive automated test suite covering every core subsystem:

```bash
# Run unit & integration tests (Vitest)
npm test

# Run tests with code coverage
npm run test:coverage

# Run end-to-end desktop tests (Playwright)
npm run build && npm run e2e
```

- **1,180+ Unit Tests** — Testing CodeMirror extensions, workspace operations, export engines, and UI state.
- **78 E2E Tests** — Automated Playwright tests launching the live packaged Electron app against real filesystem vaults.

---

## Documentation

Comprehensive design guides and API specs are available in the [`brain/`](./brain/) directory:

- [`brain/purpose.md`](./brain/purpose.md) — Architectural overview, state flow, and layout system.
- [`brain/lumina.md`](./brain/lumina.md) — System guide, theme engine, and UX principles.
- [`brain/shortcuts.md`](./brain/shortcuts.md) — Complete keyboard shortcuts map.
- [`brain/specs/scope.md`](./brain/specs/scope.md) — Technical specifications and feature deliverables.

---

## Contributing & License

Contributions, bug reports, and suggestions are welcome! Feel free to open an issue or pull request.

Released under the [MIT License](./license.md).
