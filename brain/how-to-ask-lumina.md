# How to Ask Lumina

Great answers start with clear prompts. This guide teaches **both you and Lumina** how to communicate clearly so you get accurate notes, cited PDF answers, clean `.canvas` diagrams, and fast workspace actions on the very first try.

---

## The 4-Part Lumina Prompt Formula

Whenever you want a high-precision result, combine these four building blocks:

```text
[Context] + [Action / Goal] + [Output Format] + [Constraints]
```

- **Context** — Point Lumina to exact sources using `@note`, `@folder`, or `@document.pdf`.
- **Action / Goal** — State clearly what you want: *summarize, compare, critique, scaffold, search, diagram, refactor*.
- **Output Format** — Specify where and how the result should appear: *chat table, new Markdown note, interactive `.canvas` diagram, Mermaid diagram, flashcards*.
- **Constraints** — Set boundaries: *keep it under 200 words, cite page numbers, group into 3 layers, don't create new folders*.

---

## Before & After: Prompt Makeovers

| Instead of a Vague Prompt… | Try a High-Signal Lumina Prompt |
| :--- | :--- |
| *"Summarize my PDF"* | *"Summarize `@attention.pdf` in 5 bullet points with `[p. X]` citations, focusing on the scaling results in Table 3."* |
| *"Make a diagram of auth"* | *"Create an `architecture` canvas diagram called **Auth Flow** (`LR` direction) showing Browser, API Gateway, OAuth Service, and Token DB, grouped into Client and Backend."* |
| *"Help with my notes"* | *"Compare `@Lecture 3` and `@Lecture 4`, list 3 contradictions or gaps, and save the review as a new note in `Study/`."* |
| *"Search RAG"* | *"Search the web for the latest hybrid RAG best practices (BM25 + embeddings + RRF) and give me a summary with clickable source links."* |
| *"Organize my files"* | *"Query my workspace index for all notes tagged `#draft` with 0 backlinks, and show them in a table."* |

---

## 1. Grounding Prompts with `@mentions`

Lumina reads `@`-mentioned targets with highest priority so it never guesses:

- **`@Note Title`** — Injects the full note content directly into Lumina's focus.
- **`@Folder`** — Automatically expands every note inside that folder (and its subfolders).
- **`@Document.pdf`** — Runs hybrid search over the PDF and pulls the top relevant pages with exact page numbers.
- **Drag & Drop to Composer** — Drag any note, folder, or PDF from the Explorer straight into the AI composer to attach it instantly.
- **Active Tab Shortcut** — If a note or PDF is already open on screen, you can simply ask *"Explain section 2 of this document"* without re-mentioning it.

---

## 2. Prompting for PDF Research & Citations

Lumina's PDF index understands **both exact terms and conceptual questions**:

- **Exact Lookups** (tables, equations, definitions):
  > *"What does `@thesis.pdf` report in Table 2 and Equation 4? Cite exact page numbers."*
- **Conceptual Synthesis**:
  > *"Explain how `@paper.pdf` prevents overfitting, in plain English, and link each claim to `[p. X]`."*
- **PDF + Personal Notes Comparison**:
  > *"Compare `@paper.pdf` against my `@Research Notes`. What claims in my notes are supported, and what is missing?"*
- **Multi-PDF Search**:
  > *"Search across all PDFs in my workspace for benchmark latency numbers and build a comparison table."*

---

## 3. Prompting for Native `.canvas` Diagrams

When you want an interactive, editable visual diagram on Lumina Canvas (not just a static chat diagram), mention **canvas** plus the **layout** and **structure**:

- **System Architecture (`architecture`, `LR`)**:
  > *"Create an architecture canvas diagram titled **Lumina Sync Engine** flowing left-to-right, grouped into Local Storage, Sync Queue, and Cloud Backup."*
- **Process / Decision Flowchart (`flowchart`, `TB`)**:
  > *"Create a top-to-bottom flowchart canvas diagram for our CI/CD release pipeline including build, test decision diamond, staging, and production."*
- **Study Mindmap (`mindmap`)**:
  > *"Turn `@Neuroscience` into a mindmap canvas diagram with the core concept in the center and 6 main branches."*
- **PDF-to-Canvas Synthesis**:
  > *"Read `@paper.pdf` and create a concept-map canvas diagram showing the key modules and how data flows between them."*

> [!TIP]
> You never need to specify pixel positions or coordinates — Lumina's native Canvas compiler automatically computes non-overlapping shapes, flat group frames, and smart-routed arrows.

---

## 4. Choosing the Right AI Mode

- **Planning & Strategy (Chat Mode)** — Best for brainstorming, Q&A, reviewing notes, web research, and drafting ideas in chat without modifying workspace files.
- **Execution & Action (Agent Mode)** — Best when you want Lumina to create/update notes, generate `.canvas` diagrams, organize folders, audit wikilinks, or query your workspace index directly.

---

## 5. Copy-Paste Prompt Templates

### Research Paper Breakdown
```text
Read @paper.pdf and give me:
1. Core thesis in 2 sentences
2. Methodology steps (with [p. X] citations)
3. Key quantitative results in a markdown table
4. 3 open limitations or follow-up questions
```

### Turn Notes into a Visual Canvas
```text
Based on @FolderOrNote, create a native canvas diagram titled "[Topic] Overview":
- Layout: architecture (LR)
- Group related components into clear frames
- Keep labels short (2–5 words per node) and label the connecting arrows
```

### Workspace Knowledge Audit
```text
Audit my workspace for broken wikilinks and orphan notes, then suggest 5 high-value connections between my notes.
```

### Live Web Research Brief
```text
Search the web for [topic] (focus on official docs and recent papers). Summarize the key takeaways, trade-offs, and include clickable source links.
```
