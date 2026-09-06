import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, WidgetType, keymap, ViewPlugin } from '@codemirror/view'
import { StateField, StateEffect, Facet, Prec, Transaction } from '@codemirror/state'
import { undo, redo } from '@codemirror/commands'
import { treeGrowthEffect, treeProgressPlugin } from './tableParserProgress'
import { useVaultStore } from '../../core/store/workspaceStore'
import { TableAutocomplete } from './tableAutocomplete'
import { setupTableFormattingToolbar } from './tableToolbar'
import './table.css'
import { openCellMenu } from './tableMenu'
import { setupTableSelection } from './tableSelection'
import { setupTableDragAndDrop } from './tableDragDrop'
import { setupTableInsertion } from './tableInsert'
import { createTableHeaderDOM } from './tableHeader.js'
import { createTableFooterDOM, updateTableFooterCount } from './tableFooter.js'

import { parseTable, serializeTable, readModelFromDom, getCellSource } from './tableModel'
import { renderCellSourceDecorated, makeCell } from './tableCell'

export function findCurrentTableRange(view, dom) {
  if (!dom) return null
  const wrap = dom.closest ? (dom.closest('.cm-atomic-table') || dom) : dom
  if (!wrap) return null

  const doc = view.state.doc
  const tree = syntaxTree(view.state)

  let pos = -1
  if (wrap.dataset && wrap.dataset.tableFrom != null) {
    const parsedFrom = parseInt(wrap.dataset.tableFrom, 10)
    if (!isNaN(parsedFrom) && parsedFrom >= 0 && parsedFrom <= doc.length) {
      pos = parsedFrom
    }
  }

  if (pos < 0) {
    try {
      const block = view.lineBlockAtElement(wrap)
      if (block) pos = block.from
    } catch {}
  }

  if (pos < 0) {
    try {
      pos = view.posAtDOM(wrap)
    } catch {}
  }

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

  // 1. If pos is valid, find the Table node that directly matches or contains/is closest to pos
  if (pos >= 0) {
    // First check exact start line match (since pos is startLine.from)
    for (const n of tableNodes) {
      const sLine = doc.lineAt(n.from)
      let tableFrom = sLine.from
      if (sLine.number > 1) {
        const prevLine = doc.line(sLine.number - 1)
        if (
          prevLine.text.trim().match(/^<!--\s*table:\s*(.*?)\s*-->$/i) ||
          prevLine.text.trim().match(/^Table:\s*(.+)$/i)
        ) {
          tableFrom = prevLine.from
        }
      }
      if (pos === tableFrom || pos === n.from) {
        targetNode = n
        break
      }
    }

    if (!targetNode) {
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
      if (!targetNode && closest && minDist <= 500) {
        targetNode = closest
      }
    }
  }

  // 2. Fallback: match by exact DOM order among all rendered tables in document
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
export function scrollCellIntoView(scrollContainer, targetCell) {
  if (!scrollContainer || !targetCell) return
  const cell = targetCell.closest('th, td') || targetCell
  const cellRect = cell.getBoundingClientRect()
  const containerRect = scrollContainer.getBoundingClientRect()

  // Vertical scroll adjustment (ensure cell/cursor is completely above footer)
  if (cellRect.bottom > containerRect.bottom) {
    const diff = (cellRect.bottom - containerRect.bottom) + 10
    scrollContainer.scrollTop += diff
  } else if (cellRect.top < containerRect.top) {
    const diff = (containerRect.top - cellRect.top) + 10
    scrollContainer.scrollTop -= diff
  }

  // Horizontal scroll adjustment (ensure cell/cursor is within visible columns)
  if (cellRect.right > containerRect.right) {
    const diff = (cellRect.right - containerRect.right) + 16
    scrollContainer.scrollLeft += diff
  } else if (cellRect.left < containerRect.left) {
    const diff = (containerRect.left - cellRect.left) + 16
    scrollContainer.scrollLeft -= diff
  }
}
export function getAllCells(wrap) {
  return Array.from(wrap.querySelectorAll('thead th, tbody tr:not(.cm-table-empty-row) td'))
}
// ---- widget ---------------------------------------------------------
export class TableWidget extends WidgetType {
  constructor(model, from = -1, to = -1) {
    super()
    this.from = from
    this.to = to
    Object.defineProperty(this, 'model', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: model
    })
  }
  
  get estimatedHeight() {
    return Math.min(450, this.model.rows.length * 35 + 80)
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
    if (this.from >= 0) {
      wrap.dataset.tableFrom = String(this.from)
    }
    if (this.to >= 0) {
      wrap.dataset.tableTo = String(this.to)
    }
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

    createTableHeaderDOM(view, wrap, this.model)

    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'cm-table-scroll-container'

    // Prevent wheel events from propagating to CodeMirror scroller so scrolling inside
    // the table scrolls the table rows/columns, NOT the entire page/editor!
    scrollContainer.addEventListener(
      'wheel',
      (e) => {
        const canScrollY = scrollContainer.scrollHeight > scrollContainer.clientHeight
        const canScrollX = scrollContainer.scrollWidth > scrollContainer.clientWidth
        if (canScrollY || canScrollX) {
          e.stopPropagation()
          if (!canScrollY && canScrollX && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            scrollContainer.scrollLeft += e.deltaY
          }
        }
      },
      { passive: true }
    )

    const table = document.createElement('table')
    scrollContainer.appendChild(table)
    wrap.appendChild(scrollContainer)

    const rowCount = this.model.rows ? this.model.rows.length : 0
    const colCount = this.model.header ? this.model.header.length : 0

    if (colCount > 0) {
      table.style.minWidth = `${colCount * 110}px`
    }

    const thead = document.createElement('thead')

    const headerRow = document.createElement('tr')
    for (let i = 0; i < colCount; i++) {
      const cell = makeCell('th', this.model.header[i], view)
      cell.style.width = `${100 / colCount}%`
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
        dispatchModel(view, wrap, m, { isHeader: false, rowIdx: 0, colIdx: 0 })
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

    wrap.appendChild(createTableFooterDOM(this.model))

    setupTableFormattingToolbar(wrap, view)
    setupTableSelection(wrap, view)
    setupTableDragAndDrop(wrap, view)
    setupTableInsertion(wrap, view)

    return wrap
  }
  updateDOM(dom, view) {
    const theadTr = dom.querySelector('thead tr')
    const tbody = dom.querySelector('tbody')
    const table = dom.querySelector('table')
    if (!theadTr || !tbody || !table) return false

    const colCount = this.model.header.length
    const rowCount = this.model.rows.length

    if (colCount > 0) {
      table.style.minWidth = `${colCount * 110}px`
    }

    // 1. Sync header row (ths)
    let ths = Array.from(theadTr.querySelectorAll('th'))
    while (ths.length < colCount) {
      const idx = ths.length
      const th = makeCell('th', this.model.header[idx] ?? '', view)
      theadTr.appendChild(th)
      ths.push(th)
    }
    while (ths.length > colCount) {
      const extraTh = ths.pop()
      extraTh.remove()
    }

    for (let i = 0; i < colCount; i++) {
      ths[i].__view = view
      ths[i].style.width = `${100 / colCount}%`
      ths[i].style.minWidth = ''
      const source = ths[i].querySelector('.cm-atomic-table-cell-source')

      // Sync alignments
      const align = this.model.alignments?.[i] || ''
      ths[i].style.textAlign = align
      if (source) source.style.textAlign = align

      const textVal = this.model.header[i] ?? ''
      if (source && source.parentElement.dataset.raw !== textVal) {
        const isFocused = document.activeElement === source
        source.parentElement.dataset.raw = textVal
        renderCellSourceDecorated(source)
        if (isFocused) placeCaretAtEnd(source)
      }
    }

    // 2. Sync body rows (trs and tds)
    const emptyRow = tbody.querySelector('.cm-table-empty-row')
    if (rowCount === 0) {
      tbody.querySelectorAll('tr:not(.cm-table-empty-row)').forEach((tr) => tr.remove())
      if (!emptyRow) {
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
          const m = readModelFromDom(dom)
          const cols = m.header.length > 0 ? m.header.length : (colCount || 1)
          m.rows = [Array(cols).fill('')]
          dispatchModel(view, dom, m, { isHeader: false, rowIdx: 0, colIdx: 0 })
        }
        addBtn.addEventListener('mousedown', handleAddRow)
        addBtn.addEventListener('click', handleAddRow)
        emptyTr.appendChild(emptyTd)
        tbody.appendChild(emptyTr)
      } else {
        const emptyTd = emptyRow.querySelector('.cm-table-empty-cell')
        if (emptyTd) emptyTd.colSpan = colCount || 1
      }
    } else {
      if (emptyRow) emptyRow.remove()

      let trs = Array.from(tbody.querySelectorAll('tr:not(.cm-table-empty-row)'))
      // Add missing rows
      while (trs.length < rowCount) {
        const r = trs.length
        const tr = document.createElement('tr')
        for (let c = 0; c < colCount; c++) {
          const cell = makeCell('td', this.model.rows[r]?.[c] ?? '', view)
          if (this.model.alignments?.[c]) {
            cell.style.textAlign = this.model.alignments[c]
            const source = cell.querySelector('.cm-atomic-table-cell-source')
            if (source) source.style.textAlign = this.model.alignments[c]
          }
          tr.appendChild(cell)
        }
        tbody.appendChild(tr)
        trs.push(tr)
      }
      // Remove extra rows
      while (trs.length > rowCount) {
        const extraTr = trs.pop()
        extraTr.remove()
      }

      // Sync cells within each row
      for (let r = 0; r < rowCount; r++) {
        const tr = trs[r]
        let tds = Array.from(tr.querySelectorAll('td'))
        while (tds.length < colCount) {
          const c = tds.length
          const cell = makeCell('td', this.model.rows[r]?.[c] ?? '', view)
          if (this.model.alignments?.[c]) {
            cell.style.textAlign = this.model.alignments[c]
            const source = cell.querySelector('.cm-atomic-table-cell-source')
            if (source) source.style.textAlign = this.model.alignments[c]
          }
          tr.appendChild(cell)
          tds.push(cell)
        }
        while (tds.length > colCount) {
          const extraTd = tds.pop()
          extraTd.remove()
        }

        for (let c = 0; c < colCount; c++) {
          const td = tds[c]
          td.__view = view
          const source = td.querySelector('.cm-atomic-table-cell-source')
          const align = this.model.alignments?.[c] || ''
          td.style.textAlign = align
          if (source) source.style.textAlign = align

          const textVal = this.model.rows[r]?.[c] ?? ''
          if (source && source.parentElement.dataset.raw !== textVal) {
            const isFocused = document.activeElement === source
            source.parentElement.dataset.raw = textVal
            renderCellSourceDecorated(source)
            if (isFocused) placeCaretAtEnd(source)
          }
        }
      }
    }

    if (this.from >= 0) {
      dom.dataset.tableFrom = String(this.from)
    }
    if (this.to >= 0) {
      dom.dataset.tableTo = String(this.to)
    }

    if (this.model.caption !== dom.dataset.caption) {
      dom.dataset.caption = this.model.caption || ''
      const titleLabel = dom.querySelector('.cm-table-title-label')
      if (titleLabel) {
        titleLabel.textContent = this.model.caption || 'Table'
      }
      const titleBtn = dom.querySelector('.cm-table-title-btn')
      if (titleBtn) {
        titleBtn.setAttribute('data-tooltip', this.model.caption || 'Table')
      }
    }

    updateTableFooterCount(dom, this.model)

    return true
  }
  // All cell interactions are handled by the listeners we attach in
  // `makeCell`; tell CM6 to stay out of events within the widget so
  // its own selection/click logic doesn't compete with contenteditable.
  ignoreEvent() {
    return true
  }
}

export function cellRowIndex(cell) {
  if (!cell) return -1
  const targetCell = cell.closest ? (cell.closest('th, td') || cell) : cell
  const tr = targetCell.closest ? targetCell.closest('tr') : null
  const tbody = tr?.closest ? tr.closest('tbody') : null
  if (!tr || !tbody) return -1
  return Array.from(tbody.querySelectorAll('tr')).indexOf(tr)
}

export function cellColIndex(cell) {
  if (!cell) return -1
  const targetCell = cell.closest ? (cell.closest('th, td') || cell) : cell
  const tr = targetCell.closest ? targetCell.closest('tr') : null
  if (!tr) return -1
  return Array.from(tr.querySelectorAll('th, td')).indexOf(targetCell)
}

export function dispatchModel(view, wrap, nextModel, explicitFocusInfo = null) {
  const range = findCurrentTableRange(view, wrap)
  if (!range) return

  // Track focused cell before transaction so we can restore focus
  const activeEl = document.activeElement
  const wasInsideTable = wrap && wrap.contains(activeEl)
  let cellInfo = explicitFocusInfo
  if (!cellInfo && wasInsideTable && activeEl) {
    const cell = activeEl.closest('th, td')
    if (cell) {
      cellInfo = {
        isHeader: cell.tagName === 'TH',
        rowIdx: cellRowIndex(cell),
        colIdx: cellColIndex(cell)
      }
    }
  }

  const next = serializeTable(nextModel)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next },
    // Keep CM6 selection anchored inside the table while the widget DOM
    // rebuilds — without this the cursor snaps to pos 0.
    selection: { anchor: range.from },
    annotations: Transaction.userEvent.of('input')
  })

  // Re-focus the cell if one was active or explicitly requested
  if (cellInfo) {
    const fromPos = range.from
    const focusTarget = () => {
      const tables = Array.from(view.dom.querySelectorAll('.cm-atomic-table'))
      const target = (wrap && wrap.isConnected) ? wrap : (tables.find((t) => {
        const r = findCurrentTableRange(view, t)
        return r && r.from === fromPos
      }) || tables[0])
      if (!target) return
      let targetTr = null
      if (cellInfo.isHeader) {
        targetTr = target.querySelector('thead tr')
      } else {
        const bodyRows = target.querySelectorAll('tbody tr:not(.cm-table-empty-row)')
        if (bodyRows.length > 0) {
          const safeBodyIdx = Math.max(0, Math.min(cellInfo.rowIdx, bodyRows.length - 1))
          targetTr = bodyRows[safeBodyIdx]
        }
      }
      if (targetTr) {
        const cells = targetTr.querySelectorAll('.cm-atomic-table-cell-source')
        if (cells.length > 0) {
          const colIdx = Math.max(0, Math.min(cellInfo.colIdx, cells.length - 1))
          const targetCell = cells[colIdx]
          if (targetCell) {
            const scrollContainer = target.querySelector('.cm-table-scroll-container')
            if (scrollContainer) {
              scrollCellIntoView(scrollContainer, targetCell)
            }
            targetCell.focus({ preventScroll: true })
            placeCaretAtEnd(targetCell)
          }
        }
      }
    }

    focusTarget()
    requestAnimationFrame(() => {
      requestAnimationFrame(focusTarget)
    })
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
    // Never jump out of the table to pos 0 of the editor! Keep focus on the first cell.
    const firstCellSource = getCellSource(cells[0])
    if (firstCellSource) {
      firstCellSource.focus({ preventScroll: true })
      const sel = firstCellSource.ownerDocument?.defaultView?.getSelection()
      if (sel) {
        const range = document.createRange()
        range.selectNodeContents(firstCellSource)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    return
  }
  if (next >= cells.length) {
    if (opts.appendOnOverflow) {
      const thead = wrap.querySelector('thead tr')
      const colCount = thead ? thead.querySelectorAll('th').length : 1
      const currentCol = cellColIndex(cell)
      const focusCol = (Math.abs(dir) === 1) ? 0 : Math.max(0, currentCol >= 0 ? currentCol : (idx % colCount))
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
  const scrollContainer = wrap.querySelector('.cm-table-scroll-container')
  if (scrollContainer) {
    scrollCellIntoView(scrollContainer, source)
  }
  source.focus({ preventScroll: true })

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
  const model = readModelFromDom(wrap)
  model.rows.push(model.header.map(() => ''))
  dispatchModel(view, wrap, model, {
    isHeader: false,
    rowIdx: model.rows.length - 1,
    colIdx: focusColIndex
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
          widget: new TableWidget(model, fromPos, lastTableLine.to),
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
