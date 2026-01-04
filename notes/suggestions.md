# Lumina Engineering Suggestions & Standards

These suggestions draw inspiration from industry leaders (Google, Facebook) and productivity benchmarks (Obsidian) to ensure Lumina remains a high-performance, professional-grade application.

## ✅ 1. List Virtualization (Google/FB Standard) - **IMPLEMENTED**

**Idea:** For notebooks with thousands of notes, use `react-window` or `react-virtuoso` in the File Explorer.

**Why:** Google (Gmail/Drive) and Facebook (Feed) never render more items than what is visible in the viewport. This prevents DOM bloat and keeps the UI responsive even with 10,000+ notes.

**Implementation:** Custom `VirtualList` component in `FileExplorer.jsx` with `AutoSizer` for dynamic height. Only renders ~20 visible rows regardless of vault size.

---

## ✅ 2. Atomic State Management (FB Standard) - **IMPLEMENTED**

**Idea:** Transition from prop-drilling to an atomic state library like `Zustand` or `Recoil`.

**Why:** Facebook pioneered atomic updates to prevent the entire page from re-rendering when a single character is typed. This ensures the Markdown editor stays at 60fps.

**Implementation:** Using `Zustand 5.0.9` with three atomic stores: `useVaultStore` (snippets, selection), `useSettingsStore` (preferences, theme), and `useAIStore` (embeddings, semantic search). Zero prop drilling.

---

## ✅ 3. Skeleton Shimmer Loading (Google Standard) - **IMPLEMENTED**

**Idea:** Replace "Loading..." text with animated layout skeletons during vault indexing or search.

**Why:** Google uses skeletons to increase "perceived performance." It gives users an immediate sense of the content structure before the data finishes loading.

**Implementation:** Skeleton loaders in `FileExplorer.jsx` and `AppShell.jsx` with CSS shimmer animations. Shows structure before data loads.

---

## ✅ 4. Layered Z-Index Architecture (Material Design Standard) - **IMPLEMENTED**

**Idea:** Implement a strict layering system (Base: 0, Sidebar: 100, Header: 200, Modals: 1000, Toasts: 2000).

**Why:** Google's Material Design uses "elevation" to manage focus. A clear layering system prevents UI bugs where search results appear under sidebars or modals overlap incorrectly.

**Implementation:** Strict z-index hierarchy in CSS: Base (0), Sidebar (100), TitleBar (200), Modals (1000), Toasts (2000), CodeMirror tooltips (9999).

---

## ✅ 5. Command Palette First Workflow (Obsidian Standard) - **IMPLEMENTED**

**Idea:** Implement a global `Ctrl+P` command palette using a fuzzy search algorithm (like `fuse.js`).

**Why:** High-end writing tools (Obsidian, VS Code) prioritize keyboard-only workflows. It allows users to jump to any note or execute any command without touching the mouse.

**Implementation:** `CommandPalette.jsx` with `Ctrl/Cmd+P` trigger, fuzzy search across all snippets, keyboard navigation, and quick note switching.

---

## ✅ 6. Web Workers for Markdown Parsing (Performance) - **IMPLEMENTED**

**Idea:** Offload `marked.parse` and search indexing to a background Web Worker.

**Why:** JavaScript is single-threaded. By moving heavy text processing off the main thread, the UI remains silky smooth even when rendering massive 50,000-word markdown documents.

**Implementation:** `markdown.worker.js` and `ai.worker.js` in `core/workers/` and `core/ai/` handle markdown parsing and AI embeddings off the main thread. Preview rendering is non-blocking.

---

## ✅ 7. Zero-Shift Layouts (Performance Standard) - **IMPLEMENTED**

**Idea:** Always reserve height/width for icons and sidebars using CSS Grid before they load.

**Why:** Modern standards (Google Search Console's "Core Web Vitals") penalize "Cumulative Layout Shift" (CLS). Reserving space prevents the editor from "jumping" when the sidebar content appears.

**Implementation:** CSS Grid layout in `AppShell.css` with fixed dimensions. Skeleton loaders maintain exact dimensions of final content. Zero layout shift on load.

---

## ✅ 8. Local-First & Multi-Vault Support (Obsidian Standard) - **IMPLEMENTED**

**Idea:** Decouple the application logic from the file system, allowing users to switch between multiple root folders (Vaults).

**Why:** This is Obsidian's core strength. It ensures privacy and allows users to organize distinct areas of life (Work, Personal) into separate physical directories.

**Implementation:** `VaultManager.js` with vault switching via `vault:select-folder` IPC. Settings modal includes "Change Location" button. Supports multiple vault directories with automatic asset folder management.

---

## ✅ 9. Atomic Design Component Library (Engineering Standard) - **IMPLEMENTED**

**Idea:** Break the UI into Atoms (Buttons), Molecules (Search Bar), Organisms (Ribbon), and Templates (AppShell).

**Why:** This standard ensures that changing a button's padding in one place updates it across the entire app, maintaining a "robust" and consistent look like professional Google Workspace apps.

**Implementation:** Component hierarchy: Atoms (`Button.jsx`), Utils (`VirtualList`, `AutoSizer`), Features (modular feature components), Layout (`AppShell`, `TitleBar`).

---

## ✅ 10. IndexedDB for Metadata Caching (Performance) - **IMPLEMENTED**

**Idea:** Cache note metadata (tags, backlinks, titles) in a browser database (`IndexedDB`).

**Why:** Scanning the physical file system is slow. Caching the structure in a local DB allows for near-instant search and tab switching, keeping the vault feeling "lightweight."

**Implementation:** `Dexie 4.2.1` in `core/db/cache.js`. Caches snippet metadata (id, title, timestamp). Instant startup (<100ms) with background filesystem sync.

---

## ✅ 11. Tag Intelligence System (Tag Standard) - **IMPLEMENTED**

**Idea:** Replace simple text input with a robust tagging engine featuring pills, improved UX, and autocomplete.

**Why:** Proper categorization is key to knowledge management. Users expect tags to be visual objects (pills) they can interact with, not just comma-separated text.

**Implementation:** Tag system integrated with metadata editor, global tag autocomplete based on vault contents, tag-based graph connections.

---

## ✅ 12. Interactive Breadcrumbs (Navigation Standard) - **IMPLEMENTED**

**Idea:** Interactive path navigation in the header, allowing users to trace back their location.

**Why:** Essential for deep folder hierarchies. Google Drive and OS file explorers all use clickable breadcrumbs to improve navigability.

**Implementation:** Dynamic breadcrumb bar in `EditorTitleBar` component. File type icons, metadata display, and smooth hover effects.

---

## ✅ 13. Production-Ready Documentation (Docs Standard) - **IMPLEMENTED**

**Idea:** Ensure all documentation is free of lint errors and follows professional technical writing guidelines.

**Why:** "Documentation is code." Broken links, bad formatting, or inconsistent styles erode trust. A robust app must have robust docs.

**Implementation:** Comprehensive `notes/doc.md` with full technical documentation. Standardized structure for screen readers and parsers.

---

## ✅ 14. Knowledge Graph Visualization (Obsidian Standard) - **IMPLEMENTED**

**Idea:** Implement an interactive force-directed graph showing connections between notes via WikiLinks and tags.

**Why:** Visual representation of knowledge connections helps users discover relationships and navigate complex information networks. Obsidian's graph view is one of its most beloved features.

**Implementation:** `GraphView.jsx` using `react-force-graph-2d`. Features include:

- WikiLink-based connections between notes
- Tag-based grouping and connections
- Ghost nodes for non-existent linked notes
- Interactive hover highlighting of neighbors
- Semantic similarity links (AI-powered)
- Responsive canvas with zoom/pan controls
- Click-to-navigate functionality

---

## ✅ 15. AI-Powered Semantic Search (Next-Gen Standard) - **IMPLEMENTED**

**Idea:** Use local transformer models to generate embeddings and enable semantic search beyond keyword matching.

**Why:** Traditional search fails when users can't remember exact keywords. Semantic search understands meaning, finding "machine learning algorithms" when searching for "AI techniques."

**Implementation:** `useAIStore.js` with `@xenova/transformers` running in Web Worker:

- Local embedding generation (no cloud dependency)
- Cosine similarity-based search
- Automatic vault indexing on load
- Semantic link detection for graph view
- Privacy-first (all processing on-device)
- Progress tracking for model loading

---

## ✅ 16. Drag & Drop Image Support (UX Standard) - **IMPLEMENTED**

**Idea:** Allow users to drag images directly into the editor, automatically saving them to the vault and inserting markdown.

**Why:** Modern editors (Notion, Typora) make media insertion effortless. Requiring manual file management breaks creative flow.

**Implementation:**

- Drop handler in `MarkdownEditor.jsx`
- Automatic image saving to `vault/assets/` folder
- Slugified filenames with timestamps to prevent collisions
- Markdown insertion at drop position: `![filename](assets/image.png)`
- Custom `asset://` protocol for secure local file access
- Image hover preview with `imageHoverPreview.js`

---

## ✅ 17. PDF & HTML Export (Publishing Standard) - **IMPLEMENTED**

**Idea:** Enable one-click export of notes to professional PDF and HTML formats with proper styling.

**Why:** Knowledge is meant to be shared. Users need to export notes for presentations, documentation, or archival without manual conversion.

**Implementation:**

- Export menu in `EditorTitleBar.jsx`
- HTML export with embedded CSS styling
- PDF export using Electron's `printToPDF` API
- Preserves markdown formatting (headers, code blocks, images)
- Custom export templates with professional typography
- File save dialogs with proper default names

---

## ✅ 18. Live Preview with Reading Mode (Typora Standard) - **IMPLEMENTED**

**Idea:** Provide three editor modes: Source (raw markdown), Live (WYSIWYG with syntax on cursor), and Reading (pure preview).

**Why:** Different tasks require different views. Writing needs syntax visibility, reviewing needs clean reading, debugging needs raw source.

**Implementation:** `richMarkdown.js` with intelligent syntax hiding:

- **Source Mode**: Full markdown syntax visible, line numbers enabled
- **Live Mode**: Syntax hidden except on active line, fully editable
- **Reading Mode**: All syntax hidden, read-only, distraction-free
- Smooth transitions between modes via footer toggle
- Cursor-aware syntax revelation
- Sorted decorations to prevent crashes

---

## ✅ 19. Caret Position Persistence (FB Standard #11) - **IMPLEMENTED**

**Idea:** Remember exact cursor position and selection for each note, restoring it when reopening.

**Why:** Context switching is expensive. Losing your place when switching notes breaks concentration and wastes time.

**Implementation:**

- Selection tracking in `EditorView.updateListener`
- Debounced persistence to IndexedDB cache (1s delay)
- Automatic restoration on note open with viewport safety
- Handles edge cases (document length changes, invalid positions)
- Syncs with vault store for consistency

---

## ✅ 20. Custom Protocol Handler (Security Standard) - **IMPLEMENTED**

**Idea:** Implement a secure `asset://` protocol for loading local images without exposing file system paths.

**Why:** Direct file:// URLs expose system paths and can be security risks. Custom protocols provide sandboxed, vault-scoped access.

**Implementation:**

- `asset://` protocol registered in main process
- Scoped to vault directory only
- URL decoding for special characters and spaces
- Proper MIME type handling
- CORS and CSP bypass for local assets
- Fallback error handling for missing files

---

## 🔮 21. Retrieval-Augmented Generation (RAG) (User Request) - **PLANNED**

**Idea:** Transform the AI assistant from a "single-note aware" helper into a "full-vault expert."

**Why:** A "Second Brain" needs to connect dots across thousands of files. When a user asks "How does authentication work?", the AI should not just look at the open file but retrieve relevant context from `auth.js`, `login.md`, and `server.js` automatically.

**Implementation Plan:**

- **Vector Database**: Utilize the existing local embeddings (via `useAIStore`) to create a searchable vector index of the entire vault.
- **Context Retrieval**: When a query is sent:
  1. Generate embedding for the question.
  2. Retrieve top-k semantically similar chunks from the *entire* vault.
  3. Inject these snippets into the LLM system prompt as context.
- **Privacy-First**: Keep all RAG operations local or ensuring only relevant snippets are sent to API endpoints (like DeepSeek) with user consent.

## Summary

**All 20 engineering standards have been successfully implemented!** 🎉

Lumina now features:

### **Performance & Architecture**

- ✅ Enterprise-grade performance (10,000+ notes)
- ✅ Zero-jump startup with IndexedDB caching
- ✅ Atomic state management with Zustand (3 stores)
- ✅ Web Worker-based markdown & AI processing
- ✅ Zero layout shift architecture
- ✅ Strict z-index layering system

### **User Experience**

- ✅ Professional UI with skeleton loaders
- ✅ Keyboard-first workflow with command palette
- ✅ Three editor modes (Source/Live/Reading)
- ✅ Drag & drop image support
- ✅ Caret position persistence
- ✅ Interactive navigation breadcrumbs

### **Knowledge Management**

- ✅ Multi-vault support for privacy
- ✅ WikiLink system with autocomplete & hover preview
- ✅ Knowledge graph visualization
- ✅ AI-powered semantic search
- ✅ Tag intelligence & autocomplete
- ✅ PDF & HTML export

### **Code Quality**

- ✅ Atomic design component library
- ✅ Comprehensive technical documentation
- ✅ Secure custom protocol handler
- ✅ Robust error handling & recovery
