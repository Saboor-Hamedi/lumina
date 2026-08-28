import { dispatchModel } from './tableWidgetExtension.js'
import { readModelFromDom } from './tableModel.js'
import { icons } from './icons.js'

export function setupTableDragAndDrop(wrap, view) {
  let isDragging = false
  let dragType = null // 'row' or 'col'
  let dragStartIndex = -1
  let currentDropIndex = -1

  // Set position relative on the wrap if not already
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
  rowHandle.style.width = '24px'
  rowHandle.style.height = '24px'
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
  colHandle.style.width = '24px'
  colHandle.style.height = '24px'
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

    // If hovering directly over the handle, keep it visible!
    if (e.target.closest('.cm-table-drag-handle')) {
      return
    }

    const cell = e.target.closest('th, td')
    if (!cell || !wrap.contains(cell)) {
      return
    }

    const tr = cell.closest('tr')
    if (!tr) return

    const tbody = tr.closest('tbody')

    // We'll use absolute positioning so they stay within the widget's DOM (cleaned up automatically)
    // but we use wrapRect to map viewport coordinates to local widget coordinates
    rowHandle.style.position = 'absolute'
    colHandle.style.position = 'absolute'
    
    const wrapRect = wrap.getBoundingClientRect()
    
    // Nudge handles slightly if near the edge, or hide completely if scrolled out
    const VIEWPORT_MARGIN = 20
    const GUTTER_SIZE = 16

    let showRow = false
    let showCol = false

    if (tbody) {
      const rowRect = tr.getBoundingClientRect()
      const cellRect = cell.getBoundingClientRect()
      
      const distLeft = e.clientX - cellRect.left
      const distTop = e.clientY - cellRect.top

      // Show row handle if near the left edge of the cell
      if (distLeft >= 0 && distLeft <= GUTTER_SIZE && rowRect.top > VIEWPORT_MARGIN && rowRect.bottom < window.innerHeight - VIEWPORT_MARGIN) {
        // Track cursor vertically
        const handleY = Math.max(rowRect.top, Math.min(e.clientY - 10, rowRect.bottom - 20))
        rowHandle.style.top = `${handleY - wrapRect.top}px`
        rowHandle.style.left = `${rowRect.left - wrapRect.left - 10}px` // straddles the left border
        rowHandle.style.width = `20px`
        rowHandle.style.height = `20px`
        rowHandle.style.opacity = '1'
        rowHandle.style.pointerEvents = 'auto'
        rowHandle.dataset.index = Array.from(tbody.children).indexOf(tr).toString()
        showRow = true
      }

      // Show col handle if near the top edge of the cell
      const colIndex = Array.from(tr.children).indexOf(cell)
      if (colIndex >= 0 && distTop >= 0 && distTop <= GUTTER_SIZE && cellRect.left > VIEWPORT_MARGIN && cellRect.right < window.innerWidth - VIEWPORT_MARGIN) {
        // Position horizontally exactly where the mouse is, clamped to the cell width
        const handleX = Math.max(cellRect.left, Math.min(e.clientX - 10, cellRect.right - 20))
        colHandle.style.left = `${handleX - wrapRect.left}px`
        colHandle.style.top = `${cellRect.top - wrapRect.top - 10}px` // straddles the top border
        colHandle.style.width = `20px`
        colHandle.style.height = `20px`
        colHandle.style.opacity = '1'
        colHandle.style.pointerEvents = 'auto'
        colHandle.dataset.index = colIndex.toString()
        showCol = true
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
    if (!isDragging) {
      hideHandles()
    }
  })
  
  const scrollContainer = wrap.querySelector('.cm-table-scroll-container')
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
      if (!isDragging) {
        hideHandles()
      }
    })
  }

  function hideHandles() {
    rowHandle.style.opacity = '0'
    colHandle.style.opacity = '0'
    rowHandle.style.pointerEvents = 'none'
    colHandle.style.pointerEvents = 'none'
  }

  let draggedElementWidth = 0
  let draggedElementHeight = 0
  let initialBounds = []

  function calculateDragDimensions(type, index) {
    const table = wrap.querySelector('table')
    if (!table) return
    initialBounds = []

    if (type === 'row') {
      const rows = Array.from(table.querySelectorAll('tr'))
      draggedElementHeight = rows[index].getBoundingClientRect().height
      rows.forEach(r => {
        const rect = r.getBoundingClientRect()
        initialBounds.push({ top: rect.top, bottom: rect.bottom, height: rect.height })
      })
    } else {
      const headers = Array.from(table.querySelectorAll('thead th'))
      if (headers[index]) {
        draggedElementWidth = headers[index].getBoundingClientRect().width
      }
      headers.forEach(h => {
        const rect = h.getBoundingClientRect()
        initialBounds.push({ left: rect.left, right: rect.right, width: rect.width })
      })
    }
  }

  let dragStartX = 0
  let dragStartY = 0
  let initialHandleLeft = 0
  let initialHandleTop = 0

  // Drag start
  function onDragStart(e, type, index) {
    e.preventDefault()
    isDragging = true
    dragType = type
    dragStartIndex = index
    currentDropIndex = index

    dragStartX = e.clientX
    dragStartY = e.clientY
    
    // Lock the initial position before we switch to transform
    const wrapRect = wrap.getBoundingClientRect()
    if (type === 'row') {
      initialHandleLeft = parseFloat(rowHandle.style.left) || 0
      initialHandleTop = parseFloat(rowHandle.style.top) || 0
      rowHandle.style.cursor = 'grabbing'
    } else {
      initialHandleLeft = parseFloat(colHandle.style.left) || 0
      initialHandleTop = parseFloat(colHandle.style.top) || 0
      colHandle.style.cursor = 'grabbing'
    }

    calculateDragDimensions(type, index)

    // Fade out original
    const table = wrap.querySelector('table')
    if (table) {
      if (type === 'row') {
        wrap.classList.add('is-dragging-rows')
        const rows = Array.from(table.querySelectorAll('tr'))
        if (rows[index]) rows[index].style.opacity = '0.3'
      } else {
        wrap.classList.add('is-dragging-cols')
        const rows = Array.from(table.querySelectorAll('tr'))
        rows.forEach((row) => {
          if (row.children[index]) {
            row.children[index].style.opacity = '0.3'
          }
        })
      }
    }

    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)

    document.body.style.cursor = 'grabbing'
  }

  rowHandle.addEventListener('mousedown', (e) =>
    onDragStart(e, 'row', parseInt(rowHandle.dataset.index, 10))
  )
  colHandle.addEventListener('mousedown', (e) =>
    onDragStart(e, 'col', parseInt(colHandle.dataset.index, 10))
  )

  let rafId = null

  function onDragMove(e) {
    if (!isDragging) return
    
    if (rafId) cancelAnimationFrame(rafId)
    
    rafId = requestAnimationFrame(() => {
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY

      if (dragType === 'row') {
        rowHandle.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      } else {
        colHandle.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      }

      const table = wrap.querySelector('table')
      if (!table) return

  

    if (dragType === 'row') {
      let proposedIndex = currentDropIndex
      while (proposedIndex > 0) {
        if (e.clientY < initialBounds[proposedIndex - 1].top) {
          proposedIndex--
        } else {
          break
        }
      }
      while (proposedIndex < initialBounds.length - 1) {
        if (e.clientY > initialBounds[proposedIndex + 1].bottom) {
          proposedIndex++
        } else {
          break
        }
      }
      currentDropIndex = proposedIndex

      const targetIndex = currentDropIndex
      const rows = Array.from(wrap.querySelectorAll('tr'))

      // Live shifting
      rows.forEach((row, i) => {
        if (i === dragStartIndex) {
          let shift = 0
          if (targetIndex > dragStartIndex) {
            for (let j = dragStartIndex + 1; j <= targetIndex; j++) {
              shift += initialBounds[j].height
            }
          } else {
            for (let j = targetIndex; j < dragStartIndex; j++) {
              shift -= initialBounds[j].height
            }
          }
          row.style.transform = `translateY(${shift}px)`
        } else if (i > dragStartIndex && i <= targetIndex) {
          row.style.transform = `translateY(-${initialBounds[dragStartIndex].height}px)`
        } else if (i >= targetIndex && i < dragStartIndex) {
          row.style.transform = `translateY(${initialBounds[dragStartIndex].height}px)`
        } else {
          row.style.transform = 'none'
        }
      })
    } else {
      let proposedIndex = currentDropIndex
      while (proposedIndex > 0) {
        if (e.clientX < initialBounds[proposedIndex - 1].left) {
          proposedIndex--
        } else {
          break
        }
      }
      while (proposedIndex < initialBounds.length - 1) {
        if (e.clientX > initialBounds[proposedIndex + 1].right) {
          proposedIndex++
        } else {
          break
        }
      }
      currentDropIndex = proposedIndex

      const targetIndex = currentDropIndex
      const rows = Array.from(wrap.querySelectorAll('tr'))

      // Live shifting
      rows.forEach((row) => {
        Array.from(row.children).forEach((cell, i) => {
          if (i === dragStartIndex) {
            let shift = 0
            if (targetIndex > dragStartIndex) {
              for (let j = dragStartIndex + 1; j <= targetIndex; j++) {
                shift += initialBounds[j].width
              }
            } else {
              for (let j = targetIndex; j < dragStartIndex; j++) {
                shift -= initialBounds[j].width
              }
            }
            cell.style.transform = `translateX(${shift}px)`
          } else if (i > dragStartIndex && i <= targetIndex) {
            cell.style.transform = `translateX(-${initialBounds[dragStartIndex].width}px)`
          } else if (i >= targetIndex && i < dragStartIndex) {
            cell.style.transform = `translateX(${initialBounds[dragStartIndex].width}px)`
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
        Array.from(row.children).forEach((cell) => {
          cell.style.transform = 'none'
          cell.style.opacity = '1'
        })
      })
    }

    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)

    // Check if drop actually moves it (drop target before or immediately after itself)
    // Check if drop actually moves it (drop target before or immediately after itself)
    if (currentDropIndex === dragStartIndex || currentDropIndex === dragStartIndex + 1) {
      return
    }

    const model = readModelFromDom(wrap)
    const nextModel = {
      header: [...model.header],
      alignments: [...(model.alignments || [])],
      rows: model.rows.map((r) => [...r])
    }

    if (dragType === 'row') {
      const [movedRow] = nextModel.rows.splice(dragStartIndex, 1)
      let insertIndex = currentDropIndex
      if (insertIndex > dragStartIndex) insertIndex-- // shift down
      nextModel.rows.splice(insertIndex, 0, movedRow)
    } else if (dragType === 'col') {
      const [movedHead] = nextModel.header.splice(dragStartIndex, 1)
      const [movedAlign] = nextModel.alignments.splice(dragStartIndex, 1)

      let insertIndex = currentDropIndex
      if (insertIndex > dragStartIndex) insertIndex--

      nextModel.header.splice(insertIndex, 0, movedHead)
      if (movedAlign !== undefined) nextModel.alignments.splice(insertIndex, 0, movedAlign)

      nextModel.rows.forEach((r) => {
        const [movedCell] = r.splice(dragStartIndex, 1)
        r.splice(insertIndex, 0, movedCell)
      })
    }

    dispatchModel(view, wrap, nextModel)
  }
}
