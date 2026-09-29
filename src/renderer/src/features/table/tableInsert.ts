import { dispatchModel } from './tableShared'
import { readModelFromDom } from './tableModel'

export function setupTableInsertion(wrap, view) {
  const plusIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`

  // Row Insert Marker (Bottom handle for adding rows)
  const rowInsertHandle = document.createElement('div')
  rowInsertHandle.className = 'cm-table-insert-marker cm-table-insert-marker-row'
  rowInsertHandle.setAttribute('aria-label', 'Add row')
  rowInsertHandle.setAttribute('data-tooltip', 'Add row')
  rowInsertHandle.setAttribute('data-tooltip-pos', 'right')
  rowInsertHandle.innerHTML = plusIcon
  rowInsertHandle.style.position = 'absolute'
  rowInsertHandle.style.display = 'flex'
  rowInsertHandle.style.alignItems = 'center'
  rowInsertHandle.style.justifyContent = 'center'
  
  rowInsertHandle.style.width = '26px'
  rowInsertHandle.style.height = '26px'
  rowInsertHandle.style.boxSizing = 'border-box'
  rowInsertHandle.style.cursor = 'pointer'
  rowInsertHandle.style.opacity = '0'
  rowInsertHandle.style.pointerEvents = 'none'
  rowInsertHandle.style.zIndex = '999'
  rowInsertHandle.style.transform = 'translate(-50%, 0)'
  rowInsertHandle.style.transition = 'opacity 0.15s ease'

  // Col Insert Marker (Right handle for adding columns)
  const colInsertHandle = document.createElement('div')
  colInsertHandle.className = 'cm-table-insert-marker cm-table-insert-marker-col'
  colInsertHandle.setAttribute('aria-label', 'Add column')
  colInsertHandle.setAttribute('data-tooltip', 'Add column')
  colInsertHandle.setAttribute('data-tooltip-pos', 'bottom')
  colInsertHandle.innerHTML = plusIcon
  colInsertHandle.style.position = 'absolute'
  colInsertHandle.style.display = 'flex'
  colInsertHandle.style.alignItems = 'center'
  colInsertHandle.style.justifyContent = 'center'
  
  colInsertHandle.style.width = '26px'
  colInsertHandle.style.height = '26px'
  colInsertHandle.style.boxSizing = 'border-box'
  colInsertHandle.style.cursor = 'pointer'
  colInsertHandle.style.opacity = '0'
  colInsertHandle.style.pointerEvents = 'none'
  colInsertHandle.style.zIndex = '999'
  colInsertHandle.style.transform = 'translate(0, -50%)'
  colInsertHandle.style.transition = 'opacity 0.15s ease'

  wrap.appendChild(rowInsertHandle)
  wrap.appendChild(colInsertHandle)

  const getTableOffset = (table) => {
    const tableRect = table.getBoundingClientRect()
    const wrapRect = wrap.getBoundingClientRect()
    return {
      left: tableRect.left - wrapRect.left,
      top: tableRect.top - wrapRect.top,
      width: tableRect.width,
      height: tableRect.height
    }
  }

  const hideHandles = () => {
    rowInsertHandle.style.opacity = '0'
    rowInsertHandle.style.pointerEvents = 'none'
    colInsertHandle.style.opacity = '0'
    colInsertHandle.style.pointerEvents = 'none'
  }

  wrap.addEventListener('mousemove', (e) => {
    if (e.target.closest('.cm-table-insert-marker')) return

    const table = wrap.querySelector('table')
    if (!table) return

    const wrapRect = wrap.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()
    const tableOffset = getTableOffset(table)
    const footer = wrap.querySelector('.cm-table-ui-footer')
    const footerRect = footer?.getBoundingClientRect()
    const THRESHOLD = 12

    if (
      wrap.classList.contains('is-dragging-cols') ||
      wrap.classList.contains('is-dragging-rows') ||
      e.target.closest('.cm-table-drag-handle')
    ) {
      hideHandles()
      return
    }

    const tableBottom = footerRect
      ? footerRect.bottom - wrapRect.top
      : tableOffset.top + tableOffset.height
    const tableRight = footerRect
      ? Math.max(tableOffset.left + tableOffset.width, footerRect.right - wrapRect.left)
      : tableOffset.left + tableOffset.width

    // Expanded hit-test zones
    const overFooter = Boolean(
      footerRect &&
      e.clientX >= wrapRect.left &&
      e.clientX <= wrapRect.right &&
      e.clientY >= footerRect.top - 4 &&
      e.clientY <= footerRect.bottom + 30
    )

    const rightBoundaryX = wrapRect.left + tableRight
    const overRightEdge = Boolean(
      e.clientY >= tableRect.top - 10 &&
      e.clientY <= (footerRect ? footerRect.bottom : tableRect.bottom) + 10 &&
      e.clientX >= rightBoundaryX - 25 &&
      e.clientX <= rightBoundaryX + 35
    )

    if (overFooter) {
      // Position bottom handle centered along footer
      const buttonSize = 26
      const centerX = wrapRect.width / 2

      rowInsertHandle.style.left = `${centerX}px`
      rowInsertHandle.style.top = `${tableBottom - 13}px` // centered along footer bottom line
      rowInsertHandle.style.opacity = '1'
      rowInsertHandle.style.pointerEvents = 'auto'
      rowInsertHandle.dataset.index = String(table.querySelectorAll('tbody tr:not(.cm-table-empty-row)').length + 1)

      colInsertHandle.style.opacity = '0'
      colInsertHandle.style.pointerEvents = 'none'
      return
    }

    if (overRightEdge) {
      // Position right handle at vertical middle of table on outer right edge
      colInsertHandle.style.left = `${tableRight - 13}px`
      colInsertHandle.style.top = `${tableOffset.top + tableOffset.height / 2}px`
      colInsertHandle.style.opacity = '1'
      colInsertHandle.style.pointerEvents = 'auto'
      colInsertHandle.dataset.index = String(table.querySelectorAll('thead th').length)

      rowInsertHandle.style.opacity = '0'
      rowInsertHandle.style.pointerEvents = 'none'
      return
    }

    hideHandles()
  })

  wrap.addEventListener('mouseleave', (e) => {
    // If mouse is moving into one of the insert handles, keep visible
    if (e.relatedTarget && (e.relatedTarget === rowInsertHandle || e.relatedTarget === colInsertHandle || rowInsertHandle.contains(e.relatedTarget) || colInsertHandle.contains(e.relatedTarget))) {
      return
    }
    if (rowInsertHandle.matches(':hover') || colInsertHandle.matches(':hover')) return
    hideHandles()
  })

  const keepHandleVisible = (handle) => {
    handle.style.opacity = '1'
    handle.style.pointerEvents = 'auto'
  }
  rowInsertHandle.addEventListener('mouseenter', () => keepHandleVisible(rowInsertHandle))
  colInsertHandle.addEventListener('mouseenter', () => keepHandleVisible(colInsertHandle))

  // Click on bottom handle inserts a ROW
  rowInsertHandle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const index = parseInt(rowInsertHandle.dataset.index, 10)
    if (isNaN(index) || index < 1) return

    const model = readModelFromDom(wrap)
    const nextModel = {
      header: [...model.header],
      alignments: [...(model.alignments || [])],
      rows: model.rows.map((r) => [...r]),
      columnWidths: model.columnWidths?.length ? [...model.columnWidths] : [],
      rowHeights: model.rowHeights?.length ? [...model.rowHeights] : []
    }

    const targetRowIdx = index - 1
    const newRow = Array(nextModel.header.length).fill('')
    nextModel.rows.splice(targetRowIdx, 0, newRow)
    if (nextModel.rowHeights.length) {
      nextModel.rowHeights.splice(targetRowIdx, 0, 28)
    }

    dispatchModel(view, wrap, nextModel, {
      isHeader: false,
      rowIdx: targetRowIdx,
      colIdx: 0
    })
    hideHandles()
  })

  // Click on right handle inserts a COLUMN
  colInsertHandle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const index = parseInt(colInsertHandle.dataset.index, 10)
    if (isNaN(index) || index < 1) return

    const model = readModelFromDom(wrap)
    const nextModel = {
      header: [...model.header],
      alignments: [...(model.alignments || [])],
      rows: model.rows.map((r) => [...r]),
      columnWidths: model.columnWidths?.length ? [...model.columnWidths] : [],
      rowHeights: model.rowHeights?.length ? [...model.rowHeights] : []
    }

    nextModel.header.splice(index, 0, '')
    nextModel.alignments.splice(index, 0, 'left')
    if (nextModel.columnWidths.length) {
      nextModel.columnWidths.splice(index, 0, 110)
    }
    nextModel.rows.forEach((row) => row.splice(index, 0, ''))

    dispatchModel(view, wrap, nextModel, {
      isHeader: true,
      rowIdx: 0,
      colIdx: index
    })
    hideHandles()
  })
}
