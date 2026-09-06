import { icons } from './tableIcons.js'
import { createTableTitleDOM } from './tableRename.js'
import { createTableQuickActionsDOM } from './tableActions.js'
import { createTableViewModeToggleDOM } from './tableSourceView.js'
import { findCurrentTableRange } from './tableExtension.js'
import { createTableSearchBar } from './tableSearch.js'

/**
 * Builds the .cm-table-ui-header bar and attaches the floating search popover.
 * The popover is NOT injected into the DOM here — it floats in document.body
 * when opened and is anchored to the search icon button.
 *
 * @param {EditorView} view
 * @param {HTMLElement} wrap  - .cm-atomic-table wrapper
 * @param {object} model
 */
export function createTableHeaderDOM(view, wrap, model) {
  const header = document.createElement('div')
  header.className = 'cm-table-ui-header'
  header.contentEditable = 'false'

  // Left: editable table title trigger
  const leftGroup = document.createElement('div')
  leftGroup.className = 'cm-table-ui-left'
  leftGroup.appendChild(createTableTitleDOM(view, wrap, model))

  // Right: search + view-mode toggle + quick-actions + delete
  const rightGroup = document.createElement('div')
  rightGroup.className = 'cm-table-ui-right'

  // ── Search toggle ──────────────────────────────────────────────────────────
  const searchBtn = document.createElement('button')
  searchBtn.type = 'button'
  searchBtn.className = 'cm-table-ui-search-btn'
  searchBtn.setAttribute('data-tooltip', 'Search in table')
  searchBtn.setAttribute('data-tooltip-pos', 'bottom')
  searchBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>`

  // Build the floating search API, anchored to searchBtn
  const searchApi = createTableSearchBar(wrap, searchBtn)
  wrap._tableSearch = searchApi

  searchBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    searchApi.toggle()
  })
  rightGroup.appendChild(searchBtn)

  rightGroup.appendChild(createTableViewModeToggleDOM(view, wrap, model))
  rightGroup.appendChild(createTableQuickActionsDOM(view, wrap, model))

  // ── Delete button ──────────────────────────────────────────────────────────
  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'cm-table-ui-delete-btn'
  deleteBtn.setAttribute('data-tooltip', 'Delete table')
  deleteBtn.setAttribute('data-tooltip-pos', 'bottom')
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
      view.dispatch({
        changes: { from, to, insert: '' },
        selection: { anchor: from },
        scrollIntoView: true
      })
      view.focus()
    }
  })
  rightGroup.appendChild(deleteBtn)

  header.appendChild(leftGroup)
  header.appendChild(rightGroup)
  wrap.appendChild(header)
  // Note: no search bar element appended here — it floats in document.body
}
