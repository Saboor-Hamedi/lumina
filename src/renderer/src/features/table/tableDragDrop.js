import { dispatchModel } from './tableExtension.js'
import { readModelFromDom } from './tableModel.js'
import { icons } from './tableIcons.js'

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

    const wrapRect = wrap.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    const isHeader = cell.tagName === 'TH' || tr.parentElement.tagName === 'THEAD'
    const colIndex = Array.from(tr.children).indexOf(cell)

    let showRow = false
    let showCol = false

    // Column handle: appears when hovering over header cells TH or top of cells
    if (isHeader) {
      const handleX = Math.max(cellRect.left + 2, Math.min(e.clientX - 7, cellRect.right - 18))
      colHandle.style.left = `${handleX - wrapRect.left}px`
      colHandle.style.top = `${cellRect.top - wrapRect.top - 7}px`
      colHandle.style.opacity = '1'
      colHandle.style.pointerEvents = 'auto'
      colHandle.dataset.index = colIndex.toString()
      showCol = true
    } else {
      const distTop = e.clientY - cellRect.top
      if (distTop >= 0 && distTop <= 16) {
        const handleX = Math.max(cellRect.left + 2, Math.min(e.clientX - 7, cellRect.right - 18))
        colHandle.style.left = `${handleX - wrapRect.left}px`
        colHandle.style.top = `${cellRect.top - wrapRect.top - 7}px`
        colHandle.style.opacity = '1'
        colHandle.style.pointerEvents = 'auto'
        colHandle.dataset.index = colIndex.toString()
        showCol = true
      }
    }

    // Row handle: appears when hovering over body rows (near the left border or first cell)
    if (!isHeader) {
      const tbody = table.querySelector('tbody')
      if (tbody) {
        const rowIndex = Array.from(tbody.children).indexOf(tr)
        if (rowIndex >= 0) {
          const rowRect = tr.getBoundingClientRect()
          const distLeft = e.clientX - rowRect.left
          if (distLeft >= -10 && distLeft <= 36) {
            const handleY = Math.max(rowRect.top + 2, Math.min(e.clientY - 7, rowRect.bottom - 18))
            rowHandle.style.top = `${handleY - wrapRect.top}px`
            rowHandle.style.left = `${rowRect.left - wrapRect.left - 8}px`
            rowHandle.style.opacity = '1'
            rowHandle.style.pointerEvents = 'auto'
            rowHandle.dataset.index = rowIndex.toString()
            showRow = true
          }
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
      const rows = tbody ? Array.from(tbody.children) : []
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

    // Visual feedback
    const table = wrap.querySelector('table')
    if (table) {
      if (type === 'row') {
        wrap.classList.add('is-dragging-rows')
        const tbody = table.querySelector('tbody')
        const rows = tbody ? Array.from(tbody.children) : []
        if (rows[index]) rows[index].style.opacity = '0.4'
      } else {
        wrap.classList.add('is-dragging-cols')
        const rows = Array.from(table.querySelectorAll('tr'))
        rows.forEach((row) => {
          if (row.children[index]) {
            row.children[index].style.opacity = '0.4'
          }
        })
      }
    }

    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
    document.body.style.cursor = 'grabbing'
  }

  rowHandle.addEventListener('mousedown', (e) => {
    const idx = parseInt(rowHandle.dataset.index, 10)
    onDragStart(e, 'row', idx)
  })

  colHandle.addEventListener('mousedown', (e) => {
    const idx = parseInt(colHandle.dataset.index, 10)
    onDragStart(e, 'col', idx)
  })

  let rafId = null

  function onDragMove(e) {
    if (!isDragging || initialBounds.length === 0) return

    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY

      if (dragType === 'row') {
        rowHandle.style.transform = `translate3d(${dx}px, ${dy}px, 0)`

        // Calculate proposed drop index based on row midpoints
        let proposed = 0
        for (let i = 0; i < initialBounds.length; i++) {
          if (e.clientY > initialBounds[i].mid) {
            proposed = i
          }
        }
        proposed = Math.max(0, Math.min(initialBounds.length - 1, proposed))
        currentDropIndex = proposed

        const tbody = wrap.querySelector('tbody')
        const rows = tbody ? Array.from(tbody.children) : []
        const draggedHeight = initialBounds[dragStartIndex]?.height || 28

        rows.forEach((row, i) => {
          if (i === dragStartIndex) {
            row.style.transform = `translateY(${dy}px)`
            row.style.zIndex = '10'
            row.style.position = 'relative'
          } else if (i > dragStartIndex && i <= currentDropIndex) {
            row.style.transform = `translateY(-${draggedHeight}px)`
          } else if (i < dragStartIndex && i >= currentDropIndex) {
            row.style.transform = `translateY(${draggedHeight}px)`
          } else {
            row.style.transform = 'none'
          }
        })
      } else {
        colHandle.style.transform = `translate3d(${dx}px, ${dy}px, 0)`

        // Calculate proposed drop index based on column midpoints
        let proposed = 0
        for (let i = 0; i < initialBounds.length; i++) {
          if (e.clientX > initialBounds[i].mid) {
            proposed = i
          }
        }
        proposed = Math.max(0, Math.min(initialBounds.length - 1, proposed))
        currentDropIndex = proposed

        const rows = Array.from(wrap.querySelectorAll('tr'))
        const draggedWidth = initialBounds[dragStartIndex]?.width || 80

        rows.forEach((row) => {
          Array.from(row.children).forEach((cell, i) => {
            if (i === dragStartIndex) {
              cell.style.transform = `translateX(${dx}px)`
              cell.style.zIndex = '10'
              cell.style.position = 'relative'
            } else if (i > dragStartIndex && i <= currentDropIndex) {
              cell.style.transform = `translateX(-${draggedWidth}px)`
            } else if (i < dragStartIndex && i >= currentDropIndex) {
              cell.style.transform = `translateX(${draggedWidth}px)`
            } else {
              cell.style.transform = 'none'
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
        row.style.transform = 'none'
        row.style.opacity = '1'
        row.style.position = ''
        row.style.zIndex = ''
        Array.from(row.children).forEach((cell) => {
          cell.style.transform = 'none'
          cell.style.opacity = '1'
          cell.style.position = ''
          cell.style.zIndex = ''
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
      caption: model.caption
    }

    if (dragType === 'row') {
      if (dragStartIndex < nextModel.rows.length && currentDropIndex < nextModel.rows.length) {
        const [movedRow] = nextModel.rows.splice(dragStartIndex, 1)
        nextModel.rows.splice(currentDropIndex, 0, movedRow)
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

        nextModel.rows.forEach((r) => {
          const [movedCell] = r.splice(dragStartIndex, 1)
          r.splice(currentDropIndex, 0, movedCell)
        })

        dispatchModel(view, wrap, nextModel)
      }
    }
  }
}
