import { readModelFromDom } from './tableModel.js'

const MIN_COLUMN_WIDTH = 72
const MIN_ROW_HEIGHT = 32
const RESIZE_ZONE = 10

function setColumnWidths(table, columnIndex, delta, initialWidths) {
  if (columnIndex < 0 || columnIndex >= initialWidths.length) return
  const rows = table.querySelectorAll('tr')
  const nextWidths = [...initialWidths]
  nextWidths[columnIndex] = Math.max(MIN_COLUMN_WIDTH, initialWidths[columnIndex] + delta)

  const totalWidth = nextWidths.reduce((sum, width) => sum + width, 0)
  table.style.setProperty('width', `${totalWidth}px`, 'important')
  table.style.setProperty('min-width', `${totalWidth}px`, 'important')

  rows.forEach((row) => {
    Array.from(row.children).forEach((cell, index) => {
      const nextWidth = nextWidths[index]
      if (nextWidth) {
        cell.style.setProperty('width', `${nextWidth}px`, 'important')
        cell.style.setProperty('min-width', `${nextWidth}px`, 'important')
        cell.style.setProperty('max-width', `${nextWidth}px`, 'important')
      }
    })
  })
}

function setRowHeight(row, height) {
  row.style.height = `${height}px`
  Array.from(row.children).forEach((cell) => {
    cell.style.height = `${height}px`
  })
}

export function setupTableColResizing(wrap, onCommit = null) {
  const table = wrap?.querySelector('table')
  if (!table) return () => {}

  const columnGrip = document.createElement('div')
  columnGrip.className = 'cm-table-resize-grip cm-table-column-resize-grip'
  const rowGrip = document.createElement('div')
  rowGrip.className = 'cm-table-resize-grip cm-table-row-resize-grip'
  wrap.append(columnGrip, rowGrip)

  let resizeType = null
  let resizeIndex = -1
  let startCoordinate = 0
  let startSize = 0
  let activeRow = null
  let initialColumnWidths = []

  const getResizeTarget = (event) => {
    const rows = Array.from(table.querySelectorAll('tr:not(.cm-table-empty-row)'))
    for (const row of rows) {
      const cells = Array.from(row.children)
      if (event.clientY < row.getBoundingClientRect().top - RESIZE_ZONE || event.clientY > row.getBoundingClientRect().bottom + RESIZE_ZONE) {
        continue
      }
      for (let index = 0; index < cells.length; index += 1) {
        const rect = cells[index].getBoundingClientRect()
        if (Math.abs(event.clientX - rect.right) <= RESIZE_ZONE) {
          return { type: 'column', index, size: rect.width, cell: cells[index] }
        }
      }
    }

    const bodyRows = Array.from(table.querySelectorAll('tbody tr:not(.cm-table-empty-row)'))
    for (const row of bodyRows) {
      const rect = row.getBoundingClientRect()
      if (Math.abs(event.clientY - rect.bottom) <= RESIZE_ZONE && event.clientX >= rect.left - RESIZE_ZONE) {
        return { type: 'row', row, size: rect.height }
      }
    }

    return null
  }

  const onMouseMove = (event) => {
    if (resizeType) return
    if (event.target.closest?.('.cm-table-resize-grip')) {
      wrap.style.cursor = event.target.closest('.cm-table-column-resize-grip')
        ? 'col-resize'
        : 'row-resize'
      return
    }
    const target = getResizeTarget(event)
    wrap.style.cursor = target ? (target.type === 'column' ? 'col-resize' : 'row-resize') : ''

    columnGrip.classList.toggle('visible', Boolean(target?.type === 'column'))
    rowGrip.classList.toggle('visible', Boolean(target?.type === 'row'))
    if (target?.type === 'column') {
      const cell = target.cell || table.querySelector(`thead th:nth-child(${target.index + 1})`)
      if (!cell) return
      const rect = cell.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      columnGrip.style.left = `${rect.right - wrapRect.left - 1}px`
      columnGrip.style.top = `${rect.top - wrapRect.top + rect.height / 2 - 9}px`
      columnGrip.dataset.index = String(target.index)
      columnGrip._cell = target.cell || cell
    } else if (target?.type === 'row') {
      if (!target.row) return
      const rect = target.row.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      rowGrip.style.left = `${rect.left - wrapRect.left + rect.width / 2 - 9}px`
      rowGrip.style.top = `${rect.bottom - wrapRect.top - 1}px`
      rowGrip._row = target.row
    }
  }

  const onMouseDown = (event) => {
    const grip = event.target.closest?.('.cm-table-resize-grip')
    const target = grip?.classList.contains('cm-table-column-resize-grip')
      ? { type: 'column', index: Number.parseInt(columnGrip.dataset.index, 10), size: 0 }
      : grip?.classList.contains('cm-table-row-resize-grip')
        ? { type: 'row', row: rowGrip._row, size: 0 }
        : getResizeTarget(event)
    if (!target) return

    if (target.type === 'column') {
      const cell = target.cell || columnGrip._cell || table.querySelector(`thead th:nth-child(${target.index + 1})`)
      if (!cell) return
      target.size = cell.getBoundingClientRect().width
    } else if (!target.row) {
      return
    } else {
      target.size = target.row.getBoundingClientRect().height
    }

    event.preventDefault()
    event.stopPropagation()
    resizeType = target.type
    resizeIndex = target.index ?? -1
    activeRow = target.row || null
    startCoordinate = resizeType === 'column' ? event.clientX : event.clientY
    startSize = target.size
    if (resizeType === 'column') {
      initialColumnWidths = Array.from(table.querySelectorAll('thead th')).map(
        (cell) => cell.getBoundingClientRect().width
      )
    }
    wrap.classList.add('is-resizing-table')
    document.body.classList.add('is-global-resizing')
    document.body.style.cursor = resizeType === 'column' ? 'col-resize' : 'row-resize'
  }

  const onDrag = (event) => {
    if (!resizeType) return
    const coordinate = resizeType === 'column' ? event.clientX : event.clientY
    const delta = coordinate - startCoordinate
    const nextSize = Math.max(
      resizeType === 'column' ? MIN_COLUMN_WIDTH : MIN_ROW_HEIGHT,
      startSize + delta
    )

    if (resizeType === 'column') {
      setColumnWidths(table, resizeIndex, nextSize - startSize, initialColumnWidths)
    } else if (activeRow) {
      setRowHeight(activeRow, nextSize)
    }
  }

  const onMouseUp = () => {
    if (!resizeType) return
    if (resizeType === 'column') {
      const ths = Array.from(table.querySelectorAll('thead th'))
      const widths = ths.map((cell) => Math.round(cell.getBoundingClientRect().width))
      if (widths.length) {
        wrap.dataset.columnWidths = widths.join(',')
      }
      const model = readModelFromDom(wrap)
      model.columnWidths = widths
      onCommit?.(model)
    } else if (resizeType === 'row') {
      const rows = Array.from(table.querySelectorAll('tbody tr:not(.cm-table-empty-row)'))
      const heights = rows.map((row) => Math.round(row.getBoundingClientRect().height))
      if (heights.length) {
        wrap.dataset.rowHeights = heights.join(',')
      }
      const model = readModelFromDom(wrap)
      model.rowHeights = heights
      onCommit?.(model)
    }
    resizeType = null
    resizeIndex = -1
    activeRow = null
    wrap.classList.remove('is-resizing-table')
    document.body.classList.remove('is-global-resizing')
    document.body.style.cursor = ''
    wrap.style.cursor = ''
    columnGrip.classList.remove('visible')
    rowGrip.classList.remove('visible')
  }

  wrap.addEventListener('mousemove', onMouseMove)
  wrap.addEventListener('mousedown', onMouseDown)
  wrap.addEventListener('dblclick', (event) => {
    if (event.target.closest?.('.cm-table-resize-grip')) {
      event.preventDefault()
      event.stopPropagation()
    }
  })
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', onMouseUp)

  return () => {
    wrap.removeEventListener('mousemove', onMouseMove)
    wrap.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', onMouseUp)
    columnGrip.remove()
    rowGrip.remove()
  }
}
