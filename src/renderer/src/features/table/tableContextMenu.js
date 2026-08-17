import { readModelFromDom, dispatchModel } from './tableWidgetExtension.js'
import { icons } from './icons.js'

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

  const createItem = (label, iconSVG, action) => ({ type: 'item', label, icon: iconSVG, action })
  const createSubmenu = (label, iconSVG, items) => ({ type: 'submenu', label, icon: iconSVG, items })
  const createSeparator = () => ({ type: 'separator' })

  const rowSubmenu = [
    createItem('Insert row above', icons.addUp, () => {
      const m = readModelFromDom(wrap)
      m.rows.splice(row, 0, m.header.map(() => ''))
      dispatchModel(view, wrap, m)
    }),
    createItem('Insert row below', icons.addDown, () => {
      const m = readModelFromDom(wrap)
      m.rows.splice(row + 1, 0, m.header.map(() => ''))
      dispatchModel(view, wrap, m)
    }),
    createSeparator(),
    createItem('Move row up', icons.moveUp, () => {
      if (row <= 0) return
      const m = readModelFromDom(wrap)
      const temp = m.rows[row]
      m.rows[row] = m.rows[row - 1]
      m.rows[row - 1] = temp
      dispatchModel(view, wrap, m)
    }),
    createItem('Move row down', icons.moveDown, () => {
      const m = readModelFromDom(wrap)
      if (row >= m.rows.length - 1) return
      const temp = m.rows[row]
      m.rows[row] = m.rows[row + 1]
      m.rows[row + 1] = temp
      dispatchModel(view, wrap, m)
    }),
    createSeparator(),
    createItem('Duplicate row', icons.duplicate, () => {
      const m = readModelFromDom(wrap)
      m.rows.splice(row + 1, 0, [...m.rows[row]])
      dispatchModel(view, wrap, m)
    }),
    createItem('Delete row', icons.delete, () => {
      const m = readModelFromDom(wrap)
      if (row >= 0 && row < m.rows.length) m.rows.splice(row, 1)
      dispatchModel(view, wrap, m)
    })
  ]

  const colSubmenu = [
    createItem('Add column to the left', icons.addLeft, () => {
      const m = readModelFromDom(wrap)
      m.header.splice(col, 0, '')
      m.alignments.splice(col, 0, '')
      for (const r of m.rows) r.splice(col, 0, '')
      dispatchModel(view, wrap, m)
    }),
    createItem('Add column to the right', icons.addRight, () => {
      const m = readModelFromDom(wrap)
      m.header.splice(col + 1, 0, '')
      m.alignments.splice(col + 1, 0, '')
      for (const r of m.rows) r.splice(col + 1, 0, '')
      dispatchModel(view, wrap, m)
    }),
    createSeparator(),
    createItem('Move column left', icons.moveLeft, () => {
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
    }),
    createItem('Move column right', icons.moveRight, () => {
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
    }),
    createSeparator(),
    createItem('Align left', icons.alignLeft, () => {
      const m = readModelFromDom(wrap)
      m.alignments[col] = 'left'
      dispatchModel(view, wrap, m)
    }),
    createItem('Align center', icons.alignCenter, () => {
      const m = readModelFromDom(wrap)
      m.alignments[col] = 'center'
      dispatchModel(view, wrap, m)
    }),
    createItem('Align right', icons.alignRight, () => {
      const m = readModelFromDom(wrap)
      m.alignments[col] = 'right'
      dispatchModel(view, wrap, m)
    }),
    createSeparator(),
    createItem('Duplicate column', icons.duplicate, () => {
      const m = readModelFromDom(wrap)
      m.header.splice(col + 1, 0, m.header[col])
      m.alignments.splice(col + 1, 0, m.alignments[col])
      for (const r of m.rows) r.splice(col + 1, 0, r[col])
      dispatchModel(view, wrap, m)
    }),
    createItem('Delete column', icons.delete, () => {
      const m = readModelFromDom(wrap)
      if (m.header.length <= 1 || col < 0) return
      m.header.splice(col, 1)
      m.alignments.splice(col, 1)
      for (const r of m.rows) r.splice(col, 1)
      dispatchModel(view, wrap, m)
    })
  ]

  const items = []
  if (!isHeader) {
    items.push(createSubmenu('Row', icons.row, rowSubmenu))
  }
  items.push(createSubmenu('Column', icons.column, colSubmenu))
  items.push(createSeparator())
  items.push(createItem('Sort by column (A to Z)', icons.sortAsc, () => {
    const m = readModelFromDom(wrap)
    m.rows.sort((a, b) => (a[col] || '').trim().localeCompare((b[col] || '').trim(), undefined, { numeric: true }))
    dispatchModel(view, wrap, m)
  }))
  items.push(createItem('Sort by column (Z to A)', icons.sortDesc, () => {
    const m = readModelFromDom(wrap)
    m.rows.sort((a, b) => (b[col] || '').trim().localeCompare((a[col] || '').trim(), undefined, { numeric: true }))
    dispatchModel(view, wrap, m)
  }))

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

  function buildMenuDom(menuItems, parentEl) {
    for (const item of menuItems) {
      if (item.type === 'separator') {
        const sep = document.createElement('div')
        sep.className = 'cm-atomic-table-menu-sep'
        parentEl.appendChild(sep)
        continue
      }
      
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'cm-atomic-table-menu-item'
      
      const iconSpan = document.createElement('span')
      iconSpan.className = 'cm-atomic-table-menu-icon'
      if (item.icon) iconSpan.innerHTML = item.icon
      btn.appendChild(iconSpan)
      
      const labelSpan = document.createElement('span')
      labelSpan.className = 'cm-atomic-table-menu-label'
      labelSpan.textContent = item.label
      btn.appendChild(labelSpan)
      
      if (item.type === 'submenu') {
        const chevron = document.createElement('span')
        chevron.className = 'cm-atomic-table-menu-chevron'
        chevron.innerHTML = icons.chevronRight
        btn.appendChild(chevron)
        
        const submenuEl = document.createElement('div')
        submenuEl.className = 'cm-atomic-table-menu cm-atomic-table-submenu'
        buildMenuDom(item.items, submenuEl)
        btn.appendChild(submenuEl)
        
        btn.addEventListener('mouseenter', () => {
           Array.from(parentEl.querySelectorAll('.cm-atomic-table-submenu.open')).forEach(el => el.classList.remove('open'))
           submenuEl.classList.add('open')
           
           const rect = submenuEl.getBoundingClientRect()
           if (rect.right > window.innerWidth) {
             submenuEl.style.left = 'auto'
             submenuEl.style.right = '100%'
           } else {
             submenuEl.style.left = '100%'
             submenuEl.style.right = 'auto'
           }
        })
      } else {
        btn.addEventListener('click', () => {
          item.action()
          dismiss()
        })
        btn.addEventListener('mouseenter', () => {
           Array.from(parentEl.querySelectorAll('.cm-atomic-table-submenu.open')).forEach(el => el.classList.remove('open'))
        })
      }
      
      parentEl.appendChild(btn)
    }
  }

  buildMenuDom(items, menu)
  document.body.appendChild(menu)
  
  const rect = menu.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    menu.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`
  }
  
  setTimeout(() => {
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onDocKey, true)
  }, 0)
}
