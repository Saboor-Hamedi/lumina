# Lumina — Vault-Based Knowledge Management

**Lumina** is a premium, vault-based knowledge management desktop application built with **Electron 39**, **React 19**, **CodeMirror 6**, and **Zustand 5**. All notes are stored as plain Markdown files with YAML frontmatter, giving you full ownership of your data.

The app features a multi-tab workspace with drag-reorderable pinned tabs, a knowledge graph (6 themes + minimap), AI semantic search (local ONNX embeddings + cloud), a multi-model AI chat panel (DeepSeek, OpenAI, Anthropic, Ollama) with slash commands and image generation, inline AI assistant (Ctrl+K), 18 themes with glassmorphism mirror mode, daily notes, multi-vault support, export (PDF/HTML/MD), and a rich CodeMirror 6 editor with wikilinks, mermaid diagrams, callouts, live preview, image paste, and 16+ editor extensions.

---

## Table of Contents

### Core Architecture & Concepts

| # | File | Covers |
|---|------|--------|
| 01 | [Architecture](features/Architecture.md) | Full system architecture: main process, preload bridge, renderer, data flow, vault management, settings, AtomicEditor / CodeMirror 6 integration, theme system, virtualized rendering, IPC, keyboard shortcuts, export (PDF/HTML/MD), protocol handler, performance, development standards. |
| 02 | [AI System](features/AI.md) | AI system: store, providers (DeepSeek/OpenAI/Anthropic/Ollama), web worker, chat UI, composer, image gen, settings. |
| 03 | [Testing](features/Testing.md) | Complete testing guide: commands, test structure, coverage (93 tests), writing tests, mock patterns, bundle analysis, CI/CD, performance workbench, troubleshooting. |
| 04 | [Roadmap](features/Roadmap.md) | Project roadmap: completed features, immediate next steps, multi-model AI engine, test coverage goals, performance, security, distribution. |
| 05 | [Dev Notes](features/DevNotes.md) | Active development notes about AI chat panel merge, modal improvements, and known issues. |
| 06 | [Color Modal](features/colormodal.md) | General-purpose color picker: curated palette, hex input, live CSS variable preview, draggable modal, integration with Settings. |

### Vault System

| # | File | Covers |
|---|------|--------|
| 01 | [Overview](vault/Overview.md) | Vault architecture diagram, process split, IPC channel table, key design decisions. |
| 02 | [Manager](vault/Manager.md) | `VaultManager.js` deep-dive: file I/O, chokidar watcher, auto-healing, collision handling, edge cases. |
| 03 | [Indexer](vault/Indexer.md) | `VaultIndexer.js` deep-dive: chunking algorithm, ONNX embeddings, incremental indexing, concurrency. |
| 04 | [Search](vault/Search.md) | `VaultSearch.js` deep-dive: cosine similarity, re-ranking, query caching, lazy ONNX loader. |
| 05 | [Store](vault/Store.md) | `useVaultStore.js` deep-dive: Zustand state, tab management, dirty tracking, wikilink auto-update. |
| 06 | [Data Flow](vault/DataFlow.md) | End-to-end walkthroughs: save cycle, delete cycle, app startup, chokidar sync, indexing, image pipeline. |

---

## Quick Reference

**Tech Stack:** Electron 39 / React 19 / CodeMirror 6 / Zustand 5 / Dexie 4 / Vite 7 / Tailwind 3 / marked 17 / highlight.js 11 / lucide-react / react-force-graph-2d / flexsearch / @xenova/transformers

**Key Paths:**
- Main process: `src/main/`
- Preload bridge: `src/preload/`
- Renderer: `src/renderer/src/`
- Stores: `src/renderer/src/core/store/` (useVaultStore, useSettingsStore, useAIStore, useUpdateStore)
- Features: `src/renderer/src/features/` (Layout, Editor, Explorer, Navigation, Graph, AI, Settings, Theme, Overlays, Inspector, Icons, Shared, Workspace)
- Editor extensions: `src/renderer/src/features/Workspace/` (mermaid, wikilinks, callouts, tables, images, HTML widgets, code block headers, tag mentions, tree progress)
- AI providers: `src/renderer/src/features/AI/providers/` (DeepSeek, OpenAI, Anthropic, Ollama) — 5 chat modes, 6 slash commands
- Overlays: `src/renderer/src/features/Overlays/` (CommandPalette, InlineAIModal, PreviewModal, ContextMenu, PromptModal, RenameModal, ConfirmModal, OverwriteModal, ColorModal, UpdateToast)
- Inspector: `src/renderer/src/features/Inspector/` (TabbedSidebar with Details + Outline tabs)
- Graph: `src/renderer/src/features/Graph/` (Graph, GraphSidebar, GraphMiniMap, GraphThemeSelector)

**Run Commands:**
- `npm run dev` — Dev server with HMR
- `npm run build` — Build for current platform
- `npm run build:win` — Package for Windows
- `npm run format` — Format all files with Prettier
- `npm run lint` — Lint all files with ESLint
- `npm test` — Run tests (watch mode)
- `npm run test:run` — Run tests once
- `npm run test:coverage` — Run tests with coverage report
