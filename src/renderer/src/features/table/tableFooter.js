/**
 * Builds the .cm-table-ui-footer bar DOM.
 * Shows row × col count and any other table-level metadata.
 *
 * @param {number} rowCount
 * @param {number} colCount
 * @returns {HTMLElement}
 */
export function createTableFooterDOM(rowCount, colCount) {
  const footer = document.createElement('div')
  footer.className = 'cm-table-ui-footer'
  footer.contentEditable = 'false'

  const countSpan = document.createElement('span')
  countSpan.className = 'cm-table-ui-footer-count'
  countSpan.textContent = formatCount(rowCount, colCount)
  footer.appendChild(countSpan)

  return footer
}

/**
 * Updates an existing footer's count text in-place.
 * @param {HTMLElement} dom  - the .cm-atomic-table wrapper
 * @param {number} rowCount
 * @param {number} colCount
 */
export function updateTableFooterCount(dom, rowCount, colCount) {
  const countSpan = dom.querySelector('.cm-table-ui-footer-count')
  if (countSpan) {
    countSpan.textContent = formatCount(rowCount, colCount)
  }
}

function formatCount(rowCount, colCount) {
  return `${rowCount} ${rowCount === 1 ? 'row' : 'rows'} · ${colCount} ${colCount === 1 ? 'col' : 'cols'}`
}
