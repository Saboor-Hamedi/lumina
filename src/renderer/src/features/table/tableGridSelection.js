import { readModelFromDom, dispatchModel } from './tableWidgetExtension.js'

export function setupTableSelection(wrap, view) {
  let isDragging = false
  let startCell = null
  let endCell = null

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

  function renderSelection() {
    // 1. One selection owner, no inline styles race.
    wrap.querySelectorAll('.cm-table-cell-selected').forEach(el => {
      el.classList.remove('cm-table-cell-selected')
    })
    
    if (!startCell || !endCell) return
    
    const start = getCoords(startCell)
    const end = getCoords(endCell)
    if (start.c === -1 || end.c === -1) return

    const minR = Math.min(start.r, end.r)
    const maxR = Math.max(start.r, end.r)
    const minC = Math.min(start.c, end.c)
    const maxC = Math.max(start.c, end.c)

    if (minR === maxR && minC === maxC) {
      startCell = null
      endCell = null
      return
    }

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
    if (!cell) return

    // If they click inside the source, let them edit, but prepare for cross-cell drag
    const source = e.target.closest('.cm-atomic-table-cell-source')
    if (!source) {
      // They clicked on padding, prevent default to avoid CodeMirror taking focus
      e.preventDefault()
    }

    isDragging = true
    startCell = cell
    endCell = cell
    renderSelection()
  })

  window.addEventListener('mousemove', (e) => {
    if (!startCell) return
    
    // e.buttons === 1 means the left mouse button is currently held down
    if ((e.buttons & 1) !== 1) {
      isDragging = false
      wrap.classList.remove('cm-table-selecting')
      return
    }
    
    // Bypass native drag target-locking by finding exactly what element is under the pointer
    const target = document.elementFromPoint(e.clientX, e.clientY)
    if (!target) return
    
    const cell = target.closest('th, td')
    
    // Re-resolve wrap by position during mousemove so drag survives re-renders
    const currentWrap = target.closest('.cm-atomic-table')
    
    if (!cell || cell === endCell || !currentWrap) return
    // Ensure we are dragging within the same logical table even if DOM replaced
    if (currentWrap !== wrap && !wrap.contains(cell)) {
       // It might be a new DOM element for the same table. We'll verify it's a table cell.
       if (!cell.closest('.cm-atomic-table')) return
    }
    
    endCell = cell
    
    // We crossed into a new cell, so it's a grid selection!
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
    
    // If we just finished a drag but didn't select anything (just clicked a cell),
    // clear the startCell so future drags from outside don't trigger grid selection
    if (startCell === endCell) {
       startCell = null
       endCell = null
    }
  })

  wrap.addEventListener('keydown', (e) => {
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
  })

  wrap.tabIndex = -1 // Allow wrap to receive focus for copy events
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
    
    // If header is selected, generate markdown header and delimiter
    if (minR === -1) {
      let headerText = []
      for (let c = minC; c <= maxC; c++) {
        const cell = getCellAt(-1, c)
        const source = cell?.querySelector('.cm-atomic-table-cell-source')
        headerText.push((source ? source.textContent : '').replace(/\\|\\/g, '\\|'))
      }
      markdown.push('| ' + headerText.join(' | ') + ' |')
      markdown.push('|' + headerText.map(() => '---').join('|') + '|')
    }
    
    for (let r = Math.max(0, minR); r <= maxR; r++) {
      let rowText = []
      for (let c = minC; c <= maxC; c++) {
        const cell = getCellAt(r, c)
        const source = cell?.querySelector('.cm-atomic-table-cell-source')
        rowText.push((source ? source.textContent : '').replace(/\\|\\/g, '\\|'))
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
    wrap.focus({ preventScroll: true }) // Give wrap focus so Ctrl+C triggers copy listener
  }

  wrap.__getCellAt = getCellAt
}

