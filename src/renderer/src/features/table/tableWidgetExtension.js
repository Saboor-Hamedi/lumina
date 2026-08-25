import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, WidgetType, keymap, ViewPlugin } from '@codemirror/view'
import { StateField, StateEffect, Facet, Prec, Transaction } from '@codemirror/state'
import { undo, redo } from '@codemirror/commands'
import { treeGrowthEffect, treeProgressPlugin } from './tree-progress'
import { useVaultStore } from '../../core/store/useVaultStore'
import { TableAutocomplete } from './wikilinkAutocompletion'
import { setupTableFormattingToolbar } from './tableFormattingToolbar'
import { openCellMenu } from './tableContextMenu'
import { setupTableSelection } from './tableGridSelection'
import { setupTableDragAndDrop } from './tableDragAndDrop'
import { setupTableInsertion } from './tableInsertion'
import { setupTableColResizing } from './tableColResizing'
import { icons } from './icons.js'

import { parseTable, serializeTable, readModelFromDom, getCellSource } from './tableModel'
import { renderCellSourceDecorated, makeCell } from './tableCellDom'

export function findCurrentTableRange(view, dom) {
  const pos = view.posAtDOM(dom)
  if (pos < 0) return null
  const tree = syntaxTree(view.state)
  let node = tree.resolveInner(pos, 1)
  while (node && node.name !== 'Table') node = node.parent
  if (node) return { from: node.from, to: node.to }
  // Fallback: scan for the nearest Table node containing or starting
  // at pos. Rare — resolveInner + parent walk handles almost every
  // case — but guards against parser edge cases.
  let found = null
  tree.iterate({
    enter: (n) => {
      if (n.name !== 'Table') return
      if (n.from <= pos && n.to >= pos) {
        found = n.node
        return false
      }
    }
  })
  if (found) return { from: found.from, to: found.to }
  return null
}
// ---- DOM helpers ----------------------------------------------------
export function placeCaretAtEnd(el) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}
export function getAllCells(wrap) {
  return Array.from(wrap.querySelectorAll('th, td'))
}
// ---- widget ---------------------------------------------------------
export class TableWidget extends WidgetType {
  constructor(model) {
    super()
    Object.defineProperty(this, 'model', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: model
    })
  }
  // Structure-only equality. Typing in a cell produces a new
  // TableWidget with the same dimensions but different cell contents.
  // Returning true here means CM6 keeps the existing DOM instead of
  // calling `toDOM` again — which is what lets the caret survive
  // across the per-keystroke dispatch cycle.
  eq(other) {
    if (other.model.header.length !== this.model.header.length) return false
    if (other.model.rows.length !== this.model.rows.length) return false
    for (let i = 0; i < this.model.header.length; i++) {
      if (other.model.header[i] !== this.model.header[i]) return false
      if (other.model.alignments?.[i] !== this.model.alignments?.[i]) return false
    }
    for (let r = 0; r < this.model.rows.length; r++) {
      for (let c = 0; c < this.model.rows[r].length; c++) {
        if (other.model.rows[r][c] !== this.model.rows[r][c]) return false
      }
    }
    return true
  }
  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = 'cm-atomic-table'
    wrap.tabIndex = -1

    wrap.addEventListener('keydown', (event) => {
      if (view.state.readOnly) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        event.stopPropagation()
        view.dispatch({
          selection: { anchor: 0, head: view.state.doc.length }
        })
        view.focus()
      }
    })

    wrap.addEventListener('mousedown', (event) => {
      if (view.state.readOnly) return

      const source = event.target.closest('.cm-atomic-table-cell-source')
      if (source) return // Let normal focus happen if they clicked directly in the editable text

      if (!event.target.closest('.cm-table-scroll-container')) return // Let CodeMirror handle clicks in the 16px top/bottom spacer gap

      // They clicked on padding or borders inside the visual table container
      event.preventDefault() // Prevent CodeMirror from taking focus and drawing a giant cursor

      const cell = event.target.closest('td, th')
      if (cell) {
        const innerSource = cell.querySelector('.cm-atomic-table-cell-source')
        if (innerSource) {
          innerSource.focus()
          placeCaretAtEnd(innerSource)
        }
      }
    })

    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'cm-table-scroll-container'

    const table = document.createElement('table')
    scrollContainer.appendChild(table)
    wrap.appendChild(scrollContainer)

    const actionArea = document.createElement('div')
    actionArea.className = 'cm-table-action-area'

    const cornerHandle = document.createElement('div')
    cornerHandle.className = 'cm-table-handle cm-table-corner-handle'
    cornerHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`
    cornerHandle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      wrap.__setGridSelection?.(
        wrap.__getCellAt(-1, 0),
        wrap.__getCellAt(this.model.rows.length - 1, this.model.header.length - 1)
      )
    })
    actionArea.appendChild(cornerHandle)

    const deleteBtn = document.createElement('div')
    deleteBtn.className = 'cm-table-handle cm-table-delete-btn'
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`
    deleteBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const range = findCurrentTableRange(view, wrap)
      if (range) {
        view.dispatch({
          changes: { from: range.from, to: range.to, insert: '' }
        })
      }
    })
    actionArea.appendChild(deleteBtn)

    wrap.appendChild(actionArea)

    const thead = document.createElement('thead')

    const headerRow = document.createElement('tr')
    for (let i = 0; i < this.model.header.length; i++) {
      const cell = makeCell('th', this.model.header[i], view)
      if (this.model.alignments?.[i]) {
        cell.style.textAlign = this.model.alignments[i]
        const source = cell.querySelector('.cm-atomic-table-cell-source')
        if (source) source.style.textAlign = this.model.alignments[i]
      }
      headerRow.appendChild(cell)
    }

    thead.appendChild(headerRow)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    const colCount = this.model.header.length
    for (let r = 0; r < this.model.rows.length; r++) {
      const row = this.model.rows[r]
      const tr = document.createElement('tr')
      for (let c = 0; c < colCount; c++) {
        const cell = makeCell('td', row[c] ?? '', view)
        if (this.model.alignments?.[c]) {
          cell.style.textAlign = this.model.alignments[c]
          const source = cell.querySelector('.cm-atomic-table-cell-source')
          if (source) source.style.textAlign = this.model.alignments[c]
        }
        tr.appendChild(cell)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    setupTableFormattingToolbar(wrap, view)
    setupTableSelection(wrap, view)
    setupTableDragAndDrop(wrap, view)
    setupTableInsertion(wrap, view)
    setupTableColResizing(wrap, view)

    return wrap
  }
  updateDOM(dom, view) {
    const theadTr = dom.querySelector('thead tr')
    if (!theadTr) return false
    const ths = Array.from(theadTr.querySelectorAll('th'))
    if (ths.length !== this.model.header.length) return false
    for (let i = 0; i < this.model.header.length; i++) {
      ths[i].__view = view
      const source = ths[i].querySelector('.cm-atomic-table-cell-source')

      // Sync alignments
      if (this.model.alignments?.[i]) {
        ths[i].style.textAlign = this.model.alignments[i]
        if (source) source.style.textAlign = this.model.alignments[i]
      } else {
        ths[i].style.textAlign = ''
        if (source) source.style.textAlign = ''
      }

      if (source && source.parentElement.dataset.raw !== this.model.header[i]) {
        const isFocused = document.activeElement === source
        source.parentElement.dataset.raw = this.model.header[i]
        renderCellSourceDecorated(source)
        if (isFocused) placeCaretAtEnd(source)
      }
    }

    const tbody = dom.querySelector('tbody')
    if (!tbody) return false
    const trs = Array.from(tbody.querySelectorAll('tr'))
    if (trs.length !== this.model.rows.length) return false
    for (let r = 0; r < trs.length; r++) {
      const tds = Array.from(trs[r].querySelectorAll('td'))
      for (let c = 0; c < tds.length; c++) {
        tds[c].__view = view
        const source = tds[c].querySelector('.cm-atomic-table-cell-source')

        // Sync alignments
        if (this.model.alignments?.[c]) {
          tds[c].style.textAlign = this.model.alignments[c]
          if (source) source.style.textAlign = this.model.alignments[c]
        } else {
          tds[c].style.textAlign = ''
          if (source) source.style.textAlign = ''
        }

        if (source && source.parentElement.dataset.raw !== this.model.rows[r][c]) {
          const isFocused = document.activeElement === source
          source.parentElement.dataset.raw = this.model.rows[r][c]
          renderCellSourceDecorated(source)
          if (isFocused) placeCaretAtEnd(source)
        }
      }
    }
    return true
  }
  // All cell interactions are handled by the listeners we attach in
  // `makeCell`; tell CM6 to stay out of events within the widget so
  // its own selection/click logic doesn't compete with contenteditable.
  ignoreEvent() {
    return true
  }
}
export function dispatchModel(view, wrap, nextModel) {
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const next = serializeTable(nextModel)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next }
  })
}
export function dispatchModelFromDom(view, cell) {
  const wrap = cell.closest('.cm-atomic-table')
  if (!wrap) return
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const model = readModelFromDom(wrap)
  const next = serializeTable(model)

  const oldText = view.state.sliceDoc(range.from, range.to)
  if (oldText === next) return

  let start = 0
  while (start < oldText.length && start < next.length && oldText[start] === next[start]) {
    start++
  }
  let endOld = oldText.length
  let endNext = next.length
  while (endOld > start && endNext > start && oldText[endOld - 1] === next[endNext - 1]) {
    endOld--
    endNext--
  }

  view.dispatch({
    changes: {
      from: range.from + start,
      to: range.from + endOld,
      insert: next.substring(start, endNext)
    },
    selection: { anchor: range.from + start + next.substring(start, endNext).length },
    // Tag as typing so CM6's history coalesces consecutive cell edits
    // gracefully. Because we are now dispatching fine-grained diffs,
    // CM6 will naturally break history groups on word boundaries/spaces
    // just like standard typing!
    annotations: Transaction.userEvent.of('input.type')
  })
}
export function moveCellFocus(view, cell, dir, opts = { appendOnOverflow: true }) {
  const wrap = cell.closest('.cm-atomic-table')
  if (!wrap) return
  const cells = getAllCells(wrap)
  const idx = cells.indexOf(cell)
  if (idx < 0) return
  const next = idx + dir
  if (next < 0) {
    const pos = view.posAtDOM(wrap)
    if (pos !== null) {
      view.dispatch({ selection: { anchor: pos } })
      view.focus()
    }
    return
  }
  if (next >= cells.length) {
    if (opts.appendOnOverflow) {
      const thead = wrap.querySelector('thead tr')
      const colCount = thead ? thead.querySelectorAll('th').length : 1
      appendRow(view, wrap, idx % colCount)
    } else {
      // jump out below
      const range = findCurrentTableRange(view, wrap)
      if (range) {
        view.dispatch({ selection: { anchor: range.to } })
        view.focus()
      }
    }
    return
  }
  const source = getCellSource(cells[next])
  if (!source) return
  source.focus()

  if (dir > 0) {
    // Moving forward/down: place caret at start
    const sel = source.ownerDocument?.defaultView?.getSelection()
    if (sel) {
      const range = document.createRange()
      range.selectNodeContents(source)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  } else {
    // Moving backward/up: place caret at end
    placeCaretAtEnd(source)
  }
}
export function appendRow(view, wrap, focusColIndex = 0) {
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const model = readModelFromDom(wrap)
  model.rows.push(model.header.map(() => ''))
  const next = serializeTable(model)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next }
  })
  // Adding a row changes the widget's row count, so `eq` returns
  // false and CM6 rebuilds the widget DOM. The old `wrap` reference
  // is now detached. Wait for the paint that attaches the new DOM,
  // then look up the fresh widget by position and focus its new
  // last-row cell. Double-rAF because the first rAF only guarantees
  // CM6 has processed the dispatch; the second ensures the layout
  // has painted so focus commands don't get lost.
  const { from } = range
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
      let target = null
      for (const el of tables) {
        try {
          if (view.posAtDOM(el) === from) {
            target = el
            break
          }
        } catch {
          // posAtDOM can throw on detached/transitional DOM nodes
          // — skip and keep looking.
        }
      }
      if (!target) return
      const rows = target.querySelectorAll('tbody tr')
      if (!rows.length) return
      const lastRow = rows[rows.length - 1]
      const newCells = lastRow.querySelectorAll('.cm-atomic-table-cell-source')
      const cellToFocus = newCells[focusColIndex] || newCells[0]
      if (cellToFocus) cellToFocus.focus()
    })
  })
}
// Backspace at the line immediately after a table normally deletes
// the `\n` separator and merges the line-below into the table's last
// source line. Lezer then re-parses the merged content as part of
// the table (or mangles it), producing the "swallow" behavior where
// content below the table looks like it's been absorbed as new rows.
//
// Instead, when the caret sits right after a Table and the user hits
// backspace, select the whole Table range — same pattern Obsidian
// uses for treating the table as an atomic unit for deletion. The
// caller can press backspace again to actually delete the selected
// table.
export function backspaceAtTableBoundary(view) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const pos = sel.head
  if (pos === 0) return false
  const tree = syntaxTree(state)
  let tableBefore = null
  // Scan a few positions back for a Table whose end is adjacent to
  // the caret. `table.to` is the position just after the table's
  // last character — if the caret sits on the next line, `pos` will
  // be one past `table.to` (the \n separator at `table.to` + start
  // of the line after). Accept both.
  tree.iterate({
    from: Math.max(0, pos - 2),
    to: pos,
    enter: (n) => {
      if (n.name !== 'Table') return
      if (n.to === pos || n.to + 1 === pos) {
        tableBefore = n.node
      }
    }
  })
  if (!tableBefore) return false
  const range = tableBefore
  view.dispatch({
    selection: EditorSelection.range(range.from, range.to)
  })
  return true
}
// ---- state field ----------------------------------------------------
export function buildTableWidgets(state) {
  const ranges = []
  // Force full-doc parse so tables past the initial parsed region
  // also get the widget treatment. This StateField only rebuilds on
  // doc change; CM6's background parser advancing the tree later
  // doesn't retrigger it, so a partial tree at mount means orphaned
  // `| col |` raw lines for the rest of the session. 200ms budget
  // bounds the worst case on very long atoms.
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  const doc = state.doc
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Table') return
      const model = parseTable(state, node.node)
      if (!model) return
      // Block-replace needs whole-line coverage.
      const startLine = doc.lineAt(node.from)
      const endLine = doc.lineAt(node.to)
      ranges.push(
        Decoration.replace({
          widget: new TableWidget(model),
          block: true
        }).range(startLine.from, endLine.to)
      )
      return false // don't descend
    }
  })
  return Decoration.set(ranges, true)
}
// Detect whether a doc change could have added, removed, or modified
// a Table node. Two cheap signals:
//
//   1. Any existing table decoration overlaps the changed range
//      (edit to / deletion of an existing table).
//   2. Any line touched by the change contains a pipe `|`. GFM
//      tables are pipe-delimited, so every table line has one and
//      editing one without touching a pipe character is impossible.
//      Prose rarely contains pipes; the occasional false positive
//      is fine because `buildTableWidgets` fails cleanly when
//      lezer didn't emit a Table.
//
// If neither fires, skip the full-doc walk and just map existing
// decorations through the change.
export function changeAffectsTables(tr, existing) {
  let affected = false
  tr.changes.iterChanges((fromA, toA) => {
    if (affected) return
    existing.between(fromA, toA, () => {
      affected = true
      return false
    })
  })
  if (affected) return true
  const state = tr.state
  tr.changes.iterChanges((_fromA, _toA, fromB, toB) => {
    if (affected) return
    const startLine = state.doc.lineAt(fromB)
    const endLine = toB > startLine.to ? state.doc.lineAt(toB) : startLine
    for (let n = startLine.number; n <= endLine.number; n++) {
      if (state.doc.line(n).text.includes('|')) {
        affected = true
        break
      }
    }
  })
  return affected
}
const tableField = StateField.define({
  create: (state) => buildTableWidgets(state),
  update(deco, tr) {
    // Tree-growth effect: lezer's background parser caught up to a
    // region that wasn't parsed when we last built. Rebuild so any
    // newly-visible Table nodes get their widget.
    for (const effect of tr.effects) {
      if (effect.is(treeGrowthEffect)) return buildTableWidgets(tr.state)
    }
    if (!tr.docChanged) return deco
    const mapped = deco.map(tr.changes)
    if (!changeAffectsTables(tr, deco)) return mapped
    return buildTableWidgets(tr.state)
  },
  provide: (f) => EditorView.decorations.from(f)
})
const defaultLinkOpener = (url) => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    // window.open can throw in sandboxed iframes etc.
  }
}
// Per-view facet so `makeCell`'s pointerdown handler can look up the
// current link-click callback. Avoids threading the config through the
// widget constructor and toDOM args.
export const tableLinkClickFacet = Facet.define({
  combine: (values) => values[0] ?? defaultLinkOpener
})

const tableSelectionSyncPlugin = ViewPlugin.fromClass(
  class {
    update(update) {
      if (update.selectionSet || update.docChanged || update.viewportChanged) {
        this.syncSelection(update.view)
      }
    }
    syncSelection(view) {
      const sel = view.state.selection.main
      const tables = view.dom.querySelectorAll('.cm-atomic-table')
      for (const table of tables) {
        const pos = view.posAtDOM(table)
        // Check if this pos is inside the CodeMirror selection
        const isSelected = pos !== null && pos >= sel.from && pos <= sel.to && !sel.empty

        // If the actual DOM focus is INSIDE the table, the user is editing it.
        // Do NOT highlight the entire table blue in this case.
        const hasFocus = table.contains(document.activeElement)
        const hasDomSelection =
          window.getSelection().anchorNode && table.contains(window.getSelection().anchorNode)

        if (isSelected && !hasFocus && !hasDomSelection) {
          table.classList.add('cm-widget-selected-by-cm')
        } else {
          table.classList.remove('cm-widget-selected-by-cm')
        }
      }
    }
  }
)

export function tables(config = {}) {
  setupTableFormattingToolbar()
  return [
    tableField,
    treeProgressPlugin,
    tableSelectionSyncPlugin,
    ...(config.onLinkClick ? [tableLinkClickFacet.of(config.onLinkClick)] : []),
    Prec.high(keymap.of([{ key: 'Backspace', run: backspaceAtTableBoundary }]))
  ]
}
