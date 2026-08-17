# Lumina — Non-Technical User Experience Guide

Current-state source of truth for making Lumina easy for non-technical users.
`[x]` = verified done. Unchecked = open work. Sections marked "[SPEC]" are
implementation specs for an agent — implement exactly, do not redesign.

---

## 1. Current state (verified against the code)

**Shipped and verified:**
- [x] **"Ask Anything" CommandPalette** — split-pane Search/Ask AI toggle, full-fidelity
  note preview (mermaid/images/tables), "Ask Lumina" auto-route on zero results. See
  `features/Overlays/CommandPalette.jsx` + `features/Overlays/PreviewCommandPalette.jsx`.
- [x] **Spotlight global summon** — `Ctrl+Space` (CommandOrControl+Space) opens the
  CommandPalette from anywhere, even when the window is hidden/closed. Wired end-to-end:
  `main/handlers/useGlobalShortcut.js` → `window:toggle-command-palette` →
  preload `onToggleCommandPalette` → `AppShell.jsx:301-305`.
- [x] **Launch on startup** — `main/handlers/useAutoLauncher.js` (packaged builds only),
  toggle in Settings > Advanced.
- [x] **Settings = 3 friendly tabs** — Look & Feel / AI Assistant / Advanced
  (`features/Settings/Settings.jsx`).
- [x] **Labeled sidebar buttons** — New / Daily / Graph with icons (`SidebarHeader.jsx`).
- [x] **Welcome page 4 cards** with correct shortcuts (Ctrl+N / Ctrl+P / Ctrl+B / Ctrl+Shift+\).
- [x] **Search no-results state** — `No matching notes found for "..."` + `Ask Lumina: "..."`
  button that routes to AI mode (`CommandPalette.jsx:733-747`).
- [x] **Corrected shortcuts** — AI chat `Ctrl+Shift+\`, settings `Ctrl+,`, CommandPalette `Ctrl+Space`.
- [x] **Tests green** — 374 unit + e2e.

---

## 2. Open work (do in this order)

### 2.1 Friendly error messages (high value, low risk)
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
`features/AI/LuminaChat.jsx:890-915` currently shows `"How can I help you today?"` plus
**one** conditional `Explain "{title}"` button (only when a note is selected).

**Spec:** always show a row of **3 tappable example prompts** (even with no note selected),
e.g.:
1. "Summarize my open note"
2. "Brainstorm ideas for a new project"
3. "Explain this code"
Each prompt, when tapped, calls the existing `sendChatMessage(...)` flow. Keep the existing
dynamic `Explain "{title}"` button when a note is selected.

### 2.3 "Create your first note" empty state
`features/Explorer/FileExplorer.jsx:1045` shows a button-less `No notes or folders found`.

**Spec:** when the workspace has no notes, show `"Create your first note"` + a button that
triggers the same action as the sidebar "New" button (`trigger-new-note` custom event).

### 2.4 Reset to defaults button
`features/Settings/SettingAdvanced.jsx` (or Settings footer).

**Spec:** a `"Reset to defaults"` button that restores all settings to
`main/SettingsManager.js` `defaultSettings` and persists via `updateSettings`. Add a plain
confirmation ("Reset all settings to defaults?") before applying.

### 2.5 Spotlight shortcut config
`main/handlers/useGlobalShortcut.js:7` hardcodes `CommandOrControl+Space`; the persisted
`globalShortcut` setting is never read, and `SettingAdvanced.jsx:178-183` shows only a
read-only badge.

**Spec:** read the actual shortcut from `settings.globalShortcut` in
`useGlobalShortcut(mainWindow, settings)`, defaulting to `CommandOrControl+Space`. Keep the
Settings display in sync. (If a shortcut-recorder UI is out of scope, at least honor the
persisted value or a fixed set of presets.)

### 2.6 Move Ollama URL under Advanced
`features/Settings/SettingAssistant.jsx:112-128` exposes
`http://localhost:11434/api/chat` in the AI Assistant tab.

**Spec:** keep the friendly `"Use AI on this computer"` heading in Assistant, but move the
`Connection Address` input + URL into Settings > Advanced. Hide the raw URL from the main
AI tab.

---

## 3. Larger features (not started — confirm before building)

- [ ] **First-launch AI onboarding** — one friendly question: "Do you want smart AI help?"
  (Yes → paste a key / pick provider; Not now → fully offline). Never block the app on a key.
- [ ] **First-run walkthrough** — non-blocking 4-step spotlight over the Welcome cards
  ("This is your notebook." → "Create a note." → "This is AI." → "Search everything here.").
- [ ] **Help button + guides** — "?" button (sidebar/titlebar) opening a Help panel with
  short guides for the top 5 actions (create, search, use AI, organize, export).
- [ ] **Recoverable Trash** — soft-delete to `.lumina/trash/` with a restore UI. *(Previously
  deferred by user decision.)*

---

## 4. Build priority

1. Friendly error messages (2.1)
2. Chat example prompts (2.2)
3. "Create your first note" empty state (2.3)
4. Reset to defaults (2.4)
5. Spotlight config honors setting (2.5)
6. Ollama URL → Advanced (2.6)
7. Larger features (Section 3) — only after confirming scope

---

## 5. Acceptance checklist (how an agent knows it's done)

- [ ] Never see a raw error, status code, or API body — only friendly messages + console logs.
- [ ] Chat empty state offers tappable example prompts with no note selected.
- [ ] Empty workspace shows "Create your first note" with a working button.
- [ ] Settings has a working "Reset to defaults".
- [ ] Spotlight honors the configured shortcut (or clearly fixed/preset).
- [ ] No `localhost`/API URLs in the main AI Assistant tab.
