import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, WidgetType, keymap, ViewPlugin } from '@codemirror/view'
import { StateField, StateEffect, Facet, Prec, Transaction } from '@codemirror/state'
import { undo, redo } from '@codemirror/commands'
import { treeGrowthEffect, treeProgressPlugin } from './tableParserProgress'
import { useVaultStore } from '../../core/store/useVaultStore'
import { TableAutocomplete } from './tableAutocomplete'
import { setupTableFormattingToolbar } from './tableToolbar'
import './table.css'
import { openCellMenu } from './tableContextMenu'
import { setupTableSelection } from './tableSelection'
import { setupTableDragAndDrop } from './tableDragDrop'
import { setupTableInsertion } from './tableInsert'
import { setupTableColResizing } from './tableResize'
import { icons } from './tableIcons.js'
import { createTableTitleDOM } from './tableRename.js'
import { createTableQuickActionsDOM } from './tableActions.js'
import { createTableViewModeToggleDOM } from './tableSourceView.js'

import { parseTable, serializeTable, readModelFromDom, getCellSource } from './tableModel'
import { renderCellSourceDecorated, makeCell } from './tableCell'

export function findCurrentTableRange(view, dom) {
  if (!dom) return null
  const wrap = dom.closest ? (dom.closest('.cm-atomic-table') || dom) : dom
  if (!wrap) return null

  const doc = view.state.doc
  const tree = syntaxTree(view.state)

  let pos = -1
  try {
    pos = view.posAtDOM(wrap)
  } catch {}

  if (pos < 0) {
    const child = wrap.querySelector('th, td, .cm-atomic-table-cell-source')
    if (child) {
      try {
        pos = view.posAtDOM(child)
      } catch {}
    }
  }

  // Find all Table nodes in the syntax tree
  const tableNodes = []
  tree.iterate({
    enter: (n) => {
      if (n.name === 'Table') {
        tableNodes.push(n.node)
        return false
      }
    }
  })

  if (tableNodes.length === 0) return null

  let targetNode = null

  // 1. If pos is valid, find the Table node that directly matches or is nearest to pos
  if (pos >= 0) {
    let closest = null
    let minDist = Infinity
    for (const n of tableNodes) {
      if (pos >= n.from && pos <= n.to) {
        targetNode = n
        break
      }
      const dist = Math.min(Math.abs(n.from - pos), Math.abs(n.to - pos))
      if (dist < minDist) {
        minDist = dist
        closest = n
      }
    }
    if (!targetNode && closest && minDist <= 250) {
      targetNode = closest
    }
  }

  // 2. Fallback: match by DOM index among all rendered tables in document
  if (!targetNode) {
    const allTables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
    const tableIdx = allTables.indexOf(wrap)
    if (tableIdx >= 0 && tableIdx < tableNodes.length) {
      targetNode = tableNodes[tableIdx]
    } else {
      targetNode = tableNodes[0]
    }
  }

  if (targetNode) {
    const startLine = doc.lineAt(targetNode.from)
    let fromPos = startLine.from
    if (startLine.number > 1) {
      const prevLine = doc.line(startLine.number - 1)
      if (
        prevLine.text.trim().match(/^<!--\s*table:\s*(.*?)\s*-->$/i) ||
        prevLine.text.trim().match(/^Table:\s*(.+)$/i)
      ) {
        fromPos = prevLine.from
      }
    }
    const endLine = doc.lineAt(targetNode.to)
    let lastTableLine = startLine
    for (let n = startLine.number; n <= endLine.number; n++) {
      const l = doc.line(n)
      if (l.text.includes('|')) {
        lastTableLine = l
      } else {
        break
      }
    }
    return { from: fromPos, to: lastTableLine.to }
  }

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
  
  get estimatedHeight() {
    return this.model.rows.length * 35 + 50
  }

  // Return false so CodeMirror calls updateDOM(dom, view) on changes.
  // updateDOM will then update cell contents in-place and return true to keep the DOM stable.
  eq(other) {
    return false
  }
  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = 'cm-atomic-table'
    wrap.tabIndex = -1
    if (this.model.caption) {
      wrap.dataset.caption = this.model.caption
    }

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

      if (event.target.closest('.cm-table-ui-header')) return // Let clicks inside the header pass through to buttons

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

    const header = document.createElement('div')
    header.className = 'cm-table-ui-header'
    header.contentEditable = 'false'

    // Left group: Editable Table Title Trigger + [Table | Source] View Toggle
    const leftGroup = document.createElement('div')
    leftGroup.className = 'cm-table-ui-left'
    leftGroup.appendChild(createTableTitleDOM(view, wrap, this.model))
    leftGroup.appendChild(createTableViewModeToggleDOM(view, wrap, this.model))

    // Right group: Dimension Badge + Quick Actions/Export + Delete button
    const rightGroup = document.createElement('div')
    rightGroup.className = 'cm-table-ui-right'

    // Dimension Badge: "3 Rows • 4 Cols"
    const dimBadge = document.createElement('div')
    dimBadge.className = 'cm-table-dim-badge'
    const rowCount = this.model.rows.length
    const colCount = this.model.header.length
    dimBadge.textContent = `${rowCount} ${rowCount === 1 ? 'Row' : 'Rows'} • ${colCount} ${colCount === 1 ? 'Col' : 'Cols'}`
    rightGroup.appendChild(dimBadge)

    rightGroup.appendChild(createTableQuickActionsDOM(view, wrap, this.model))

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'cm-table-ui-delete-btn'
    deleteBtn.title = 'Delete table'
    deleteBtn.innerHTML = icons.delete
    deleteBtn.addEventListener('mousedown', (e) => {
      e.preventDefault() // prevent losing focus
      e.stopPropagation()
      const range = findCurrentTableRange(view, wrap)
      if (range) {
        let from = range.from
        let to = range.to
        const doc = view.state.doc
        if (to < doc.length && view.state.sliceDoc(to, to + 1) === '\n') {
          to += 1
        } else if (from > 0 && view.state.sliceDoc(from - 1, from) === '\n') {
          from -= 1
        }
        view.dispatch({ changes: { from, to, insert: '' } })
        view.focus()
      }
    })
    rightGroup.appendChild(deleteBtn)

    header.appendChild(leftGroup)
    header.appendChild(rightGroup)
    wrap.appendChild(header)

    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'cm-table-scroll-container'

    const table = document.createElement('table')
    scrollContainer.appendChild(table)
    wrap.appendChild(scrollContainer)

    const thead = document.createElement('thead')

    const headerRow = document.createElement('tr')
    for (let i = 0; i < colCount; i++) {
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

    if (rowCount === 0) {
      const emptyTr = document.createElement('tr')
      emptyTr.className = 'cm-table-empty-row'
      const emptyTd = document.createElement('td')
      emptyTd.colSpan = colCount || 1
      emptyTd.className = 'cm-table-empty-cell'
      emptyTd.innerHTML = `
        <div class="cm-table-empty-state">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
          <span>No data rows yet</span>
          <button type="button" class="cm-table-empty-add-btn">+ Add Row</button>
        </div>
      `
      const addBtn = emptyTd.querySelector('.cm-table-empty-add-btn')
      const handleAddRow = (e) => {
        e.preventDefault()
        e.stopPropagation()
        const m = readModelFromDom(wrap)
        const cols = m.header.length > 0 ? m.header.length : (colCount || 1)
        m.rows = [Array(cols).fill('')]
        dispatchModel(view, wrap, m)
        requestAnimationFrame(() => {
          const firstCell = wrap.querySelector('tbody td .cm-atomic-table-cell-source')
          if (firstCell) firstCell.focus()
        })
      }
      addBtn.addEventListener('mousedown', handleAddRow)
      addBtn.addEventListener('click', handleAddRow)
      emptyTr.appendChild(emptyTd)
      tbody.appendChild(emptyTr)
    } else {
      for (let r = 0; r < rowCount; r++) {
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
    const hasEmptyRow = !!tbody.querySelector('.cm-table-empty-row')
    if (this.model.rows.length === 0) {
      if (!hasEmptyRow) return false
      return true
    }
    if (hasEmptyRow) return false

    const trs = Array.from(tbody.querySelectorAll('tr:not(.cm-table-empty-row)'))
    if (trs.length !== this.model.rows.length) return false

    // Update dimension badge if present
    const dimBadge = dom.querySelector('.cm-table-dim-badge')
    if (dimBadge) {
      const rowCount = this.model.rows.length
      const colCount = this.model.header.length
      dimBadge.textContent = `${rowCount} ${rowCount === 1 ? 'Row' : 'Rows'} • ${colCount} ${colCount === 1 ? 'Col' : 'Cols'}`
    }

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
    changes: { from: range.from, to: range.to, insert: next },
    annotations: Transaction.userEvent.of('input')
  })
  if (view && !view.hasFocus) {
    view.focus()
  }
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
    const range = findCurrentTableRange(view, wrap)
    let targetPos = range ? range.from : Math.max(0, view.posAtDOM(wrap) - 1)
    if (range) {
      if (targetPos > 0 && view.state.sliceDoc(targetPos - 1, targetPos) === '\n') {
        targetPos -= 1
      }
    } else {
      // Emergency fallback if table boundaries lost
      targetPos = Math.max(0, targetPos - 1)
    }
    view.dispatch({ selection: { anchor: targetPos } })
    view.focus()
    return
  }
  if (next >= cells.length) {
    if (opts.appendOnOverflow) {
      const thead = wrap.querySelector('thead tr')
      const colCount = thead ? thead.querySelectorAll('th').length : 1
      const focusCol = (Math.abs(dir) === 1) ? 0 : (idx % colCount)
      appendRow(view, wrap, focusCol)
    } else {
      // jump out below safely
      const range = findCurrentTableRange(view, wrap)
      let targetPos = range ? range.to : view.posAtDOM(wrap) + 10 // fallback
      
      if (range) {
        if (targetPos < view.state.doc.length && view.state.sliceDoc(targetPos, targetPos + 1) === '\n') {
          targetPos += 1
        } else if (targetPos === view.state.doc.length) {
          view.dispatch({ changes: { from: targetPos, insert: '\n' } })
          targetPos += 1
        }
      } else {
        // Extreme fallback if table range totally lost: just throw them to the end of the doc
        targetPos = view.state.doc.length
      }
      view.dispatch({ selection: { anchor: targetPos } })
      view.focus()
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
    changes: { from: range.from, to: range.to, insert: next },
    annotations: Transaction.userEvent.of('input')
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
      const target = tables.find(t => {
        const r = findCurrentTableRange(view, t)
        return r && r.from === from
      })
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

  const line = state.doc.lineAt(pos)
  // If the caret is not at the start of the line, let normal backspace edit text
  if (pos !== line.from) return false

  const tree = syntaxTree(state)
  let tableBefore = null
  tree.iterate({
    from: Math.max(0, pos - 3),
    to: pos,
    enter: (n) => {
      if (n.name !== 'Table') return
      if (n.to === pos || n.to + 1 === pos || n.to + 2 === pos) {
        tableBefore = n.node
      }
    }
  })

  if (!tableBefore) return false

  const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
  const startLine = state.doc.lineAt(tableBefore.from)
  const target = tables.find((t) => {
    try {
      const p = view.posAtDOM(t)
      return p === startLine.from || p === tableBefore.from
    } catch {
      return false
    }
  })

  if (target) {
    const trs = Array.from(target.querySelectorAll('tbody tr'))
    const lastRow = trs.length > 0 ? trs[trs.length - 1] : target.querySelector('thead tr')
    if (lastRow) {
      const cells = lastRow.querySelectorAll('.cm-atomic-table-cell-source')
      const lastCell = cells[cells.length - 1]
      if (lastCell) {
        if (line.text.trim() === '') {
          view.dispatch({
            changes: { from: Math.max(0, line.from - 1), to: line.to, insert: '' }
          })
        }
        lastCell.focus()
        placeCaretAtEnd(lastCell)
        return true
      }
    }
  }

  return false
}

export function arrowUpIntoTable(view) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const pos = sel.head
  if (pos === 0) return false

  // Scan backwards in the syntax tree for a Table node whose end is
  // adjacent to the current cursor position. The table widget is a
  // block Decoration.replace that swallows all source lines, so
  // line.number - 1 points *inside* the replaced range and won't
  // find anything. We look up to ~3 chars back to handle the \n
  // separator between the table and the following line.
  const tree = syntaxTree(state)
  let tableNode = null
  tree.iterate({
    from: Math.max(0, pos - 3),
    to: pos,
    enter: (n) => {
      if (n.name !== 'Table') return
      if (n.to === pos || n.to + 1 === pos || n.to + 2 === pos) {
        tableNode = n.node
      }
    }
  })

  if (!tableNode) return false

  const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
  const startLine = state.doc.lineAt(tableNode.from)
  const target = tables.find(t => {
    try {
      const p = view.posAtDOM(t)
      return p === startLine.from || p === tableNode.from
    } catch { return false }
  })

  if (target) {
    const trs = Array.from(target.querySelectorAll('tbody tr'))
    const lastRow = trs.length > 0 ? trs[trs.length - 1] : target.querySelector('thead tr')
    if (lastRow) {
      const cell = lastRow.querySelector('.cm-atomic-table-cell-source')
      if (cell) {
        cell.focus()
        placeCaretAtEnd(cell)
        return true
      }
    }
  }
  return false
}


export function arrowDownIntoTable(view) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const pos = sel.head

  const line = state.doc.lineAt(pos)
  if (line.number === state.doc.lines) return false
  
  const nextLine = state.doc.line(line.number + 1)
  
  const tree = syntaxTree(state)
  let tableNode = null
  tree.iterate({
    from: nextLine.from,
    to: nextLine.to,
    enter: (n) => {
      if (n.name === 'Table') {
        tableNode = n.node
        return false
      }
    }
  })

  if (!tableNode) return false

  const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
  const startLine = state.doc.lineAt(tableNode.from)
  const target = tables.find(t => {
    try {
      const pos = view.posAtDOM(t)
      return pos === startLine.from || pos === tableNode.from
    } catch { return false }
  })
  
  if (target) {
    const cell = target.querySelector('thead .cm-atomic-table-cell-source')
    if (cell) {
      cell.focus()
      placeCaretAtEnd(cell)
      return true
    }
  }
  return false
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
      const startLine = doc.lineAt(node.from)
      const endLine = doc.lineAt(node.to)
      let fromPos = startLine.from
      if (startLine.number > 1) {
        const prevLine = doc.line(startLine.number - 1)
        if (
          prevLine.text.trim().match(/^<!--\s*table:\s*(.*?)\s*-->$/i) ||
          prevLine.text.trim().match(/^Table:\s*(.+)$/i)
        ) {
          fromPos = prevLine.from
        }
      }
      let lastTableLine = startLine
      for (let n = startLine.number; n <= endLine.number; n++) {
        const l = doc.line(n)
        if (l.text.includes('|')) {
          lastTableLine = l
        } else {
          break
        }
      }
      ranges.push(
        Decoration.replace({
          widget: new TableWidget(model),
          block: true
        }).range(fromPos, lastTableLine.to)
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

      // Full-document selection (Ctrl+A): just mark all tables as selected
      // without calling posAtDOM which triggers a layout measurement and
      // causes the widget to shrink during reflow.
      const isFullDocSelect = sel.from === 0 && sel.to === view.state.doc.length && !sel.empty
      if (isFullDocSelect) {
        for (const table of tables) {
          const hasFocus = table.contains(document.activeElement)
          const hasDomSelection =
            window.getSelection().anchorNode && table.contains(window.getSelection().anchorNode)
          if (!hasFocus && !hasDomSelection) {
            table.classList.add('cm-widget-selected-by-cm')
          }
        }
        return
      }

      for (const table of tables) {
        const pos = view.posAtDOM(table)
        const isSelected = pos !== null && pos >= sel.from && pos <= sel.to && !sel.empty

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


export function preventTableDeletion(view, event) {
  const sel = view.state.selection.main
  if (sel.empty) return false
  
  // Check if the selection exactly matches a table
  const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
  for (const t of tables) {
    const r = findCurrentTableRange(view, t)
    if (r && sel.from === r.from && sel.to === r.to) {
      // The table is fully selected natively!
      if (event === 'Enter') {
        // Just focus the table instead of deleting it!
        const cell = t.querySelector('.cm-atomic-table-cell-source')
        if (cell) {
          cell.focus()
          placeCaretAtEnd(cell)
        }
        return true
      }
    }
  }
  return false
}

export function tables(config = {}) {
  setupTableFormattingToolbar()
  return [
    tableField,
    treeProgressPlugin,
    tableSelectionSyncPlugin,
    ...(config.onLinkClick ? [tableLinkClickFacet.of(config.onLinkClick)] : []),
    Prec.high(
      keymap.of([
        { key: 'Backspace', run: backspaceAtTableBoundary },
        { key: 'Enter', run: (view) => preventTableDeletion(view, 'Enter') },
        { key: 'ArrowUp', run: arrowUpIntoTable },
        { key: 'ArrowDown', run: arrowDownIntoTable }
      ])
    )
  ]
}
