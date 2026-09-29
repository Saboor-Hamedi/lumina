import { dispatchModel, placeCaretAtEnd, findCurrentTableRange } from './tableShared'
import { readModelFromDom as readParsedModel } from './tableModel'
import { redistributeColumnWidths } from './tableResize'
import type { EditorView } from '@codemirror/view'
import type { CellAlignment, TableModel, TableWidgetRange } from './tableModel'

type GridSelection = { minR: number; maxR: number; minC: number; maxC: number }
type TableSelectionWrapper = HTMLElement & {
  __setGridSelection?: (start: HTMLTableCellElement, end: HTMLTableCellElement) => void
  __getCoords?: (cell: HTMLTableCellElement) => { r: number; c: number }
  __getCellAt?: (row: number, column: number) => HTMLTableCellElement | null
  __clearSelectionVisuals?: () => void
  __getGridSelection?: () => GridSelection | null
  __selectAll?: () => void
}

function readModelFromDom(wrap: HTMLElement): TableModel & { alignments: CellAlignment[] } {
  const model = readParsedModel(wrap)
  model.alignments ??= Array(model.header.length).fill('')
  return model as TableModel & { alignments: CellAlignment[] }
}

export function setupTableSelection(wrap: TableSelectionWrapper, view: EditorView): void {
  let isDragging = false
  let startCell: HTMLTableCellElement | null = null
  let endCell: HTMLTableCellElement | null = null
  let hasSelection = false // track if we currently have a grid selection

  function getCoords(cell: HTMLTableCellElement): { r: number; c: number } {
    const isHeader = cell.tagName === 'TH'
    const tr = cell.closest('tr') as HTMLTableRowElement | null
    if (!tr) return { r: -1, c: -1 }
    const tbody = tr?.closest('tbody')

    let r = -1
    if (isHeader) {
      r = -1
    } else if (tbody) {
      r = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr')).indexOf(tr)
    }
    const c = Array.from(tr.querySelectorAll<HTMLTableCellElement>('th, td')).indexOf(cell)
    return { r, c }
  }

  function getCellAt(r: number, c: number): HTMLTableCellElement | null {
    if (r === -1) {
      const ths = wrap.querySelectorAll<HTMLTableCellElement>('thead th')
      return ths[c] ?? null
    } else {
      const trs = wrap.querySelectorAll<HTMLTableRowElement>('tbody tr')
      if (trs[r]) {
        const tds = trs[r].querySelectorAll<HTMLTableCellElement>('td')
        return tds[c] ?? null
      }
    }
    return null
  }

  function clearSelectionVisuals() {
    wrap.querySelectorAll<HTMLElement>('.cm-table-cell-selected').forEach((el) => {
      el.classList.remove('cm-table-cell-selected')
    })
    const overlay = wrap.querySelector<HTMLElement>('.cm-table-selection-overlay')
    if (overlay) overlay.style.display = 'none'
    hasSelection = false
  }

  function renderSelection() {
    clearSelectionVisuals()

    if (!startCell || !endCell) return

    const start = getCoords(startCell)
    const end = getCoords(endCell)
    if (start.c === -1 || end.c === -1) return

    const minR = Math.min(start.r, end.r)
    const maxR = Math.max(start.r, end.r)
    const minC = Math.min(start.c, end.c)
    const maxC = Math.max(start.c, end.c)

    // If it's just one cell and mouse is dragging, wait until dragging across multiple cells
    if (isDragging && minR === maxR && minC === maxC) return

    hasSelection = true

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = getCellAt(r, c)
        if (cell) {
          cell.classList.add('cm-table-cell-selected')
        }
      }
    }

    // Find the top-left and bottom-right cells
    const tlCell = getCellAt(minR, minC)
    const brCell = getCellAt(maxR, maxC)

    if (tlCell && brCell) {
      const scrollContainer = wrap.querySelector<HTMLElement>('.cm-table-scroll-container') || wrap
      let overlay = scrollContainer.querySelector<HTMLDivElement>('.cm-table-selection-overlay')
      if (!overlay) {
        overlay = document.createElement('div')
        overlay.className = 'cm-table-selection-overlay'
        overlay.style.pointerEvents = 'none' // GUARANTEE clicks pass through to the cells!

        // Ensure container is relative so the absolute overlay positions correctly
        const computed = window.getComputedStyle(scrollContainer)
        if (computed.position === 'static') {
          scrollContainer.style.position = 'relative'
        }
        scrollContainer.appendChild(overlay)
      }

      const containerRect = scrollContainer.getBoundingClientRect()
      const tlRect = tlCell.getBoundingClientRect()
      const brRect = brCell.getBoundingClientRect()

      // Calculate coordinates relative to the scroll container
      // Add scroll offsets of the container so the overlay scrolls with the table
      const topOffset = tlRect.top - containerRect.top + scrollContainer.scrollTop
      const leftOffset = tlRect.left - containerRect.left + scrollContainer.scrollLeft
      const width = brRect.right - tlRect.left
      const height = brRect.bottom - tlRect.top

      // Apply to overlay
      overlay.style.top = `${topOffset}px`
      overlay.style.left = `${leftOffset}px`
      overlay.style.width = `${width}px`
      overlay.style.height = `${height}px`
      overlay.style.display = 'block'
    }
  }

  // Use capture phase on document to guarantee we see the mousedown before any child
  // components (like wikilinks) can stop propagation.
  document.addEventListener(
    'mousedown',
    (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      if (e.button !== 0) return // Only left-clicks start selection
      if (target.closest('.cm-table-drag-handle')) return // Don't conflict with table column/row reorder handles
      if (!wrap.contains(target)) return // Handled by the window mousedown for outside clicks

      const cell = target.closest('th, td') as HTMLTableCellElement | null
      if (!cell) {
        clearSelectionVisuals()
        startCell = null
        endCell = null
        return
      }

      // They clicked a cell inside this table wrapper.
      clearSelectionVisuals()
      isDragging = true
      startCell = cell
      endCell = cell
    },
    true
  )

  let lastMouseX = 0
  let lastMouseY = 0
  let autoscrollRaf: number | null = null

  function checkAutoscroll(): void {
    if (!isDragging) return
    const scrollContainer = wrap.querySelector<HTMLElement>('.cm-table-scroll-container')
    if (!scrollContainer) return
    
    const rect = scrollContainer.getBoundingClientRect()
    const edgeThreshold = 40
    let dx = 0
    
    // Calculate scroll speed based on distance to edge for smooth acceleration
    if (lastMouseX < rect.left + edgeThreshold) {
      dx = Math.max(-15, lastMouseX - (rect.left + edgeThreshold))
    } else if (lastMouseX > rect.right - edgeThreshold) {
      dx = Math.min(15, lastMouseX - (rect.right - edgeThreshold))
    }
    
    if (dx !== 0) {
      scrollContainer.scrollLeft += dx
      
      const target = document.elementFromPoint(lastMouseX, lastMouseY)
      if (target) {
        const cell = target.closest('th, td') as HTMLTableCellElement | null
        if (cell && cell !== endCell && wrap.contains(cell)) {
          endCell = cell
          renderSelection()
        }
      }
      autoscrollRaf = requestAnimationFrame(checkAutoscroll)
    } else {
      autoscrollRaf = null
    }
  }

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!startCell) return

    if ((e.buttons & 1) !== 1) {
      isDragging = false
      wrap.classList.remove('cm-table-selecting')
      if (autoscrollRaf) { cancelAnimationFrame(autoscrollRaf); autoscrollRaf = null; }
      return
    }

    lastMouseX = e.clientX
    lastMouseY = e.clientY

    const target = document.elementFromPoint(e.clientX, e.clientY)
    if (!target) return

    const cell = target.closest('th, td') as HTMLTableCellElement | null
    const currentWrap = target.closest('.cm-atomic-table')

    if (!cell || cell === endCell || !currentWrap) {
      if (!autoscrollRaf) autoscrollRaf = requestAnimationFrame(checkAutoscroll)
      return
    }
    if (currentWrap !== wrap && !wrap.contains(cell)) {
      if (!cell.closest('.cm-atomic-table')) {
        if (!autoscrollRaf) autoscrollRaf = requestAnimationFrame(checkAutoscroll)
        return
      }
    }

    endCell = cell

    wrap.classList.add('cm-table-selecting')
    if (document.activeElement instanceof HTMLElement && wrap.contains(document.activeElement)) {
      document.activeElement.blur()
      window.getSelection()?.removeAllRanges()
    }

    wrap.focus({ preventScroll: true })
    renderSelection()
    
    if (!autoscrollRaf) autoscrollRaf = requestAnimationFrame(checkAutoscroll)
  })

  window.addEventListener('mouseup', () => {
    isDragging = false
    wrap.classList.remove('cm-table-selecting')
    if (autoscrollRaf) {
      cancelAnimationFrame(autoscrollRaf)
      autoscrollRaf = null
    }

    // If they just clicked/dragged within a single cell, don't keep it as a grid selection start
    if (startCell === endCell) {
      startCell = null
      endCell = null
      clearSelectionVisuals()
    }
  })

  window.addEventListener('mousedown', (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Element)) return
    if (target.closest('.cm-atomic-table-menu')) return
    if (!wrap.contains(target)) {
      clearSelectionVisuals()
      startCell = null
      endCell = null
    }
  })

  wrap.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!hasSelection) {
      // If they press Escape while editing text inside a cell, exit text editing mode and select the cell!
      if (e.key === 'Escape') {
        const source = document.activeElement
        if (source instanceof HTMLElement && source.classList.contains('cm-atomic-table-cell-source')) {
          const cell = source.closest('th, td') as HTMLTableCellElement | null
          if (cell) {
            source.blur()
            wrap.focus()
            startCell = cell
            endCell = cell
            renderSelection()
            e.preventDefault()
          }
        }
      }
      return
    }

    const selected = Array.from(wrap.querySelectorAll<HTMLTableCellElement>('.cm-table-cell-selected'))
    if (selected.length === 0) return

    // Intercept Ctrl+C / Cmd+C because the native 'copy' event won't fire if the browser selection is empty
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault()

      if (!startCell || !endCell) return
      const start = getCoords(startCell)
      const end = getCoords(endCell)
      const minR = Math.min(start.r, end.r)
      const maxR = Math.max(start.r, end.r)
      const minC = Math.min(start.c, end.c)
      const maxC = Math.max(start.c, end.c)

      let markdown = []

      if (minR === -1) {
        let headerText = []
        for (let c = minC; c <= maxC; c++) {
          const cell = getCellAt(-1, c)
          const source = cell?.querySelector<HTMLElement>('.cm-atomic-table-cell-source')
          headerText.push((source ? source.textContent : '').replace(/\|/g, '\\|'))
        }
        markdown.push('| ' + headerText.join(' | ') + ' |')

        let dividerText = []
        for (let c = minC; c <= maxC; c++) dividerText.push('---')
        markdown.push('| ' + dividerText.join(' | ') + ' |')
      }

      const bodyStart = Math.max(0, minR)
      for (let r = bodyStart; r <= maxR; r++) {
        let rowText = []
        for (let c = minC; c <= maxC; c++) {
          const cell = getCellAt(r, c)
          const source = cell?.querySelector<HTMLElement>('.cm-atomic-table-cell-source')
          rowText.push((source ? source.textContent : '').replace(/\|/g, '\\|'))
        }
        markdown.push('| ' + rowText.join(' | ') + ' |')
      }

      navigator.clipboard.writeText(markdown.join('\n'))
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      if (!startCell || !endCell) return
      const start = getCoords(startCell)
      const end = getCoords(endCell)
      const minR = Math.min(start.r, end.r)
      const maxR = Math.max(start.r, end.r)
      const minC = Math.min(start.c, end.c)
      const maxC = Math.max(start.c, end.c)
      const colTotal = wrap.querySelectorAll('thead th').length
      const tbody = wrap.querySelector('tbody')
      const rowTotal = tbody ? tbody.querySelectorAll('tr:not(.cm-table-empty-row)').length : 0

      // Backspace/Delete clears selected cells. Structural row/column deletion
      // remains available through the table menu, so keyboard editing is safe.
      selected.forEach((cell) => {
        cell.dataset.raw = ''
        const source = cell.querySelector<HTMLElement>('.cm-atomic-table-cell-source')
        if (source) source.textContent = ''
      })
      clearSelectionVisuals()
      startCell = null
      endCell = null
      const clearedModel = readModelFromDom(wrap)
      dispatchModel(view, wrap, clearedModel, {
        isHeader: minR === -1,
        rowIdx: Math.max(0, minR),
        colIdx: Math.max(0, minC)
      })
      return

      // If full row(s) are selected (and not the header row), delete the row(s)!
      if (minR >= 0 && minC === 0 && maxC >= colTotal - 1) {
        const m = readModelFromDom(wrap)
        const deleteCount = maxR - minR + 1
        m.rows.splice(minR, deleteCount)
        clearSelectionVisuals()
        startCell = null
        endCell = null
        const nextRowIdx = Math.min(minR, m.rows.length - 1)
        const focusInfo = m.rows.length > 0
          ? { isHeader: false, rowIdx: Math.max(0, nextRowIdx), colIdx: 0 }
          : { isHeader: true, rowIdx: 0, colIdx: 0 }
        dispatchModel(view, wrap, m, focusInfo)
        return
      }

      // If full column(s) are selected (from header to bottom), delete the column(s)!
      const isFullCol = minR === -1 && (rowTotal === 0 ? maxR === -1 : maxR === rowTotal - 1)
      if (isFullCol) {
        if (colTotal <= (maxC - minC + 1)) {
          // Entire table is selected: delete the entire table
          const range = findCurrentTableRange(view, wrap)
          if (!range) return
          const { from, to } = range as TableWidgetRange
          clearSelectionVisuals()
          startCell = null
          endCell = null
          view.dispatch({
            changes: { from, to, insert: '' },
            selection: { anchor: from },
            scrollIntoView: true
          })
          view.focus()
          return
        }
        const m = readModelFromDom(wrap)
        const deleteCount = maxC - minC + 1
        m.header.splice(minC, deleteCount)
        m.alignments.splice(minC, deleteCount)
        const columnWidths = m.columnWidths ?? []
        if (columnWidths.length) {
          columnWidths.splice(minC, deleteCount)
          // Redistribute freed space so remaining columns fill the container.
          m.columnWidths = redistributeColumnWidths(columnWidths, wrap)
        }
        for (const r of m.rows) r.splice(minC, deleteCount)
        clearSelectionVisuals()
        startCell = null
        endCell = null
        const nextCol = Math.max(0, Math.min(minC, m.header.length - 1))
        const focusInfo = { isHeader: true, rowIdx: 0, colIdx: nextCol }
        dispatchModel(view, wrap, m, focusInfo)
        return
      }

      // If not a full row and not a full column: clear content of selected cells
      selected.forEach((cell) => {
        cell.dataset.raw = ''
        const source = cell.querySelector<HTMLElement>('.cm-atomic-table-cell-source')
        if (source) source.textContent = ''
      })
      clearSelectionVisuals()
      startCell = null
      endCell = null
      const m = readModelFromDom(wrap)
      const focusInfo = {
        isHeader: minR === -1,
        rowIdx: Math.max(0, minR),
        colIdx: Math.max(0, minC)
      }
      dispatchModel(view, wrap, m, focusInfo)
      return
    }

    // Phase 3: Keyboard selection via Shift + Arrow Keys
    if (e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const selectionEnd = endCell || startCell
      if (!selectionEnd) return
      const end = getCoords(selectionEnd)
      if (end.c === -1) return

      let r = end.r
      let c = end.c

      if (e.key === 'ArrowUp') r = Math.max(-1, r - 1)
      if (e.key === 'ArrowDown') {
        const tbody = wrap.querySelector('tbody')
        const rowCount = tbody ? tbody.querySelectorAll('tr:not(.cm-table-empty-row)').length : 0
        r = Math.min(rowCount - 1, r + 1)
      }
      if (e.key === 'ArrowLeft') c = Math.max(0, c - 1)
      if (e.key === 'ArrowRight') {
        const colCount = wrap.querySelectorAll('thead th').length
        c = Math.min(colCount - 1, c + 1)
      }

      const newEnd = getCellAt(r, c)
      if (newEnd) {
        if (!startCell) startCell = newEnd
        endCell = newEnd
        renderSelection()
      }
      return
    }

    // If they press an un-shifted arrow key, return control to cell editing
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (e.key.startsWith('Arrow') || e.key === 'Escape') {
        const target = endCell || startCell
        clearSelectionVisuals()
        startCell = null
        endCell = null
        if (target) {
          const source = target.querySelector<HTMLElement>('.cm-atomic-table-cell-source')
          if (source) {
            source.focus()
            placeCaretAtEnd(source)
          }
        }
        e.preventDefault()
      } else {
        clearSelectionVisuals()
        startCell = null
        endCell = null
      }
    }
  })

  wrap.tabIndex = -1

  wrap.__setGridSelection = (c1, c2) => {
    startCell = c1
    endCell = c2
    renderSelection()
    if (document.activeElement instanceof HTMLElement && wrap.contains(document.activeElement)) {
      document.activeElement.blur()
      window.getSelection()?.removeAllRanges()
    }
    wrap.focus({ preventScroll: true })
  }

  wrap.__getCoords = getCoords
  wrap.__getCellAt = getCellAt
  wrap.__clearSelectionVisuals = clearSelectionVisuals
  wrap.__getGridSelection = () => {
    if (!hasSelection || !startCell || !endCell) return null
    if (!startCell || !endCell) return null
    const start = getCoords(startCell)
    const end = getCoords(endCell)
    if (start.c === -1 || end.c === -1) return null
    return {
      minR: Math.min(start.r, end.r),
      maxR: Math.max(start.r, end.r),
      minC: Math.min(start.c, end.c),
      maxC: Math.max(start.c, end.c)
    }
  }

  /**
   * Programmatically select all cells (header + all body rows).
   * Called by the "Select All" menu item.
   */
  wrap.__selectAll = () => {
    const firstTh = wrap.querySelector<HTMLTableCellElement>('thead th')
    // Exclude placeholder/empty rows so selMaxR reflects real data rows only.
    const dataRows = Array.from(
      wrap.querySelectorAll<HTMLTableRowElement>('tbody tr:not(.cm-table-empty-row)')
    )
    const lastRow = dataRows.at(-1)
    const lastTd = lastRow
      ? Array.from(lastRow.querySelectorAll<HTMLTableCellElement>('td')).at(-1)
      : null
    if (!firstTh || !lastTd) return
    startCell = firstTh
    endCell = lastTd
    isDragging = false
    renderSelection()
  }
}
