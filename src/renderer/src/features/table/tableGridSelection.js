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
  }

  wrap.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('th, td')
    if (!cell) {
      // Clicked outside table cells (e.g. padding), clear selection
      clearSelectionVisuals()
      startCell = null
      endCell = null
      return
    }

    // They clicked a cell. Clear existing grid selection immediately to allow normal text selection
    clearSelectionVisuals()

    const source = e.target.closest('.cm-atomic-table-cell-source')
    if (!source) {
      e.preventDefault()
    }

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

  wrap.addEventListener('keydown', (e) => {
    if (!hasSelection) return

    const selected = Array.from(wrap.querySelectorAll('.cm-table-cell-selected'))
    if (selected.length === 0) return

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      selected.forEach(cell => {
        const source = cell.querySelector('.cm-atomic-table-cell-source')
        if (source) source.textContent = ''
      })
      const m = readModelFromDom(wrap)
      dispatchModel(view, wrap, m)
    }
    
    // Phase 3: Keyboard selection via Shift + Arrow Keys
    if (e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const end = getCoords(endCell)
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
        endCell = newEnd
        renderSelection()
      }
    }
    
    if (e.key === 'Escape') {
      clearSelectionVisuals()
      startCell = null
      endCell = null
    }
  })

  wrap.tabIndex = -1 
  wrap.addEventListener('copy', (e) => {
    const selected = Array.from(wrap.querySelectorAll('.cm-table-cell-selected'))
    if (selected.length === 0) return
    
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
      markdown.push('|' + headerText.map(() => '---').join('|') + '|')
    }
    
    for (let r = Math.max(0, minR); r <= maxR; r++) {
      let rowText = []
      for (let c = minC; c <= maxC; c++) {
        const cell = getCellAt(r, c)
        const source = cell?.querySelector('.cm-atomic-table-cell-source')
        rowText.push((source ? source.textContent : '').replace(/\|/g, '\\|'))
      }
      markdown.push('| ' + rowText.join(' | ') + ' |')
    }
    
    e.clipboardData.setData('text/plain', markdown.join('\n'))
    e.preventDefault()
  })

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
