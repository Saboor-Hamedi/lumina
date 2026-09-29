# Table Extension — Improvement Suggestions

## 1. Break Up the Monolithic Keydown Handler

**File:** `tableCell.js` (~400 lines in a single `keydown` listener)

The `keydown` handler in `makeCell()` is a deeply nested conditional handling Tab, Enter, Arrow keys, Backspace, pipe character, undo/redo, and more. This is extremely difficult to maintain, test, and debug.

**Suggestion:** Extract each key handler into its own named function (e.g., `handleTab`, `handleEnter`, `handleArrowUp`, `handleBackspace`, `handlePipe`, `handleUndoRedo`). Then the main `keydown` becomes a simple dispatcher:

```js
source.addEventListener('keydown', (event) => {
  if (autocomplete.handleKeyDown(event)) { /* ... */ }
  if (handleTab(view, cell, event)) return
  if (handleEnter(view, cell, event)) return
  if (handleArrowUp(view, cell, event)) return
  // ...
})
```

This makes each handler independently testable and the control flow obvious.

---

## 2. Eliminate the Circular Dependency

**Files:** `tableExtension.js` ↔ `tableCell.js`

`tableCell.js` imports `findCurrentTableRange`, `placeCaretAtEnd`, `dispatchModel`, `dispatchModelFromDom`, `flushPendingTableDispatch`, `moveCellFocus` from `tableExtension.js`. Meanwhile, `tableExtension.js` imports `renderCellSourceDecorated` and `makeCell` from `tableCell.js`. This circular dependency can cause subtle initialization bugs and makes the module graph hard to reason about.

**Suggestion:** Move shared utilities (`findCurrentTableRange`, `placeCaretAtEnd`, `dispatchModel`, `dispatchModelFromDom`, `flushPendingTableDispatch`, `moveCellFocus`, `renderCellSourceDecorated`, `makeCell`) into a new `tableShared.js` module. Both `tableExtension.js` and `tableCell.js` import from it, breaking the cycle.

---

## 3. Replace `ignoreEvent()` with Granular Event Handling

**File:** `tableExtension.js` (line 652–654)

`TableWidget.ignoreEvent()` returns `true`, which tells CodeMirror to ignore ALL events within the widget. This completely bypasses CM6's native selection, click, and input handling, forcing every interaction to be manually reimplemented.

**Suggestion:** Instead of ignoring all events, use `handleDOMEvents` in the EditorView extension to selectively intercept only the events you need (e.g., `keydown`, `mousedown` for cell selection). Let CodeMirror handle the rest natively. This reduces code and improves compatibility with CM6 features like drag-selection, touch handling, and accessibility.

---

## 4. Add TypeScript Types

**Files:** All 13 table files are `.js`

The entire table extension is plain JavaScript while the rest of the codebase uses TypeScript. This loses type safety, IDE autocomplete, and compile-time error detection in the most complex part of the editor.

**Suggestion:** Migrate the table extension to TypeScript. Start with `tableModel.js` (the data model — easiest to type), then `tableCell.js` and `tableExtension.js`. Define interfaces for `TableModel`, `CellPosition`, `TableRange`, etc. This will catch bugs like `model.rows[r]?.[c] ?? ''` where `r` or `c` could be out of bounds.

---

## 5. Extract Hardcoded Constants to a Config Object

**Files:** `tableExtension.js`, `tableModel.js`, `tableCell.js`

Magic numbers are scattered throughout:
- Default column width: `144` (tableExtension.js:33)
- Max widget height: `450` (tableExtension.js:281)
- Debounce timers: `60ms`, `100ms`, `150ms` (tableExtension.js:772, tableCell.js:100)
- Scroll offsets: `10px`, `16px` (tableExtension.js:234–247)
- Resize debounce: `300ms` (tableExtension.js:334)
- Default row height: `28` (tableModel.js)
- Default column width in reconcile: `110` (tableModel.js)

**Suggestion:** Create a `tableConfig.js` with a single config object:

```js
export const TABLE_CONFIG = {
  defaultColWidth: 144,
  maxWidgetHeight: 450,
  debounceMs: { dispatch: 60, resize: 300, parser: 150 },
  scrollOffset: { vertical: 10, horizontal: 16 },
  defaultRowHeight: 28,
  minColWidth: 60,
}
```

This makes tuning easy and documents the magic numbers.

---

## 6. Fix Memory Leaks from Uncleaned Event Listeners

**File:** `tableCell.js` — `makeCell()`

Every cell attaches `keydown`, `input`, `paste`, `focus`, `blur`, `mouseup`, `keyup`, `compositionstart`, `compositionend`, `click`, `pointerdown`, and `contextmenu` listeners to its DOM elements. When the widget re-renders (e.g., `updateDOM`), old cell DOM is discarded but listeners are not explicitly removed. While GC usually handles this, the `view` reference captured in closures can keep entire editor state alive.

**Suggestion:** Use `ViewPlugin` with a proper `destroy()` method to clean up listeners. Alternatively, attach listeners to the widget wrapper (which persists) and use event delegation with `event.target.closest('td, th')` to find the relevant cell. This way listeners are attached once per table, not once per cell.

---

## 7. Simplify Focus Management

**Files:** `tableExtension.js` — `dispatchModel()`, `tableCell.js` — `restoreFocusAfterHistory()`

Focus restoration uses double `requestAnimationFrame`, manual DOM traversal, and position calculations. The `dispatchModel` function has a `focusTarget` closure that queries the DOM, finds the right cell, scrolls it into view, and places the caret. This is fragile — any DOM structure change breaks it.

**Suggestion:** Use CodeMirror's `EditorView.requestMeasure()` or a `StateEffect` that stores the desired focus position in the editor state. Then a `ViewPlugin` reads that effect and focuses the correct cell after the widget rebuilds. This decouples focus logic from DOM timing.

---

## 8. Make `findCurrentTableRange` More Robust

**File:** `tableExtension.js` (lines 102–215)

This function tries multiple strategies to find a table's range: `dataset.tableFrom`, `lineBlockAtElement`, `posAtDOM`, syntax tree iteration, and DOM order matching. The fallback chain is complex and the DOM-order matching (line 188–196) can silently match the wrong table if tables are reordered.

**Suggestion:** Store the table's `from` and `to` positions directly on the widget's DOM element as `data-table-from` and `data-table-to` (already partially done). On update, remap these positions through `tr.changes.mapPos()`. This eliminates the need for most fallback heuristics. Only use the syntax tree as a last resort.

---

## 9. Debounce `dispatchModelFromDom` More Aggressively

**File:** `tableExtension.js` (lines 758–775)

`dispatchModelFromDom` is called on every `input` event (via `commit()` in tableCell.js). It reads the entire table model from DOM, serializes it, and dispatches a transaction. The 60ms debounce helps, but for large tables (50+ cells), `readModelFromDom` + `serializeTable` can be expensive.

**Suggestion:** Track which cell changed and only update that cell's content in the serialized output, rather than re-serializing the entire table. Alternatively, use a `requestAnimationFrame`-based debounce instead of `setTimeout` to align with the browser's render cycle.

---

## 10. Add Error Boundaries and Defensive Checks

**Files:** `tableExtension.js`, `tableModel.js`, `tableCell.js`

Many operations assume the DOM structure is correct:
- `wrap.querySelector('thead tr')` could return `null` if the table is malformed
- `cell.closest('.cm-atomic-table')` could return `null` if the cell is detached
- `view.posAtDOM(wrap)` can throw if the DOM is not in the document
- `model.rows[r]?.[c]` assumes `r` and `c` are valid indices

When these assumptions fail, the errors are cryptic (e.g., "Cannot read properties of null") and hard to trace back to the root cause.

**Suggestion:** Add a `assertTableIntegrity(wrap)` function that validates the DOM structure before operations. Use optional chaining consistently. Wrap risky operations in try-catch with descriptive error messages that include the table's `data-table-from` position and the operation being performed. This makes debugging much faster.
