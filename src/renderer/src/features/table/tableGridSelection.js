import { dispatchModel } from './tableWidgetExtension.js'
import { readModelFromDom } from './tableModel.js'

export function setupTableSelection(wrap, view) {
  let isDragging = false
  let startCell = null
  let endCell = null
  let hasSelection = false // track if we currently have a grid selection

  function getCoords(cell) {
    const isHeader = cell.tagName === 'TH'
    const tr = cell.closest('tr')
    const tbody = tr?.closest('tbody')
    
    let r = -1
    if (isHeader) {
      r = -1
    } else if (tbody) {
      r = Array.from(tbody.querySelectorAll('tr')).indexOf(tr)
    }
    const c = Array.from(tr.querySelectorAll('th, td')).indexOf(cell)
    return { r, c }
  }

  function getCellAt(r, c) {
    if (r === -1) {
      const ths = wrap.querySelectorAll('thead th')
      return ths[c]
    } else {
      const trs = wrap.querySelectorAll('tbody tr')
      if (trs[r]) {
        const tds = trs[r].querySelectorAll('td')
        return tds[c]
      }
    }
    return null
  }

  function clearSelectionVisuals() {
    wrap.querySelectorAll('.cm-table-cell-selected').forEach(el => {
      el.classList.remove('cm-table-cell-selected')
    })
    const overlay = wrap.querySelector('.cm-table-selection-overlay')
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

    // If it's just one cell, we don't render grid selection so users can edit text normally.
    if (minR === maxR && minC === maxC) return

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
      let overlay = wrap.querySelector('.cm-table-selection-overlay')
      if (!overlay) {
        overlay = document.createElement('div')
        overlay.className = 'cm-table-selection-overlay'
        overlay.style.pointerEvents = 'none' // GUARANTEE clicks pass through to the cells!
        
        // Ensure wrap is relative so the absolute overlay positions correctly
        const computed = window.getComputedStyle(wrap)
        if (computed.position === 'static') {
          wrap.style.position = 'relative'
        }
        wrap.appendChild(overlay)
      }
      
      const wrapRect = wrap.getBoundingClientRect()
      const tlRect = tlCell.getBoundingClientRect()
      const brRect = brCell.getBoundingClientRect()
      
      // Calculate coordinates relative to the wrap container
      // Add scroll offsets of the wrapper if it has any overflow scroll
      const topOffset = tlRect.top - wrapRect.top + wrap.scrollTop
      const leftOffset = tlRect.left - wrapRect.left + wrap.scrollLeft
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

  wrap.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('th, td')
    if (!cell) {
      // Clicked outside table cells, clear selection
      clearSelectionVisuals()
      startCell = null
      endCell = null
      return
    }

    // They clicked a cell. Clear existing grid selection immediately to allow normal text selection
    clearSelectionVisuals()

    isDragging = true
    startCell = cell
    endCell = cell
  })

  window.addEventListener('mousemove', (e) => {
    if (!startCell) return
    
    if ((e.buttons & 1) !== 1) {
      isDragging = false
      wrap.classList.remove('cm-table-selecting')
      return
    }
    
    const target = document.elementFromPoint(e.clientX, e.clientY)
    if (!target) return
    
    const cell = target.closest('th, td')
    const currentWrap = target.closest('.cm-atomic-table')
    
    if (!cell || cell === endCell || !currentWrap) return
    if (currentWrap !== wrap && !wrap.contains(cell)) {
       if (!cell.closest('.cm-atomic-table')) return
    }
    
    endCell = cell
    
    wrap.classList.add('cm-table-selecting')
    if (document.activeElement && wrap.contains(document.activeElement)) {
      document.activeElement.blur()
      window.getSelection().removeAllRanges()
    }
    
    // Ensure the wrapper has focus so it can receive the Ctrl+C keydown event!
    wrap.focus()
    
    renderSelection()
  })

  window.addEventListener('mouseup', () => {
    isDragging = false
    wrap.classList.remove('cm-table-selecting')
    
    // If they just clicked/dragged within a single cell, don't keep it as a grid selection start
    if (startCell === endCell) {
       startCell = null
       endCell = null
    }
  })

  window.addEventListener('mousedown', (e) => {
    if (!wrap.contains(e.target)) {
      clearSelectionVisuals()
      startCell = null
      endCell = null
    }
  })

  wrap.addEventListener('keydown', (e) => {
    if (!hasSelection) return

    const selected = Array.from(wrap.querySelectorAll('.cm-table-cell-selected'))
    if (selected.length === 0) return

    // Intercept Ctrl+C / Cmd+C because the native 'copy' event won't fire if the browser selection is empty
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      
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
          const source = cell?.querySelector('.cm-atomic-table-cell-source')
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
          const source = cell?.querySelector('.cm-atomic-table-cell-source')
          rowText.push((source ? source.textContent : '').replace(/\|/g, '\\|'))
        }
        markdown.push('| ' + rowText.join(' | ') + ' |')
      }
      
      navigator.clipboard.writeText(markdown.join('\n'))
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      selected.forEach(cell => {
        const source = cell.querySelector('.cm-atomic-table-cell-source')
        if (source) source.textContent = ''
      })
      const m = readModelFromDom(wrap)
      dispatchModel(view, wrap, m)
      return
    }
    
    // Phase 3: Keyboard selection via Shift + Arrow Keys
    if (e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const end = getCoords(endCell || startCell)
      if (end.c === -1) return
      
      let r = end.r
      let c = end.c
      
      if (e.key === 'ArrowUp') r = Math.max(-1, r - 1)
      if (e.key === 'ArrowDown') {
        const rowCount = wrap.querySelectorAll('tbody tr').length
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
    
    // If they press an un-shifted arrow key, start typing, or hit Escape,
    // we MUST clear the grid selection and return control to the native text cursor.
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      clearSelectionVisuals()
      startCell = null
      endCell = null
    }
  })

  wrap.tabIndex = -1 

  wrap.__setGridSelection = (c1, c2) => {
    startCell = c1
    endCell = c2
    renderSelection()
    if (document.activeElement && wrap.contains(document.activeElement)) {
      document.activeElement.blur()
      window.getSelection().removeAllRanges()
    }
    wrap.focus({ preventScroll: true })
  }

  wrap.__getCellAt = getCellAt
}
