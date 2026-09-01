# 💡 Lumina Product Roadmap & Feature Suggestions

This document outlines high-impact polish opportunities and next-generation features for **Lumina**, organized by priority and user experience value.

---

## 🧭 Current Core Strengths
Lumina already boasts a rich suite of foundational capabilities:
- **Knowledge Graph:** Interactive 2D and 3D visual graph views with physics simulations, theme coloring, and minimap.
- **WYSIWYG Markdown Engine:** Live preview with native mark-based `[[wikilinks]]`, fold placeholders, hierarchical nested lists with smart indentation/auto-continuation, custom callouts, code block wrappers, and image insertions.
- **Dynamic Tables:** Interactive table widgets with invisible horizontal scrolling, natural column expansion, and cell-level editing.
- **Embedded Diagrams:** Real-time Mermaid diagram rendering with quick edit modes.
- **AI Integration:** Both inline prompt generation and dedicated Lumina AI chat assistant with multi-provider support.
- **Vault & Storage Management:** File-based markdown storage, fast indexing, tag filtering, full-text vector embeddings search, and Google Drive backup synchronization.
- **Export & Interoperability:** Multi-format exports (`.pdf`, `.html`, `.docx`, `.xlsx`, `.md`, `.json`, `.txt`) and local directory imports.
- **Personalization:** Rich theme system, custom caret styles, icon pickers, and configurable editor shortcuts.

---

## 🎯 Phase 1: High-Impact Polish & UX Perfection
*Refining existing systems to feel 10/10 rock-solid, fluid, and intuitive.*

### 1. Backlinks & Unlinked Mentions Panel (Inspector)
- **What it is:** A collapsible bottom drawer or inspector sidebar panel within the active note view.
- **Capabilities:**
  - **Direct Backlinks:** Automatically lists all other notes that contain `[[Current Note Title]]` with surrounding paragraph context snippets.
  - **Unlinked Mentions:** Scans the vault for mentions of the note’s title that are not yet formatted as wikilinks, offering a **1-click "Link"** button to convert them into `[[wikilinks]]`.
- **Value:** Turns isolated notes into an interconnected second brain effortlessly.

### 2. Slash Command Menu (`/` Commands)
- **What it is:** Triggering `/` on any blank line opens an Obsidian/Notion-style floating palette.
- **Commands:**
  - `/table` — Insert a new grid table.
  - `/mermaid` — Insert a flowchart, sequence diagram, or mindmap template.
  - `/callout` — Insert info, warning, tip, or note callouts.
  - `/ai` — Trigger inline Lumina AI prompt.
  - `/date` / `/time` — Insert today's timestamp.
  - `/heading1`, `/code`, `/quote`, `/task` — Quick formatting without key combinations.
- **Value:** Drastically speeds up note authoring and makes rich features instantly discoverable.

### 3. Note Revision History (Local Snapshots)
- **What it is:** Automatic periodic local version snapshots of active notes.
- **Capabilities:**
  - Visual side-by-side diff view showing what changed over the last hour, day, or week.
  - 1-click **Restore Version** button to safely undo accidental overwrites or bulk deletions.
- **Value:** Peace of mind and robust data safety for power users.

### 4. Interactive Image & Media Lightbox
- **What it is:** Clicking on any image in the editor opens a sleek, full-screen lightbox modal.
- **Capabilities:**
  - Smooth pan, zoom (mouse wheel / pinch), rotate, copy to clipboard, and open in default OS viewer.
- **Value:** Makes visual research notes and diagram review seamless.

---

## 🚀 Phase 2: Next-Generation Pillar Features
*Distinctive features that position Lumina as an elite, next-level knowledge workspace.*

### 1. Infinite Visual Canvas (Whiteboard Mode)
- **What it is:** An infinite 2D canvas workspace (like Obsidian Canvas, Apple Freeform, or Miro).
- **Capabilities:**
  - Drag and drop notes, images, PDFs, web links, and sticky notes onto the canvas.
  - Draw directional connecting arrows with labels to map out complex architectures, storyboards, and research clusters.
  - Embedded live markdown cards editable directly inside the canvas.
- **Value:** Unlocks visual thinking and spatial knowledge organization.

### 2. Audio Transcription & Voice Memos (Local AI / Whisper)
- **What it is:** Built-in microphone recording tool in the sidebar or bottom bar.
- **Capabilities:**
  - Record audio memos directly into a note.
  - 1-click speech-to-text transcription powered by local lightweight Whisper or cloud AI.
  - Automatic AI bullet-point summarization of voice notes.
- **Value:** Capture thoughts on the go without manual typing.

### 3. Deep Full-Text PDF & Document Indexing (OCR)
- **What it is:** Extending the vector search engine to parse attached PDFs, receipts, and images.
- **Capabilities:**
  - Search queries surface exact pages and highlights inside attached PDF documents.
  - AI Assistant can cite and answer questions directly from attached reference PDFs.
- **Value:** Complete all-in-one personal research hub.

### 4. 1-Click Web Publishing / Static Site Generator
- **What it is:** Export a single note, folder, or vault as a beautiful, standalone static web document or microsite.
- **Capabilities:**
  - Self-contained HTML with preserved dark/light theme, interactive graph view, and table of contents.
  - Ready for immediate upload to GitHub Pages, Netlify, or local offline sharing.
- **Value:** Effortlessly share research, portfolios, and documentation with clients or colleagues.

---

## 📊 Summary Comparison

| Feature | Category | Effort | Impact | Recommended Priority |
| :--- | :--- | :--- | :--- | :--- |
| **Backlinks & Mentions Panel** | Polish | Medium | 🔥 High | ⭐⭐⭐ Immediate |
| **`/` Slash Command Menu** | Polish | Medium | 🔥 High | ⭐⭐⭐ Immediate |
| **Note Version History** | Data Safety | Low-Med | 🔥 High | ⭐⭐ Next |
| **Image Lightbox** | Polish | Low | Medium | ⭐⭐ Next |
| **Infinite Canvas Mode** | Pillar Feature | High | 🚀 Massive | ⭐ Future Major Release |
| **Voice Memos & Transcribe**| AI & Productivity | Medium | 🚀 Massive | ⭐ Future Major Release |
