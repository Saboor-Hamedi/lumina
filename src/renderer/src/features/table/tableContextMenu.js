import { readModelFromDom, dispatchModel } from './tableWidgetExtension.js'

export function cellRowIndex(cell) {
  const tr = cell.closest('tr')
  const tbody = tr?.closest('tbody')
  if (!tr || !tbody) return -1
  return Array.from(tbody.querySelectorAll('tr')).indexOf(tr)
}

export function cellColIndex(cell) {
  const tr = cell.closest('tr')
  if (!tr) return -1
  return Array.from(tr.querySelectorAll('th, td')).indexOf(cell)
}

export function openCellMenu(view, cell, x, y) {
  const wrap = cell.closest('.cm-atomic-table')
  if (!wrap) return
  const isHeader = cell.tagName === 'TH'
  const row = cellRowIndex(cell)
  const col = cellColIndex(cell)
  // Remove any existing menus first
  document.querySelectorAll('.cm-atomic-table-menu').forEach(m => m.remove())

  const menu = document.createElement('div')
  menu.className = 'cm-atomic-table-menu'
  menu.style.left = `${x}px`
  menu.style.top = `${y}px`
  const items = []
  
  if (!isHeader) {
    items.push({
      label: 'Insert row above',
      action: () => {
        const m = readModelFromDom(wrap)
        m.rows.splice(
          row,
          0,
          m.header.map(() => '')
        )
        dispatchModel(view, wrap, m)
      }
    })
    items.push({
      label: 'Insert row below',
      action: () => {
        const m = readModelFromDom(wrap)
        m.rows.splice(
          row + 1,
          0,
          m.header.map(() => '')
        )
        dispatchModel(view, wrap, m)
      }
    })
    items.push({
      label: 'Move row up',
      action: () => {
        if (row <= 0) return
        const m = readModelFromDom(wrap)
        const temp = m.rows[row]
        m.rows[row] = m.rows[row - 1]
        m.rows[row - 1] = temp
        dispatchModel(view, wrap, m)
      }
    })
    items.push({
      label: 'Move row down',
      action: () => {
        const m = readModelFromDom(wrap)
        if (row >= m.rows.length - 1) return
        const temp = m.rows[row]
        m.rows[row] = m.rows[row + 1]
        m.rows[row + 1] = temp
        dispatchModel(view, wrap, m)
      }
    })
    items.push({
      label: 'Delete row',
      action: () => {
        const m = readModelFromDom(wrap)
        if (row >= 0 && row < m.rows.length) m.rows.splice(row, 1)
        dispatchModel(view, wrap, m)
      }
    })
    items.push('separator')
  }
  
  items.push({
    label: 'Insert column left',
    action: () => {
      const m = readModelFromDom(wrap)
      m.header.splice(col, 0, '')
      m.alignments.splice(col, 0, '')
      for (const r of m.rows) r.splice(col, 0, '')
      dispatchModel(view, wrap, m)
    }
  })
  items.push({
    label: 'Insert column right',
    action: () => {
      const m = readModelFromDom(wrap)
      m.header.splice(col + 1, 0, '')
      m.alignments.splice(col + 1, 0, '')
      for (const r of m.rows) r.splice(col + 1, 0, '')
      dispatchModel(view, wrap, m)
    }
  })
  items.push({
    label: 'Move column left',
    action: () => {
      if (col <= 0) return
      const m = readModelFromDom(wrap)
      const tempH = m.header[col]
      m.header[col] = m.header[col - 1]
      m.header[col - 1] = tempH
      const tempA = m.alignments[col]
      m.alignments[col] = m.alignments[col - 1]
      m.alignments[col - 1] = tempA
      for (const r of m.rows) {
        const temp = r[col]
        r[col] = r[col - 1]
        r[col - 1] = temp
      }
      dispatchModel(view, wrap, m)
    }
  })
  items.push({
    label: 'Move column right',
    action: () => {
      const m = readModelFromDom(wrap)
      if (col >= m.header.length - 1) return
      const tempH = m.header[col]
      m.header[col] = m.header[col + 1]
      m.header[col + 1] = tempH
      const tempA = m.alignments[col]
      m.alignments[col] = m.alignments[col + 1]
      m.alignments[col + 1] = tempA
      for (const r of m.rows) {
        const temp = r[col]
        r[col] = r[col + 1]
        r[col + 1] = temp
      }
      dispatchModel(view, wrap, m)
    }
  })
  items.push({
    label: 'Delete column',
    action: () => {
      const m = readModelFromDom(wrap)
      if (m.header.length <= 1 || col < 0) return
      m.header.splice(col, 1)
      m.alignments.splice(col, 1)
      for (const r of m.rows) r.splice(col, 1)
      dispatchModel(view, wrap, m)
    }
  })
  items.push('separator')
  items.push({
    label: 'Align Left',
    action: () => {
      const m = readModelFromDom(wrap)
      m.alignments[col] = 'left'
      dispatchModel(view, wrap, m)
    }
  })
  items.push({
    label: 'Align Center',
    action: () => {
      const m = readModelFromDom(wrap)
      m.alignments[col] = 'center'
      dispatchModel(view, wrap, m)
    }
  })
  items.push({
    label: 'Align Right',
    action: () => {
      const m = readModelFromDom(wrap)
      m.alignments[col] = 'right'
      dispatchModel(view, wrap, m)
    }
  })
  items.push('separator')
  items.push({
    label: 'Sort Ascending',
    action: () => {
      const m = readModelFromDom(wrap)
      m.rows.sort((a, b) => {
        const valA = (a[col] || '').trim()
        const valB = (b[col] || '').trim()
        return valA.localeCompare(valB, undefined, { numeric: true })
      })
      dispatchModel(view, wrap, m)
    }
  })
  items.push({
    label: 'Sort Descending',
    action: () => {
      const m = readModelFromDom(wrap)
      m.rows.sort((a, b) => {
        const valA = (a[col] || '').trim()
        const valB = (b[col] || '').trim()
        return valB.localeCompare(valA, undefined, { numeric: true })
      })
      dispatchModel(view, wrap, m)
    }
  })
  
  const dismiss = () => {
    menu.remove()
    document.removeEventListener('mousedown', onDocDown, true)
    document.removeEventListener('keydown', onDocKey, true)
  }
  const onDocDown = (event) => {
    if (event.target instanceof Node && menu.contains(event.target)) return
    dismiss()
  }
  const onDocKey = (event) => {
    if (event.key === 'Escape') dismiss()
  }
  
  for (const item of items) {
    if (item === 'separator') {
      const sep = document.createElement('div')
      sep.className = 'cm-atomic-table-menu-sep'
      menu.appendChild(sep)
      continue
    }
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-atomic-table-menu-item'
    btn.textContent = item.label
    btn.addEventListener('click', () => {
      item.action()
      dismiss()
    })
    menu.appendChild(btn)
  }
  document.body.appendChild(menu)
  
  // Clip the menu inside the viewport if it overflows.
  const rect = menu.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    menu.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`
  }
  
  // Deferred listener attach so the current contextmenu→document
  // mousedown cycle doesn't immediately dismiss us.
  setTimeout(() => {
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onDocKey, true)
  }, 0)
}
