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
  rowHandle.style.width = '20px'
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
  colHandle.style.height = '20px'
  colHandle.style.cursor = 'grab'
  colHandle.style.opacity = '0'
  colHandle.style.pointerEvents = 'none'
  colHandle.style.zIndex = '100'
  colHandle.style.color = 'var(--text-muted)'

  wrap.appendChild(rowHandle)
  wrap.appendChild(colHandle)

  // Drop Indicator
  const dropIndicator = document.createElement('div')
  dropIndicator.className = 'cm-table-drop-indicator'
  dropIndicator.style.position = 'absolute'
  dropIndicator.style.backgroundColor = 'var(--text-accent, #2196f3)'
  dropIndicator.style.display = 'none'
  dropIndicator.style.pointerEvents = 'none'
  dropIndicator.style.zIndex = '11'
  wrap.appendChild(dropIndicator)

  // Ghost element for visual dragging
  const ghost = document.createElement('div')
  ghost.className = 'cm-table-drag-ghost'
  ghost.style.position = 'fixed'
  ghost.style.pointerEvents = 'none'
  ghost.style.zIndex = '999999'
  ghost.style.opacity = '0.9'
  ghost.style.display = 'none'
  ghost.style.borderRadius = '4px'
  ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'
  ghost.style.overflow = 'hidden'
  document.body.appendChild(ghost)

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

    const wrapRect = wrap.getBoundingClientRect()
    const table = wrap.querySelector('table')
    if (!table) return
    const tableRect = table.getBoundingClientRect()

    // Show row handle outside the left edge
    if (tbody) {
      const rect = tr.getBoundingClientRect()
      rowHandle.style.top = `${rect.top - wrapRect.top + rect.height / 2 - 10}px` // Centered vertically
      rowHandle.style.left = `${tableRect.left - wrapRect.left + wrap.scrollLeft - 24}px` // Outside the left edge
      rowHandle.style.width = `20px`
      rowHandle.style.height = `20px`
      rowHandle.style.opacity = '1'
      rowHandle.style.pointerEvents = 'auto'
      rowHandle.dataset.index = Array.from(tbody.children).indexOf(tr).toString()
    } else {
      rowHandle.style.opacity = '0'
      rowHandle.style.pointerEvents = 'none'
    }

    // Show col handle outside the top edge
    const colIndex = Array.from(tr.children).indexOf(cell)
    if (colIndex >= 0) {
      const rect = cell.getBoundingClientRect()
      colHandle.style.left = `${rect.left - wrapRect.left + wrap.scrollLeft + rect.width / 2 - 10}px` // Centered horizontally
      colHandle.style.top = `${tableRect.top - wrapRect.top - 24}px` // Outside the top edge
      colHandle.style.width = `20px`
      colHandle.style.height = `20px`
      colHandle.style.opacity = '1'
      colHandle.style.pointerEvents = 'auto'
      colHandle.dataset.index = colIndex.toString()
    } else {
      colHandle.style.opacity = '0'
      colHandle.style.pointerEvents = 'none'
    }
  })

  wrap.addEventListener('mouseleave', () => {
    if (!isDragging) {
      hideHandles()
    }
  })

  function hideHandles() {
    rowHandle.style.opacity = '0'
    colHandle.style.opacity = '0'
    rowHandle.style.pointerEvents = 'none'
    colHandle.style.pointerEvents = 'none'
  }

  let draggedElementWidth = 0
  let draggedElementHeight = 0

  function createGhostClone(type, index) {
    ghost.innerHTML = ''
    const table = wrap.querySelector('table')
    if (!table) return

    const cloneTable = document.createElement('table')
    cloneTable.style.cssText = table.style.cssText
    cloneTable.style.margin = '0'
    cloneTable.style.tableLayout = 'fixed'
    cloneTable.style.background = 'var(--bg-panel, #2a2a2a)'
    cloneTable.style.border = '1px solid var(--border-accent, #40bafa)'
    cloneTable.style.borderRadius = '6px'
    cloneTable.style.borderCollapse = 'collapse'
    cloneTable.style.opacity = '0.85'
    cloneTable.style.overflow = 'hidden'

    cloneTable.style.color = 'var(--text-main, #eee)'
    cloneTable.style.fontFamily = 'inherit'
    cloneTable.style.fontSize = '14px'

    function cloneCellToText(originalCell) {
      const newCell = document.createElement(originalCell.tagName)

      const rect = originalCell.getBoundingClientRect()
      newCell.style.width = `${rect.width}px`
      newCell.style.height = `${rect.height}px`
      newCell.style.boxSizing = 'border-box'

      newCell.style.padding = '8px 12px'
      newCell.style.border = '1px solid var(--border-dim)'
      newCell.style.textAlign = 'left'
      newCell.style.whiteSpace = 'normal'
      newCell.style.overflow = 'hidden'

      // Grab text from the CodeMirror content if it exists, otherwise use innerText
      const cmContent = originalCell.querySelector('.cm-content')
      newCell.textContent = cmContent ? cmContent.innerText : originalCell.innerText
      return newCell
    }

    if (type === 'row') {
      const rows = Array.from(table.querySelectorAll('tr'))
      const tr = document.createElement('tr')
      Array.from(rows[index].children).forEach((cell) => {
        tr.appendChild(cloneCellToText(cell))
      })
      const tbody = document.createElement('tbody')
      tbody.appendChild(tr)
      cloneTable.appendChild(tbody)
      draggedElementHeight = rows[index].getBoundingClientRect().height
      cloneTable.style.width = `${table.getBoundingClientRect().width}px`
    } else {
      const rows = Array.from(table.querySelectorAll('tr'))
      rows.forEach((row) => {
        const tr = document.createElement('tr')
        const cells = Array.from(row.children)
        if (cells[index]) {
          tr.appendChild(cloneCellToText(cells[index]))
        }
        cloneTable.appendChild(tr)
      })
      const headers = Array.from(table.querySelectorAll('thead th'))
      if (headers[index]) {
        draggedElementWidth = headers[index].getBoundingClientRect().width
        cloneTable.style.width = `${draggedElementWidth}px`
      }
    }

    ghost.appendChild(cloneTable)
  }

  // Drag start
  function onDragStart(e, type, index) {
    e.preventDefault()
    isDragging = true
    dragType = type
    dragStartIndex = index
    currentDropIndex = index

    createGhostClone(type, index)

    ghost.style.display = 'block'
    ghost.style.left = `${e.clientX + 15}px`
    ghost.style.top = `${e.clientY + 15}px`

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

  function onDragMove(e) {
    if (!isDragging) return

    ghost.style.left = `${e.clientX + 15}px`
    ghost.style.top = `${e.clientY + 15}px`

    const table = wrap.querySelector('table')
    if (!table) return

    // Hide standard drop indicator if we use live shifting
    dropIndicator.style.display = 'none'

    if (dragType === 'row') {
      const rows = Array.from(wrap.querySelectorAll('tr'))
      let targetIndex = rows.length
      for (let i = 0; i < rows.length; i++) {
        const rect = rows[i].getBoundingClientRect()
        if (e.clientY < rect.top + rect.height / 2) {
          targetIndex = i
          break
        }
      }
      currentDropIndex = targetIndex

      // Live shifting
      rows.forEach((row, i) => {
        if (i === dragStartIndex) {
          // The dragged row shifts backwards/forwards depending on the target to visually "swap"
          if (targetIndex > dragStartIndex) {
            row.style.transform = `translateY(${(targetIndex - dragStartIndex - 1) * draggedElementHeight}px)` // approximate
          } else {
            row.style.transform = `translateY(${(targetIndex - dragStartIndex) * draggedElementHeight}px)` // approximate
          }
          // Actually, precise shifting of the dragged row is tricky because rows vary in height.
          // Let's just keep the dragged row where it is (it's faded out anyway) or shift it perfectly.
          // For now, let's keep it simple: dragged row stays put, others shift.
          row.style.transform = 'none'
        } else if (i >= targetIndex && i < dragStartIndex) {
          row.style.transform = `translateY(${draggedElementHeight}px)`
        } else if (i > dragStartIndex && i < targetIndex) {
          row.style.transform = `translateY(-${draggedElementHeight}px)`
        } else {
          row.style.transform = 'none'
        }
      })
    } else {
      const headerCells = Array.from(wrap.querySelectorAll('thead th'))
      let targetIndex = headerCells.length
      for (let i = 0; i < headerCells.length; i++) {
        const rect = headerCells[i].getBoundingClientRect()
        if (e.clientX < rect.left + rect.width / 2) {
          targetIndex = i
          break
        }
      }
      currentDropIndex = targetIndex

      // Live shifting
      const rows = Array.from(wrap.querySelectorAll('tr'))
      rows.forEach((row) => {
        Array.from(row.children).forEach((cell, i) => {
          if (i === dragStartIndex) {
            cell.style.transform = 'none'
          } else if (i >= targetIndex && i < dragStartIndex) {
            cell.style.transform = `translateX(${draggedElementWidth}px)`
          } else if (i > dragStartIndex && i < targetIndex) {
            cell.style.transform = `translateX(-${draggedElementWidth}px)`
          } else {
            cell.style.transform = 'none'
          }
        })
      })
    }
  }

  function onDragEnd() {
    isDragging = false
    document.body.style.cursor = ''
    rowHandle.style.cursor = 'grab'
    colHandle.style.cursor = 'grab'
    ghost.style.display = 'none'
    dropIndicator.style.display = 'none'

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
