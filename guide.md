# Lumina — Strategic Future Roadmap & Vision Guide

> **Guiding Principle**: Lumina is strictly a **local-first, plaintext Markdown** knowledge system. All content resides as real `.md` files and directories on disk. We do not use SQLite, proprietary databases, or closed storage layers. Everything is transparent, portable, fast, and user-owned.

---

## 1. Local AI & Knowledge Intelligence (No Databases, 100% Filesystem)

### A. High-Performance Filesystem In-Memory Index & BM25
- **Pure In-Memory Indexing**: Fast in-memory inverted index built on vault load and incrementally updated via `chokidar` file watchers.
- **BM25 Scoring & Fuzzy Hybrid Matching**: Combines Fuse.js fuzzy title matching with BM25 term weighting across note bodies directly from memory for sub-millisecond retrieval.
- **Local Dense Embeddings (`@xenova/transformers`)**: On-device vector generation cached in `.lumina/cache/embeddings.json` (or float arrays in binary chunks) without external servers or databases.

### B. Contextual Note Connections & "Ghost Links"
- **Unlinked References Discovery**: Automatically scans open documents for mentions of existing note titles that haven't been wrapped in `[[wikilinks]]`.
- **Semantic Relationship Recommendations**: Inspects note embeddings to recommend related thoughts under a dedicated "Suggested Connections" tab in the right inspector.
- **Auto-Backlink Aggregator**: Lists backlinking files and context snippets with 1-click conversion to permanent links.

### C. Agentic In-Document Workflows
- **One-Click Thought Synthesis**:
  - *Extract Action Items & Tasks*: Automatically scans headings and checklists to build consolidated task views.
  - *Generate Flashcards / Q&A*: Generates spaced-repetition cards directly formatted as Markdown callouts.
  - *Executive Summarizer*: Generates TL;DR metadata banners at the top of long notes.
  - *Automated Visual Roadmaps*: Generates Mermaid.js diagrams directly from textual notes.

---

## 2. Knowledge Graph & Spatial Thinking

### A. Infinite Canvas / Spatial Whiteboard
- **Visual Node Arrangement**: A boundless 2D canvas where markdown notes can be placed, arranged, linked with arrows, and visually organized.
- **Card Cards & Live Markdown Previews**: Render note cards with live editable previews on the canvas.
- **Sticky Thoughts & Media Embeds**: Drop images, colors, sticky notes, and freeform text blocks alongside files.
- **Format**: Saved as a transparent, human-readable JSON canvas file (e.g. `.canvas` or `.lumina-canvas`), maintaining portability.

### B. Graph Clustering & Evolution Timeline
- **Community Detection**: In-memory Louvain or label propagation algorithms run in `physics.worker.js` to automatically color-code topic clusters without heavy overhead.
- **Graph Time Machine (Timeline Filter)**: An interactive timeline slider at the bottom of the 2D/3D graph to visualize how the vault grew over days, weeks, and months.
- **Depth-Based Filtering**: Filter graph exploration by 1-hop, 2-hop, or N-hop neighborhoods from the active note.

---

## 3. Writing, Reading & Document Experience

### A. Zen / Focused Writing Mode (`F11` / Command Palette)
- **Distraction-Free Workspace**: Smoothly slides both left and right sidebars out of view, centers the active document with a comfortable reading width, and hides toolbars.
- **Typewriter Scrolling**: Keeps the active line of code/prose centered vertically on screen.
- **Ambient Focus Metrics**: Subtle, non-intrusive word counter and reading timer in the margin.

### B. Side-by-Side Split Panes
- **Vertical & Horizontal Split**: View or edit two notes simultaneously (e.g. drafting on the right while referencing notes or research on the left).
- **Linked Scrolling**: Synchronized scrolling between source note and translation/summary note when desired.

### C. Native PDF & EPUB Annotation
- **Local Asset Reader**: In-app PDF/EPUB viewer rendering from local vault assets.
- **Text Selection & Highlight Clips**: Select text in PDFs and create direct deep links and quote blocks inside markdown notes (`[[file.pdf#page=12]]`).

---

## 4. Portability, Publishing & Sync (User Sovereignty)

### A. Zero-Database Peer-to-Peer / Encrypted Sync
- **File-Level Synchronization**: Optional encrypted sync over WebDAV, Git, or S3-compatible cloud storage, preserving native file hierarchies.
- **Conflict Resolution**: Graceful diffing and file conflict resolution banners if external edits happen simultaneously.

### B. One-Click Digital Garden & Web Export
- **Static Site Generation**: Export chosen folders or tagged notes into a sleek, static documentation website or digital garden.
- **Clean Markdown / HTML / PDF Bundling**: High-fidelity export preserving formatting, KaTeX math formulas, syntax-highlighted code blocks, and diagrams.

### C. Lightweight Plugin Architecture
- **Hook-Based Extensibility**: Expose safe renderer hooks for community themes, custom editor slash commands, and tailored AI prompt recipes without modifying core code.
