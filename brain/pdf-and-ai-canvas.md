# Smart PDFs & AI-to-Canvas Visual Thinking

Lumina turns static PDFs and complex ideas into a live, searchable, visual knowledge workspace — **100% locally, privately, and with zero setup**.

---

## 1. Smart PDF Knowledge Index

Drop any PDF into Lumina (research papers, textbooks, manuals, reports) and it becomes immediately searchable and readable by Lumina AI.

### How It Works (Automatically, Behind the Scenes)
1. **Drag & Drop or Open Any PDF** — No manual extraction, no setup, and no technical configuration required.
2. **Instant Page Indexing** — Within milliseconds, Lumina extracts text page-by-page so exact terms, equations, table numbers (e.g. `Table 3`, `Eq. 4.2`), and phrases are searchable right away.
3. **Background Semantic Understanding** — Quietly in the background, Lumina uses its built-in local offline model to understand the *meaning* of each page, storing compact vectors (~4× smaller on disk) in a private workspace index.
4. **Hybrid Search (Exact + Meaning)** — When you ask a question, Lumina combines exact keyword matching and semantic understanding so you never miss either a specific formula or a broad concept.
5. **Smart Deduplication** — Unchanged PDFs are recognized automatically and never re-indexed.

### Subtle Toolbar Status
When viewing a PDF, the floating bottom-right toolbar shows its live status:
- `Indexing…` — Extracting and preparing pages in the background.
- `✦ N pages` — Ready for instant search and `@mention` in Lumina AI.

### Using PDFs with Lumina AI
- **Direct `@mention`**: Type `@` in Lumina AI and pick any PDF (or drag a PDF from the Explorer into the chat composer).
- **Active Tab Awareness**: Simply open a PDF and ask Lumina AI *"What are the main findings in this paper?"* — Lumina automatically pulls the most relevant pages.
- **Exact Page Citations**: Lumina cites exact page numbers (such as `[p. 4]` or `[p. 14]`) so you can verify every claim immediately.
- **Cross-Document Synthesis**: Combine PDFs with your Markdown notes (e.g. *"Compare @attention.pdf with @Transformer Notes and highlight what I missed"*).

---

## 2. AI-to-Canvas Visual Thinking

Ask Lumina AI to visualize any concept, note, folder, or PDF, and it builds a **100% native, editable `.canvas` diagram** — using the exact same shapes, colors, smart wires, and typography you draw by hand.

### Why Native Canvas Diagrams Feel Effortless
- **Zero Lag**: Generated diagrams use native Lumina nodes, integer coordinates, and smart port routing — identical in performance to hand-crafted canvases.
- **Zero Overlapping Boxes**: Lumina's deterministic layout engine arranges every node with clean spacing automatically.
- **Native Visual Primitives**:
  - Frameless **Canvas Titles** (`28px` bold typography)
  - Auto-sized flat **Group Frames** enclosing related layers/subsystems
  - Semantic **Shapes** (`rounded-rectangle`, `diamond` for decisions, `cylinder` for databases, `cloud`, `server`, `pill` for start/end, `sticky` notes)
  - **Smart-Routed Arrows** (`curved` for flowcharts & mindmaps, `step` for system architectures, `dashed` for async/optional links)
- **Fully Editable**: Drag any node, recolor shapes, add sticky notes, draw freehand ink, or export to crisp PNG/SVG.

### Supported Diagram Layouts
| Layout | Best For | Default Flow |
| :--- | :--- | :--- |
| **`flowchart`** | Processes, algorithms, decision trees, user journeys | Top-to-Bottom (`TB`) |
| **`architecture`** | System design, microservices, pipelines, data flow | Left-to-Right (`LR`) |
| **`mindmap`** | Brainstorming, topic breakdowns, study maps | Radial (center-out) |
| **`concept-map`** | Connecting ideas across notes or research papers | Layered (`TB`) |
| **`timeline`** | Roadmaps, project phases, historical events | Left-to-Right (`LR`) |

### PDF-to-Canvas in One Prompt
Because Smart PDFs and AI-to-Canvas work together, you can turn dense reading into an interactive visual map in seconds:

> *"Read @paper.pdf and create an architecture canvas diagram showing its training pipeline, grouped into Data Prep, Model, and Evaluation."*

See [How to Ask Lumina](how-to-ask-lumina.md) for prompt templates and examples.
