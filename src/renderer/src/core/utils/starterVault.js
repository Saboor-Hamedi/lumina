export const STARTER_NOTES = [
  {
    id: 'starter-welcome',
    title: 'Welcome to Lumina',
    fileName: 'Welcome to Lumina.md',
    language: 'markdown',
    tags: 'welcome, guide, getting-started',
    folderId: '',
    code: `---
id: starter-welcome
title: Welcome to Lumina
tags: [welcome, guide, getting-started]
created: 2026-09-03
---

# ✨ Welcome to Lumina

**Lumina** is a lightning-fast, local-first workspace designed for thinking, researching, and writing. Everything you create is stored as pure Markdown on your local machine with zero vendor lock-in.

---

## 🧭 Explore the Interactive Guides

Discover everything Lumina can do with these interactive starter notes:

- 📝 [[Markdown & Formatting]] — Typography, callouts, task lists, code blocks, and tables.
- 📐 [[Math & Formulas]] — Real-time KaTeX mathematical notation and equations.
- 📊 [[Diagrams & Visuals]] — Render live flowcharts, sequence diagrams, and mindmaps with Mermaid.
- 🕸️ [[Graph & Wikilinks]] — Explore how interconnected thoughts form a 2D & 3D Knowledge Graph.

---

## ⚡ Essential Keyboard Shortcuts

| Action | Windows / Linux | macOS |
| :--- | :--- | :--- |
| **Quick Search / Command Palette** | <kbd>Ctrl</kbd> + <kbd>P</kbd> | <kbd>⌘</kbd> + <kbd>P</kbd> |
| **Create New Note** | <kbd>Ctrl</kbd> + <kbd>N</kbd> | <kbd>⌘</kbd> + <kbd>N</kbd> |
| **Toggle Knowledge Graph** | <kbd>Ctrl</kbd> + <kbd>G</kbd> | <kbd>⌘</kbd> + <kbd>G</kbd> |
| **Toggle Left Sidebar** | <kbd>Ctrl</kbd> + <kbd>B</kbd> | <kbd>⌘</kbd> + <kbd>B</kbd> |
| **Open AI Assistant** | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>\\</kbd> | <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>\\</kbd> |
| **Open Preferences / Settings** | <kbd>Ctrl</kbd> + <kbd>,</kbd> | <kbd>⌘</kbd> + <kbd>,</kbd> |

---

## 🚀 Quick Start Checklist

- [x] Installed and launched Lumina
- [ ] Try creating your first note with <kbd>Ctrl</kbd> + <kbd>N</kbd>
- [ ] Connect two notes using \`[[Wikilinks]]\` syntax
- [ ] Open the **3D Interactive Graph** to see your thoughts connect
- [ ] Customize your visual theme in **Settings** (<kbd>Ctrl</kbd> + <kbd>,</kbd>)
`
  },
  {
    id: 'starter-markdown',
    title: 'Markdown & Formatting',
    fileName: 'Markdown & Formatting.md',
    language: 'markdown',
    tags: 'formatting, syntax, code',
    folderId: '',
    code: `---
id: starter-markdown
title: Markdown & Formatting
tags: [formatting, syntax, code]
---

# 📝 Markdown & Rich Typography

Lumina provides a polished, distraction-free editing canvas powered by CodeMirror 6 with live syntax highlighting and instant preview.

---

## 🎨 Callouts & Admonitions

> [!NOTE]
> Useful background context, helpful insights, or general advice.

> [!TIP]
> Pro-tip: Type \`[[\` anywhere in the editor to trigger autocomplete for existing notes!

> [!IMPORTANT]
> All notes are saved automatically in real-time directly to your vault folder on disk.

> [!WARNING]
> Renaming a note will automatically update all incoming [[Wikilinks]] across your entire vault.

---

## 💻 Syntax-Highlighted Code Blocks

\`\`\`typescript
interface NoteItem {
  id: string
  title: string
  tags: string[]
  content: string
  updatedAt: Date
}

function computeWordCount(text: string): number {
  return text.trim().split(/\\s+/).filter(Boolean).length
}
\`\`\`

\`\`\`python
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
\`\`\`

---

## 📊 Formatted Tables

| Feature | Local-First | Cloud Sync | AI Augmented |
| :--- | :---: | :---: | :---: |
| **Plaintext Markdown** | ✅ | ✅ (Optional) | ✅ |
| **Interactive Graph** | ✅ | ✅ | ✅ |
| **KaTeX Math Engine** | ✅ | ✅ | ✅ |
| **Mermaid Renderers** | ✅ | ✅ | ✅ |

---

## 🔗 Related Notes
- Return to [[Welcome to Lumina]]
- Try math equations in [[Math & Formulas]]
- View graphics in [[Diagrams & Visuals]]
`
  },
  {
    id: 'starter-math',
    title: 'Math & Formulas',
    fileName: 'Math & Formulas.md',
    language: 'markdown',
    tags: 'math, katex, formulas',
    folderId: '',
    code: `---
id: starter-math
title: Math & Formulas
tags: [math, katex, formulas]
---

# 📐 Mathematical Notation with KaTeX

Lumina renders LaTeX formulas instantly using **KaTeX**, making it ideal for scientific, engineering, and mathematical writing.

---

## ✨ Inline Equations

Use single dollar signs \`$...$\` to embed formulas directly within your text:

* **Mass-Energy Equivalence:** $E = mc^2$
* **Standard Deviation:** $\\sigma = \\sqrt{\\frac{1}{N} \\sum_{i=1}^N (x_i - \\mu)^2}$
* **The Golden Ratio:** $\\phi = \\frac{1 + \\sqrt{5}}{2} \\approx 1.618033$

---

## 🌌 Display Block Formulas

Wrap expressions in double dollar signs \`$$...$$\` to create centered, standalone equations:

### Euler's Identity
$$e^{i\\pi} + 1 = 0$$

### The Gaussian Integral
$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

### Maxwell's Equations (Differential Form)
$$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$$

$$\\nabla \\cdot \\mathbf{B} = 0$$

$$\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}$$

$$\\nabla \\times \\mathbf{B} = \\mu_0 \\left(\\mathbf{J} + \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}\\right)$$

---

## 🔗 Explore Further
* Return to [[Welcome to Lumina]]
* See how to create visuals in [[Diagrams & Visuals]]
* Connect your knowledge in [[Graph & Wikilinks]]
`
  },
  {
    id: 'starter-diagrams',
    title: 'Diagrams & Visuals',
    fileName: 'Diagrams & Visuals.md',
    language: 'markdown',
    tags: 'diagrams, mermaid, charts',
    folderId: '',
    code: `---
id: starter-diagrams
title: Diagrams & Visuals
tags: [diagrams, mermaid, charts]
---

# 📊 Interactive Mermaid Diagrams

Render diagrams directly from clean text definitions. Lumina automatically renders them with responsive theme-aware colors.

---

## 🔄 Architecture Flowchart

\`\`\`mermaid
graph TD
    User([User Writing Note]) -->|Input| CM6[CodeMirror 6 Canvas]
    CM6 -->|Parse| AST[Markdown AST & Tokens]
    AST -->|Extract| Links[Wikilink Extractor]
    Links -->|Update| Graph[2D / 3D Knowledge Graph]
    CM6 -->|Debounced Save| Disk[(Local Disk Storage)]
    Disk -->|SQLite FTS5| Search[Instant Vector Search]
\`\`\`

---

## ⏱️ IPC Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Renderer (React)
    participant Preload as Context Bridge
    participant Main as Electron Main
    participant Disk as File System

    User->>UI: Type note content
    UI->>Preload: window.api.saveSnippet()
    Preload->>Main: IPC 'vault:saveSnippet'
    Main->>Disk: Atomic write to .md file
    Disk-->>Main: Write acknowledged
    Main-->>UI: Broadcast 'vault:updated'
    UI-->>User: Visual save indicator (Saved)
\`\`\`

---

## 🧠 Concept Mindmap

\`\`\`mermaid
mindmap
  root((Lumina))
    Local First
      Zero cloud dependency
      Plain Markdown files
      Privacy by default
    Visualization
      2D Physics Graph
      3D Spatial Graph
      Mermaid Diagrams
    Intelligence
      Local Vector Search
      Multi-provider LLM Chat
      Smart Citations
\`\`\`

---

## 🔗 Related Notes
- Return to [[Welcome to Lumina]]
- Connect ideas in [[Graph & Wikilinks]]
- Review formatting in [[Markdown & Formatting]]
`
  },
  {
    id: 'starter-graph',
    title: 'Graph & Wikilinks',
    fileName: 'Graph & Wikilinks.md',
    language: 'markdown',
    tags: 'graph, wikilinks, zettelkasten',
    folderId: '',
    code: `---
id: starter-graph
title: Graph & Wikilinks
tags: [graph, wikilinks, zettelkasten]
---

# 🕸️ Bi-Directional Linking & Knowledge Graph

Lumina transforms your notes into an associative, interconnected web of thoughts (Zettelkasten).

---

## 🔗 How Wikilinks Work

Whenever you want to reference another note, simply type \`[[\` and choose the target note from autocomplete:

- Link to [[Welcome to Lumina]]
- Link to [[Markdown & Formatting]]
- Link to [[Math & Formulas]]
- Link to [[Diagrams & Visuals]]

### Automatic Backlink Indexing
When Note A links to Note B, Note B automatically indexes Note A in its **Backlinks & References** panel.

---

## 🌌 Exploring the Graph View

1. Press <kbd>Ctrl</kbd> + <kbd>G</kbd> (or click **Graph** in the top navigation bar).
2. Switch between **2D Force Simulation** and **3D Orbital View**.
3. Hover over nodes to highlight connected clusters, filter by tag, or adjust link distance and gravitational forces.

---

## 💡 Best Practices for Note Taking

1. **Atomic Notes**: Keep individual notes focused on one core idea or topic.
2. **Dense Linking**: Connect related concepts liberally with \`[[Wikilinks]]\`.
3. **Emergent Clusters**: Let topics and tags organize themselves organically in the graph.
`
  }
]

export async function populateStarterVault(saveSnippet) {
  if (typeof saveSnippet !== 'function') return []

  const createdSnippets = []
  for (const note of STARTER_NOTES) {
    const saved = await saveSnippet({
      id: note.id,
      title: note.title,
      fileName: note.fileName,
      code: note.code,
      language: note.language,
      tags: note.tags,
      folderId: note.folderId,
      timestamp: Date.now()
    })
    createdSnippets.push(saved || note)
  }
  return createdSnippets
}
