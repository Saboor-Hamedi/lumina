import { dispatchModel } from './tableExtension.js'
import { readModelFromDom } from './tableModel.js'
import { icons } from './tableIcons.js'
import { copyTableAs, exportTableAsCSV, duplicateTable } from './tableActions.js'
import { applyColumnSort } from './tableSort.js'
import { redistributeColumnWidths } from './tableResize.js'

export function cellRowIndex(cell) {
  if (!cell) return -1
  const targetCell = cell.closest ? (cell.closest('th, td') || cell) : cell
  const tr = targetCell.closest ? targetCell.closest('tr') : null
  const tbody = tr?.closest ? tr.closest('tbody') : null
  if (!tr || !tbody) return -1
  return Array.from(tbody.querySelectorAll('tr')).indexOf(tr)
}

export function cellColIndex(cell) {
  if (!cell) return -1
  const targetCell = cell.closest ? (cell.closest('th, td') || cell) : cell
  const tr = targetCell.closest ? targetCell.closest('tr') : null
  if (!tr) return -1
  return Array.from(tr.querySelectorAll('th, td')).indexOf(targetCell)
}

/**
 * Opens a rich, accessible context menu for a table cell.
 *
 * @param {EditorView} view
 * @param {HTMLElement} cell
 * @param {number} x
 * @param {number} y
 */
export function openCellMenu(view, cell, x, y) {
  const wrap = cell.closest('.cm-atomic-table')
  if (!wrap) return
  const isHeader = cell.tagName === 'TH'
  const row = cellRowIndex(cell)
  const col = cellColIndex(cell)

  // Remove any previous menu or backdrop instances
  cleanupExistingMenus()

  // Read current model state to determine alignments, row counts, etc.
  const currentModel = readModelFromDom(wrap)
  const totalRows = currentModel.rows.length
  const totalCols = currentModel.header.length

  const selection = wrap.__getGridSelection ? wrap.__getGridSelection() : null
  let targetRow = row
  let rowDeleteCount = 1

  if (selection) {
    if (selection.minR >= 0) {
      targetRow = selection.minR
      rowDeleteCount = selection.maxR - selection.minR + 1
    } else if (selection.minR === -1 && selection.maxR >= 0) {
      targetRow = 0
      rowDeleteCount = selection.maxR + 1
    } else if (selection.minR === -1 && selection.maxR === -1) {
      targetRow = -1
      rowDeleteCount = 0
    }
  }

  let targetCol = col >= 0 ? col : 0
  let colDeleteCount = 1

  if (selection && selection.minC >= 0) {
    targetCol = selection.minC
    colDeleteCount = selection.maxC - selection.minC + 1
  }

  const minR = selection ? selection.minR : row
  const maxR = selection ? selection.maxR : row
  const minC = selection ? selection.minC : targetCol
  const maxC = selection ? selection.maxC : targetCol

  const currentColAlign = (currentModel.alignments && currentModel.alignments[targetCol]) || 'left'

  // Item Factory Helpers
  const createItem = (label, iconSVG, action, opts = {}) => ({
    type: 'item',
    label,
    icon: iconSVG,
    action,
    danger: Boolean(opts.danger),
    disabled: Boolean(opts.disabled),
    shortcut: opts.shortcut || null,
    isActive: Boolean(opts.isActive)
  })

  const createSubmenu = (label, iconSVG, items) => ({
    type: 'submenu',
    label,
    icon: iconSVG,
    items
  })

  const createSeparator = () => ({ type: 'separator' })

  // ── Row Submenu ──────────────────────────────────────────────────────────
  const rowSubmenu = []
  if (isHeader) {
    rowSubmenu.push(
      createItem('Add Row Below', icons.addDown, () => {
        const m = readModelFromDom(wrap)
        m.rows.unshift(m.header.map(() => ''))
        if (m.rowHeights?.length) {
          m.rowHeights.unshift(28)
        }
        dispatchModel(view, wrap, m, {
          isHeader: false,
          rowIdx: 0,
          colIdx: Math.max(0, targetCol)
        })
      })
    )
  } else {
    rowSubmenu.push(
      createItem('Add Row Above', icons.addUp, () => {
        const m = readModelFromDom(wrap)
        const rIdx = targetRow >= 0 ? targetRow : 0
        m.rows.splice(rIdx, 0, m.header.map(() => ''))
        if (m.rowHeights?.length) {
          m.rowHeights.splice(rIdx, 0, 28)
        }
        dispatchModel(view, wrap, m, {
          isHeader: false,
          rowIdx: rIdx,
          colIdx: Math.max(0, targetCol)
        })
      }),
      createItem('Add Row Below', icons.addDown, () => {
        const m = readModelFromDom(wrap)
        const rIdx = targetRow >= 0 ? targetRow : m.rows.length - 1
        m.rows.splice(rIdx + 1, 0, m.header.map(() => ''))
        if (m.rowHeights?.length) {
          m.rowHeights.splice(rIdx + 1, 0, 28)
        }
        dispatchModel(view, wrap, m, {
          isHeader: false,
          rowIdx: rIdx + 1,
          colIdx: Math.max(0, targetCol)
        })
      }),
      createSeparator(),
      createItem('Duplicate Row', icons.duplicate, () => {
        const m = readModelFromDom(wrap)
        const rIdx = targetRow >= 0 ? targetRow : 0
        if (m.rows[rIdx]) {
          m.rows.splice(rIdx + 1, 0, [...m.rows[rIdx]])
          if (m.rowHeights?.length) {
            m.rowHeights.splice(rIdx + 1, 0, m.rowHeights[rIdx] || 28)
          }
          dispatchModel(view, wrap, m, {
            isHeader: false,
            rowIdx: rIdx + 1,
            colIdx: Math.max(0, targetCol)
          })
        }
      }),
      createItem(
        'Move Row Up',
        icons.moveUp,
        () => {
          if (targetRow <= 0) return
          const m = readModelFromDom(wrap)
          const temp = m.rows[targetRow]
          m.rows[targetRow] = m.rows[targetRow - 1]
          m.rows[targetRow - 1] = temp
          if (m.rowHeights?.length) {
            const tempH = m.rowHeights[targetRow]
            m.rowHeights[targetRow] = m.rowHeights[targetRow - 1]
            m.rowHeights[targetRow - 1] = tempH
          }
          dispatchModel(view, wrap, m, {
            isHeader: false,
            rowIdx: targetRow - 1,
            colIdx: Math.max(0, targetCol)
          })
        },
        { disabled: targetRow <= 0 }
      ),
      createItem(
        'Move Row Down',
        icons.moveDown,
        () => {
          if (targetRow >= totalRows - 1 || targetRow < 0) return
          const m = readModelFromDom(wrap)
          const temp = m.rows[targetRow]
          m.rows[targetRow] = m.rows[targetRow + 1]
          m.rows[targetRow + 1] = temp
          if (m.rowHeights?.length) {
            const tempH = m.rowHeights[targetRow]
            m.rowHeights[targetRow] = m.rowHeights[targetRow + 1]
            m.rowHeights[targetRow + 1] = tempH
          }
          dispatchModel(view, wrap, m, {
            isHeader: false,
            rowIdx: targetRow + 1,
            colIdx: Math.max(0, targetCol)
          })
        },
        { disabled: targetRow >= totalRows - 1 || targetRow < 0 }
      ),
      createSeparator(),
      createItem(
        rowDeleteCount > 1 ? `Delete ${rowDeleteCount} Rows` : 'Delete Row',
        icons.delete,
        () => {
          const m = readModelFromDom(wrap)
          if (targetRow >= 0 && targetRow < m.rows.length) {
            m.rows.splice(targetRow, rowDeleteCount)
            if (m.rowHeights?.length) {
              m.rowHeights.splice(targetRow, rowDeleteCount)
            }
            const nextRow = Math.min(targetRow, m.rows.length - 1)
            const focusInfo = m.rows.length > 0
              ? { isHeader: false, rowIdx: Math.max(0, nextRow), colIdx: Math.max(0, targetCol) }
              : { isHeader: true, rowIdx: 0, colIdx: Math.max(0, targetCol) }
            dispatchModel(view, wrap, m, focusInfo)
          }
        },
        { danger: true }
      )
    )
  }

  // ── Column Submenu ───────────────────────────────────────────────────────
  const colSubmenu = [
    createItem('Add Column Left', icons.addLeft, () => {
      const m = readModelFromDom(wrap)
      const cIdx = targetCol >= 0 ? targetCol : 0
      m.header.splice(cIdx, 0, '')
      m.alignments.splice(cIdx, 0, '')
      if (m.columnWidths?.length) {
        m.columnWidths.splice(cIdx, 0, 110)
      }
      for (const r of m.rows) r.splice(cIdx, 0, '')
      dispatchModel(view, wrap, m, {
        isHeader,
        rowIdx: Math.max(0, targetRow),
        colIdx: cIdx
      })
    }),
    createItem('Add Column Right', icons.addRight, () => {
      const m = readModelFromDom(wrap)
      const cIdx = targetCol >= 0 ? targetCol : m.header.length - 1
      m.header.splice(cIdx + 1, 0, '')
      m.alignments.splice(cIdx + 1, 0, '')
      if (m.columnWidths?.length) {
        m.columnWidths.splice(cIdx + 1, 0, 110)
      }
      for (const r of m.rows) r.splice(cIdx + 1, 0, '')
      dispatchModel(view, wrap, m, {
        isHeader,
        rowIdx: Math.max(0, targetRow),
        colIdx: cIdx + 1
      })
    }),
    createSeparator(),
    createItem('Duplicate Column', icons.duplicate, () => {
      const m = readModelFromDom(wrap)
      const cIdx = targetCol >= 0 ? targetCol : 0
      if (cIdx >= 0 && cIdx < m.header.length) {
        m.header.splice(cIdx + 1, 0, m.header[cIdx])
        m.alignments.splice(cIdx + 1, 0, m.alignments[cIdx])
        if (m.columnWidths?.length) {
          m.columnWidths.splice(cIdx + 1, 0, m.columnWidths[cIdx] || 110)
        }
        for (const r of m.rows) r.splice(cIdx + 1, 0, r[cIdx])
        dispatchModel(view, wrap, m, {
          isHeader,
          rowIdx: Math.max(0, targetRow),
          colIdx: cIdx + 1
        })
      }
    }),
    createItem(
      'Move Column Left',
      icons.moveLeft,
      () => {
        if (targetCol <= 0) return
        const m = readModelFromDom(wrap)
        const tempH = m.header[targetCol]
        m.header[targetCol] = m.header[targetCol - 1]
        m.header[targetCol - 1] = tempH
        const tempA = m.alignments[targetCol]
        m.alignments[targetCol] = m.alignments[targetCol - 1]
        m.alignments[targetCol - 1] = tempA
        if (m.columnWidths?.length) {
          const tempW = m.columnWidths[targetCol]
          m.columnWidths[targetCol] = m.columnWidths[targetCol - 1]
          m.columnWidths[targetCol - 1] = tempW
        }
        for (const r of m.rows) {
          const temp = r[targetCol]
          r[targetCol] = r[targetCol - 1]
          r[targetCol - 1] = temp
        }
        dispatchModel(view, wrap, m, {
          isHeader,
          rowIdx: Math.max(0, targetRow),
          colIdx: targetCol - 1
        })
      },
      { disabled: targetCol <= 0 }
    ),
    createItem(
      'Move Column Right',
      icons.moveRight,
      () => {
        if (targetCol >= totalCols - 1 || targetCol < 0) return
        const m = readModelFromDom(wrap)
        const tempH = m.header[targetCol]
        m.header[targetCol] = m.header[targetCol + 1]
        m.header[targetCol + 1] = tempH
        const tempA = m.alignments[targetCol]
        m.alignments[targetCol] = m.alignments[targetCol + 1]
        m.alignments[targetCol + 1] = tempA
        if (m.columnWidths?.length) {
          const tempW = m.columnWidths[targetCol]
          m.columnWidths[targetCol] = m.columnWidths[targetCol + 1]
          m.columnWidths[targetCol + 1] = tempW
        }
        for (const r of m.rows) {
          const temp = r[targetCol]
          r[targetCol] = r[targetCol + 1]
          r[targetCol + 1] = temp
        }
        dispatchModel(view, wrap, m, {
          isHeader,
          rowIdx: Math.max(0, targetRow),
          colIdx: targetCol + 1
        })
      },
      { disabled: targetCol >= totalCols - 1 || targetCol < 0 }
    ),
    createSeparator(),
    createItem(
      colDeleteCount > 1 ? `Delete ${colDeleteCount} Columns` : 'Delete Column',
      icons.delete,
      () => {
        const m = readModelFromDom(wrap)
        if (targetCol >= 0 && targetCol < m.header.length) {
          if (m.header.length <= 1) {
            m.header = ['']
            m.alignments = ['left']
            if (m.columnWidths?.length) m.columnWidths = [110]
            m.rows.forEach(r => { r[0] = '' })
            dispatchModel(view, wrap, m, { isHeader: true, rowIdx: 0, colIdx: 0 })
          } else {
            const deleteCount = Math.min(colDeleteCount, m.header.length)
            m.header.splice(targetCol, deleteCount)
            m.alignments.splice(targetCol, deleteCount)
            if (m.columnWidths?.length) {
              m.columnWidths.splice(targetCol, deleteCount)
              // Redistribute freed space so remaining columns fill the container.
              m.columnWidths = redistributeColumnWidths(m.columnWidths, wrap)
            }
            for (const r of m.rows) {
              if (r.length > targetCol) r.splice(targetCol, deleteCount)
            }
            const nextCol = Math.max(0, Math.min(targetCol, m.header.length - 1))
            const focusInfo = {
              isHeader,
              rowIdx: Math.max(0, targetRow),
              colIdx: nextCol
            }
            dispatchModel(view, wrap, m, focusInfo)
          }
        }
      },
      { danger: true }
    )
  ]

  // ── Export & Options Submenu ─────────────────────────────────────────────
  const exportSubmenu = [
    createItem('Copy as Plain Text', icons.duplicate, () => {
      const m = readModelFromDom(wrap)
      copyTableAs(m, 'plain')
    }),
    createItem('Copy as Markdown', icons.code, () => {
      const m = readModelFromDom(wrap)
      copyTableAs(m, 'markdown')
    }),
    createItem('Copy as Spreadsheet', icons.column, () => {
      const m = readModelFromDom(wrap)
      copyTableAs(m, 'csv')
    }),
    createItem('Copy as Data (JSON)', icons.code, () => {
      const m = readModelFromDom(wrap)
      copyTableAs(m, 'json')
    }),
    createSeparator(),
    createItem('Save as Spreadsheet (.csv)', icons.settings, () => {
      const m = readModelFromDom(wrap)
      exportTableAsCSV(m)
    }),
    createItem('Duplicate Table', icons.duplicate, () => {
      const m = readModelFromDom(wrap)
      duplicateTable(view, wrap, m)
    })
  ]

  // ── Format Submenu ───────────────────────────────────────────────────────
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
    createItem(
      'Bold',
      icons.bold,
      () => applyFormatToSelection((t) => toggleTag(t, '**')),
      { shortcut: 'Ctrl+B' }
    ),
    createItem(
      'Italic',
      icons.italic,
      () => applyFormatToSelection((t) => toggleTag(t, '_')),
      { shortcut: 'Ctrl+I' }
    ),
    createItem(
      'Strikethrough',
      icons.strikethrough,
      () => applyFormatToSelection((t) => toggleTag(t, '~~'))
    ),
    createItem(
      'Inline Code',
      icons.code,
      () => applyFormatToSelection((t) => toggleTag(t, '`')),
      { shortcut: '`' }
    ),
    createSeparator(),
    createItem(
      'Clear Formatting',
      icons.eraser,
      () => applyFormatToSelection((t) => t.replace(/(\*\*|__|~~|`|_|\*)/g, ''))
    )
  ]

  // ── Main Menu Items ──────────────────────────────────────────────────────
  const items = []

  items.push(createSubmenu('Row', icons.row, rowSubmenu))
  items.push(createSubmenu('Column', icons.column, colSubmenu))
  items.push(createSeparator())

  items.push(createSubmenu('Format', icons.format, formatSubmenu))
  items.push(createSubmenu('More Options', icons.duplicate, exportSubmenu))
  items.push(createSeparator())

  items.push(
    createItem(
      'Align Left',
      icons.alignLeft,
      () => {
        const m = readModelFromDom(wrap)
        for (let c = minC; c <= maxC; c++) m.alignments[c] = 'left'
        dispatchModel(view, wrap, m, { isHeader, rowIdx: Math.max(0, targetRow), colIdx: targetCol })
      },
      { isActive: currentColAlign === 'left' || !currentColAlign }
    )
  )
  items.push(
    createItem(
      'Align Center',
      icons.alignCenter,
      () => {
        const m = readModelFromDom(wrap)
        for (let c = minC; c <= maxC; c++) m.alignments[c] = 'center'
        dispatchModel(view, wrap, m, { isHeader, rowIdx: Math.max(0, targetRow), colIdx: targetCol })
      },
      { isActive: currentColAlign === 'center' }
    )
  )
  items.push(
    createItem(
      'Align Right',
      icons.alignRight,
      () => {
        const m = readModelFromDom(wrap)
        for (let c = minC; c <= maxC; c++) m.alignments[c] = 'right'
        dispatchModel(view, wrap, m, { isHeader, rowIdx: Math.max(0, targetRow), colIdx: targetCol })
      },
      { isActive: currentColAlign === 'right' }
    )
  )
  items.push(createSeparator())

  items.push(
    createItem('Sort Column (A to Z)', icons.sortAsc, () => {
      const cIdx = targetCol >= 0 ? targetCol : 0
      applyColumnSort(view, wrap, cIdx, 'asc')
    })
  )
  items.push(
    createItem('Sort Column (Z to A)', icons.sortDesc, () => {
      const cIdx = targetCol >= 0 ? targetCol : 0
      applyColumnSort(view, wrap, cIdx, 'desc')
    })
  )

  // ── Build DOM Elements ───────────────────────────────────────────────────
  const checkIconSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`

  // Transparent backdrop to prevent click leaks
  const backdrop = document.createElement('div')
  backdrop.className = 'cm-atomic-table-menu-backdrop'
  backdrop.style.position = 'fixed'
  backdrop.style.inset = '0'
  backdrop.style.zIndex = '9999'
  backdrop.style.background = 'transparent'

  const menu = document.createElement('div')
  menu.className = 'context-menu cm-atomic-table-menu-instance'
  menu.style.position = 'fixed'
  menu.style.display = 'block'
  menu.style.zIndex = '10000'
  menu.style.left = `${x}px`
  menu.style.top = `${y}px`
  menu.setAttribute('role', 'menu')

  const dismiss = () => {
    cleanupExistingMenus()
    document.removeEventListener('keydown', onDocKey, true)
  }

  const onDocKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      dismiss()
    }
  }

  backdrop.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    dismiss()
  })

  backdrop.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    dismiss()
  })

  let activeSubmenuEl = null
  let activeSubmenuTimer = null

  function closeSubmenus() {
    if (activeSubmenuTimer) {
      clearTimeout(activeSubmenuTimer)
      activeSubmenuTimer = null
    }
    document.querySelectorAll('.cm-atomic-table-submenu-instance').forEach((el) => {
      el.style.display = 'none'
      el.classList.remove('open')
    })
    activeSubmenuEl = null
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
      btn.className = `menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`
      btn.setAttribute('role', 'menuitem')

      if (item.disabled) {
        btn.style.opacity = '0.45'
        btn.style.cursor = 'not-allowed'
        btn.style.pointerEvents = 'none'
      }

      // Left wrap: icon + label
      const leftWrap = document.createElement('div')
      leftWrap.style.display = 'flex'
      leftWrap.style.alignItems = 'center'
      leftWrap.style.gap = '8px'

      if (item.icon) {
        const iconSpan = document.createElement('div')
        iconSpan.className = 'menu-icon-left'
        iconSpan.style.display = 'flex'
        iconSpan.style.alignItems = 'center'
        if (item.danger) {
          iconSpan.style.color = 'var(--text-danger, #ef4444)'
        }
        iconSpan.innerHTML = item.icon
        leftWrap.appendChild(iconSpan)
      }

      const labelSpan = document.createElement('span')
      labelSpan.className = 'menu-label'
      labelSpan.style.whiteSpace = 'nowrap'
      labelSpan.textContent = item.label
      leftWrap.appendChild(labelSpan)
      btn.appendChild(leftWrap)

      // Right wrap: shortcuts, checkmark, or submenu chevron
      const rightWrap = document.createElement('div')
      rightWrap.style.display = 'flex'
      rightWrap.style.alignItems = 'center'
      rightWrap.style.gap = '6px'

      if (item.shortcut) {
        const shortcutWrap = document.createElement('span')
        shortcutWrap.className = 'menu-shortcut-wrap'
        shortcutWrap.style.display = 'inline-flex'
        shortcutWrap.style.alignItems = 'center'
        shortcutWrap.style.gap = '3px'

        const parts = item.shortcut.split('+')
        parts.forEach((part, pIdx) => {
          const kbd = document.createElement('kbd')
          kbd.className = 'menu-shortcut'
          kbd.style.fontSize = '10px'
          kbd.style.fontWeight = '600'
          kbd.style.color = 'var(--text-muted, #94a3b8)'
          kbd.style.padding = '1px 5px'
          kbd.style.borderRadius = '4px'
          kbd.style.background = 'rgba(255, 255, 255, 0.06)'
          kbd.style.border = '1px solid rgba(255, 255, 255, 0.08)'
          kbd.style.lineHeight = '1.3'
          kbd.style.whiteSpace = 'nowrap'
          kbd.textContent = part.trim()
          shortcutWrap.appendChild(kbd)

          if (pIdx < parts.length - 1) {
            const plus = document.createElement('span')
            plus.style.fontSize = '9px'
            plus.style.color = 'var(--text-faint, #64748b)'
            plus.textContent = '+'
            shortcutWrap.appendChild(plus)
          }
        })
        rightWrap.appendChild(shortcutWrap)
      }

      if (item.isActive) {
        const checkSpan = document.createElement('span')
        checkSpan.className = 'menu-check'
        checkSpan.style.display = 'flex'
        checkSpan.style.alignItems = 'center'
        checkSpan.style.color = 'var(--text-accent, #3b82f6)'
        checkSpan.innerHTML = checkIconSVG
        rightWrap.appendChild(checkSpan)
      }

      if (item.type === 'submenu') {
        const chevron = document.createElement('span')
        chevron.className = 'menu-submenu-arrow'
        chevron.style.display = 'flex'
        chevron.style.alignItems = 'center'
        chevron.innerHTML = icons.chevronRight
        rightWrap.appendChild(chevron)
        btn.appendChild(rightWrap)

        const submenuEl = document.createElement('div')
        submenuEl.className = 'context-menu cm-atomic-table-submenu-instance'
        submenuEl.style.zIndex = '10001'
        buildMenuDom(item.items, submenuEl, true)
        document.body.appendChild(submenuEl)

        const openThisSubmenu = () => {
          if (activeSubmenuTimer) {
            clearTimeout(activeSubmenuTimer)
            activeSubmenuTimer = null
          }
          if (activeSubmenuEl === submenuEl) return

          // Close other open submenus
          document.querySelectorAll('.cm-atomic-table-submenu-instance').forEach((el) => {
            if (el !== submenuEl) {
              el.style.display = 'none'
              el.classList.remove('open')
            }
          })

          submenuEl.style.display = 'block'
          submenuEl.style.position = 'fixed'
          submenuEl.style.margin = '0'
          submenuEl.classList.add('open')
          activeSubmenuEl = submenuEl

          const btnRect = btn.getBoundingClientRect()
          const subRect = submenuEl.getBoundingClientRect()
          const subWidth = subRect.width || 210
          const subHeight = subRect.height || 260

          const safeTop = 40
          const safeBottom = window.innerHeight - 40
          const safeLeft = 10
          const safeRight = window.innerWidth - 10

          // Horizontal positioning (flip left if clipped by window edge)
          if (btnRect.right + subWidth > safeRight) {
            submenuEl.style.left = `${Math.max(safeLeft, btnRect.left - subWidth)}px`
          } else {
            submenuEl.style.left = `${btnRect.right}px`
          }

          // Vertical positioning (align with item, clamp to window bounds)
          if (btnRect.top + subHeight > safeBottom) {
            submenuEl.style.top = `${Math.max(safeTop, btnRect.bottom - subHeight)}px`
          } else {
            submenuEl.style.top = `${Math.max(safeTop, btnRect.top - 4)}px`
          }
        }

        btn.addEventListener('pointerenter', () => {
          openThisSubmenu()
        })

        btn.addEventListener('pointerleave', () => {
          activeSubmenuTimer = setTimeout(() => {
            if (activeSubmenuEl === submenuEl) {
              submenuEl.style.display = 'none'
              submenuEl.classList.remove('open')
              activeSubmenuEl = null
            }
          }, 150)
        })

        submenuEl.addEventListener('pointerenter', () => {
          if (activeSubmenuTimer) {
            clearTimeout(activeSubmenuTimer)
            activeSubmenuTimer = null
          }
        })

        submenuEl.addEventListener('pointerleave', () => {
          activeSubmenuTimer = setTimeout(() => {
            submenuEl.style.display = 'none'
            submenuEl.classList.remove('open')
            if (activeSubmenuEl === submenuEl) activeSubmenuEl = null
          }, 150)
        })

        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          openThisSubmenu()
        })
      } else {
        btn.appendChild(rightWrap)

        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          if (item.disabled) return
          dismiss()
          if (typeof item.action === 'function') {
            item.action()
          }
        })

        if (!isSubmenu) {
          btn.addEventListener('pointerenter', () => {
            closeSubmenus()
          })
        }
      }

      parentEl.appendChild(btn)
    }
  }

  buildMenuDom(items, menu)

  // Append backdrop and main menu to body
  document.body.appendChild(backdrop)
  document.body.appendChild(menu)

  // Viewport-safe bounds clamping for the main menu
  const rect = menu.getBoundingClientRect()
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

  document.addEventListener('keydown', onDocKey, true)
}

function cleanupExistingMenus() {
  document.querySelectorAll('.cm-atomic-table-menu-backdrop').forEach((el) => el.remove())
  document.querySelectorAll('.cm-atomic-table-menu-instance').forEach((el) => el.remove())
  document.querySelectorAll('.cm-atomic-table-submenu-instance').forEach((el) => el.remove())
}
