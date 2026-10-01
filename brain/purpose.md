# Lumina — Purpose, Architecture & Future Roadmap

> **Architectural Source of Truth**: This document defines Lumina's core purpose, mental model, system architecture, architectural decision log, development invariants, known limitations, and strategic future roadmap.

**Version**: `v1.0.65` | **Status**: Active Production | **Knowledge Classification**: Evergreen Architecture  
**Last Verified**: October 2026 | **Target Audience**: Core Developers & Lumina AI Agents

---

## Onboarding Path ("Start Here" Sequence)

To quickly orient yourself within Lumina's architecture, follow this recommended reading sequence:
1. **Fresh AI Session / New Contributor**: Read [Section 1 (Executive Summary)](#1-executive-summary--the-vision) → [Section 2 (Mental Model)](#2-core-mental-model--design-philosophy) → [Section 5 (Architectural Invariants)](#5-architectural-guardrails--developer-invariants).
2. **Layout & UI Engineers**: Read [Section 3 (Three-Pane Layout Rhythm)](#3-system-architecture--layout-hierarchy) → [Section 4 (Decision Log)](#4-architectural-decision-log-the-why).
3. **AI & Prompt Engineers**: Read [Section 3 (Context Engine & Surgical Updates)](#context-engine--prompt-assembly) → [Section 7 (Terminology Glossary)](#7-terminology-glossary).
4. **Roadmap & Feature Planning**: Read [Section 6 (Known Limitations)](#6-known-limitations--deliberate-trade-offs) → [Section 8 (Future Roadmap)](#8-strategic-future-roadmap--upcoming-capabilities).

---

## Table of Contents
1. [Executive Summary & The Vision](#1-executive-summary--the-vision)
2. [Core Mental Model & Design Philosophy](#2-core-mental-model--design-philosophy)
3. [System Architecture & Layout Hierarchy](#3-system-architecture--layout-hierarchy)
4. [Architectural Decision Log (The "Why")](#4-architectural-decision-log-the-why)
5. [Architectural Guardrails & Developer Invariants](#5-architectural-guardrails--developer-invariants)
6. [Known Limitations & Deliberate Trade-offs](#6-known-limitations--deliberate-trade-offs)
7. [Terminology Glossary](#7-terminology-glossary)
8. [Strategic Future Roadmap & Upcoming Capabilities](#8-strategic-future-roadmap--upcoming-capabilities)

---

## 1. Executive Summary & The Vision

**Lumina** is a modern, local-first knowledge management workspace and AI-assisted thinking environment designed for researchers, engineers, writers, and deep thinkers.

In an era of locked cloud silos, proprietary document formats, and intrusive data harvesting, Lumina is built upon three foundational human promises:

1. **Absolute Data Sovereignty**: You own your thoughts forever. Every note, sketch, and roadmap is stored directly on your computer's filesystem as plain, human-readable Markdown files and portable JSON. There are no proprietary database locks, no subscription walls on your personal data, and no cloud gatekeepers.
2. **Absolute Privacy & Offline Sovereignty**: Your privacy is non-negotiable. Lumina functions completely offline with zero telemetry, zero analytics tracking, and zero hidden network requests. When you choose to use AI, your thoughts are sent only to the provider you explicitly configure, or kept entirely offline on your local hardware via local models.
3. **Pure Focus & Frictionless Thought**: Tools should disappear into the act of thinking. Lumina provides a calm, beautiful, and distraction-free environment where typing feels tactile and immediate, navigation is instantaneous, and ideas fluidly transition between text, knowledge graphs, and infinite visual canvases.

---

## 2. Core Mental Model & Design Philosophy

### The Plaintext Axiom
The filesystem is the database. Notes are never converted into binary blobs or opaque database rows. If you open your Lumina workspace directory in any other text editor, operating system terminal, or script, you find standard Markdown files organized in clean folders. External changes made by git or other editors are detected instantly and synchronized into the workspace without friction.

### Connected Thinking & The Knowledge Graph
Knowledge is rarely a flat list of files; it is an interconnected web of thoughts.
- **Bidirectional Wikilinks**: Linking concepts using double brackets creates living, associative connections between ideas.
- **Interactive Knowledge Graph**: Two- and three-dimensional force-directed graph visualizers reveal the natural topography of your thinking — surfacing emergent topical hubs, unexpected connections across disciplines, and isolated thoughts that need integration.
- **Topological Awareness**: The AI companion reads the 1-to-2 hop graph neighborhood around your active note, understanding the contextual neighborhood of your work before answering questions.

### Spatial Thinking on an Infinite Canvas
Linear documents are only one dimension of thought. Complex architectures, brainstorms, and system designs require spatial freedom.
- **Infinite 2D Workspace**: A smooth, hardware-accelerated spatial plane where cards, notes, sticky thoughts, and vector geometry coexist.
- **Magnetic Snap & Smart Directional Connectors**: Connectors snap intelligently to card ports and automatically choose optimal collision-free paths, flipping direction dynamically as concepts move in space.
- **Portable Canvas Architecture**: All visual diagrams are stored alongside your notes in an open, portable canvas format, ensuring complete longevity.

### Multi-Provider Pluggable Intelligence
AI in Lumina is a thinking partner, not an automated content mill. Lumina connects pluggably to world-class reasoning models:
- **Cloud Intelligence**: DeepSeek, OpenAI, Anthropic Claude, and Groq.
- **Local On-Device Models**: Fully offline Ollama models running directly on your local hardware with zero external network access.
- **Modular Operational Modes**:
  - *Plan Mode*: High-level strategic roadmaps, architectural blueprints, and deep structural outlines without touching disk files.
  - *Code Mode*: Technical precision and file scaffolding for engineering workflows.
  - *Deep Mode*: Extended chain-of-thought reasoning for difficult multi-step analytical challenges.
  - *Creative Mode*: Divergent associative brainstorming and conceptual synthesis.

### High-Fidelity Themed Document & Topography Export
Thinking is meant to be shared and archived with aesthetic integrity. Lumina treats document generation and export as a core cognitive extension:
- **Theme-Synchronized PDF Engine**: Converts individual notes or merged multi-document vaults into publication-ready PDFs. Every visual aspect — typography, syntax-highlighted code blocks, tables, callouts, and inline math — exactly preserves the active user theme (Dark, Light, Porcelain, or custom palettes) via sandboxed offscreen styling.
- **Interactive Live Preview**: Real-time sandboxed preview pane (`PDFPreview`, `DOCSPreview`, `HTMLPreview`, `MarkdownPreview`, `TEXTPreview`) rendering the exact document output with zoom and layout inspection before writing to disk.
- **Batch Vault Synthesis**: Multi-select notes or whole folder hierarchies to export into unified single volumes (with automatic hierarchical Table of Contents and dynamic page bookmarks) or cleanly structured standalone document bundles with live progress streaming.
- **Vector & Image Knowledge Topography**: Instant export of 2D knowledge graphs to high-resolution PNG images or scalable SVG vectors directly from the graph workspace for papers, presentations, and archival documentation.
- **Zero-Dependency Offline Assets**: Embedded images (`asset://`), local attachments, and dynamic Mermaid diagrams are automatically bundled inline as vector SVG and data URIs, producing self-contained, standalone documents.

---

## 3. System Architecture & Layout Hierarchy

### The Three-Pane Layout Rhythm
The Lumina interface is organized into three balanced horizontal regions:
- **Navigation Pane (Left)**: Houses the workspace directory tree, folder hierarchies, tag filters, and global views.
- **Thinking Canvas & Editor (Center)**: The central sanctuary for reading, writing, and spatial canvas exploration.
- **Inspector & Collaboration Pane (Right)**: Hosts document outlines, note metadata, graph previews, and the conversational AI companion.

### The Curtain Sidebar Principle
Sidebars behave like stationary curtains. When opened or closed, the internal content remains anchored against the screen edges while the outer viewport boundary expands or contracts over it. Internal controls, tabs, and explorer trees never awkwardly crush or squish during sidebar animations.

### 32-Pixel Vertical Rhythm
The top headers across all three panels — the file explorer header, the central workspace tab bar, and the right inspector panel — adhere strictly to an exact 32-pixel height. This guarantees an uninterrupted horizontal datum line across the entire screen, preserving visual harmony and calm.

### Context Engine & Prompt Assembly
When interacting with the AI companion, Lumina constructs a multi-layered context hierarchy:
1. **Explicit Mentions**: Specific notes or topics tagged directly by the user take absolute precedence.
2. **Active Editor Workspace**: The currently open note, unsaved draft buffers, and cursor focus are provided so the AI sees exactly what you are looking at.
3. **Open Tab Working Set**: Snippets from other active tabs provide immediate working memory.
4. **Knowledge Graph Topology**: Incoming backlinks and outgoing references from the active note provide associative depth.
5. **Persistent User Memory**: Structured user identity, workflow preferences, and learned facts are woven in seamlessly so explanations match your expertise level.

### Surgical Note Modification Philosophy
Lumina avoids destructive full-file rewrites whenever possible. When updating an existing document, the system targets specific sections or paragraphs, preserving frontmatter, document metadata, custom formatting, and unmentioned sections with surgical precision.

### Unified Thinking Stream
All model reasoning — including initial problem decomposition, tool deliberation, and post-execution reflection — is presented in a single, cohesive thinking stream with live duration timers, ensuring full transparency without jarring layout shifts.

### Persistent Multi-Tier Memory
User memory is structured into three clear tiers:
1. **User Identity**: Name, professional background, role, and domain expertise.
2. **User Preferences**: Preferred communication styles, technical depth, formatting habits, and language conventions.
3. **Learned Facts**: Explicit insights and project details curated across sessions.

### Sandboxed Document Export Architecture
Document generation is strictly decoupled into modular backend pipelines (`src/export/`) and renderer interfaces (`src/renderer/src/features/export/`):
- **Core Exporters**: `exportPDF.js` (A4 layout, auto-TOC, page counter, print-optimized CSS), `exportBundle.js` (clean self-contained HTML/Markdown bundles), `exportDocs.js` (.doc Word-compatible format), `exportBatch.js` (folder-recursive batch processing), and `exportCombined.js` (single merged volume synthesis).
- **IPC Preview Pipeline**: `src/export/preview/` generates theme-tokenized HTML previews without touching the filesystem, streamed across IPC channels to sandboxed preview components (`PDFPreview`, `DOCSPreview`, `HTMLPreview`, `MarkdownPreview`, `TEXTPreview`).
- **Offline Mermaid Runtime**: Diagram rendering executes via an offscreen Electron render window (`mermaidRuntime.js`, `renderWindow.js`), rendering charts directly into inline SVGs before document assembly.

### Modular Knowledge Graph Architecture
The knowledge topography engine (`src/renderer/src/features/graph/`) operates across specialized, decoupled modules:
- **Modular Directory Hierarchy**:
  - `graph/2d/`: High-performance HTML5 2D canvas renderer (`Graph2D.tsx`), radar HUD (`GraphMiniMap.tsx`), and inline graph widgets (`InlineGraph.tsx`).
  - `graph/3d/`: Hardware-accelerated WebGL force-directed space (`Graph3D.tsx`).
  - `graph/utils/`: High-resolution vector & raster export (`graphExport.ts`), layout coordinate persistence, and geometry transforms.
  - `graph/css/`: Domain stylesheets (`Graph.css`, `GraphSidebar.css`) with low-profile shadows and theme-adaptive variable injection.
- **Worker-Driven Physics**: D3 force simulations run off-thread in `physics.worker.ts`, preserving 60+ FPS UI fluidity even across thousands of nodes.

---

## 4. Architectural Decision Log (The "Why")

To prevent well-intentioned regressions, the rationales behind key architectural decisions are documented below:

### Decision 1: LocalStorage as the Sidebar State Source of Truth
- **Context**: Sidebar open/closed states and custom panel widths must persist across app reboots.
- **Decision**: Local component state paired immediately with `localStorage` is the primary source of truth. Writes to global Zustand stores are deferred.
- **Rationale**: Synchronous global store updates during React component mounts caused cascading re-renders and circular update warnings. `localStorage` reads synchronously before initial paint, eliminating sidebar layout flashes without state overhead.

### Decision 2: Direct Flex Siblings for Layout Resizers
- **Context**: Users drag 5px dividing knobs to resize the left and right sidebars.
- **Decision**: The resizer dividers are direct flex children of the application shell container, never nested inside the sidebar panels.
- **Rationale**: The sidebar panels utilize CSS `contain: inline-size layout` for optimal rendering performance. Any child elements inside a layout containment box have their absolute positioning coordinates trapped within that box. Placing resizers inside sidebars caused knobs to visually render inside the sidebar rather than in the dividing gutter.

### Decision 3: Plaintext Files Over Embedded Databases
- **Context**: Storing notes in an embedded SQLite database would offer rapid single-query indexing.
- **Decision**: Reject database storage in favor of individual Markdown files on disk.
- **Rationale**: User sovereignty is a core human promise. A proprietary or single-file database traps user data if the application is uninstalled or damaged. Filesystem-based notes ensure the user can inspect, copy, or edit their life's work via git, command line, or external editors forever.

### Decision 4: Off-Thread Worker for Vector Embeddings
- **Context**: Semantic search and knowledge indexing require computing 384-dimensional vector embeddings via neural models.
- **Decision**: Embedding generation is delegated to a separate background worker thread (`indexer-worker.js`), never computed on the main Electron thread or UI process.
- **Rationale**: Neural feature extraction is CPU-intensive. Running embeddings on the UI or main event loop introduces noticeable 100–300ms frame drops and typing stutter. A dedicated worker thread keeps the editor silky smooth at 60 FPS while background indexing proceeds silently.

### Decision 5: Live Sandboxed IPC Previews for Document Exports
- **Context**: Verifying export formatting previously required writing files to disk and opening external applications, leading to repeated trial-and-error cycles.
- **Decision**: Stream styled document HTML over IPC into sandboxed preview frames (`src/export/preview/`) with active theme token variables before writing to disk.
- **Rationale**: Provides instant visual feedback for pagination, typography, code block syntax highlighting, and table-of-contents layout without disk clutter.

### Decision 6: LocalStorage Node Persistence with Elastic Central Physics
- **Context**: Users arranging knowledge graph topologies lost customized node placements upon navigation or reload. Conversely, pinning the active central node frozen in space degraded local navigation.
- **Decision**: Persist peripheral dragged node coordinates in `localStorage`, but enforce elastic spring release on central/focused notes so they smoothly return to equilibrium.
- **Rationale**: Gives users manual layout agency over graph clusters while maintaining automatic force-directed centering for active document exploration.

---

## 5. Architectural Guardrails & Developer Invariants

To keep Lumina performant, reliable, and maintainable, development adheres to the following foundational invariants:

1. **Direct Flex Sibling Rule for Resizers**: Draggable layout resizers must always remain direct flex children of the outer application container. They must never be nested inside elements with layout containment to avoid coordinate trapping.
2. **Non-Blocking UI Thread**: The main user interface thread must never freeze or stutter. All heavy computations — vector embeddings, file system scanning, text indexing, image processing, and PDF exports — are offloaded to background worker threads or asynchronous queues.
3. **Non-Destructive User Data Guarantee**: User text is sacred. The AI and system operations must never overwrite, truncate, or delete user notes without clear user intent. Unsaved in-memory editor drafts always take precedence over disk state.
4. **Multilingual & Bidirectional Equality**: Persian, Arabic, Hebrew, CJK, and Latin scripts are first-class citizens. Unicode text normalization, RTL line detection, and IME composition guards operate universally across the editor, search bars, and spatial canvas.
5. **Natural Human-Readable Naming**: File and folder names reflect human language. The system avoids synthetic database keys, random hash filenames, or hidden directory redirection.
6. **Isolated System Components**: Background maintenance systems (such as internal knowledge indexing and backup synchronizers) must remain strictly decoupled from user-facing workspace notification systems. Specifically, `Indexing.jsx` is dedicated exclusively to user note progress.

---

## 6. Known Limitations & Deliberate Trade-offs

Understanding what is intentionally deferred or bounded prevents futile debugging:

### 1. File Size Limits & Large Document Thresholds
- **Limitation**: Files exceeding `MAX_WORKSPACE_TEXT_BYTES` (~2MB) are marked as oversized and bypass full deep vector chunking.
- **Trade-off**: Protects memory and vector store bounds from gigantic log files, scraped data dumps, or raw CSVs accidentally placed in the vault.
- **Workaround**: Split monolithic data dumps into chapter-sized notes or store raw datasets outside the active markdown vault.

### 2. Single Active Workspace Root
- **Limitation**: Lumina operates on one active workspace folder at a time per window.
- **Trade-off**: Simplifies bidirectional link resolution, file-watching trees, and local graph indexes. Multi-vault federation is scheduled for upcoming architecture (see Section 8).
- **Workaround**: Use topic-level root folders within a single master vault.

### 3. Spatial Canvas Coordinate Bounds
- **Limitation**: The infinite canvas operates stably up to ±20,000 pixels in either axis. Placing elements at extreme distant coordinates (e.g. 500,000px) can cause minor sub-pixel rendering inaccuracies in browser matrix math.
- **Workaround**: Group related concepts within reasonable spatial clusters and utilize the radar minimap to navigate.

### 4. Local Model Hardware Dependence
- **Limitation**: Local intelligence through Ollama requires sufficient host RAM/VRAM. On lower-end machines, initial model load can take several seconds.
- **Trade-off**: Preserves 100% offline privacy and zero API costs.
- **Workaround**: Lumina implements an abortable request controller and dynamic timeouts so users are never stuck waiting on an unresponsive local model.

---

## 7. Terminology Glossary

To ensure consistent communication across agents, developers, and UI components:

- **Unified Thinking Stream**: The single, consolidated reasoning block at the top of an AI response that records initial problem decomposition, tool deliberation, and post-execution reflection with live duration timers.
- **Surgical Update**: The AI technique of replacing only a targeted section, subheading, or opening paragraph without rewriting or risking the rest of the document.
- **Context Engine**: The multi-tiered subsystem responsible for gathering user mentions, open editor drafts, tab snippets, graph backlinks, and persistent memories into the AI system prompt.
- **Curtain Sidebar**: The responsive layout pattern where sidebars clip stationary content from the screen edges during resizing rather than compressing or breaking internal element layouts.
- **Plaintext Axiom**: The foundational principle that every note is a standard Markdown file directly on disk, guaranteeing lifetime data sovereignty without database locks.
- **Knowledge Topography**: The structural layout of notes, clusters, central hubs, and orphan thoughts revealed by the 2D/3D force-directed knowledge graph.
- **Theme-Synchronized PDF Pipeline**: The print-to-PDF rendering system that injects CSS custom properties and active theme tokens into an offscreen render window, ensuring exports match dark, light, or porcelain themes with exact color fidelity.
- **Batch Vault Synthesis**: The engine that compiles multi-selected files or entire directory trees into unified single-volume exports with auto-generated tables of contents and bookmarks, or processes them concurrently into discrete file bundles.
- **Elastic Central Physics**: Dynamic force relaxation on central/focused graph nodes upon drag release, gently guiding active notes back toward visual equilibrium while preserving custom coordinates for peripheral nodes.

---

## 8. Strategic Future Roadmap & Upcoming Capabilities

Lumina is evolving from a local markdown editor into a comprehensive cognitive workspace. The following strategic pillars define upcoming development:

### A. Agentic In-Document Workflows
- **One-Click Thought Synthesis**: Instantly generate structured executive summaries, key takeaways, and flashcards from dense research notes.
- **Automated Diagramming**: Automatic extraction of sequence diagrams, entity relationship charts, and concept roadmaps into interactive Mermaid diagrams directly within the active note.
- **Interactive Action Item Extraction**: Intelligent aggregation of scattered task lists across multiple project folders into a unified operational view.

### B. Next-Generation Spatial Canvas
- **Visual Wikilink Bridges**: Two-way interactive links connecting canvas cards directly to notes in the workspace tree.
- **Hierarchical Group Containers**: Nestable canvas frames and swimlanes for organizing complex system architectures and sprint boards.
- **Intelligent Auto-Layout**: One-click orthogonal and radial layout engines that automatically arrange complex node webs into clean, readable presentations.

### C. Knowledge Graph Synthesis & Cross-Vault Federation
- **Multi-Vault Federation**: Fluidly traverse and link across multiple separate local knowledge vaults (e.g. personal research, work projects, and client archives) with unified search and cross-vault wikilinking.
- **Associative Discovery Engine**: AI-assisted discovery of conceptual gaps and surprising thematic bridges between historically disconnected note folders.

### D. Deep On-Device Local Intelligence
- **Zero-Cloud Local Workflows**: Seamless integration with local neural engines and small language models for complete privacy on mobile hardware and air-gapped environments.
- **Local Vector Indexing with High Recall**: Instant semantic recall powered by lightweight on-device embeddings that require negligible RAM and zero external API credits.

### E. Temporal Note Lineage & Version Timelines
- **Visual Note Diffing**: Intuitive side-by-side time-travel comparisons showing how complex documents and research papers evolved over days, weeks, and months.
- **Local Snapshot Recovery**: Lightweight, automatic recovery points that protect against accidental edits without requiring manual git commands.
