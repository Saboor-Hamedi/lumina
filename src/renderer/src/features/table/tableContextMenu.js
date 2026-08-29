import { dispatchModel, findCurrentTableRange } from './tableWidgetExtension.js'
import { readModelFromDom } from './tableModel.js'
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
  document.querySelectorAll('.cm-atomic-table-menu-instance').forEach((m) => m.remove())

  const menu = document.createElement('div')
  menu.className = 'context-menu cm-atomic-table-menu-instance'
  menu.style.left = `${x}px`
  menu.style.top = `${y}px`
  menu.style.position = 'fixed'
  menu.style.display = 'block'

  const createItem = (label, iconSVG, action) => ({ type: 'item', label, icon: iconSVG, action })
  const createSubmenu = (label, iconSVG, items) => ({
    type: 'submenu',
    label,
    icon: iconSVG,
    items
  })
  const createSeparator = () => ({ type: 'separator' })

  const rowSubmenu = [
    createItem('Insert row above', icons.addUp, () => {
      const m = readModelFromDom(wrap)
      m.rows.splice(
        row,
        0,
        m.header.map(() => '')
      )
      dispatchModel(view, wrap, m)
    }),
    createItem('Insert row below', icons.addDown, () => {
      const m = readModelFromDom(wrap)
      m.rows.splice(
        row + 1,
        0,
        m.header.map(() => '')
      )
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
    createItem('Delete row', icons.row, () => { // Changed to row icon per user request
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
    createItem('Delete column', icons.column, () => { // Changed to column icon per user request
      const m = readModelFromDom(wrap)
      if (m.header.length <= 1 || col < 0) return
      m.header.splice(col, 1)
      m.alignments.splice(col, 1)
      for (const r of m.rows) r.splice(col, 1)
      dispatchModel(view, wrap, m)
    })
  ]

  let items = []
  const selection = wrap.__getGridSelection ? wrap.__getGridSelection() : null

  const minR = selection ? selection.minR : row
  const maxR = selection ? selection.maxR : row
  const minC = selection ? selection.minC : col
  const maxC = selection ? selection.maxC : col

  const applyFormatToSelection = (formatFn) => {
    const m = readModelFromDom(wrap)
    for (let r = minR; r <= maxR; r++) {
      if (r === -1) {
        for (let c = minC; c <= maxC; c++) m.header[c] = formatFn(m.header[c] || '')
      } else {
        if (m.rows[r]) {
          for (let c = minC; c <= maxC; c++) m.rows[r][c] = formatFn(m.rows[r][c] || '')
        }
      }
    }
    dispatchModel(view, wrap, m)
  }

  const toggleTag = (text, tag) => {
    let t = text.trim()
    if (t.startsWith(tag) && t.endsWith(tag) && t.length >= tag.length * 2) {
      return t.substring(tag.length, t.length - tag.length)
    }
    return `${tag}${t}${tag}`
  }

  const formatSubmenu = [
    createItem('Bold', icons.bold, () => applyFormatToSelection((t) => toggleTag(t, '**'))),
    createItem('Italic', icons.italic, () => applyFormatToSelection((t) => toggleTag(t, '_'))),
    createItem('Strikethrough', icons.strikethrough, () =>
      applyFormatToSelection((t) => toggleTag(t, '~~'))
    ),
    createItem('Code', icons.code, () => applyFormatToSelection((t) => toggleTag(t, '`'))),
    createSeparator(),
    createItem('Clear formatting', icons.eraser, () =>
      applyFormatToSelection((t) => t.replace(/(\*\*|__|~~|`|_|\*)/g, ''))
    )
  ]

  items.push(createSubmenu('Format', icons.format, formatSubmenu))
  items.push(createSeparator())

  items.push(
    createItem('Align left', icons.alignLeft, () => {
      const m = readModelFromDom(wrap)
      for (let c = minC; c <= maxC; c++) m.alignments[c] = 'left'
      dispatchModel(view, wrap, m)
    })
  )
  items.push(
    createItem('Align center', icons.alignCenter, () => {
      const m = readModelFromDom(wrap)
      for (let c = minC; c <= maxC; c++) m.alignments[c] = 'center'
      dispatchModel(view, wrap, m)
    })
  )
  items.push(
    createItem('Align right', icons.alignRight, () => {
      const m = readModelFromDom(wrap)
      for (let c = minC; c <= maxC; c++) m.alignments[c] = 'right'
      dispatchModel(view, wrap, m)
    })
  )
  items.push(createSeparator())

  items.push(createItem('Clear cells', icons.clearCells, () => applyFormatToSelection(() => '')))

  if (selection) {
    items.push(
      createItem('Delete rows', icons.delete, () => {
        if (minR !== -1) {
          const m = readModelFromDom(wrap)
          const numRows = maxR - minR + 1
          m.rows.splice(minR, numRows)
          dispatchModel(view, wrap, m)
        }
      })
    )
  } else {
    items.push(createSeparator())
    if (!isHeader) {
      items.push(createSubmenu('Row', icons.row, rowSubmenu))
    }
    items.push(createSubmenu('Column', icons.column, colSubmenu))
    items.push(createSeparator())
    items.push(
      createItem('Sort by column (A to Z)', icons.sortAsc, () => {
        const m = readModelFromDom(wrap)
        m.rows.sort((a, b) =>
          (a[col] || '').trim().localeCompare((b[col] || '').trim(), undefined, { numeric: true })
        )
        dispatchModel(view, wrap, m)
      })
    )
    items.push(
      createItem('Sort by column (Z to A)', icons.sortDesc, () => {
        const m = readModelFromDom(wrap)
        m.rows.sort((a, b) =>
          (b[col] || '').trim().localeCompare((a[col] || '').trim(), undefined, { numeric: true })
        )
        dispatchModel(view, wrap, m)
      })
    )
    items.push(createSeparator())
    // Add "Delete table" using the table grid icon
    const tableIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`
    items.push(
      createItem('Delete table', tableIcon, () => {
        const range = findCurrentTableRange(view, wrap)
        if (range) {
          view.dispatch({ changes: { from: range.from, to: range.to, insert: '' } })
        }
      })
    )
  }

  const dismiss = () => {
    menu.remove()
    document.querySelectorAll('.cm-atomic-table-submenu-instance').forEach((el) => el.remove())
    document.removeEventListener('mousedown', onDocDown, true)
    document.removeEventListener('keydown', onDocKey, true)
  }
  const onDocDown = (event) => {
    if (event.target instanceof Node) {
      if (menu.contains(event.target)) return
      // Prevent dismiss if clicking inside ANY portaled submenu
      const inSubmenu = Array.from(document.querySelectorAll('.cm-atomic-table-submenu-instance')).some(
        (sub) => sub.contains(event.target)
      )
      if (inSubmenu) return
    }
    dismiss()
  }
  const onDocKey = (event) => {
    if (event.key === 'Escape') dismiss()
  }

  function buildMenuDom(menuItems, parentEl, isSubmenu = false) {
    for (const item of menuItems) {
      if (item.type === 'separator') {
        const sep = document.createElement('div')
        sep.className = 'menu-divider'
        parentEl.appendChild(sep)
        continue
      }

      const btn = document.createElement('div')
      btn.className = 'menu-item'
      
      // Need a wrapper for icon + label to match ContextMenu.jsx exactly
      const leftWrap = document.createElement('div')
      leftWrap.style.display = 'flex'
      leftWrap.style.alignItems = 'center'
      leftWrap.style.gap = '8px'
      
      if (item.icon) {
        const iconSpan = document.createElement('div')
        iconSpan.className = 'menu-icon-left'
        iconSpan.innerHTML = item.icon
        leftWrap.appendChild(iconSpan)
      }

      const labelSpan = document.createElement('span')
      labelSpan.className = 'menu-label'
      labelSpan.style.whiteSpace = 'nowrap'
      labelSpan.textContent = item.label
      leftWrap.appendChild(labelSpan)
      btn.appendChild(leftWrap)

      if (item.type === 'submenu') {
        const rightWrap = document.createElement('div')
        rightWrap.style.display = 'flex'
        rightWrap.style.alignItems = 'center'
        rightWrap.style.gap = '6px'

        const chevron = document.createElement('span')
        chevron.className = 'menu-submenu-arrow'
        chevron.innerHTML = icons.chevronRight
        rightWrap.appendChild(chevron)
        btn.appendChild(rightWrap)

        const submenuEl = document.createElement('div')
        // We omit '.submenu' here because tableContextMenu manually positions it on document.body,
        // and '.submenu' has `left: 100% !important` which breaks absolute positioning on body.
        submenuEl.className = 'context-menu cm-atomic-table-submenu-instance'
        buildMenuDom(item.items, submenuEl, true)

        // Append directly to document.body so it can NEVER be clipped
        document.body.appendChild(submenuEl)

        const openSubmenu = () => {
          try {
            // Close all other submenus first
            Array.from(document.querySelectorAll('.cm-atomic-table-submenu-instance')).forEach((el) => {
              el.style.display = 'none'
              el.classList.remove('open')
            })

            // Show this submenu
            submenuEl.style.display = 'block'
            submenuEl.style.position = 'fixed'
            submenuEl.style.margin = '0' // prevent margin offset
            submenuEl.classList.add('open')

            const btnRect = btn.getBoundingClientRect()

            // Measure dimensions after making it visible
            const rect = submenuEl.getBoundingClientRect()
            const subWidth = rect.width || 200
            const subHeight = rect.height || 300

            // Safe bounds: avoid top header (40px) and bottom status bar (40px)
            const safeTop = 40
            const safeBottom = window.innerHeight - 40
            const safeLeft = 10
            const safeRight = window.innerWidth - 10

            // Portal Horizontal Positioning (fixed to viewport)
            if (btnRect.right + subWidth > safeRight) {
              submenuEl.style.left = `${Math.max(safeLeft, btnRect.left - subWidth)}px`
              submenuEl.style.right = 'auto'
            } else {
              submenuEl.style.left = `${btnRect.right}px`
              submenuEl.style.right = 'auto'
            }

            // Portal Vertical Positioning (fixed to viewport)
            if (btnRect.top + subHeight > safeBottom) {
              submenuEl.style.top = `${Math.max(safeTop, btnRect.bottom - subHeight)}px`
              submenuEl.style.bottom = 'auto'
            } else {
              submenuEl.style.top = `${btnRect.top - 4}px` // -4px for alignment with menu item
              submenuEl.style.bottom = 'auto'
            }
          } catch (err) {
            labelSpan.textContent = 'Err: ' + err.message
          }
        }
        btn.addEventListener('pointerenter', openSubmenu)
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          openSubmenu()
        })
      } else {
        btn.addEventListener('click', () => {
          item.action()
          // dismiss is handled below
          menu.remove()
          document.querySelectorAll('.cm-atomic-table-submenu-instance').forEach((el) => el.remove())
          document.removeEventListener('mousedown', onDocDown, true)
          document.removeEventListener('keydown', onDocKey, true)
        })

        // Only attach the close-submenu behavior if this is a MAIN menu item
        if (!isSubmenu) {
          btn.addEventListener('pointerenter', () => {
            Array.from(document.querySelectorAll('.cm-atomic-table-submenu-instance')).forEach((el) => {
              el.style.display = 'none'
              el.classList.remove('open')
            })
          })
        }
      }

      parentEl.appendChild(btn)
    }
  }

  buildMenuDom(items, menu)
  document.body.appendChild(menu)

  const rect = menu.getBoundingClientRect()
  
  // Safe bounds: avoid top header (40px) and bottom status bar (40px)
  const safeTop = 40
  const safeBottom = window.innerHeight - 40
  const safeLeft = 10
  const safeRight = window.innerWidth - 10

  if (rect.right > safeRight) {
    menu.style.left = `${Math.max(safeLeft, safeRight - rect.width)}px`
  }
  if (rect.bottom > safeBottom) {
    menu.style.top = `${Math.max(safeTop, safeBottom - rect.height)}px`
  }

  setTimeout(() => {
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onDocKey, true)
  }, 0)
}
