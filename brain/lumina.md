# Lumina — A Premium, AI-Powered Thinking Environment

**Lumina** is a local-first, privacy-respecting knowledge workspace built for developers, researchers, writers, and deep thinkers. It combines the simplicity of plain Markdown files with the power of an intelligent AI assistant, visual knowledge graphs, and live-rendered documents.

---

## 1. Core Philosophy

- **Local-First & Future-Proof:** Your notes remain yours forever. Everything is stored as plain Markdown (`.md`) files on your computer—no proprietary database, no cloud lock-in, and full offline capability.
- **Fluid & Distraction-Free:** Designed with zero clutter, keyboard-driven navigation, and instantaneous response times.
- **Privacy by Default:** Your workspace lives locally on your disk. You control your API keys and your data.

---

## 2. Key Architecture & Features

### A. Intelligent Markdown Editor
- **Live Preview Widgets:** Powered by CodeMirror 6 with seamless inline rendering for:
  - **Mermaid Diagrams:** Flowcharts, sequence diagrams, mindmaps, state diagrams, and ERDs rendered live.
  - **Interactive Tables:** Keyboard-accessible tabular editing, column formatting, and drag-and-drop cell workflows.
  - **Obsidian-Style Callouts:** Highlighted admonitions (`[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`).
  - **KaTeX Mathematical Notation:** Inline and block LaTeX math rendering.
  - **Syntax-Highlighted Code Blocks:** Integrated syntax highlighting across dozens of programming languages.
  - **Interactive Checklists:** Clickable task lists (`- [x]`) that persist directly to Markdown.

### B. Visual Knowledge Graph
- Explore connections between your thoughts in real time using interactive 2D and 3D physics-driven force graphs.
- Powered by bidirectional wikilinks (`[[Note Name]]`).
- Filter nodes by tags, search queries, or connection clusters to discover hidden relationships across your vault.

### C. Context-Aware AI Assistant & Persistent Memory
- **Lumina AI Chat (`Ctrl + Shift + \`):** A dedicated sidebar AI partner capable of analyzing your active notes, summarizing folder contents, and answering questions grounded in your workspace.
- **Persistent AI Memory (`memory.json`):** Remembers your name, role, bio, personal preferences, and learned facts & knowledge across chats with natural name addressing and dedicated Settings management.
- **Multi-Disciplinary Plan Intelligence:** Mode-aware planning that recommends Research Mode for academic and thesis writing, Creative Mode for storytelling, and Code Mode for software implementation.
- **Deep Workspace Synthesis:** Connect ideas across multiple notes, generate outlines, draft sections, and find missing links in your research.
- **Flexible Models:** Plug in your own preferred AI model providers (DeepSeek, OpenAI, Anthropic, Ollama) seamlessly.

### D. Keyboard-Driven Navigation
- **Spotlight Search (`Ctrl + P` / `Ctrl + Space`):** Jump between notes instantly or search your entire workspace with fuzzy matching.
- **Global Shortcuts:** Fast hotkeys for formatting, toggling sidebars, navigating tabs, and opening previews. See [[shortcuts]] for the complete cheat sheet.

### E. Theme & Accent Customization
- Built-in theme collection designed for focus during day or night.
- Live accent color picker allowing instant interface personalization across buttons, highlights, graphs, and the welcome dashboard.
- Configurable cursor styles, font families, and preview typography.

### F. Google Drive Git-Like Mirroring & Note Push
- **Uncompressed Hierarchy Mirror:** Mirror your complete local vault hierarchy into a clean `lumina/` root folder on Google Drive as individual Markdown and asset files.
- **Dedicated Push Button:** Push individual notes with automatic parent directory creation on Drive directly from the editor metadata toolbar.
- **Dual Backup Modes:** Switch effortlessly between compressed (.zip) snapshot archives and live uncompressed git-like folder mirroring.
- **In-Place Title Synchronization:** Renaming note titles updates both the local disk file and the remote Google Drive file without creating orphan drafts.

### G. Native PDF & Voice Dictation
- **Chromium Native PDF Engine:** High-performance PDF reader tabs with zero external protocol dialogs, instant zero-copy in-memory caching, zoom, and text search.
- **Offline Whisper Dictation:** Real-time speech-to-text with animated soundwave capsule feedback for hands-free thought capture.

---

## 3. Getting Started

1. **Create your first note:** Press `Ctrl + N` or click **+ New** in the sidebar.
2. **Connect notes together:** Type `[[` anywhere in the editor to search and link to other notes.
3. **Switch notes quickly:** Hit `Ctrl + P` to bring up the Quick Switcher.
4. **Inspect connections:** Press `Ctrl + G` to view your notes visualised on the Knowledge Graph.
5. **Ask the AI:** Press `Ctrl + Shift + \` to open Lumina AI and start querying your notes.

---

## 4. Explore More

- [[Introduction]] — Complete overview of Lumina and its core capabilities
- [[shortcuts]] — Full reference of keyboard shortcuts and navigation hotkeys
- [[purpose]] — Vision, engineering design standards, and system architecture
- [[scope]] — Roadmap, feature scope, and development boundaries
- [Learning Markdown](references/01-basic-syntax.md) — Comprehensive Markdown styling guides and cheat sheets
