# Lumina — "Ask Anything" Command Palette Spec

One always-visible bar (like macOS Spotlight) at the top of the app. One input box.
Type a note title → results appear (search). Type a question → AI answers (AI).
Works from anywhere (global, instant). This is the single source of truth for
implementing `src/renderer/src/features/Overlays/CommandPalette.jsx`.

> Implement exactly. Do not redesign.

---

## 1. Layout

Two-column split. Widen the container from `500px` → `~820px`, height `320px` → `~480px`
(`CommandPalette.css`: `.command-palette-container`, `.palette-results`). Preview needs
real width for mermaid/tables.

```
┌────────────────────────────────────────────────────────────────────┐
│  [🔍]  query................................  [ 🔍 Search | ✨ Ask AI ] │
├───────────────────────────────┬────────────────────────────────────┤
│  Results (left, ~45%)         │  Preview (right, ~55%)             │
│  ▶ Result 1  ← selected       │  ┌──────────────────────────────┐  │
│  ▶ Result 2                   │  │ full-fidelity note rendering: │  │
│  ▶ Result 3                   │  │ mermaid · images · tables     │  │
│  ✨ AI Match: …               │  │ callouts · wikilinks · code   │  │
├───────────────────────────────┴────────────────────────────────────┤
│  ↑↓ navigate · ↵ open/send · ESC dismiss                           │
└────────────────────────────────────────────────────────────────────┘
```

**Responsive:** below ~900px viewport, fall back to single column (no preview pane).

---

## 2. Two modes (segmented toggle, top-right of input)

Two beautiful buttons: `🔍 Search` and `✨ Ask AI`. Default = Search.

### Search mode (default)
- Type → results list on the **left**; live preview of the **selected** note on the **right**.
- **Arrow keys** move selection + update the preview. Mouse hover does NOT change
  preview. **Mouse click opens** the note.
- **Enter** opens the selected note in the editor.

### Ask AI mode
- Results area becomes a compact **inline chat**: user message + streamed answer.
- Reuse `useAIStore.sendChatMessage()` (`features/AI/tools/LuminaChat.js`) and the
  `MessageContent` renderer (`features/AI/LuminaChat.jsx:139` — export it for reuse).
  Shares the same session as the floating chat.
- Palette input sends on Enter; add a **Stop** button while generating; Escape closes.
- **No @mentions, no images, no slash commands** in the palette — plain question →
  answer. The full chat is one click away.

---

## 3. Auto-route rule (the key part)

In **Search mode**, when the query returns **zero results**:
- Show `"No matching notes"` + one action row: `✨ Ask Lumina: "<query>"`.
- Pressing **Enter** (or clicking it) switches to **Ask AI mode** and sends the query
  immediately — the answer streams in the same palette. The user never leaves the window.

When results exist, Enter opens the selected note normally.

Flow: type → preview shows → Enter opens the note. OR type something with no matches →
Enter → AI answers right there.

---

## 4. Preview pane — full editor stack (mermaid, images, tables)

The preview is NOT a lightweight markdown render. It must look like
`features/Overlays/PreviewModal/PreviewModal.jsx`:

- Extract the read-only editor from `PreviewModal.jsx:78-106` into a shared component,
  e.g. `features/Overlays/PreviewModal/NotePreview.jsx`, accepting `content` + `title`.
- Extensions (copy from PreviewModal):
  `EditorState.readOnly.of(true)`, `EditorView.editable.of(false)`, `imageWidgetExtension`,
  `htmlWidgetExtension`, `mermaidWidgetExtension`, `calloutExtension`,
  `codeBlockDecorations`, `luminaSyntaxHighlighting`, `tables`, `wikiLinks`
  (resolve via `useVaultStore`; `onOpen` opens the target note + closes the palette).
- Import `MarkdownEditor.css`, `CodeWrapper.css`, `@atomic-editor/editor/styles.css`
  + the inline `.preview-body` overrides (`PreviewModal.jsx:139-170`).
- Data source: `snippets` already carry `code` with frontmatter stripped
  (`VaultManager.js:195`) — no parsing needed.

### Performance (critical)
Mounting a full CodeMirror + mermaid per arrow key is too heavy:
1. **Debounce preview mount** — create/re-create the editor only after the selection
   settles (~150-200ms after the last arrow/click).
2. Show a lightweight loading placeholder while mermaid renders (reuse PreviewModal's
   spinner, `PreviewModal.jsx:213-242`).
3. **Key the editor by note id** so React unmounts the old editor before mounting the
   new one (only one preview editor exists at a time).
4. Keep the results list virtualized (already is).

### Known constraint
`codeMap` in `features/Workspace/codeBlockHeader.js:22` is a module-level singleton
cleared on every rebuild. With the main editor + preview editor mounted at once,
code-header copy state can be overwritten. **Low-risk path:** accept current behavior
(PreviewModal already coexists this way); verify preview copy works and only disable it
if it visibly breaks.

---

## 5. Files to touch

| File | Change |
|---|---|
| `features/Overlays/CommandPalette.jsx` | `mode` state, Search/Ask AI toggle, split layout, preview pane, zero-result auto-route, AI send handler, keyboard wiring |
| `features/Overlays/CommandPalette.css` | wide container (~820px), 2-column grid, toggle styles, preview pane, responsive fallback |
| `features/Overlays/PreviewModal/NotePreview.jsx` (new) | extracted read-only editor preview from PreviewModal |
| `features/Overlays/PreviewModal/PreviewModal.jsx` | (optional) refactor to reuse NotePreview |
| `features/AI/LuminaChat.jsx` | export `MessageContent` |
