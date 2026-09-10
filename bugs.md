# Lumina: The Life & Work Cockpit Roadmap
> **Mission**: Build an all-in-one local intelligence operating system so powerful, seamless, and execution-capable that users never need to leave Lumina to do their best work.

---

## Architecture Overview

```
   ┌─────────────────────────────────────────────────────────────┐
   │                     LUMINA WORKSPACE                        │
   ├──────────────────────────────┬──────────────────────────────┤
   │                              │                              │
   │      Active Note Editor      │    Research & Web Split      │
   │     - Rich Markdown / CM6    │    - Embedded Chromium Pane  │
   │     - Interactive Code Run   │    - Real-Time AI Extraction │
   │     - Living Databases/Kanban│    - 1-Click Clipper         │
   │                              │                              │
   ├──────────────────────────────┴──────────────────────────────┤
   │                  Autonomous Command Layer                   │
   │      - Daily Briefing & Morning Kickoff                     │
   │      - External Action Automations (Email, Calendar, Tasks) │
   │      - Cross-Note Knowledge Graph & Memory Core             │
   └─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Knowledge Ingest & Web Integration (Kill Tab Hopping)
*Goal: Enable users to browse, digest, and research external documentation and web pages side-by-side with their notes without switching to an external browser.*

### 1.1 Rich Link Previews (Inline Bookmark Cards)
- **CORS-Free OpenGraph Extractor**: Electron main-process worker fetches URL metadata (`title`, `description`, `image`, `siteName`, `favicon`).
- **Notion-Style Interactive Bookmark Card**: Clean inline widget in CodeMirror 6 with thumbnail preview, truncated description, and one-click "Open in Browser" or "Copy URL".
- **Clean Markdown Portability**: Stored as standard markdown link or comment (`[bookmark](url)`) preserving 100% plain-text compatibility.

### 1.2 Smart Web Clipper (Reader-Mode Article Ingest)
- **1-Click Clip Dialog**: Quick modal or hotkey (`Ctrl+Shift+C`) to paste any web article or documentation page.
- **Distraction-Free Parsing**: Uses readability algorithms to strip ads, cookies, navigations, and popups.
- **Markdown Conversion**: Converts clean DOM directly into standard GitHub-flavored Markdown with headers, code blocks, lists, and images.
- **Frontmatter Attribution**: Automatically injects source URL, author, clipping timestamp, and tags into note frontmatter.

### 1.3 Embedded Web Split-Pane ("Browse & Digest")
- **Dual-Pane Layout**: Toggle an embedded Chromium browser pane beside the active note (`Ctrl+\`).
- **AI Co-Reading**: Lumina AI reads the active web page alongside you, extracting key bullet points, answering queries, or pasting citations directly into the open note.

---

## Phase 2: In-Note Execution Engine (Kill Terminal/VS Code Hopping)
*Goal: Turn notes from static text into live, runnable execution environments.*

### 2.1 Interactive In-Note Code Runner
- **Inline Run Buttons**: `▶ Run` button attached to CodeMirror code blocks for JavaScript/Node.js, Python, and Shell/PowerShell.
- **Sandboxed Execution**: Subprocess runner via Electron main process with timeout safeguards and cancellation controls.
- **Rich Output Cells**: Display execution output (STDOUT, STDERR, formatted JSON, tabular data, and ASCII diagrams) directly beneath the code block.

### 2.2 Data Scratchpad & Local File Manipulation
- Query local CSVs, JSON datasets, and files right inside notes.
- Format tabular outputs into live markdown tables or charts with 1 click.

---

## Phase 3: Visual Cockpit & Living Databases (Kill Notion/Trello Hopping)
*Goal: Provide visual organization and project tracking without abandoning plain Markdown files.*

### 3.1 Inline Kanban Boards
- Turn any markdown task list or tagged section into a visual drag-and-drop Kanban board (`Todo`, `In Progress`, `Done`).
- Two-way sync: Dragging a card instantly updates the markdown checkboxes/tags on disk.

### 3.2 Notion-Style Living Tables & Trackers
- Dynamic table view with sorting, filtering, and column types (Text, Number, Select, Date, Checkbox).
- Stored as flat JSON or markdown tables—100% offline and zero database lock-in.

---

## Phase 4: Autonomous Command & Personal Chief of Staff
*Goal: Connect Lumina to daily life workflows and external actions.*

### 4.1 Daily Morning Briefing & Nightly Review
- **Morning Cockpit**: Auto-generated daily dashboard greeting the user on startup:
  - High-priority unfinished tasks aggregated across all notes.
  - Recommended notes to revisit or complete.
  - Google Drive cloud backup health.
- **Nightly Review**: Quick prompt to log achievements, capture loose thoughts, and plan tomorrow.

### 4.2 Native Lumina Workflows & External Actions
- **Slash Action Commands**: Type `//calendar`, `//email`, or `//todo` inside notes.
- **Action Dispatcher**: Connects to user-configured APIs (Google Calendar, GitHub Issues, Webhooks) to execute real-world tasks straight from meeting notes.

---

## Phasing & Execution Order

| Phase | Milestone | Primary Deliverable | Status |
|---|---|---|---|
| **Phase 1A** | **Rich Link Previews** | OpenGraph metadata fetcher + inline CodeMirror bookmark card | 🚀 Next Up |
| **Phase 1B** | **Smart Web Clipper** | Article scraper + clean reader markdown generator | Planned |
| **Phase 1C** | **Web Split-Pane** | Side-by-side browser pane with AI live digest | Planned |
| **Phase 2** | **Code Runner** | In-note executable code blocks (JS, Python, Shell) | Planned |
| **Phase 3** | **Living Databases** | Markdown-backed Kanban & dynamic filtered tables | Planned |
| **Phase 4** | **Personal Cockpit** | Daily briefing dashboard & external action workflows | Planned |
