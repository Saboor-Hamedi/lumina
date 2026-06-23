# Lumina — Vault-Based Knowledge Management

**Lumina** is a premium, vault-based knowledge management desktop application built with **Electron 39**, **React 19**, **CodeMirror 6**, and **Zustand 5**. All notes are stored as plain Markdown files with YAML frontmatter, giving you full ownership of your data.

The app features a multi-tab workspace, knowledge graph visualization, AI-powered semantic search (local + cloud), advanced theming (18 themes), and a rich CodeMirror 6 editor with wikilinks, mermaid diagrams, callouts, and live preview.

---

## Table of Contents

### Core Architecture & Concepts

| # | File | Covers |
|---|------|--------|
| 01 | [Architecture](features/01-architecture.md) | Full system architecture: main process, preload bridge, renderer, data flow, vault management, settings, CodeMirror 6 integration, theme system, virtualized rendering, IPC, keyboard shortcuts, export (PDF/HTML/MD), protocol handler, performance, development standards. |
| 02 | [AI System](features/02-ai.md) | AI system: store, providers (DeepSeek/OpenAI/Anthropic/Ollama), web worker, chat UI, composer, image gen, settings. |
| 03 | [Testing](features/03-testing.md) | Complete testing guide: commands, test structure, coverage (93 tests), writing tests, mock patterns, bundle analysis, CI/CD, performance workbench, troubleshooting. |
| 04 | [Roadmap](features/04-roadmap.md) | Project roadmap: completed features, immediate next steps, multi-model AI engine, test coverage goals, performance, security, distribution. |
| 05 | [Dev Notes](features/05-devnotes.md) | Active development notes about AI chat panel merge, modal improvements, and known issues. |

### Vault System

| # | File | Covers |
|---|------|--------|
| 01 | [Overview](vault/01-overview.md) | Vault architecture diagram, process split, IPC channel table, key design decisions. |
| 02 | [Manager](vault/02-manager.md) | `VaultManager.js` deep-dive: file I/O, chokidar watcher, auto-healing, collision handling, edge cases. |
| 03 | [Indexer](vault/03-indexer.md) | `VaultIndexer.js` deep-dive: chunking algorithm, ONNX embeddings, incremental indexing, concurrency. |
| 04 | [Search](vault/04-search.md) | `VaultSearch.js` deep-dive: cosine similarity, re-ranking, query caching, lazy ONNX loader. |
| 05 | [Store](vault/05-store.md) | `useVaultStore.js` deep-dive: Zustand state, tab management, dirty tracking, wikilink auto-update. |
| 06 | [Data Flow](vault/06-data-flow.md) | End-to-end walkthroughs: save cycle, delete cycle, app startup, chokidar sync, indexing, image pipeline. |

---

## Quick Reference

**Tech Stack:** Electron 39 / React 19 / CodeMirror 6 / Zustand 5 / Vite 7 / Tailwind 3

**Key Paths:**
- Main process: `src/main/`
- Preload bridge: `src/preload/`
- Renderer: `src/renderer/src/`
- Stores: `src/renderer/src/core/store/` (useVaultStore, useSettingsStore, useAIStore)
- Features: `src/renderer/src/features/` (Layout, Editor, Explorer, Navigation, Graph, AI, Settings, Theme, Overlays, Inspector, Icons, Workspace)
- Editor extensions: `src/renderer/src/features/Workspace/` (mermaid, wikilinks, callouts, tables, images, HTML widgets)
- AI providers: `src/renderer/src/features/AI/providers/` (DeepSeek, OpenAI, Anthropic, Ollama)

**Run Commands:**
- `npm run dev` — Dev server with HMR
- `npm run build:win` — Package for Windows
- `npm test` — Run tests (watch mode)
- `npm run test:run` — Run tests once
