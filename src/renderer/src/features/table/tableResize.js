import { readModelFromDom } from './tableModel.js'

const MIN_COLUMN_WIDTH = 48
const MIN_ROW_HEIGHT = 28
const RESIZE_ZONE = 10

/**
 * Read the scroll container's *content-box* width, excluding scrollbar
 * gutters. With `scrollbar-gutter: stable both-edges`, this value is
 * invariant across overflow transitions — safe to cache for a drag.
 */
function getContainerContentWidth(scrollContainer) {
  if (!scrollContainer) return 0
  const cs = getComputedStyle(scrollContainer)
  const padL = parseFloat(cs.paddingLeft) || 0
  const padR = parseFloat(cs.paddingRight) || 0
  return scrollContainer.clientWidth - padL - padR
}

/**
 * Apply a width vector to a table. Sets `min-width` on the table (for
 * the scroll threshold) and per-cell `width/min/max` for every cell.
 * NEVER sets table `width`.
 */
function applyWidths(table, widths) {
  const total = widths.reduce((s, w) => s + w, 0)
  table.style.removeProperty('width')
  table.style.setProperty('min-width', `${total}px`, 'important')

  for (const row of table.querySelectorAll('tr')) {
    const cells = row.children
    for (let i = 0; i < cells.length; i++) {
      const w = widths[i]
      if (w == null) continue
      const cell = cells[i]
      cell.style.setProperty('width', `${w}px`, 'important')
      cell.style.setProperty('min-width', `${w}px`, 'important')
      cell.style.setProperty('max-width', `${w}px`, 'important')
    }
  }
}

/**
 * Given a target width for one column, produce a full width vector
 * whose sum equals `containerContentWidth` (when the container is
 * wider than the sum) — so the last column's right border sits flush
 * with the container edge. When the sum exceeds the container, no
 * padding is applied and horizontal scrolling takes over.
 */
function computeWidthVector(initialWidths, columnIndex, delta, containerWidth) {
  const next = [...initialWidths]
  if (columnIndex >= 0 && columnIndex < next.length) {
    next[columnIndex] = Math.max(
      MIN_COLUMN_WIDTH,
      Math.round(initialWidths[columnIndex] + delta)
    )
  }

  // If the vector is narrower than the container, distribute the slack
  // proportionally so the table's rendered width exactly equals the
  // container — meaning the right wall is mathematically pinned.
  const total = next.reduce((s, w) => s + w, 0)
  if (total < containerWidth) {
    const slack = containerWidth - total
    const sum = next.reduce((s, w) => s + w, 0) || 1
    let distributed = 0
    for (let i = 0; i < next.length - 1; i++) {
      const add = Math.round((next[i] / sum) * slack)
      next[i] += add
      distributed += add
    }
    next[next.length - 1] += slack - distributed
  }

  return next
}

export function setupTableColResizing(wrap, onCommit = null) {
  const table = wrap?.querySelector('table')
  if (!table) return () => {}

  const scrollContainer = wrap.querySelector('.cm-table-scroll-container')

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

  // ── Drag-session state (frozen at mousedown) ───────────────────────
  let frozenContainerWidth = 0   // clientWidth at drag start
  let frozenInitialWidths = []   // column widths at drag start
  let latestWidths = null        // last applied vector, for commit
  let dragSessionId = 0          // guards against stale dispatches

  const getResizeTarget = (event) => {
    const rows = Array.from(table.querySelectorAll('tr:not(.cm-table-empty-row)'))
    for (const row of rows) {
      const rr = row.getBoundingClientRect()
      if (event.clientY < rr.top - RESIZE_ZONE || event.clientY > rr.bottom + RESIZE_ZONE) continue
      const cells = Array.from(row.children)
      for (let i = 0; i < cells.length; i++) {
        const rect = cells[i].getBoundingClientRect()
        if (Math.abs(event.clientX - rect.right) <= RESIZE_ZONE) {
          return { type: 'column', index: i, size: rect.width, cell: cells[i] }
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
        ? 'col-resize' : 'row-resize'
      return
    }
    const target = getResizeTarget(event)
    wrap.style.cursor = target ? (target.type === 'column' ? 'col-resize' : 'row-resize') : ''

    columnGrip.classList.toggle('visible', target?.type === 'column')
    rowGrip.classList.toggle('visible', target?.type === 'row')

    if (target?.type === 'column') {
      const cell = target.cell || table.querySelector(`thead th:nth-child(${target.index + 1})`)
      if (!cell) return
      const rect = cell.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      columnGrip.style.left = `${rect.right - wrapRect.left - 1}px`
      columnGrip.style.top = `${rect.top - wrapRect.top + rect.height / 2 - 9}px`
      columnGrip.dataset.index = String(target.index)
      columnGrip._cell = cell
    } else if (target?.type === 'row' && target.row) {
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
      ? { type: 'column', index: parseInt(columnGrip.dataset.index, 10), size: 0 }
      : grip?.classList.contains('cm-table-row-resize-grip')
        ? { type: 'row', row: rowGrip._row, size: 0 }
        : getResizeTarget(event)
    if (!target) return

    if (target.type === 'column') {
      const cell = target.cell || columnGrip._cell
        || table.querySelector(`thead th:nth-child(${target.index + 1})`)
      if (!cell) return
      target.size = cell.getBoundingClientRect().width

      // FREEZE the container width and the initial column widths for
      // the entire drag session. Reading clientWidth on every mousemove
      // is unsafe: the moment the table overflows, a scrollbar may
      // appear and steal ~15px, shrinking every column mid-drag.
      frozenContainerWidth = getContainerContentWidth(scrollContainer)
      frozenInitialWidths = Array.from(table.querySelectorAll('thead th'))
        .map((th) => th.getBoundingClientRect().width)

      latestWidths = [...frozenInitialWidths]
    } else if (target.row) {
      target.size = target.row.getBoundingClientRect().height
    } else {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    resizeType = target.type
    resizeIndex = target.index ?? -1
    activeRow = target.row || null
    startCoordinate = resizeType === 'column' ? event.clientX : event.clientY
    startSize = target.size

    wrap.classList.add('is-resizing-table')
    document.body.classList.add('is-global-resizing')
    document.body.style.cursor = resizeType === 'column' ? 'col-resize' : 'row-resize'
  }

  let rafId = null
  const onDrag = (event) => {
    if (!resizeType) return
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (!resizeType) return
      const coordinate = resizeType === 'column' ? event.clientX : event.clientY
      const delta = coordinate - startCoordinate

      if (resizeType === 'column') {
        const widths = computeWidthVector(
          frozenInitialWidths,
          resizeIndex,
          delta,
          frozenContainerWidth
        )
        latestWidths = widths
        applyWidths(table, widths)

        // Live update the column grip position so it follows the cell border smoothly
        const cell = columnGrip._cell || table.querySelector(`thead th:nth-child(${resizeIndex + 1})`)
        if (cell) {
          const rect = cell.getBoundingClientRect()
          const wrapRect = wrap.getBoundingClientRect()
          columnGrip.style.left = `${rect.right - wrapRect.left - 1}px`
          columnGrip.style.top = `${rect.top - wrapRect.top + rect.height / 2 - 9}px`
        }
      } else if (activeRow) {
        const nextSize = Math.max(MIN_ROW_HEIGHT, startSize + delta)
        activeRow.style.height = `${nextSize}px`
        for (const cell of activeRow.children) cell.style.height = `${nextSize}px`

        // Live update row grip position
        const rect = activeRow.getBoundingClientRect()
        const wrapRect = wrap.getBoundingClientRect()
        rowGrip.style.left = `${rect.left - wrapRect.left + rect.width / 2 - 9}px`
        rowGrip.style.top = `${rect.bottom - wrapRect.top - 1}px`
      }
    })
  }

  const onMouseUp = () => {
    if (!resizeType) return
    const sessionId = ++dragSessionId

    // Flush any pending rAF so the final widths land before commit.
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    if (resizeType === 'column' && latestWidths) {
      // Persist the FINAL vector — not a re-measurement from the DOM.
      // Re-measuring via getBoundingClientRect() can return fractional
      // widths that disagree with `latestWidths` after CSS rounding,
      // reintroducing the gap on reload.
      const integerWidths = latestWidths.map((w) => Math.round(w))
      wrap.dataset.columnWidths = integerWidths.join(',')
      const model = readModelFromDom(wrap)
      model.columnWidths = integerWidths
      onCommit?.(model)
    } else if (resizeType === 'row' && activeRow) {
      const rows = Array.from(table.querySelectorAll('tbody tr:not(.cm-table-empty-row)'))
      const heights = rows.map((row) => Math.round(row.getBoundingClientRect().height))
      wrap.dataset.rowHeights = heights.join(',')
      const model = readModelFromDom(wrap)
      model.rowHeights = heights
      onCommit?.(model)
    }

    resizeType = null
    resizeIndex = -1
    activeRow = null
    frozenInitialWidths = []
    latestWidths = null
    wrap.classList.remove('is-resizing-table')
    document.body.classList.remove('is-global-resizing')
    document.body.style.cursor = ''
    wrap.style.cursor = ''
    columnGrip.classList.remove('visible')
    rowGrip.classList.remove('visible')
  }

  // ResizeObserver for external container resizes (window resize, editor pane split)
  let ro = null
  if (typeof ResizeObserver !== 'undefined' && scrollContainer) {
    ro = new ResizeObserver(() => {
      if (resizeType) return
      const widths = (wrap.dataset.columnWidths || '')
        .split(',')
        .map((n) => Number(n.trim()))
        .filter(Number.isFinite)
      if (!widths.length) return
      const containerWidth = getContainerContentWidth(scrollContainer)
      const total = widths.reduce((s, w) => s + w, 0)
      if (total < containerWidth) {
        const next = computeWidthVector(
          widths,
          -1 /* no-op column index */,
          0,
          containerWidth
        )
        if (next) applyWidths(table, next)
      }
    })
    ro.observe(scrollContainer)
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
    if (rafId) cancelAnimationFrame(rafId)
    if (ro) ro.disconnect()
    columnGrip.remove()
    rowGrip.remove()
  }
}
