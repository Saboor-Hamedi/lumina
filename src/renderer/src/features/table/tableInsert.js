import { dispatchModel } from './tableExtension.js'
import { readModelFromDom } from './tableModel.js'

export function setupTableInsertion(wrap, view) {
  const plusIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`

  // Row Insert Marker
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
  
  rowInsertHandle.style.width = '24px'
  rowInsertHandle.style.height = '24px'
  rowInsertHandle.style.boxSizing = 'border-box'
  rowInsertHandle.style.border = 'none'
  rowInsertHandle.style.backgroundClip = 'border-box'
  rowInsertHandle.style.backgroundColor = 'var(--text-accent, #2196f3)'
  
  rowInsertHandle.style.borderRadius = '4px'
  rowInsertHandle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
  rowInsertHandle.style.backdropFilter = 'blur(4px)'
  rowInsertHandle.style.color = '#fff'
  rowInsertHandle.style.cursor = 'pointer'
  rowInsertHandle.style.opacity = '0'
  rowInsertHandle.style.pointerEvents = 'none'
  rowInsertHandle.style.zIndex = '999' // high z-index
  rowInsertHandle.style.transform = 'translate(0, 0)'
  rowInsertHandle.style.transition = 'opacity 0.15s ease'

  // Col Insert Marker
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
  
  colInsertHandle.style.width = '24px'
  colInsertHandle.style.height = '24px'
  colInsertHandle.style.boxSizing = 'border-box'
  colInsertHandle.style.border = 'none'
  colInsertHandle.style.backgroundClip = 'border-box'
  colInsertHandle.style.backgroundColor = 'var(--text-accent, #2196f3)'
  
  colInsertHandle.style.borderRadius = '4px'
  colInsertHandle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
  colInsertHandle.style.backdropFilter = 'blur(4px)'
  colInsertHandle.style.color = '#fff'
  colInsertHandle.style.cursor = 'pointer'
  colInsertHandle.style.opacity = '0'
  colInsertHandle.style.pointerEvents = 'none'
  colInsertHandle.style.zIndex = '999' // high z-index
  colInsertHandle.style.transform = 'translate(0, 0)'
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
    const tableRight = tableOffset.left + tableOffset.width
    const withinTableX = e.clientX >= tableRect.left - THRESHOLD && e.clientX <= tableRect.right + THRESHOLD
    const withinTableY = e.clientY >= tableRect.top - THRESHOLD && e.clientY <= tableRect.bottom + THRESHOLD
    const overFooter = Boolean(
      footerRect &&
      e.clientX >= footerRect.left &&
      e.clientX <= footerRect.right &&
      e.clientY >= footerRect.top &&
      e.clientY <= footerRect.bottom
    )
    const nearRightEdge = withinTableY && Math.abs(e.clientX - tableRect.right) <= THRESHOLD

    if (overFooter && withinTableX) {
      colInsertHandle.style.left = `${tableOffset.left + tableOffset.width / 2}px`
      colInsertHandle.style.top = `${tableBottom}px`
      colInsertHandle.style.width = `${tableOffset.width}px`
      colInsertHandle.style.height = '8px'
      colInsertHandle.style.transform = 'translate(-50%, 0)'
      colInsertHandle.style.opacity = '1'
      colInsertHandle.style.pointerEvents = 'auto'
      colInsertHandle.dataset.index = String(table.querySelectorAll('tbody tr:not(.cm-table-empty-row)').length + 1)

      rowInsertHandle.style.opacity = '0'
      rowInsertHandle.style.pointerEvents = 'none'
      return
    }

    if (nearRightEdge) {
      colInsertHandle.style.opacity = '0'
      colInsertHandle.style.pointerEvents = 'none'
      rowInsertHandle.style.opacity = '0'
      rowInsertHandle.style.left = `${tableRight}px`
      rowInsertHandle.style.top = `${tableOffset.top + tableOffset.height / 2}px`
      rowInsertHandle.style.width = '8px'
      rowInsertHandle.style.height = `${tableOffset.height}px`
      rowInsertHandle.style.transform = 'translate(0, -50%)'
      rowInsertHandle.style.opacity = '1'
      rowInsertHandle.style.pointerEvents = 'auto'
      rowInsertHandle.dataset.index = String(table.querySelectorAll('thead th').length)
      colInsertHandle.style.opacity = '0'
      colInsertHandle.style.pointerEvents = 'none'
      return
    }

    hideHandles()
  })

  wrap.addEventListener('mouseleave', () => {
    if (rowInsertHandle.matches(':hover') || colInsertHandle.matches(':hover')) return
    rowInsertHandle.style.opacity = '0'
    colInsertHandle.style.opacity = '0'
    rowInsertHandle.style.pointerEvents = 'none'
    colInsertHandle.style.pointerEvents = 'none'
  })

  const keepHandleVisible = (handle) => {
    handle.style.opacity = '1'
    handle.style.pointerEvents = 'auto'
  }
  rowInsertHandle.addEventListener('mouseenter', () => keepHandleVisible(rowInsertHandle))
  colInsertHandle.addEventListener('mouseenter', () => keepHandleVisible(colInsertHandle))

  rowInsertHandle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const index = parseInt(rowInsertHandle.dataset.index, 10)
    if (isNaN(index) || index < 1) return

    const model = readModelFromDom(wrap)
    const nextModel = {
      header: [...model.header],
      alignments: [...(model.alignments || [])],
      rows: model.rows.map((r) => [...r])
    }

    nextModel.header.splice(index, 0, '')
    nextModel.alignments.splice(index, 0, 'left')
    nextModel.rows.forEach((row) => row.splice(index, 0, ''))

    dispatchModel(view, wrap, nextModel, {
      isHeader: true,
      rowIdx: 0,
      colIdx: index
    })
    hideHandles()
  })

  colInsertHandle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const index = parseInt(colInsertHandle.dataset.index, 10)
    if (isNaN(index) || index < 1) return

    const model = readModelFromDom(wrap)
    const nextModel = {
      header: [...model.header],
      alignments: [...(model.alignments || [])],
      rows: model.rows.map((r) => [...r])
    }

    const targetRowIdx = index - 1
    const newRow = Array(nextModel.header.length).fill('')
    nextModel.rows.splice(targetRowIdx, 0, newRow)

    dispatchModel(view, wrap, nextModel, {
      isHeader: false,
      rowIdx: targetRowIdx,
      colIdx: 0
    })
    hideHandles()
  })
}
