# Lumina — Future Feature Scope & Strategic Roadmap

This document outlines the strategic vision and feature scope for the evolution of **Lumina**. Building upon our local-first, high-performance foundation (**Electron 39**, **React 19**, **CodeMirror 6**, **Zustand 5**, and **ONNX/FlexSearch**), these planned features elevate Lumina from a powerful Markdown editor into a state-of-the-art **AI-augmented environment for thought, research, and engineering**.

---

## 1. Next-Generation Surgical AI & Autonomous Workflows

### 1.1 Inline Diff Review & Hunk-Level Editing
* **Concept:** Transition from full-file AI replacements to surgical, block-level diff patching directly inside CodeMirror 6.
* **Mechanics:** When the AI (`LuminaChat`) suggests updates or refactors, changes are rendered in-place using inline decoration widgets (green additions, red deletions). Users can navigate between hunks (`Alt+N` / `Alt+P`), accepting or rejecting individual block edits without touching the rest of the document.
* **Architectural Advantage:** Eliminates LLM context drift and prevents accidental rewrites or loss of existing markdown structures and complex widgets (atomic tables, callouts, diagrams).

### 1.2 Proactive "Smart Connections" & Semantic Sidebars
* **Concept:** Real-time semantic serendipity without waiting for explicit chat prompts.
* **Mechanics:** As the user drafts a note, a lightweight background WebWorker computes rolling embeddings of the active section and queries the local ONNX index (`VaultSearch`). A subtle sidebar surfaces "Unlinked Mentions," related concepts from historical notes, or contrasting arguments in real time.
* **Architectural Advantage:** Zero latency impact on the main rendering thread (`useVaultStore`), leveraging existing `xenova/transformers` embeddings.

### 1.3 Autonomous Vault Agents & Scheduled Workflows (`/agents/*.md`)
* **Concept:** User-defined, autonomous AI agents customized entirely via clean Markdown templates stored right inside `.lumina/agents/` or `/brain/agents/`.
* **Mechanics:** An agent file (e.g., `DailyDigest.md` or `TaskExtractor.md`) defines system instructions, trigger schedules (`cron` or `on-vault-close`), and target folder scopes. When triggered, the background AI worker executes the workflow across target notes—summarizing messy notes, updating project trackers, or auto-tagging new items.

### 1.4 Smart Cross-File Refactoring (`@concept` Renaming)
* **Concept:** IDE-grade project wide refactoring for knowledge and ideas.
* **Mechanics:** When a concept, tag, or wikilink is renamed (`[[Old Title]]` → `[[New Title]]`), Lumina performs a global syntax tree scan across the entire vault, updating links, frontmatter aliases, and heading references instantly with a unified confirmation preview dialog.

---

## 2. Spatial Canvas & Advanced Knowledge Graph

### 2.1 Infinite 2D Spatial Whiteboard (Canvas Mode)
* **Status:** Implemented & Production-Ready (v1.0.62 / `src/renderer/src/features/canvas/`).
* **Delivered Capabilities:**
  - Full infinite zoomable 2D canvas with pan/zoom (10% to 500%), dot-grid background, smooth momentum, and spacebar panning.
  - 12+ Vector Geometric Shapes (rectangle, rounded rectangle, diamond, circle, cylinder, document, actor, cloud, triangle, hexagon, star, callout) with double-click Markdown text editing.
  - Smart Dynamic Ports & Magnetic Snapping: shape-aware connection ports (actor head/hands, cylinder rim, callout tail) with magnetic terminal docking.
  - Orthogonal 90° Routing with collision avoidance, Bezier curves, and straight paths with custom arrow markers (arrows, diamonds, circles, bars).
  - Alignment Snapping & Smart Guides: live crosshairs for edge and center alignment during drag and resize.
  - Box Marquee Selection & Bulk Operations: lasso selection, multi-node translation, bulk delete, color cycling, and floating alignment toolbar.
  - Radar MiniMap HUD: real-time viewport tracker, click-to-pan, and instant zoom controls.
  - Minimalist Sticky Notes: headerless cards with soft drop shadows and Ctrl+Enter / Escape shortcuts.
  - Vault Ingestion: drag-and-drop notes, images, and PDFs from FileExplorer onto the canvas with Markdown AST rendering and "Open in Tab" integration.

### 2.2 Time-Travel Graph Evolution
* **Concept:** Watch your intellectual network grow and cluster over time.
* **Mechanics:** A playback slider integrated into the bottom of `Graph.jsx`. Dragging the slider filters visible nodes and edges by timestamp (`createdAt` / `updatedAt`), animating the historical emergence of idea clusters and highlighting stale or orphan concepts that need re-integration.

### 2.3 Local Neighborhood & Radial Focus Mode
* **Concept:** Instant visual isolation inside massive, multi-thousand-note vaults.
* **Mechanics:** Clicking any note in the graph or pressing a shortcut (`Ctrl+Shift+F`) inside the editor isolates a clean 1-hop or 2-hop radial view. All unrelated nodes fade out, letting the user inspect immediate dependencies and outgoing links with crystal clarity.

### 2.4 Semantic Graph Clusters & Auto-Tagging
* **Concept:** AI-driven structural organization of chaotic vaults.
* **Mechanics:** The local embedding engine clusters notes using K-means or HDBSCAN over vector representations. Lumina automatically suggests logical folder hierarchies, overarching themes, and shared tags for disconnected clusters.

---

## 3. Live Document Intelligence & Block-Level Power

### 3.1 Dynamic Vault Queries (Live Markdown Views)
* **Concept:** Turn passive markdown files into live, self-updating project dashboards using dynamic code blocks (`\`\`\`query` or `\`\`\`dataview`).
* **Mechanics:** Users write simple SQL-like or filtering expressions inside code blocks:
  ```yaml
  ```query
  FROM "/Projects"
  WHERE status = "Active" AND due <= "2026-08-01"
  SORT priority DESC
  ```
  ```
  CodeMirror renders this block as an interactive, auto-updating table widget (`tableWidgetExtension` style) showing live data pulled straight from vault frontmatter and tasks.

### 3.2 Block-Level Transclusion & Syncing (`![[Note#^block-id]]`)
* **Concept:** Atomic idea reuse across multiple notes without copy-pasting.
* **Mechanics:** Every paragraph, list item, callout, or atomic table can receive a unique block identifier (`^block-id`). Transcluding that block inside another note (`![[Master Project Plan#^goals]]`) embeds the exact block live. Editing the block inside the transclusion instantly syncs the update back to the source note.

### 3.3 Split-View Multi-Tab Workspace
* **Concept:** IDE-style multi-column layout (`useResizable` splitters) for deep multitasking.
* **Mechanics:** Split the workspace horizontally or vertically into independent pane grids. Pin a reference paper or graph on the left column, write your synthesis note in the middle column, and run an AI chat exploration in the right pane—all driven by unified `useVaultStore` state.

### 3.4 Live Interactive Charts from Markdown Tables
* **Concept:** Instant data visualization directly inside markdown documents.
* **Mechanics:** Add a `chart: bar` or `chart: line` metadata tag above any standard markdown table or atomic table. CodeMirror dynamically renders a responsive chart (`Chart.js` / `Recharts` widget) underneath the table that updates live as cells are modified.

---

## 4. Deep Desktop Integration & Asset Mastery

### 4.1 Global Spotlight Quick-Capture Overlay
* **Concept:** Frictionless, system-wide thought capture without breaking focus.
* **Mechanics:** A global OS keyboard shortcut (`Alt+Space` or `Cmd+Shift+L`) registered via Electron `globalShortcut`. Pops up a sleek, floating spotlight window anywhere on the desktop. Users can type quick thoughts, paste URLs, or drop screenshots, which are immediately appended to the daily note or `/Inbox` folder.

### 4.2 Local PDF, OCR & Visual Research Indexing
* **Concept:** Expand semantic vector search beyond markdown text to include all visual and PDF assets.
* **Mechanics:** When PDFs or images are dropped into the vault (`/assets`), a background worker runs local OCR (`Tesseract.js` or `ONNX vision models`) and text extraction (`pdf-parse`). The extracted text is indexed into `VaultIndexer`, enabling users to ask LuminaChat questions that synthesize across both written notes and downloaded research literature.

### 4.3 Cloud Sync & Git-Like Google Drive Mirroring
* **Status:** Implemented & Verified.
* **Mechanics:** Vault mirroring directly to Google Drive under a clean `lumina/` root folder with preserved directory trees. Individual notes can be pushed on-demand via the editor metadata toolbar (`DrivePushButton`) with ancestor tree auto-creation, in-place title rename synchronization, and cancellation support. Future expansion includes native local git commit hooks and diff timeline browsing.

### 4.4 Custom Protocol Handler & Deep Linking (`lumina://`)
* **Concept:** Connect Lumina to the broader desktop ecosystem.
* **Mechanics:** Register the `lumina://open?path=Folder/Note.md&line=42` custom URI scheme in OS registries (`app.setAsDefaultProtocolClient`). External applications, scripts, browser bookmarks, and task managers can open notes directly to specific lines or trigger specific AI prompt templates from external workflows.

### 4.5 Smart Web Clipper & Rich Link Previews
* **Concept:** Effortlessly convert external research, articles, and bookmarks into clean, permanent local Markdown notes without clutter or browser lock-in.
* **Mechanics:** 
  - **Main-Process Scraping:** Leveraging Electron's main process (`net`/Node `fetch`) to bypass browser CORS restrictions and securely scrape OpenGraph metadata (title, description, author, hero image, site favicon).
  - **Notion-Style Rich Bookmark Cards:** Pasting a URL or triggering `/bookmark` auto-generates an interactive inline card showing site favicon, title, snippet, and thumbnail.
  - **Reader-Mode Article Clipping:** 1-click modal to extract clean, ad-free article text via Mozilla Readability / Turndown, formatting it into a complete local `.md` note with frontmatter metadata (`source`, `clippedAt`, `author`).

---

## 5. Architectural Implementation Phasing

| Phase | Focus Area | Key Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | **Surgical AI & Diff Engine** | Replace full-file overwrites in `updateFile` with line-range diff patching; inline hunk review widgets inside CodeMirror; exact URI/ID checking before deletions. |
| **Phase 2** | **Block & Live Intelligence** | Block-level IDs (`^block-id`) and transclusion rendering; `\`\`\`query` live frontmatter table widgets; multi-column split workspace grids. |
| **Phase 3** | **Desktop, Web & Asset Mastery** | Smart Web Clipper & Rich Link Previews; Global `Alt+Space` quick-capture overlay; background PDF/image OCR indexing; visual Git snapshot timeline. |
| **Phase 4** | **Spatial & Graph Evolution** | 2D Spatial Whiteboard (`Canvas Mode`); time-travel graph playback slider; autonomous scheduled `/agents/*.md` workflows. |
