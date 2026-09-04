# Lumina — Architecture & Core Purpose Guide

## 1. Executive Overview & Purpose

**Lumina** is a next-generation, local-first knowledge management workspace and thinking environment built on Electron and React. It unifies markdown note-taking, an interactive 2D/3D knowledge graph, bidirectional wikilinking, and multi-provider AI copilot capabilities into a responsive desktop experience.

Lumina keeps all files local in user-controlled vaults on disk, using plain `.md` files and standard directory hierarchies, while providing offline vector search, contextual AI drafting, and full multi-tab note navigation.

---

## 2. Workspace File Structure & Component Map

### Core Layout & UI Shell
- [`src/renderer/src/App.jsx`](file:///b:/electron/lumina/src/renderer/src/App.jsx): Root desktop application wrapper, error boundaries, and theme initialization.
- [`src/renderer/src/features/Layout/AppShell.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Layout/AppShell.jsx): Main three-pane application layout (Left Sidebar, Editor/Tabs/Graph view, Right Inspector/AI Chat), modal manager, and layout state orchestrator.
- [`src/renderer/src/features/Layout/TitleBar.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Layout/TitleBar.jsx): Custom frameless titlebar with window controls, navigation breadcrumbs, and quick actions.
- [`src/renderer/src/features/Layout/TabBar.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Layout/TabBar.jsx): Multi-tab management for documents, pinned tabs, and graph view tabs.
- [`src/renderer/src/features/Navigation/Sidebar.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Navigation/Sidebar.jsx): Left explorer sidebar managing note trees, folders, favorites, recents, and vault actions.

### Editor & Content Management
- [`src/renderer/src/features/Editor/Editor.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Editor/Editor.jsx): Primary markdown editor with live preview, syntax highlighting, callouts, checklists, and table formatting.
- [`src/renderer/src/core/store/workspaceStore.js`](file:///b:/electron/lumina/src/renderer/src/core/store/workspaceStore.js): Vault and document state manager handling snippet CRUD, file drafts, folder hierarchies, and disk sync.

### AI Engine, Modes & Tools
- [`src/renderer/src/features/AI/LuminaChat.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/LuminaChat.jsx): Multi-session AI chat assistant interface available both as a docked right sidebar and a draggable floating modal.
- [`src/renderer/src/features/AI/Composer.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/Composer.jsx): Unified AI prompt composer supporting slash commands (`/`), note mentions (`@`), and mode switching.
- [`src/renderer/src/features/AI/LuminaSlash.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/LuminaSlash.jsx): Slash command menu with AI mode selectors and quick actions.
- [`src/renderer/src/features/AI/LuminaMention.jsx`](file:///b:/electron/lumina/src/renderer/src/features/AI/LuminaMention.jsx): Interactive note mention popup linking note context directly into AI prompts.
- [`src/renderer/src/features/AI/modes/index.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/index.js): AI mode registry and resolver.
  - [`src/renderer/src/features/AI/modes/luminaPlanMode.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/luminaPlanMode.js): Plan mode for structured chat roadmaps and outlines without workspace mutation.
  - [`src/renderer/src/features/AI/modes/luminaCodeMode.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/luminaCodeMode.js): Code mode for automated file creation, folder generation, and code scaffolding.
  - [`src/renderer/src/features/AI/modes/luminaDeepMode.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/luminaDeepMode.js): Deep reasoning (Chain-of-Thought) mode for rigorous analysis.
  - [`src/renderer/src/features/AI/modes/luminaCreativeMode.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/modes/luminaCreativeMode.js): Creative writing and brainstorming mode.
- [`src/renderer/src/features/AI/tools/LuminaChat.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/tools/LuminaChat.js): AI stream orchestrator, context synthesis, multi-session storage, and tool call pipeline.
- [`src/renderer/src/features/AI/tools/index.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/tools/index.js): AI execution tool suite:
  - `createFile.js`: Workspace note creation with auto-folder resolution.
  - `createFolder.js`: Workspace directory creation.
  - `updateFile.js`: Targeted section and search/replace updates.
  - `renameFile.js` / `renameFolder.js`: Safe path and title renaming.
  - `deleteFile.js` / `deleteFolder.js`: Workspace deletion.
  - `moveFile.js`: Organizing notes across folders.
  - `readFile.js` / `openFile.js`: Note content retrieval and tab opening.

### Knowledge Graph & Visualizations
- [`src/renderer/src/features/Graph/Graph.jsx`](file:///b:/electron/lumina/src/renderer/src/features/Graph/Graph.jsx): 2D and 3D interactive force-directed graph visualizing document nodes and wikilink connections.
- [`src/renderer/src/features/AI/services/graphContext.js`](file:///b:/electron/lumina/src/renderer/src/features/AI/services/graphContext.js): Graph topology extractor injecting 1-2 hop backlinks into AI reasoning.

### Settings & Persistence
- [`src/renderer/src/core/store/useSettingsStore.js`](file:///b:/electron/lumina/src/renderer/src/core/store/useSettingsStore.js): Settings state store with persistence across `settings.json` and local browser cache.
- [`src/main/SettingsManager.js`](file:///b:/electron/lumina/src/main/SettingsManager.js): Main process file watcher and settings serializer with change detection.
- [`src/main/index.js`](file:///b:/electron/lumina/src/main/index.js): Electron main process lifecycle, window management, and native IPC handlers.
