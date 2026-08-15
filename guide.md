# Lumina — Making the App Easy for Non-Technical Users

Full guidance for implementing a user-friendly experience. Target: people with no technical background. They should be able to start using Lumina within 30 seconds and understand every feature without reading a manual.

> **Current state (verified against the project):** the "vault → workspace" rename is already done in user-facing copy (Welcome page, Settings). Internal code still uses "vault" (`vaultPath`, `loadVault`, `useVaultStore`, CSS `vault-icon`/`vault-path-display`) — that is an internal cleanup, not user-facing.
>
> **Known app bugs found during review (fix these):**
> - `Ctrl+Shift+\` opens AI chat. `Ctrl+Shift+I` is Developer Tools, NOT AI. The Welcome page's "AI Assistant" card advertises `Ctrl+Shift+I` — correct the label to `Ctrl+Shift+\`.
> - `Ctrl+B` toggles the sidebar (correct). `Ctrl+Shift+B` must be DISABLED — it currently conflicts with `Ctrl+B` and should be removed (AppShell:346-353).
> - `Ctrl+I` opens the Inspector/Details panel (correct).
> - `Ctrl+P` opens Quick Search (correct).
> - `Ctrl+O` must open a file dialog to import/grab `.md` files from the local machine — currently NOT working (it does not open). `window.api.openFile` and the `dialog:openFile` IPC handler exist but `onOpenFile` is not wired up in AppShell, so `Ctrl+O` does nothing. Fix the wiring so `Ctrl+O` opens the dialog.
> - Shortcuts shown in the app (e.g. on the Welcome page / File Explorer) must match the actual shortcuts. Ensure the correct shortcut list is displayed consistently everywhere.
> - The AI chat already has a permanent sidebar icon (SidebarHeader "AI Chat" button) — the one-click entry point already exists, keep it.
> - Settings currently has **6 tabs**: General, Appearance, Shortcuts, AI, Type, Graph (SettingsModal:168-198).

> **Canonical shortcut list (single source of truth):**
> - `Ctrl+N` — New note
> - `Ctrl+P` — Quick Search
> - `Ctrl+Shift+P` — Command Palette
> - `Ctrl+B` — Toggle sidebar
> - `Ctrl+Shift+\` — AI chat
> - `Ctrl+I` — Inspector / Details
> - `Ctrl+O` — Open/import a `.md` file (currently broken — must open the file dialog)
> - `Ctrl+G` — Knowledge Graph
> - `Ctrl+,` — Settings

The guidance below reflects the real, remaining gaps.

---

## 1. Kill the Jargon — Use Plain Language

Non-technical users are confused by technical terms. Replace them everywhere (UI copy, empty states, tooltips, settings):

| Current term | Use instead |
| --- | --- |
| RAG / Semantic Indexing / Embeddings | "Smart Search (learns as you write)" |
| Enable RAG context for current provider | "Improve answers using your notes" |
| Model ID (e.g. deepseek-chat / R1) | "Simple", "Balanced", "Creative" pickers |
| API Key | "Connect an AI (optional)" |
| "Enter your DeepSeek API key (starts with sk-...)" | "Paste your key here (starts with sk-...)" with a "Where do I find this?" link |
| Ollama Local AI / localhost:11434 | "Use AI on this computer" (hide the server URL) |
| Copy Raw Markdown | "Copy as Plain Text" |
| Copy HTML Code | "Copy as Web Code" (or move under Advanced) |
| Export as Markdown | "Save as File (.md)" |
| Export as Docs | "Save as Word Document" |
| Export as Plain Text | "Save as Text" |
| @-mentions / [[wikilinks]] | "Link to another note" (tooltip: "Type @ to link") |
| Command Palette / Quick Search | "Search" |

Notes:
- "Workspace" is already the accepted user-facing term — keep it. Do not revert to "vault".
- Every setting that does not need explaining should be removed from the main view.
- Add a small "What's this?" tooltip (?) next to anything technical that must remain.

---

## 2. Make AI the Default Path, Not a Hidden Power Tool

AI is Lumina's superpower. Non-technical users should discover it instantly.

### First launch flow (max 2 steps)
1. Show one friendly question: "Do you want smart AI help?"
   - Option A: "Yes" → paste a key (or pick a provider) → done.
   - Option B: "Not now" → app works fully offline, no friction.
2. Never block the app on an API key. No key = full note-taking still works.

### AI discoverability
- The AI chat already exists with a permanent "AI Chat" sidebar icon AND the `Ctrl+Shift+\` shortcut. Both entry points are fine — keep them. Do NOT advertise `Ctrl+Shift+I` (that is Developer Tools). Fix the Welcome page label.
- Every empty state should offer a natural-language suggestion, e.g.:
  - "Tip: select text and press Ctrl+K to let AI rewrite it."
  - "Ask Lumina anything about your notes."
- The chat panel already labels modes (Fast/Thinking/Creative/Coder). Make them plain words:
  - Fast → "Quick answer"
  - Thinking → "Detailed thinking"
  - Creative → "Creative"
  - Coder → "Code help"
- The model pill (DeepSeek/OpenAI/Claude/Ollama) should read as a friendly label, e.g. "AI Model: Balanced", with the actual provider hidden in a tooltip.

---

## 3. Onboarding in ~30 Seconds, Zero Reading

### First-run walkthrough
- The Welcome page already has 4 action cards (Create a new note / Quick Search / Toggle Sidebar / AI Assistant). Note: the "AI Assistant" card shortcut is currently wrong (`Ctrl+Shift+I`) — it should be `Ctrl+Shift+\`. The "Toggle Sidebar" card (`Ctrl+B`) is correct. Wrap the cards into a 4-step spotlight walkthrough on first run:
  1. "This is your notebook."
  2. "Click here to create a note."
  3. "This is AI — ask it anything."
  4. "Search everything here."
- Non-blocking: user can dismiss anytime.

### Help menu (permanent)
- Add a "Help" button (e.g. "?" in sidebar or title bar).
- Animated GIF guides (not text walls) for the top 5 actions:
  1. Create a note
  2. Search notes
  3. Use AI
  4. Organize into folders
  5. Export/share a note

### Learning by doing
- Auto-create a sample "Welcome note" on first run containing clickable demos and tips inside the note itself.
- Keep it deletable; don't show it again once deleted.

---

## 4. Reduce Decisions and Settings

Fewer choices = less overwhelm.

- The Settings modal currently has 6 tabs: General, Appearance, Shortcuts, AI, Type, Graph. Reduce the visible choices:
  - Merge into 2 friendly tabs: **Look & Feel** (Appearance, Type) and **AI**.
  - Keep **Shortcuts** and **Graph** under an "Advanced" toggle.
  - **General** holds Workspace Location (path) + developer options — move these under "Advanced", label as "Choose where your notes are stored".
- Move technical/developer items under "Advanced":
  - Ollama Local AI / Semantic Indexing / developer reload → Advanced
- Safe defaults:
  - Auto-save: ON
  - Delete: move to a recoverable "Trash" instead of permanent delete + scary confirm dialog
  - Theme: system / auto
- One "Reset to defaults" button so users feel safe experimenting.

---

## 5. The "Ask Anything" Bar (Highest Impact Feature)

The single biggest source of confusion for non-technical users: "Where do I search vs. where do I ask the AI?"

Build one always-visible bar (like macOS Spotlight) at the top of the app:
- One input box.
- Type a note title → results appear (search).
- Type a question → AI answers (AI).
- Works from anywhere in the app (global, instant).

This replaces the separate Quick Search and AI chat entry points with ONE obvious place.

---

## 6. Friendly Copy and Empty States Everywhere

- Never show raw errors ("Error: IPC timeout"). Show human messages: "Something went wrong. Please try again."
- Empty states must teach, not show nothing:
  - No notes → "Create your first note" + button.
  - No search results → "No matching notes. Ask Lumina instead?" + button.
  - Chat empty → "How can I help you today?" + 3 example prompts users can tap.
- All confirmations in plain words:
  - "Delete Note?" → "Move this note to Trash?" with buttons "Keep it" / "Move to Trash".

---

## 7. Build Priority (Do in This Order)

1. **"Ask Anything" unified bar** — changes how the whole app feels.
2. **AI-first onboarding** — optional key, one-click chat, plain-language AI modes.
3. **Plain-language overhaul** — replace remaining jargon (RAG, API Key, model IDs, export labels).
4. **Friendly empty states + error messages** — low effort, high polish.
5. **Recoverable Trash** — remove fear of deletion.
6. **Help menu with GIF guides** — final layer of support.
7. **Internal cleanup (optional)** — rename `vaultPath` / `loadVault` / `useVaultStore` / CSS `vault-*` to workspace terms for consistency (developer-facing only, no user impact).

---

## 8. Acceptance Checklist (How an Agent Knows It's Done)

For every change, verify a brand-new non-technical user can:

- [ ] Launch the app and create a note in under 30 seconds without reading anything.
- [ ] Find and use AI without being told about a keyboard shortcut.
- [ ] Understand every button/label they see (no unexplained technical words).
- [ ] Search and ask AI from one obvious place.
- [ ] Delete something and be able to get it back.
- [ ] Never see a raw error, API key field, file path, or model ID unless they opened Advanced settings.
