/**
 * =============================================================================
 * tableFooter.js — Table footer bar
 * =============================================================================
 * Shows:  [word count]  [rows · cols]
 * Clean, no badge backgrounds — just text metadata.
 * =============================================================================
 */

/**
 * Builds the .cm-table-ui-footer bar DOM.
 *
 * @param {object} model  - parsed table model
 * @returns {HTMLElement}
 */
export function createTableFooterDOM(model: TableModel): HTMLDivElement {
  const footer = document.createElement('div')
  footer.className = 'cm-table-ui-footer'
  footer.contentEditable = 'false'

  // Left: word count
  const wordSpan = document.createElement('span')
  wordSpan.className = 'cm-table-ui-footer-words'
  wordSpan.textContent = formatWords(countWords(model))
  footer.appendChild(wordSpan)

  // Spacer
  const spacer = document.createElement('span')
  spacer.className = 'cm-table-ui-footer-spacer'
  footer.appendChild(spacer)

  // Right: row × col count
  const countSpan = document.createElement('span')
  countSpan.className = 'cm-table-ui-footer-count'
  const rowCount = model.rows ? model.rows.length : 0
  const colCount = model.header ? model.header.length : 0
  countSpan.textContent = formatCount(rowCount, colCount)
  footer.appendChild(countSpan)

  return footer
}

/**
 * Updates footer stats in-place after model changes.
 * @param {HTMLElement} dom   - the .cm-atomic-table wrapper
 * @param {object} model
 */
export function updateTableFooterCount(dom: HTMLElement, model: TableModel): void {
  const rowCount = model.rows ? model.rows.length : 0
  const colCount = model.header ? model.header.length : 0

  const countSpan = dom.querySelector('.cm-table-ui-footer-count')
  if (countSpan) countSpan.textContent = formatCount(rowCount, colCount)

  const wordSpan = dom.querySelector('.cm-table-ui-footer-words')
  if (wordSpan) wordSpan.textContent = formatWords(countWords(model))
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatCount(rowCount: number, colCount: number): string {
  return `${rowCount} ${rowCount === 1 ? 'row' : 'rows'} · ${colCount} ${colCount === 1 ? 'col' : 'cols'}`
}

function formatWords(n: number): string {
  return `${n} ${n === 1 ? 'word' : 'words'}`
}

/**
 * Counts total words across all header and body cells.
 * @param {object} model
 * @returns {number}
 */
function countWords(model: TableModel): number {
  let n = 0
  const count = (str: string) => {
    if (!str) return
    const trimmed = str.trim()
    if (trimmed) n += trimmed.split(/\s+/).length
  }
  if (model.header) model.header.forEach(count)
  if (model.rows) model.rows.forEach((row) => row.forEach(count))
  return n
}
import type { TableModel } from './tableModel'
