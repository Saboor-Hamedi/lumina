import { serializeTable, readModelFromDom } from './tableModel.js'
import { findCurrentTableRange, dispatchModel } from './tableWidgetExtension.js'

/**
 * Converts a table model into standard CSV string format.
 */
export function modelToCSV(model) {
  const escapeCSV = (val) => {
    const s = (val || '').toString().replace(/"/g, '""')
    return `"${s}"`
  }
  const lines = []
  lines.push(model.header.map(escapeCSV).join(','))
  for (const row of model.rows) {
    const padded = []
    for (let c = 0; c < model.header.length; c++) {
      padded.push(escapeCSV(row[c] || ''))
    }
    lines.push(padded.join(','))
  }
  return lines.join('\n')
}

/**
 * Converts a table model into JSON string format.
 */
export function modelToJSON(model) {
  const result = model.rows.map((row) => {
    const obj = {}
    model.header.forEach((colName, idx) => {
      const key = colName.trim() || `column_${idx + 1}`
      obj[key] = row[idx] || ''
    })
    return obj
  })
  return JSON.stringify(result, null, 2)
}

/**
 * Converts a table model into plain text format (tab-separated columns, newline rows).
 */
export function modelToPlainText(model) {
  const lines = []
  lines.push(model.header.map((h) => (h || '').trim()).join('\t'))
  for (const row of model.rows) {
    const cells = []
    for (let c = 0; c < model.header.length; c++) {
      cells.push((row[c] || '').trim())
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

/**
 * Copies table data to clipboard in specified format.
 */
export async function copyTableAs(model, format = 'plain') {
  let text = ''
  if (format === 'plain' || format === 'text') {
    text = modelToPlainText(model)
  } else if (format === 'markdown') {
    text = serializeTable(model)
  } else if (format === 'csv') {
    text = modelToCSV(model)
  } else if (format === 'json') {
    text = modelToJSON(model)
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy table: ', err)
    return false
  }
}

/**
 * Exports table data as a downloadable .csv file.
 */
export function exportTableAsCSV(model) {
  const csvContent = modelToCSV(model)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const title = (model.caption || 'table').toLowerCase().replace(/[^a-z0-9]+/g, '_')
  link.setAttribute('href', url)
  link.setAttribute('download', `${title}_${Date.now()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Duplicates the current table at the current cursor position (or directly below if cursor is inside table).
 */
export function duplicateTable(view, wrap, model) {
  const tableText = serializeTable(model)
  const sel = view.state.selection.main
  const range = findCurrentTableRange(view, wrap)

  let insertPos
  if (sel && (!range || sel.head < range.from || sel.head > range.to)) {
    insertPos = sel.head
  } else if (range) {
    insertPos = range.to
  } else {
    insertPos = view.state.doc.length
  }

  const doc = view.state.doc
  const prefix = insertPos > 0 && doc.sliceString(insertPos - 1, insertPos) !== '\n' ? '\n\n' : ''
  const suffix = insertPos < doc.length && doc.sliceString(insertPos, insertPos + 1) !== '\n' ? '\n\n' : ''

  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert: prefix + tableText + suffix },
    selection: { anchor: insertPos + (prefix + tableText).length }
  })
  view.focus()
}

/**
 * Creates the Quick Actions / Export Dropdown Button DOM for table header.
 */
export function createTableQuickActionsDOM(view, wrap, model) {
  const container = document.createElement('div')
  container.className = 'cm-table-actions-container'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'cm-table-actions-btn'
  btn.title = 'More table options'
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="19" cy="12" r="1"></circle>
      <circle cx="5" cy="12" r="1"></circle>
    </svg>
  `

  let dropdown = null

  const closeDropdown = () => {
    if (dropdown) {
      dropdown.remove()
      dropdown = null
      document.removeEventListener('mousedown', onOutsideClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }

  const onOutsideClick = (e) => {
    if (dropdown && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      closeDropdown()
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeDropdown()
    }
  }

  const showCopiedNotice = () => {
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `
    setTimeout(() => {
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="19" cy="12" r="1"></circle>
          <circle cx="5" cy="12" r="1"></circle>
        </svg>
      `
    }, 1500)
  }

  const openDropdown = () => {
    if (view.state.readOnly) return
    if (dropdown) {
      closeDropdown()
      return
    }

    document.querySelectorAll('.cm-table-actions-dropdown').forEach((el) => el.remove())

    dropdown = document.createElement('div')
    dropdown.className = 'native-dropdown-menu cm-table-actions-dropdown'
    dropdown.style.position = 'fixed'
    dropdown.style.zIndex = '100000'

    const rect = btn.getBoundingClientRect()
    dropdown.style.top = `${rect.bottom + 4}px`
    dropdown.style.left = `${Math.max(10, Math.min(rect.right - 240, window.innerWidth - 250))}px`

    const currentModel = readModelFromDom(wrap)

    const items = [
      {
        label: 'Copy as Plain Text',
        icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
        action: async () => {
          await copyTableAs(currentModel, 'plain')
          showCopiedNotice()
        }
      },
      {
        label: 'Copy as Markdown',
        icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
        action: async () => {
          await copyTableAs(currentModel, 'markdown')
          showCopiedNotice()
        }
      },
      {
        label: 'Copy as Spreadsheet',
        icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`,
        action: async () => {
          await copyTableAs(currentModel, 'csv')
          showCopiedNotice()
        }
      },
      {
        label: 'Copy as Data (JSON)',
        icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
        action: async () => {
          await copyTableAs(currentModel, 'json')
          showCopiedNotice()
        }
      },
      { type: 'separator' },
      {
        label: 'Save as Spreadsheet (.csv)',
        icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
        action: () => {
          exportTableAsCSV(currentModel)
        }
      },
      {
        label: 'Duplicate Table',
        icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
        action: () => {
          duplicateTable(view, wrap, currentModel)
        }
      }
    ]

    items.forEach((item) => {
      if (item.type === 'separator') {
        const sep = document.createElement('div')
        sep.className = 'dropdown-divider'
        dropdown.appendChild(sep)
      } else {
        const itemBtn = document.createElement('div')
        itemBtn.className = 'dropdown-item'
        itemBtn.innerHTML = `
          <span class="menu-label">${item.label}</span>
          <span class="menu-icon-right">${item.icon}</span>
        `
        itemBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          closeDropdown()
          item.action()
        })
        dropdown.appendChild(itemBtn)
      }
    })

    document.body.appendChild(dropdown)

    document.addEventListener('mousedown', onOutsideClick, true)
    document.addEventListener('keydown', onKeyDown, true)
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    openDropdown()
  })

  container.appendChild(btn)
  return container
}
