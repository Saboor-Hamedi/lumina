/**
 * ============================================================================
 * Table Column Sorting Engine (`tableSort.js`)
 * ============================================================================
 * Robust natural sorting for Markdown table columns:
 * - Natural alphanumeric sorting (handles 1, 2, 10 properly)
 * - Number and currency detection ($100, €50, 25%)
 * - Markdown delimiter stripping during comparisons
 * - Ascending / Descending toggle with visual header indicators
 * ============================================================================
 */

import { readModelFromDom } from './tableModel.js'
import { dispatchModel } from './tableExtension.js'

/**
 * Extracts clean plaintext from a markdown cell for accurate sorting comparisons.
 */
export function extractSortKey(cellContent) {
  if (!cellContent) return ''
  let text = String(cellContent).trim()

  // Strip Markdown links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  // Strip wikilinks [[text]] -> text
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1')
  // Strip bold/italics **text**, __text__, *text*, _text_
  text = text.replace(/(\*\*|__|\*|_|~~|`)/g, '')
  // Strip HTML tags
  text = text.replace(/<[^>]*>/g, '')

  return text.trim()
}

/**
 * Smart natural comparator that handles numbers, currency, and strings gracefully.
 */
export function naturalCompare(valA, valB, direction = 'asc') {
  const keyA = extractSortKey(valA)
  const keyB = extractSortKey(valB)

  // Empty values always sink to the bottom
  if (!keyA && keyB) return 1
  if (keyA && !keyB) return -1
  if (!keyA && !keyB) return 0

  // Check if both values are numbers or numeric currencies (e.g. "$120.50", "45%", "1,000")
  const numAStr = keyA.replace(/[$€£¥,%\s]/g, '')
  const numBStr = keyB.replace(/[$€£¥,%\s]/g, '')
  const numA = parseFloat(numAStr)
  const numB = parseFloat(numBStr)

  const isNumA = !isNaN(numA) && isFinite(numAStr)
  const isNumB = !isNaN(numB) && isFinite(numBStr)

  let result = 0
  if (isNumA && isNumB) {
    result = numA - numB
  } else {
    // Standard natural alphanumeric comparison
    result = keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' })
  }

  return direction === 'desc' ? -result : result
}

/**
 * Sorts table rows by a specific column index.
 * 
 * @param {Array<Array<string>>} rows - 2D array of table row data
 * @param {number} colIndex - Column index to sort by
 * @param {'asc' | 'desc'} direction - Sort direction
 * @returns {Array<Array<string>>} New sorted rows array
 */
export function sortTableRows(rows, colIndex, direction = 'asc') {
  if (!Array.isArray(rows) || rows.length <= 1) return [...rows]

  const indexedRows = rows.map((row, originalIndex) => ({
    row: [...row],
    originalIndex,
    value: row[colIndex] ?? ''
  }))

  indexedRows.sort((a, b) => {
    const cmp = naturalCompare(a.value, b.value, direction)
    return cmp !== 0 ? cmp : a.originalIndex - b.originalIndex
  })

  return indexedRows.map((item) => item.row)
}

/**
 * Sorts the active table by column and writes the transaction to CodeMirror.
 * 
 * @param {EditorView} view - CodeMirror view
 * @param {HTMLElement} wrap - .cm-atomic-table wrapper DOM element
 * @param {number} colIndex - Column index to sort
 * @param {'asc' | 'desc'} direction - Sort direction
 */
export function applyColumnSort(view, wrap, colIndex, direction = 'asc') {
  const model = readModelFromDom(wrap)
  if (!model || model.rows.length <= 1) return

  const sortedRows = sortTableRows(model.rows, colIndex, direction)
  model.rows = sortedRows

  dispatchModel(view, wrap, model)
}

/**
 * Attaches interactive sort headers to a rendered table widget.
 * 
 * @param {HTMLElement} wrap - .cm-atomic-table wrapper element
 * @param {EditorView} view - CodeMirror EditorView instance
 */
export function setupTableHeaderSorting(wrap, view) {
  const ths = Array.from(wrap.querySelectorAll('thead th'))
  if (ths.length === 0) return

  ths.forEach((th, colIndex) => {
    // Avoid re-attaching sorting triggers if already present
    if (th.querySelector('.cm-table-sort-trigger')) return

    const trigger = document.createElement('span')
    trigger.className = 'cm-table-sort-trigger'
    trigger.title = 'Click to sort column (A-Z / 0-9)'
    trigger.innerHTML = `
      <svg class="cm-sort-icon cm-sort-neutral" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m7 15 5 5 5-5"/>
        <path d="m7 9 5-5 5 5"/>
      </svg>
    `

    trigger.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (view.state.readOnly) return

      const currentDir = th.dataset.sortDir || 'none'
      const nextDir = currentDir === 'asc' ? 'desc' : 'asc'

      // Reset all other headers
      ths.forEach((otherTh) => {
        otherTh.dataset.sortDir = ''
        const otherIcon = otherTh.querySelector('.cm-sort-icon')
        if (otherIcon) {
          otherIcon.className = 'cm-sort-icon cm-sort-neutral'
          otherIcon.innerHTML = `<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>`
        }
      })

      th.dataset.sortDir = nextDir
      const icon = trigger.querySelector('.cm-sort-icon')
      if (icon) {
        icon.className = `cm-sort-icon cm-sort-${nextDir}`
        if (nextDir === 'asc') {
          icon.innerHTML = `<path d="m18 15-6-6-6 6"/>`
          trigger.title = 'Sorted Ascending (Click for Descending)'
        } else {
          icon.innerHTML = `<path d="m6 9 6 6 6-6"/>`
          trigger.title = 'Sorted Descending (Click for Ascending)'
        }
      }

      applyColumnSort(view, wrap, colIndex, nextDir)
    })

    th.appendChild(trigger)
  })
}
