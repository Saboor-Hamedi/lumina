# Build Lumina Documentation & Posts Section (`/lumina`) in `luminatabula.com`

## 1. What is Lumina?

**Lumina** (`v2.3.0`, MIT License, by Saboor Hamedi) is a local-first desktop knowledge workspace that combines a Markdown editor, spatial infinite canvas, 2D/3D knowledge graph, AI copilot, and native terminal in one application.

- **Repository:** `https://github.com/Saboor-Hamedi/lumina`
- **Releases / Downloads:** `https://github.com/Saboor-Hamedi/lumina/releases/latest`
- **Contact Email:** `saboorhamedi49@gmail.com`
- **Platforms:** Windows (`.exe` / `.msi`), macOS Universal Apple Silicon + Intel (`.dmg`), Linux (`.deb` / `.AppImage`)
- **Tech Stack:**
  - **Desktop Runtime:** Tauri 2.0 + Rust (`src-tauri`) using native OS WebViews (WebView2 on Windows, WebKit on macOS/Linux)
  - **Native Core:** `crates/lumina_core` (Rust + Rayon multithreaded disk scanner, sub-millisecond fuzzy search, knowledge graph builder)
  - **Frontend:** React 19, TypeScript, Vite 7, Zustand, Tailwind CSS, CodeMirror 6, xterm.js (`portable-pty` / ConPTY), `react-force-graph-2d`, `react-force-graph-3d` (Three.js), Mermaid, KaTeX, `@xenova/transformers` (local embeddings), Dexie (IndexedDB)
- **Storage Model:** 100% local-first plain-text `.md` notes (with YAML frontmatter preserving `createdAt`) and `.canvas` JSON files stored directly on the user's disk. Zero proprietary cloud lock-in and no tracking servers.

---

## 2. Core Features of Lumina

Document every feature below accurately in the **Features** documentation:

1. **Local-First Markdown Editor (CodeMirror 6)**
   - Plain-text `.md` files with YAML frontmatter, wikilinks (`[[note]]`), backlinks, tags, slash commands (`/`), tables, LaTeX math (KaTeX), Mermaid diagrams, syntax-highlighted code blocks, and voice input.
   - Multi-pane split views (horizontal `Ctrl + \`, vertical `Ctrl + Alt + \`) with drag-and-drop tabs and persistent layouts.
   - Zen Mode (`Ctrl + .`) hides toolbars and chrome while keeping running terminal sessions alive.
   - Preserves original note creation timestamp (`createdAt`) independently of edits.

2. **Spatial Infinite Canvas (`.canvas`)**
   - Freeform 2D whiteboard saved as `.canvas` JSON files.
   - Supports cards, frameless resizable text labels, shapes, magnetic connection ports, orthogonal edge routing, snap-to-grid toggle, zoom/pan viewport, and templates.

3. **2D & 3D Knowledge Graph**
   - Interactive force-directed 2D Canvas and 3D WebGL (`Three.js`) graph views built from wikilinks and note relationships, with cluster physics and persistent node positions.

4. **AI Copilot & Local Semantic Memory**
   - Works offline with **Ollama** and local on-device embeddings (`@xenova/transformers`), or with cloud providers (**DeepSeek**, **OpenAI**, **Claude**).
   - 3 focused modes: *Planning & Strategy*, *Execution & Action*, and *Research & Analysis*.
   - Inline AI editing (`Ctrl + K`), Global Spotlight (`Ctrl + Space`), and safety controls including inline **Approve / Reject** diff cards and **multi-file Undo**.

5. **Integrated Native Terminal (`Ctrl + J`)**
   - Real pseudoterminal powered by Rust `portable-pty` (ConPTY on Windows, PTY on macOS/Linux) and `xterm.js` with WebGL acceleration.
   - Supports PowerShell, CMD, Git Bash, Zsh, Bash, `vim`, `ssh`, `python`, interactive CLIs, `Tab` completion, `Ctrl + C`, and live resizing.

6. **Theme-Accurate Exports (50 Curated Themes)**
   - Export notes to self-contained **HTML**, **Markdown**, **Plain Text**, print-ready **PDF** (with auto-generated Table of Contents), **Word (`.doc`)**, or **ZIP** archives across 50 themes.

7. **Workspace Tools**
   - **Global Spotlight (`Ctrl + Space`)** & **Command Palette (`Ctrl + P`)** for instant fuzzy search and commands.
   - **Calendar & Daily Notes**, **Templates**, **Media / Image Viewer**, **Inspector / Outline / Metadata**, **Breadcrumbs**, and **Roadmap** views.

8. **Optional Google Integrations (OAuth 2.0 Loopback)**
   - **Google Drive Backup:** Push a single note, bulk folder mirror, or compressed ZIP workspace backup directly to Google Drive.
   - **Gmail Integration:** Read, organize, and send emails directly inside Lumina at the user's explicit direction.
   - Direct local HTTPS calls to Google APIs; no intermediate Lumina backend server ever sees user data.

---

## 3. Keyboard Shortcuts Reference

Include this reference table in the documentation:

| Shortcut | Action |
| --- | --- |
| `Ctrl + Space` | Global Spotlight (Search notes & AI command palette) |
| `Ctrl + P` | Quick note & command search palette |
| `Ctrl + N` | Create new note |
| `Ctrl + J` | Toggle integrated ConPTY / PTY terminal |
| `Ctrl + .` | Toggle Zen Mode |
| `Ctrl + B` | Toggle Left Sidebar |
| `Ctrl + \` | Split editor right |
| `Ctrl + Alt + \` | Split editor down |
| `Ctrl + K` | Inline AI edit / prompt inside editor |
| `F2` / `Ctrl + R` | Rename active note or folder |
| `Ctrl + W` | Close active tab |
| `Double-click Tab` | Rename note from tab bar |

---

## 4. What to Build in `luminatabula.com`

### A. Main Site Header Change (Minimal)
- Add **only one navigation link** in the `luminatabula.com` top header: **`Lumina`** (linking to `/lumina`).
- Do **not** alter existing `luminatabula.com` data analysis pages, posts, or Supabase tables.

### B. Dedicated Laravel-Style Documentation Architecture (`/lumina`)
Create a `docs/` (or `lumina-docs/`) module inside the `luminatabula.com` project that renders a full **Laravel-style documentation experience** under `/lumina`:

- **Dedicated Layout Shell (when on `/lumina/*`):**
  - **Top Docs Bar:** Lumina brand mark + version badge (`v2.3.0`), quick docs search input, GitHub link, Download button, and a subtle link back to `luminatabula.com`.
  - **Left Collapsible Sidebar (grouped navigation, Laravel-style):**
    - **Prologue**
      - Overview (`/lumina`)
      - Download & Installation (`/lumina/installation`)
      - Release Updates & Posts (`/lumina/posts`)
    - **Features** (`/lumina/features` + anchored or sub-pages)
      - Markdown Editor & Split Panes
      - Infinite Canvas (`.canvas`)
      - 2D & 3D Knowledge Graph
      - AI Copilot & Local Models
      - Integrated Terminal (ConPTY/PTY)
      - Exports & 50 Themes
      - Google Drive & Gmail Sync
    - **Reference**
      - Keyboard Shortcuts (`/lumina/shortcuts`)
      - Architecture & Tech Stack (`/lumina/architecture`)
      - Build from Source (`/lumina/build`)
    - **Legal** *(Required for Google Cloud Console OAuth Verification)*
      - Privacy Policy (`/lumina/privacy`)
      - Terms of Service (`/lumina/terms`)
  - **Main Content Area:** Clean typography, callout boxes (info/warning/tip), copyable code blocks, feature cards, and **Previous / Next page navigation** at the bottom of every doc page.
  - **Right "On This Page" Table of Contents:** Auto-highlighted heading links (`h2`/`h3`) for the active doc page.
  - **Mobile Responsive:** Collapsible drawer for the sidebar on smaller screens.

### C. Lumina Updates / Posts Form (Connected to Existing Supabase)
- Inside `/lumina/posts` (and an admin/create route such as `/lumina/posts/new` or gated behind the existing Supabase auth used in `luminatabula.com`), create a **form to publish posts/articles/changelogs about Lumina**.
- Form fields:
  - `title` (string, required)
  - `slug` (auto-generated from title, editable)
  - `category` (`Release`, `Guide`, `Feature`, `Announcement`)
  - `version` (optional, e.g. `2.3.0`)
  - `summary` (short excerpt)
  - `content` (Markdown body with live preview)
  - `published` (boolean toggle)
- Reuse `luminatabula.com`'s existing Supabase client. Store Lumina posts either in a dedicated `lumina_posts` table (provide the SQL migration) or tag them cleanly so they never mix with data-analysis posts.
- Display published Lumina posts at `/lumina/posts` and individual post pages at `/lumina/posts/[slug]`.

---

## 5. Required Legal Pages (Google Cloud Console OAuth Compliance)

Google Cloud Console OAuth verification requires publicly accessible, clean URLs on `luminatabula.com`:
- **App Home Page:** `https://luminatabula.com/lumina`
- **Privacy Policy:** `https://luminatabula.com/lumina/privacy`
- **Terms of Service:** `https://luminatabula.com/lumina/terms`

### Privacy Policy (`/lumina/privacy`) — Required Content
Must include all of the following sections verbatim in substance:
1. **Overview:** Lumina is a local-first desktop application developed by Saboor Hamedi.
2. **Local Storage First:** All notes, vaults, canvases, tags, and snippets are stored directly on the user's personal computer. Lumina does not operate proprietary tracking servers or centralized databases storing personal notes.
3. **Google User Data & Limited Use Disclosure:**
   - Optional Google Account connection for **Google Drive** (storing vault backups directly in the user's Google Drive) and **Gmail** (reading, organizing, and sending emails directly from the Lumina desktop interface at the user's explicit direction).
   - Prominent callout box stating:
     > **Google API Services User Data Policy Compliance:** Lumina's use and transfer of information received from Google APIs to any other app will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.
4. **How Google Data is Handled:**
   - **No Third-Party Sharing:** Never sold, rented, or transferred to third parties, advertisers, or data brokers.
   - **No Human Access:** No person or developer has access to private emails or Drive files. All API calls happen locally on the user's machine over HTTPS directly to Google's official endpoints.
   - **Secure Local Token Storage:** OAuth tokens are stored securely on the local device and only refreshed directly with Google's OAuth 2.0 servers.
5. **Data Deletion & Revoking Access:** Users can revoke access at any time by logging out inside Lumina Settings or removing Lumina at `https://myaccount.google.com/permissions`.
6. **Contact:** `saboorhamedi49@gmail.com` and `https://github.com/Saboor-Hamedi/lumina`.

### Terms of Service (`/lumina/terms`) — Required Content
Must include:
1. **Acceptance of Terms** (downloading, installing, or using Lumina).
2. **Description of Service** (local-first desktop app for Markdown notes, spatial canvas, knowledge graph, AI assistance, terminal, and optional cloud backup/email integrations).
3. **User Responsibilities** (confidentiality of notes, API keys, encryption keys, and OAuth tokens; lawful use only).
4. **Third-Party Integrations** (Google Drive, Gmail, and user-configured AI providers are subject to their respective terms and privacy policies).
5. **Disclaimer of Warranties** ("AS IS" and "AS AVAILABLE", no express or implied warranties).
6. **Limitation of Liability** (authors/copyright holders not liable for claims or damages arising from software use).
7. **Contact Information:** `saboorhamedi49@gmail.com` and `https://github.com/Saboor-Hamedi/lumina`.

---

## 6. Deliverables Checklist

- [ ] Single `Lumina` nav link added to `luminatabula.com` header → `/lumina`.
- [ ] Dedicated `docs/` folder structure inside `luminatabula.com` for all Lumina documentation pages and components.
- [ ] Laravel-style documentation layout with collapsible left sidebar, right "On This Page" TOC, search, code blocks with copy button, callouts, and prev/next footer navigation.
- [ ] Complete **Features** section covering all 8 feature areas + Download/Install + Shortcuts + Architecture + Build from Source.
- [ ] Public **Privacy Policy** (`/lumina/privacy`) and **Terms of Service** (`/lumina/terms`) pages ready for Google Cloud Console OAuth verification.
- [ ] **Lumina Posts / Updates** list + creation form wired to existing Supabase with SQL schema for `lumina_posts`.
- [ ] Zero regressions to existing `luminatabula.com` data analysis pages and posts.
