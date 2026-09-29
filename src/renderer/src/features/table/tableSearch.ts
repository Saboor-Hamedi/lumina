/**
 * tableSearch.js — Simple floating search popover
 * Case-insensitive substring match, highlights cells, hides non-matching rows.
 */

import { hideDomTooltip } from '../../components/atoms/domTooltip'

const HIGHLIGHT_CLASS = 'cm-table-search-highlight'
const MATCH_MARK      = 'cm-table-search-mark'
const ROW_HIDDEN      = 'cm-table-row-filtered'

// ─── helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightNodes(text, query) {
  const re = new RegExp(escapeRegex(query), 'gi')
  const nodes = []
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(document.createTextNode(text.slice(last, m.index)))
    const mark = document.createElement('mark')
    mark.className = MATCH_MARK
    mark.textContent = m[0]
    nodes.push(mark)
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(document.createTextNode(text.slice(last)))
  return nodes
}

function clearSearch(wrap) {
  wrap.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach((el) => {
    el.classList.remove(HIGHLIGHT_CLASS)
    el.textContent = el.textContent // strip <mark> nodes cleanly
  })
  wrap.querySelectorAll('.' + ROW_HIDDEN).forEach((el) => el.classList.remove(ROW_HIDDEN))
}

function applySearch(wrap, query) {
  clearSearch(wrap)
  if (!query) return 0

  let total = 0
  const re = new RegExp(escapeRegex(query), 'gi')

  const highlight = (source) => {
    if (!source) return 0
    const text = source.textContent || ''
    const count = (text.match(re) || []).length
    if (!count) return 0
    source.classList.add(HIGHLIGHT_CLASS)
    const nodes = highlightNodes(text, query)
    source.innerHTML = ''
    nodes.forEach((n) => source.appendChild(n))
    return count
  }

  // Header
  wrap.querySelectorAll('thead th .cm-atomic-table-cell-source').forEach((s) => {
    total += highlight(s)
  })

  // Body rows
  wrap.querySelectorAll('tbody tr:not(.cm-table-empty-row)').forEach((tr) => {
    let rowMatches = 0
    tr.querySelectorAll('.cm-atomic-table-cell-source').forEach((s) => {
      rowMatches += highlight(s)
    })
    if (!rowMatches) tr.classList.add(ROW_HIDDEN)
    else total += rowMatches
  })

  return total
}

// ─── public API ───────────────────────────────────────────────────────────────

export function createTableSearchBar(wrap, anchorBtn) {
  let open    = false
  let popover = null

  const onOutside = (e) => {
    if (!popover?.contains(e.target) && !anchorBtn?.contains(e.target)) api.close()
  }
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); api.close() }
  }

  function build() {
    const el = document.createElement('div')
    el.className = 'cm-table-search-popover native-dropdown-menu'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'cm-table-search-input'
    input.placeholder = 'Search…'
    input.spellcheck = false
    input.autocomplete = 'off'

    const counter = document.createElement('span')
    counter.className = 'cm-table-search-counter'

    el.appendChild(input)
    el.appendChild(counter)

    input.addEventListener('input', () => {
      const n = applySearch(wrap, input.value.trim())
      counter.textContent = input.value.trim()
        ? (n === 0 ? 'No results' : `${n}`)
        : ''
    })
    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Escape') { e.preventDefault(); api.close() }
    })

    // Position below anchor
    if (anchorBtn) {
      const r = anchorBtn.getBoundingClientRect()
      const w = 200
      el.style.top  = `${r.bottom + 4}px`
      el.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`
      el.style.width = `${w}px`
    }

    return { el, input }
  }

  const api = {
    open() {
      if (open) { popover?.querySelector('input')?.focus(); return }
      open = true
      const { el, input } = build()
      popover = el
      document.body.appendChild(popover)
      hideDomTooltip()
      anchorBtn?.classList.add('cm-table-ui-btn--active')
      requestAnimationFrame(() => input.focus())
      document.addEventListener('mousedown', onOutside, true)
      document.addEventListener('keydown',   onKey,     true)
    },
    close() {
      if (!open) return
      open = false
      clearSearch(wrap)
      popover?.remove()
      popover = null
      anchorBtn?.classList.remove('cm-table-ui-btn--active')
      document.removeEventListener('mousedown', onOutside, true)
      document.removeEventListener('keydown',   onKey,     true)
    },
    toggle() { open ? api.close() : api.open() },
    isOpen: () => open,
  }

  return api
}
