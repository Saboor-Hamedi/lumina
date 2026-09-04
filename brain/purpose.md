# Lumina — Comprehensive Project Architecture, Purpose & Developer Reference

> **Developer & Agent Notice**: This document is the single source of truth for understanding Lumina's design philosophy, codebase architecture, state flow, AI tool execution pipelines, and critical development invariants. Read this to quickly onboard into any aspect of the codebase.

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

## 3. Deep Dive: Lumina Chat Architecture & Ecosystem

Lumina's AI Chat system is an autonomous copilot and thinking partner tightly coupled with the user's workspace files and knowledge graph.

### A. Dual Display Interfaces
Lumina Chat operates seamlessly across two ergonomic interfaces:
1. **Docked Right Sidebar (`aiChatDisplayMode: 'sidebar'`)**:
   - Integrated into [`AppShell.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Layout/AppShell.jsx), allowing side-by-side editing and AI collaboration.
   - Resizable with persistent width memory.
2. **Floating Draggable Modal (`aiChatDisplayMode: 'modal'`)**:
   - Draggable, resizable, and maximizable window overlaying the workspace.
   - Preserves position, dimensions, and session state across app interactions.

### B. The Unified Composer & Slash Command Architecture
Located in [`Composer.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/Composer.jsx):
- **Auto-expanding Textarea**: Responsive multi-line height adjustments up to 160px with automatic scroll handling.
- **`+` Action Trigger & Slash Commands (`/`)**: Opens [`LuminaSlash.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/LuminaSlash.jsx) to switch between **Plan**, **Code**, **Deep**, and **Creative** modes without clearing user-typed text.
- **Context Mentions (`@`)**: Opens [`LuminaMention.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/LuminaMention.jsx) to attach specific notes as prioritized context. Attached mentions render as removable badges above the input.
- **Subtle Model Indicator**: Compact pill displaying the active brain (`DeepSeek`, `GPT-4o`, `Claude`, `Ollama`) with one-click settings access.

### C. Context Engine & Prompt Assembly (`LuminaChat.js`)
When a message is sent, [`LuminaChat.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/tools/LuminaChat.js) synthesizes context in a multi-tier hierarchy:
1. **Explicit `@-Mentions`**: User-selected notes (with full or draft content) injected as highest-priority target notes.
2. **Active Open Note**: The file currently active in the markdown editor.
3. **Open Tabs Context**: Content snippets from all open tabs in the tab bar.
4. **Graph Topology Context**: 1-2 hop backlinks and forward links extracted via [`graphContext.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/services/graphContext.js).
5. **Intent Detection & Dynamic Exemplars**: Detected user intent (code, update, summarize, plan) dynamically injects few-shot guidance via [`intentRouter.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/services/intentRouter.js).

### D. Streaming & Real-Time Tool Execution Pipeline
- **AI SDK & Streaming**: Uses Vercel AI SDK (`aiSdk.streamText`) with DeepSeek provider for streaming token delivery and tool call execution.
- **Real-Time Step Indicators**: Tool calls render active progress indicators in chat (e.g., `📁 Creating folder...`, `📝 Drafting note...`, `✏️ Updating section...`).
- **Tool Result Aggregation**: Completed actions produce bullet summaries with status badges.
- **XML Tag Fallback**: If non-tool models or fallbacks output raw XML tags (`<createFile...>`, `<createFolder...>`), regex handlers parse and execute them into real disk operations, stripping the raw tags so chat renders clean markdown.

### E. Session Management & History
- Multi-session chat support with persistent storage in `localStorage` (`lumina-chat-sessions`).
- History drawer for creating, switching, and deleting previous chat sessions.
- In-place rating (Thumbs Up / Down) and one-click code/message copying.

---

## 4. Directory & File Address Architecture

### Application Core & Main Process
- [`src/main/index.js`](file:///b:/electron/lumina/src/main/index.js): Application lifecycle, window creation, IPC handlers, protocol handlers, and native bridges.
- [`src/main/SettingsManager.js`](file:///b:/electron/lumina/src/main/SettingsManager.js): Configuration persistence manager syncing `.lumina/settings.json` with file watching and IPC callbacks.
- [`src/preload/index.js`](file:///b:/electron/lumina/src/preload/index.js): Secure context bridge exposing sanitized filesystem, dialog, and settings APIs to the renderer.

### UI Shell & Workspace Layout
- [`src/renderer/src/App.jsx`](file:///b:/electron/lumina/src/renderer/src/App.jsx): Root desktop component, global error handler, and theme loader.
- [`src/renderer/src/features/Layout/AppShell.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Layout/AppShell.jsx): Central orchestrator managing the 3-pane layout, modals, tabs, and resizing.
- [`src/renderer/src/features/Layout/TitleBar.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Layout/TitleBar.jsx): Custom window titlebar with navigation breadcrumbs and window controls.
- [`src/renderer/src/features/Layout/TabBar.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Layout/TabBar.jsx): Tabbed document navigation supporting pinned tabs and graph view tabs.
- [`src/renderer/src/features/Navigation/Sidebar.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Navigation/Sidebar.jsx): Left explorer sidebar with folder trees, note lists, favorites, and search.

### Editor & Document Workspace
- [`src/renderer/src/features/Editor/Editor.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Editor/Editor.jsx): Markdown editor component with real-time formatting, live preview, syntax highlighting, callouts, and checklists.
- [`src/renderer/src/core/store/workspaceStore.js`](file:///b:/electron/lumina/src/renderer/src/core/store/workspaceStore.js): Vault state store managing note snippets, folder trees, drafts, and disk synchronization.

### AI Engine, Modes & Execution Tools
- [`src/renderer/src/features/AI/LuminaChat.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/LuminaChat.jsx): AI chat interface (sidebar and floating window modes) with session history and real-time streams.
- [`src/renderer/src/features/AI/Composer.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/Composer.jsx): AI prompt composer with slash command trigger, note mentions, and mode selector.
- [`src/renderer/src/features/AI/LuminaSlash.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/LuminaSlash.jsx): Slash command popup for modes and AI actions.
- [`src/renderer/src/features/AI/LuminaMention.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/LuminaMention.jsx): `@note` context mention selector.
- [`src/renderer/src/features/AI/modes/index.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/index.js): AI mode resolver and registry.
  - [`src/renderer/src/features/AI/modes/luminaPlanMode.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/luminaPlanMode.js): Plan mode definition (`enableTools: false`).
  - [`src/renderer/src/features/AI/modes/luminaCodeMode.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/luminaCodeMode.js): Code execution mode definition (`enableTools: true`).
  - [`src/renderer/src/features/AI/modes/luminaDeepMode.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/luminaDeepMode.js): Deep reasoning mode definition (`enableTools: true`).
  - [`src/renderer/src/features/AI/modes/luminaCreativeMode.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/luminaCreativeMode.js): Creative writing mode definition (`enableTools: true`).
- [`src/renderer/src/features/AI/tools/LuminaChat.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/tools/LuminaChat.js): Core AI streaming pipeline, context injection, prompt engineering, and execution lifecycle.
- [`src/renderer/src/features/AI/tools/index.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/tools/index.js): Workspace execution tool registry:
  - `createFile.js`: Creates notes with auto-folder creation and editor opening.
  - `createFolder.js`: Creates workspace folders on disk.
  - `updateFile.js`: In-place modifications and section edits.
  - `appendToFile.js`: Appends content to existing notes.
  - `renameFile.js` / `renameFolder.js`: Safely renames files and folders while preserving references.
  - `deleteFile.js` / `deleteFolder.js`: Deletes files/folders from vault.
  - `moveFile.js`: Relocates notes between folders.
  - `readFile.js` / `openFile.js`: Reads note content and opens tabs in the editor.

### Graph & Analytics
- [`src/renderer/src/features/Graph/Graph.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Graph/Graph.jsx): 2D/3D force-directed interactive knowledge graph.
- [`src/renderer/src/features/AI/services/graphContext.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/services/graphContext.js): Graph topology scanner supplying contextual link context to AI queries.

### State & Settings
- [`src/renderer/src/core/store/useSettingsStore.js`](file:///b:/electron/lumina/src/renderer/src/core/store/useSettingsStore.js): Settings state store persisting preferences, themes, active AI modes, and provider keys across `settings.json` and local browser storage.
- [`src/renderer/src/features/Settings/Settings.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Settings/Settings.jsx): Application settings modal with provider configuration and customization options.

---

## 5. Critical Developer Invariants

- **Zero Code Comments Rule**: Never add code comments in modified or newly created files unless explicitly requested.
- **No Git Status / Diff in Chat**: Avoid running unneeded `git status` or `git diff` commands.
- **Natural File Names**: Lumina supports natural spaces in file names (`Today Log.md`). Do not force underscores or kebab-case unless requested.
- **Local Settings Resilience**: Settings like `activeAIMode` and API keys are dual-persisted to `settings.json` and `localStorage` to avoid flash resets on window refresh.
