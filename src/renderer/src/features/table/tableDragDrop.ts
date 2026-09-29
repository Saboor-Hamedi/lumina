import { dispatchModel } from './tableShared'
import { readModelFromDom } from './tableModel'
import { icons } from './tableIcons'

export function setupTableDragAndDrop(wrap, view) {
  let isDragging = false
  let dragType = null // 'row' or 'col'
  let dragStartIndex = -1
  let currentDropIndex = -1

  if (window.getComputedStyle(wrap).position === 'static') {
    wrap.style.position = 'relative'
  }

  // Row Handle
  const rowHandle = document.createElement('div')
  rowHandle.className = 'cm-table-drag-handle cm-table-row-drag-handle'
  rowHandle.innerHTML = icons.grip
  rowHandle.style.position = 'absolute'
  rowHandle.style.display = 'flex'
  rowHandle.style.alignItems = 'center'
  rowHandle.style.justifyContent = 'center'
  rowHandle.style.width = '15px'
  rowHandle.style.height = '15px'
  rowHandle.style.cursor = 'grab'
  rowHandle.style.opacity = '0'
  rowHandle.style.pointerEvents = 'none'
  rowHandle.style.zIndex = '100'
  rowHandle.style.color = 'var(--text-muted)'

  // Col Handle
  const colHandle = document.createElement('div')
  colHandle.className = 'cm-table-drag-handle cm-table-col-drag-handle'
  colHandle.innerHTML = icons.grip
  colHandle.style.position = 'absolute'
  colHandle.style.display = 'flex'
  colHandle.style.alignItems = 'center'
  colHandle.style.justifyContent = 'center'
  colHandle.style.width = '15px'
  colHandle.style.height = '15px'
  colHandle.style.cursor = 'grab'
  colHandle.style.opacity = '0'
  colHandle.style.pointerEvents = 'none'
  colHandle.style.zIndex = '100'
  colHandle.style.color = 'var(--text-muted)'

  wrap.appendChild(rowHandle)
  wrap.appendChild(colHandle)

  // Hover detection logic to position handles
  wrap.addEventListener('mousemove', (e) => {
    if (isDragging) return

    if (e.target.closest('.cm-table-drag-handle')) {
      return
    }

    const cell = e.target.closest('th, td')
    if (!cell || !wrap.contains(cell)) {
      hideHandles()
      return
    }

    const tr = cell.closest('tr')
    if (!tr) {
      hideHandles()
      return
    }

    const table = wrap.querySelector('table')
    if (!table) return

    const colCount = table.querySelectorAll('thead th').length
    const tbody = table.querySelector('tbody')
    const rowCount = tbody ? tbody.querySelectorAll('tr:not(.cm-table-empty-row)').length : 0

    const wrapRect = wrap.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    const isHeader = cell.tagName === 'TH' || tr.parentElement.tagName === 'THEAD'

    let showRow = false
    let showCol = false

    // Column handle: appears ONLY when hovering over header cells TH (and colCount > 1)
    if (colCount > 1 && isHeader) {
      const allHeaders = Array.from(table.querySelectorAll('thead th'))
      const colIndex = allHeaders.indexOf(cell)
      if (colIndex >= 0) {
        const handleX = Math.round(cellRect.left + cellRect.width / 2 - 8)
        colHandle.style.left = `${handleX - wrapRect.left}px`
        colHandle.style.top = `${cellRect.top - wrapRect.top + 3}px`
        colHandle.style.opacity = '1'
        colHandle.style.pointerEvents = 'auto'
        colHandle.dataset.index = colIndex.toString()
        colHandle._colIndex = colIndex
        showCol = true
      }
    }

    // Row handle: appears when hovering over body rows (only if > 1 rows, never on empty placeholder!)
    if (!isHeader && !tr.classList.contains('cm-table-empty-row') && rowCount > 1 && tbody) {
      const validRows = Array.from(tbody.querySelectorAll('tr:not(.cm-table-empty-row)'))
      const rowIndex = validRows.indexOf(tr)
      if (rowIndex >= 0) {
        const rowRect = tr.getBoundingClientRect()
        const distLeft = e.clientX - rowRect.left
        if (distLeft >= -10 && distLeft <= 36) {
          const handleY = Math.round(rowRect.top + rowRect.height / 2 - 8)
          rowHandle.style.top = `${handleY - wrapRect.top}px`
          rowHandle.style.left = `${rowRect.left - wrapRect.left + 3}px`
          rowHandle.style.opacity = '1'
          rowHandle.style.pointerEvents = 'auto'
          rowHandle.dataset.index = rowIndex.toString()
          rowHandle._rowIndex = rowIndex
          showRow = true
        }
      }
    }

    if (!showRow) {
      rowHandle.style.opacity = '0'
      rowHandle.style.pointerEvents = 'none'
    }
    if (!showCol) {
      colHandle.style.opacity = '0'
      colHandle.style.pointerEvents = 'none'
    }
  })

  wrap.addEventListener('mouseleave', () => {
    if (!isDragging) hideHandles()
  })

  const scrollContainer = wrap.querySelector('.cm-table-scroll-container')
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
      if (!isDragging) hideHandles()
    })
  }

  function hideHandles() {
    rowHandle.style.opacity = '0'
    colHandle.style.opacity = '0'
    rowHandle.style.pointerEvents = 'none'
    colHandle.style.pointerEvents = 'none'
  }

  let initialBounds = []

  function calculateDragDimensions(type) {
    const table = wrap.querySelector('table')
    if (!table) return
    initialBounds = []

    if (type === 'row') {
      const tbody = table.querySelector('tbody')
      const rows = tbody ? Array.from(tbody.querySelectorAll('tr:not(.cm-table-empty-row)')) : []
      if (rows.length <= 1) return
      rows.forEach((r) => {
        const rect = r.getBoundingClientRect()
        initialBounds.push({
          top: rect.top,
          bottom: rect.bottom,
          mid: (rect.top + rect.bottom) / 2,
          height: rect.height
        })
      })
    } else {
      const headers = Array.from(table.querySelectorAll('thead th'))
      if (headers.length <= 1) return
      headers.forEach((h) => {
        const rect = h.getBoundingClientRect()
        initialBounds.push({
          left: rect.left,
          right: rect.right,
          mid: (rect.left + rect.right) / 2,
          width: rect.width
        })
      })
    }
  }

  let dragStartX = 0
  let dragStartY = 0

  function onDragStart(e, type, index) {
    if (isNaN(index) || index < 0) return
    const table = wrap.querySelector('table')
    if (!table) return

    if (type === 'col') {
      const headers = table.querySelectorAll('thead th')
      if (headers.length <= 1 || index >= headers.length) return
    } else if (type === 'row') {
      const validRows = table.querySelectorAll('tbody tr:not(.cm-table-empty-row)')
      if (validRows.length <= 1 || index >= validRows.length) return
    }

    e.preventDefault()
    e.stopPropagation()

    isDragging = true
    dragType = type
    dragStartIndex = index
    currentDropIndex = index

    dragStartX = e.clientX
    dragStartY = e.clientY

    if (type === 'row') {
      rowHandle.style.cursor = 'grabbing'
    } else {
      colHandle.style.cursor = 'grabbing'
    }

    calculateDragDimensions(type)

    if (type === 'row') {
      wrap.classList.add('is-dragging-rows')
      const tbody = table.querySelector('tbody')
      const rows = tbody ? Array.from(tbody.querySelectorAll('tr:not(.cm-table-empty-row)')) : []
      if (rows[index]) {
        rows[index].style.zIndex = '20'
        rows[index].style.position = 'relative'
        rows[index].style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
      }
    } else {
      wrap.classList.add('is-dragging-cols')
      const rows = Array.from(table.querySelectorAll('tr:not(.cm-table-empty-row)'))
      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('th, td'))
        cells.forEach((cell, i) => {
          cell.style.position = 'relative'
          if (i === index) {
            cell.style.zIndex = '20'
            cell.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'
          }
        })
      })
    }

    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
    document.body.style.cursor = 'grabbing'
  }

  rowHandle.addEventListener('mousedown', (e) => {
    const idx = rowHandle._rowIndex !== undefined ? rowHandle._rowIndex : parseInt(rowHandle.dataset.index, 10)
    onDragStart(e, 'row', idx)
  })

  colHandle.addEventListener('mousedown', (e) => {
    const idx = colHandle._colIndex !== undefined ? colHandle._colIndex : parseInt(colHandle.dataset.index, 10)
    onDragStart(e, 'col', idx)
  })

  let rafId = null

  function onDragMove(e) {
    if (!isDragging || initialBounds.length === 0) return

    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY

      const table = wrap.querySelector('table')
      if (!table) return

      if (dragType === 'row') {
        rowHandle.style.transform = `translate3d(0, ${dy}px, 0)`

        const originMidY = initialBounds[dragStartIndex]?.mid || 0
        const currentMidY = originMidY + dy
        let proposed = dragStartIndex

        if (dy > 0) {
          for (let i = dragStartIndex + 1; i < initialBounds.length; i++) {
            if (currentMidY >= initialBounds[i].mid) {
              proposed = i
            }
          }
        } else if (dy < 0) {
          for (let i = dragStartIndex - 1; i >= 0; i--) {
            if (currentMidY <= initialBounds[i].mid) {
              proposed = i
            }
          }
        }

        proposed = Math.max(0, Math.min(initialBounds.length - 1, proposed))
        currentDropIndex = proposed

        const tbody = table.querySelector('tbody')
        const rows = tbody ? Array.from(tbody.querySelectorAll('tr:not(.cm-table-empty-row)')) : []
        const draggedHeight = initialBounds[dragStartIndex]?.height || 28

        rows.forEach((row, i) => {
          row.style.position = 'relative'
          if (i === dragStartIndex) {
            row.style.transform = `translateY(${dy}px)`
            row.style.zIndex = '20'
            row.style.transition = 'none'
            row.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
          } else if (dragStartIndex < currentDropIndex && i > dragStartIndex && i <= currentDropIndex) {
            row.style.transform = `translateY(-${draggedHeight}px)`
            row.style.zIndex = '1'
            row.style.transition = 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
            row.style.boxShadow = 'none'
          } else if (dragStartIndex > currentDropIndex && i >= currentDropIndex && i < dragStartIndex) {
            row.style.transform = `translateY(${draggedHeight}px)`
            row.style.zIndex = '1'
            row.style.transition = 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
            row.style.boxShadow = 'none'
          } else {
            row.style.transform = 'none'
            row.style.zIndex = ''
            row.style.transition = 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
            row.style.boxShadow = 'none'
          }
        })
      } else {
        colHandle.style.transform = `translate3d(${dx}px, 0, 0)`

        const originMidX = initialBounds[dragStartIndex]?.mid || 0
        const currentMidX = originMidX + dx
        let proposed = dragStartIndex

        if (dx > 0) {
          for (let i = dragStartIndex + 1; i < initialBounds.length; i++) {
            if (currentMidX >= initialBounds[i].mid) {
              proposed = i
            }
          }
        } else if (dx < 0) {
          for (let i = dragStartIndex - 1; i >= 0; i--) {
            if (currentMidX <= initialBounds[i].mid) {
              proposed = i
            }
          }
        }

        proposed = Math.max(0, Math.min(initialBounds.length - 1, proposed))
        currentDropIndex = proposed

        const rows = Array.from(table.querySelectorAll('tr:not(.cm-table-empty-row)'))
        const draggedWidth = initialBounds[dragStartIndex]?.width || 80

        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('th, td'))
          cells.forEach((cell, i) => {
            cell.style.position = 'relative'
            if (i === dragStartIndex) {
              cell.style.transform = `translateX(${dx}px)`
              cell.style.zIndex = '20'
              cell.style.transition = 'none'
              cell.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'
            } else if (dragStartIndex < currentDropIndex && i > dragStartIndex && i <= currentDropIndex) {
              cell.style.transform = `translateX(-${draggedWidth}px)`
              cell.style.zIndex = '1'
              cell.style.transition = 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
              cell.style.boxShadow = 'none'
            } else if (dragStartIndex > currentDropIndex && i >= currentDropIndex && i < dragStartIndex) {
              cell.style.transform = `translateX(${draggedWidth}px)`
              cell.style.zIndex = '1'
              cell.style.transition = 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
              cell.style.boxShadow = 'none'
            } else {
              cell.style.transform = 'none'
              cell.style.zIndex = ''
              cell.style.transition = 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
              cell.style.boxShadow = 'none'
            }
          })
        })
      }
    })
  }

  function onDragEnd() {
    isDragging = false
    document.body.style.cursor = ''

    if (rafId) cancelAnimationFrame(rafId)

    rowHandle.style.cursor = 'grab'
    colHandle.style.cursor = 'grab'
    rowHandle.style.transform = 'none'
    colHandle.style.transform = 'none'

    hideHandles()

    wrap.classList.remove('is-dragging-rows')
    wrap.classList.remove('is-dragging-cols')

    const table = wrap.querySelector('table')
    if (table) {
      const rows = Array.from(table.querySelectorAll('tr'))
      rows.forEach((row) => {
        row.style.transform = ''
        row.style.transition = ''
        row.style.opacity = ''
        row.style.position = ''
        row.style.zIndex = ''
        row.style.boxShadow = ''
        Array.from(row.querySelectorAll('th, td')).forEach((cell) => {
          cell.style.transform = ''
          cell.style.transition = ''
          cell.style.opacity = ''
          cell.style.position = ''
          cell.style.zIndex = ''
          cell.style.boxShadow = ''
        })
      })
    }

    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)

    if (currentDropIndex === dragStartIndex || currentDropIndex < 0 || dragStartIndex < 0) {
      return
    }

    const model = readModelFromDom(wrap)
    const nextModel = {
      header: [...model.header],
      alignments: [...(model.alignments || [])],
      rows: model.rows.map((r) => [...r]),
      columnWidths: model.columnWidths?.length ? [...model.columnWidths] : [],
      rowHeights: model.rowHeights?.length ? [...model.rowHeights] : [],
      caption: model.caption
    }

    if (dragType === 'row') {
      if (dragStartIndex < nextModel.rows.length && currentDropIndex < nextModel.rows.length) {
        const [movedRow] = nextModel.rows.splice(dragStartIndex, 1)
        nextModel.rows.splice(currentDropIndex, 0, movedRow)
        if (nextModel.rowHeights.length) {
          const [movedH] = nextModel.rowHeights.splice(dragStartIndex, 1)
          nextModel.rowHeights.splice(currentDropIndex, 0, movedH)
        }
        dispatchModel(view, wrap, nextModel)
      }
    } else if (dragType === 'col') {
      if (dragStartIndex < nextModel.header.length && currentDropIndex < nextModel.header.length) {
        const [movedHead] = nextModel.header.splice(dragStartIndex, 1)
        const [movedAlign] = nextModel.alignments.splice(dragStartIndex, 1)

        nextModel.header.splice(currentDropIndex, 0, movedHead)
        if (movedAlign !== undefined) {
          nextModel.alignments.splice(currentDropIndex, 0, movedAlign)
        }

        if (nextModel.columnWidths.length) {
          const [movedWidth] = nextModel.columnWidths.splice(dragStartIndex, 1)
          nextModel.columnWidths.splice(currentDropIndex, 0, movedWidth)
        }

        nextModel.rows.forEach((r) => {
          const [movedCell] = r.splice(dragStartIndex, 1)
          r.splice(currentDropIndex, 0, movedCell)
        })

        dispatchModel(view, wrap, nextModel)
      }
    }
  }
}
