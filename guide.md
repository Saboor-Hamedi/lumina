# Lumina AI Intelligence & Architectural Guide

This document outlines the core intelligence architecture and capabilities of **Lumina AI**, designed as an intellectual thought partner for your Personal Knowledge Management (PKM) thinking environment.

---

## 🏛️ 5 Core Pillars of Lumina AI Intelligence

### 1. 🌐 Knowledge Graph & 2-Hop Backlink Context Extraction
* **Purpose:** Provides deep topological context beyond simple vector search by traversing the workspace graph.
* **Mechanism:**
  - Extracts outgoing `[[wikilinks]]` and incoming backlinks from active notes and mentioned files.
  - Identifies 1-hop and 2-hop connected concept clusters, parent topics, and prerequisites.
  - Injects a compact topological Knowledge Graph summary directly into the prompt context for true context-awareness.

### 2. ⚡ Live Progressive Synchronization & Stream Mirroring
* **Purpose:** Seamless real-time coordination between the AI Chat and the CodeMirror workspace editor.
* **Mechanism:**
  - Single-pass native streaming (`aiSdk.streamText`) ensures zero thread lockups, pauses, or freezing.
  - Dispatches `ai-saved-snippet` events to update open editor tab buffers immediately.
  - Switches active tab selection (`vs.setActiveTabId`) upon note creation so users can observe notes live.

### 3. 🎯 Dynamic Intent Routing & Self-Healing Loop
* **Purpose:** Zero-friction classification of user intent (writing vs. conversing) and autonomous error recovery.
* **Mechanism:**
  - Categorizes requests dynamically: *Targeted Note Edit*, *New Note Creation*, *Conceptual Query*, *Refactoring*.
  - **Self-Healing Hook:** Automatically traps tool errors or minor file naming mismatches and retries with corrected parameters before displaying results.

### 4. 🔗 Natural, Non-Repetitive Wikilinking
* **Purpose:** Connects knowledge graph nodes purposefully without spamming brackets.
* **Mechanism:**
  - Enforces selective wikilinking (`[[Note Title]]` and `[[Note Title|Alias]]`) only on distinct concepts and related notes.
  - Prevents bracket pollution across standard conversational chat responses.

### 5. 🛑 Robust Abort & Smart Scroll Lifecycle
* **Purpose:** Flawless UX with instant stop controls and zero-shaking scroll interactions.
* **Mechanism:**
  - Immediate `AbortController` registration and propagation across all stream and tool loops.
  - Pulsating visual stop button indicator during generation.
  - Smart auto-scroll that pauses smoothly when the user scrolls up to read.

---

## 📂 Modular Architecture (DRY Pattern)

The AI engine is organized into dedicated, single-responsibility modules:
- `src/renderer/src/features/AI/services/graphContext.js`: Knowledge Graph traversal & backlink resolution.
- `src/renderer/src/features/AI/services/intentRouter.js`: Intent categorization & few-shot prompts.
- `src/renderer/src/features/AI/services/selfHealing.js`: Autonomous tool error correction.
- `src/renderer/src/features/AI/tools/`: Discrete, sandboxed tool definitions (`createFile`, `appendToFile`, `updateFile`, `clearFile`, `renameFile`, `readFile`, etc.).
- `src/renderer/src/features/AI/tools/LuminaChat.js`: Orchestrator store connecting UI, streaming, and execution.