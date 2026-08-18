# Lumina — Non-Technical User Experience Guide

Current-state source of truth for making Lumina easy for non-technical users.
`[x]` = verified done. Unchecked = open work. Sections marked "[SPEC]" are
implementation specs for an agent — implement exactly, do not redesign.

> Rule for the agent: read the full file first. Complete EVERY step. Do not skip
> "Verify". Do not modify files outside the ones listed under "Files" unless the
> spec says otherwise. After finishing, answer the "Deliverables" section explicitly.

---

## 1. Current state (verified against the code)

**Shipped and verified:**
- [x] **"Ask Anything" CommandPalette** — split-pane Search/Ask AI toggle, full-fidelity
  note preview (mermaid/images/tables), "Ask Lumina" auto-route on zero results.
- [x] **Spotlight global summon** — `Ctrl+Space` opens the CommandPalette from anywhere,
  even when the window is hidden/closed (main `useGlobalShortcut.js` → `window:toggle-command-palette`
  → preload → `AppShell.jsx:301-305`).
- [x] **Launch on startup** — `useAutoLauncher.js` (packaged builds only).
- [x] **Settings = 3 friendly tabs** — Look & Feel / AI Assistant / Advanced.
- [x] **Labeled sidebar buttons** — New / Daily / Graph with icons.
- [x] **Daily Notes + Templates** — Daily button opens a template picker; 26 default
  templates (Learning, Research, Book Notes, Meeting, Journal, Habit Tracker, etc.);
  creates dated notes in `DailyNotes/` and seeds a `Templates/` folder.
- [x] **Obsidian-style tables** — cursor drag-select, corner/column/row handles, resize,
  drag reorder, formatting toolbar, context menu with plain labels.
- [x] **Welcome page 4 cards** with correct shortcuts.
- [x] **Tests green** — 396 unit + e2e.

---

## 2. Known open work (do in this order)

### 2.1 Friendly AI error messages
Never show raw errors to users. Today raw provider errors still surface:
- `features/AI/providers/OpenAIProvider.js:35` — `OpenAI API Error (429): <body>`
- `features/AI/providers/DeepSeekProvider.js:35`, `AnthropicProvider.js:47`, `OllamaProvider.js:35`
- `features/AI/tools/LuminaChat.js:1182` → rendered as `**Error:** ${chatError}` (`LuminaChat.jsx:967`)
- `features/Overlays/InlineLumina.jsx:371` (`API Error: ${status}`), `:401` (`**Error:** ${err.message}`)
- `features/Settings/SettingAdvanced.jsx:28,45` (`❌ API Error: Restart App`)

**Spec:** add ONE friendly error-mapping helper (e.g. `features/AI/utils/friendlyError.js`):
- Missing key → "Connect an AI in Settings to get started."
- Rate limit / 4xx-5xx → "Lumina couldn't answer right now. Please try again."
- Timeout → "Lumina is taking too long. Please try again."
- Unknown → "Something went wrong. Please try again."
- Log the technical detail to the console only; never render status codes or bodies.
Apply it in the provider error paths, `LuminaChat` store `chatError`, `InlineLumina`, and
`CommandPalette` AI error hint.

### 2.2 Chat empty state with example prompts
`features/AI/LuminaChat.jsx:901` shows `"How can I help you today?"` plus **one**
conditional `Explain "{title}"` button (only when a note is selected).

**Spec:** always show a row of **3 tappable example prompts** (even with no note selected):
1. "Summarize my open note"
2. "Brainstorm ideas for a new project"
3. "Explain this code"
Each prompt, when tapped, calls the existing `sendChatMessage(...)` flow. Keep the
existing dynamic `Explain "{title}"` button when a note is selected.

### 2.3 "Create your first note" empty state
`features/Explorer/FileExplorer.jsx:1054` shows a button-less `No notes or folders found`.

**Spec:** when the workspace has no notes, show `"Create your first note"` + a button that
triggers the same action as the sidebar "New" button (`trigger-new-note` custom event).

### 2.4 Reset to defaults button
`features/Settings/SettingAdvanced.jsx` (or Settings footer).

**Spec:** a `"Reset to defaults"` button that restores all settings to
`main/SettingsManager.js` `defaultSettings` and persists via `updateSettings`. Add a plain
confirmation ("Reset all settings to defaults?") before applying.

### 2.5 Spotlight shortcut config
`main/handlers/useGlobalShortcut.js:7` hardcodes `CommandOrControl+Space`; the persisted
`globalShortcut` setting is never read, and `SettingAdvanced.jsx` shows only a read-only badge.

**Spec:** read the actual shortcut from `settings.globalShortcut` in
`useGlobalShortcut(mainWindow, settings)`, defaulting to `CommandOrControl+Space`. Keep the
Settings display in sync. (If a shortcut-recorder UI is out of scope, at least honor the
persisted value or a fixed set of presets.)

### 2.6 Move Ollama URL under Advanced
`features/Settings/SettingAssistant.jsx:118-125` exposes
`http://localhost:11434/api/chat` in the AI Assistant tab.

**Spec:** keep the friendly `"Use AI on this computer"` heading in Assistant, but move the
`Connection Address` input + URL into Settings > Advanced. Hide the raw URL from the main
AI tab.

---

## 3. [SPEC] Templates for every new note (not just daily)

The Daily Notes template picker exists (`TemplateModal.jsx` + `defaultTemplates.js` with
26 templates). Extend it so the **New** button also offers a template.

### Behavior
- Clicking **New** opens the same `TemplateModal`-style picker: **Blank Note** first, then
  the template list (same search + arrow-key navigation + wireframe preview).
- Selecting **Blank Note** → create an untitled note (current New behavior).
- Selecting a template → create a note titled `TemplateName` (no date prefix; dates are a
  Daily Notes concept) with the template's code, in the workspace root (no `DailyNotes/`
  folder) unless the template belongs to a folder.
- "New" keeps its shortcut `Ctrl+N` and opens the same picker.
- Daily Notes behavior is UNCHANGED (still dates + `DailyNotes/` folder).

### Files
- `features/Navigation/components/SidebarHeader.jsx` — New button opens picker.
- `features/Navigation/components/TemplateModal.jsx` — reuse; title prop may need to be
  dynamic ("Select a Template" vs "Select Daily Note Template").
- `features/Navigation/components/DailyNotes.jsx` — keep as-is.
- `defaultTemplates.js` — reuse as the shared template list.

### Verify
- `npm run test:run` green; add a unit test for the New→template flow if a handler is extracted.
- Manual: New → picker opens → Blank creates untitled; template creates titled note.

---

## 4. [SPEC] First-run sample workspace (learn by doing)

On first launch, auto-create a small **Welcome** note that demonstrates the app so a new
user sees what's possible without reading a manual.

### Behavior
- Detect first run via a persisted setting (e.g. `onboarded` default false in
  `SettingsManager.js` + `useSettingsStore.js`).
- On first run, create one note `Welcome` (in workspace root) whose content demos: a
  heading, a bullet list, a `- [ ]` checkbox, a `[[wikilink]]`, a table, a mermaid block,
  a callout, and a short "Tips" section.
- The note is deletable; once deleted it is NOT re-created (guard on `onboarded` flag).
- Never block the app; the Welcome page still shows.

### Files
- `src/main/index.js` or a new `src/main/handlers/createWelcomeNote.js` (first-run seeding).
- `src/main/SettingsManager.js` + `src/renderer/src/core/store/useSettingsStore.js` — `onboarded` flag.
- Reuse `VaultManager.saveSnippet` or `window.api.saveSnippet`.

### Verify
- Fresh temp vault (e2e launch) → Welcome note exists once; delete → not recreated.
- Unit test the first-run flag logic.

---

## 5. [SPEC] Undo toast on destructive actions

Give non-technical users reassurance when they delete or rename.

### Behavior
- On note delete: after the confirm, show a toast **"Note moved to Trash — Undo"**. The
  Undo button restores the note (soft-undelete in-memory: recreate the snippet + file).
- If a real Trash feature is out of scope, at minimum: on rename show a toast
  `"Renamed to <new title>"` (auto-dismisses).
- Delete confirm copy stays plain: `"Permanently delete this note?"` (already fixed).

### Files
- `features/core/store/useVaultStore.js` — `deleteSnippet` / `renameSnippet` emit undo data.
- `features/Overlays/` or `core/notification/` — reuse `useToast` / `ToastNotification`.
- Undo implementation: capture the snippet object before delete; on Undo, call `saveSnippet`.

### Verify
- Unit test: delete → undo restores snippet in store.
- Manual: delete a note, click Undo, note returns.

---

## 6. [SPEC] Plain model picker

Replace technical model IDs with friendly options for non-technical users.

### Behavior
- In `SettingAssistant.jsx`, the DeepSeek model select currently shows `DeepSeek Chat (V3)`
  / `DeepSeek Reasoner (R1)`. Change the visible labels to friendly names:
  - "DeepSeek Chat (V3)" → **"Simple"**
  - "DeepSeek Reasoner (R1)" → **"Thinking"**
- Keep the stored value (`deepseek-chat` / `deepseek-reasoner`) unchanged so AI routing is
  unaffected. Map label → value only in the UI.
- Add a small "What's this?" tooltip explaining the difference in plain words
  ("Simple = fast answers, Thinking = deeper reasoning").

### Files
- `features/Settings/SettingAssistant.jsx` — label mapping only.
- `features/components/atoms/ToolTip.jsx` — reuse for the tooltip.

### Verify
- Unit test: selecting "Thinking" still persists `deepseek-reasoner`.
- Manual: Settings → AI Assistant shows plain labels; chat uses the mapped model.

---

## 7. [SPEC] "What's this?" tooltips on technical settings

Add a small `?` tooltip next to anything technical that must remain, explaining in one
plain sentence.

### Behavior
- Targets (at minimum): Workspace Location (Advanced), Smart Search toggle (Assistant),
  Ollama Connection Address (Advanced after 2.6), Developer Tools (Advanced).
- Use the existing `ToolTip` atom. Text examples:
  - Workspace Location: "This is where your notes are stored on this computer."
  - Smart Search: "Lets Lumina learn from your notes to give better answers."
  - Developer Tools: "For advanced users only. You probably don't need this."

### Files
- `features/Settings/SettingAdvanced.jsx`
- `features/Settings/SettingAssistant.jsx`
- `features/components/atoms/ToolTip.jsx` (reuse, no change expected)

### Verify
- Manual: hover the `?` next to each target → plain explanation shows.

---

## 8. [SPEC] In-app Help button + top-5 guides

Rename/relabel the existing docs entry to "Help" so non-technical users find support.

### Behavior
- The docs modal already exists (opens from the status bar "docs" and the command
  `Docs: Open Documentation`). Change the visible label to **"Help"**.
- Add a small Help button in the sidebar header (or keep status-bar entry) labeled with a
  `?` icon + tooltip "Help".
- The top-5 guides live in `brain/` (rendered by `Documentation.jsx`):
  1. Create a note
  2. Search notes / Ask Lumina
  3. Use AI
  4. Organize into folders
  5. Export / share a note
- Do NOT modify `features/Docs/Documentation.jsx` (it reads `brain/**/*.md`); update the
  `brain/*.md` content instead.

### Files
- `brain/*.md` — add the top-5 guides content.
- `features/Navigation/components/SidebarHeader.jsx` or `features/Layout/StatusBar.jsx` —
  label "docs" → "Help".

### Verify
- Manual: Help button opens the docs modal with the guides visible.

---

## 9. [SPEC] Auto-save indicator

Reassure users their work is never lost.

### Behavior
- In the status bar (or title bar), show a small indicator:
  - `Saving…` while a debounced save is in flight.
  - `Saved` for ~2s after each save (then fades).
- Track via the existing auto-save flow in the editor / `useVaultStore` dirty state.

### Files
- `features/Workspace/components/StatusBar.jsx` — indicator UI.
- Editor auto-save hook — emit save start/finish events.

### Verify
- Manual: type in a note → "Saving…" → "Saved".

---

## 10. Larger features (not started — confirm before building)

- [ ] **First-launch AI onboarding** — one friendly question: "Do you want smart AI help?"
  (Yes → paste a key / pick provider; Not now → fully offline). Never block the app on a key.
- [ ] **First-run walkthrough** — non-blocking 4-step spotlight over the Welcome cards.
- [ ] **Recoverable Trash** — soft-delete to `.lumina/trash/` with a restore UI.
  *(Previously deferred by user decision; section 5 gives a lightweight undo alternative.)*

---

## 11. Build priority

1. Friendly AI error messages (2.1)
2. Chat example prompts (2.2)
3. "Create your first note" empty state (2.3)
4. Templates for every new note (Section 3)
5. First-run sample workspace (Section 4)
6. Undo toast (Section 5)
7. Plain model picker (Section 6)
8. "What's this?" tooltips (Section 7)
9. Help button + guides (Section 8)
10. Auto-save indicator (Section 9)
11. Larger features (Section 10) — only after confirming scope

---

## 12. Acceptance checklist (how an agent knows it's done)

- [ ] Never see a raw error, status code, or API body — only friendly messages + console logs.
- [ ] Chat empty state offers tappable example prompts with no note selected.
- [ ] Empty workspace shows "Create your first note" with a working button.
- [ ] New note button offers a template picker (Blank + all templates).
- [ ] First launch creates a deletable Welcome note once (not re-created).
- [ ] Deleting/renaming shows a reassurance toast (with Undo where feasible).
- [ ] AI model picker shows plain labels ("Simple" / "Thinking"), stored values unchanged.
- [ ] Technical settings have "What's this?" tooltips.
- [ ] Help button + top-5 guides available in-app.
- [ ] Auto-save indicator shows Saving… → Saved.
- [ ] Settings has a working "Reset to defaults".
- [ ] Spotlight honors the configured shortcut (or clearly fixed/preset).
- [ ] No `localhost`/API URLs in the main AI Assistant tab.
