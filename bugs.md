# Table Extension — Improvement Suggestions

## 1. Break Up the Monolithic Keydown Handler — PARTIAL

**File:** `tableCell.ts`

The keydown handler in `makeCell()` dispatches Tab, Enter, arrows, Backspace, pipe, and related keys to named handlers.

**Suggestion:** Keep each key handler named and make the dispatcher straightforward:

```js
source.addEventListener('keydown', (event) => {
  if (autocomplete.handleKeyDown(event)) { /* ... */ }
  if (handleTab(view, cell, event)) return
  if (handleEnter(view, cell, event)) return
  if (handleArrowUp(view, cell, event)) return
  // ...
})
```

**Progress:** The dispatcher now routes to named handlers for Tab, Enter, arrows, Backspace, pipe, undo/redo, and related keys. The handlers still close over `makeCell()` state, so they are not independently testable yet.

---

## 2. Eliminate the Circular Dependency — COMPLETE

**Files:** `tableExtension.ts` and `tableCell.ts`

The former imports between the extension and cell modules formed a cycle, making initialization order hard to reason about.

**Resolution:** Shared editor operations live behind `tableShared.ts`. Table UI modules now import those operations from the bridge instead of importing `tableExtension.ts`, removing the dependency cycle.

---

## 3. Replace `ignoreEvent()` with Granular Event Handling — COMPLETE (scoped widget handling)

**File:** `tableExtension.ts`

`TableWidget.ignoreEvent()` now ignores events only for editable controls and cell interactions handled by the table. Passive widget surfaces pass events through to CodeMirror, preserving native handling there.

**Resolution:** `ignoreEvent()` now returns true only for editable controls and cell interactions handled by the widget. Events on passive widget surfaces continue through CodeMirror's native handling.

---

## 4. Add TypeScript Types — PARTIAL

**Files:** Table extension files

The table extension has been migrated to TypeScript, but the migration still needs type cleanup in several modules.

**Progress:** The table files are TypeScript and core types/guards are defined for the model, parser, and shared operations. Remaining table modules still report TypeScript diagnostics; this item stays partial until those are resolved.

---

## 5. Extract Hardcoded Constants to a Config Object — COMPLETE

**Files:** `tableExtension.ts`, `tableModel.ts`, `tableCell.ts`

**Resolution:** Geometry, scroll offsets, fallback positions, parser budgets, and table interaction delays are centralized in `tableConfig.ts`.

---

## 6. Fix Memory Leaks from Uncleaned Event Listeners — COMPLETE

**File:** `tableCell.ts` — `makeCell()`

Cell DOM gets multiple event listeners. When widget DOM is discarded, those listeners must be cleaned up to release closures that reference the editor view.

**Resolution:** Cell listeners share an `AbortController`; row/cell removal and widget destruction dispose those listeners.

---

## 7. Simplify Focus Management — COMPLETE

**Files:** `tableExtension.ts` — `dispatchModel()`, `tableCell.ts` — `restoreFocusAfterHistory()`

Focus restoration now uses `EditorView.requestMeasure()` to wait for the widget rebuild before finding and focusing the cell.

---

## 8. Make `findCurrentTableRange` More Robust — COMPLETE

**File:** `tableExtension.ts`

This function tries multiple strategies to find a table's range: `dataset.tableFrom`, `lineBlockAtElement`, `posAtDOM`, syntax tree iteration, and DOM order matching. The fallback chain is complex and the DOM-order matching (line 188–196) can silently match the wrong table if tables are reordered.

**Suggestion:** Store the table's `from` and `to` positions directly on the widget's DOM element as `data-table-from` and `data-table-to` (already partially done). On update, remap these positions through `tr.changes.mapPos()`. This eliminates the need for most fallback heuristics. Only use the syntax tree as a last resort.

---

## 9. Debounce `dispatchModelFromDom` More Aggressively — COMPLETE

**File:** `tableExtension.ts`

`dispatchModelFromDom` reads and serializes the whole table. This can be expensive for large tables.

**Resolution:** DOM synchronization is coalesced with `requestAnimationFrame`; dispatch writes only the changed text range. Model reading and serialization still cover the whole table.

---

## 10. Add Error Boundaries and Defensive Checks — COMPLETE

**Files:** `tableExtension.ts`, `tableModel.ts`, `tableCell.ts`

Many operations assume the DOM structure is correct:
- `wrap.querySelector('thead tr')` could return `null` if the table is malformed
- `cell.closest('.cm-atomic-table')` could return `null` if the cell is detached
- `view.posAtDOM(wrap)` can throw if the DOM is not in the document
- `model.rows[r]?.[c]` assumes `r` and `c` are valid indices

When these assumptions fail, the errors are cryptic (e.g., "Cannot read properties of null") and hard to trace back to the root cause.

**Resolution:** `assertTableIntegrity()` validates table DOM shape, and `assertTableModel()` checks the model before serialization. Detached elements and risky DOM lookups are guarded at their call sites.
