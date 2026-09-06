import { icons } from './tableIcons.js'
import { createTableTitleDOM } from './tableRename.js'
import { createTableQuickActionsDOM } from './tableActions.js'
import { createTableViewModeToggleDOM } from './tableSourceView.js'
import { findCurrentTableRange } from './tableExtension.js'

/**
 * Builds the .cm-table-ui-header bar DOM:
 *   [Table Name]   |   [Table|Source toggle]  [Actions]  [Delete]
 *
 * @param {EditorView} view
 * @param {HTMLElement} wrap  - .cm-atomic-table wrapper
 * @param {object} model
 * @returns {HTMLElement}
 */
export function createTableHeaderDOM(view, wrap, model) {
  const header = document.createElement('div')
  header.className = 'cm-table-ui-header'
  header.contentEditable = 'false'

  // Left: editable table title trigger
  const leftGroup = document.createElement('div')
  leftGroup.className = 'cm-table-ui-left'
  leftGroup.appendChild(createTableTitleDOM(view, wrap, model))

  // Right: view-mode toggle + quick-actions + delete
  const rightGroup = document.createElement('div')
  rightGroup.className = 'cm-table-ui-right'
  rightGroup.appendChild(createTableViewModeToggleDOM(view, wrap, model))
  rightGroup.appendChild(createTableQuickActionsDOM(view, wrap, model))

  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'cm-table-ui-delete-btn'
  deleteBtn.setAttribute('data-tooltip', 'Delete table')
  deleteBtn.innerHTML = icons.delete
  deleteBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const range = findCurrentTableRange(view, wrap)
    if (range) {
      let from = range.from
      let to = range.to
      const doc = view.state.doc
      if (to < doc.length && view.state.sliceDoc(to, to + 1) === '\n') {
        to += 1
      } else if (from > 0 && view.state.sliceDoc(from - 1, from) === '\n') {
        from -= 1
      }
      view.dispatch({ changes: { from, to, insert: '' } })
      view.focus()
    }
  })
  rightGroup.appendChild(deleteBtn)

  header.appendChild(leftGroup)
  header.appendChild(rightGroup)

  return header
}
