import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  toggleNoteStatus,
  getNoteStatus,
  STATUS_UNREAD,
  STATUS_IN_PROGRESS,
  STATUS_COMPLETED
} from './useStoreProgress'

export function findTrackNameForTable(state, tablePos) {
  const tree = ensureSyntaxTree(state, tablePos, 200) ?? syntaxTree(state)
  let trackName = 'Track'
  let found = false

  tree.iterate({
    from: 0,
    to: tablePos,
    enter: (node) => {
      if (node.name.includes('Heading')) {
        const text = state.sliceDoc(node.from, node.to).replace(/^#+\s*/, '').trim()
        if (text) {
          trackName = text
          found = true
        }
      }
    }
  })

  return { trackName, found }
}

export function renderProgressIndicator(cellDom, trackName, noteId, view) {
  const existing = cellDom.querySelector('.roadmap-indicator')
  if (existing) existing.remove()

  const status = getNoteStatus(trackName, noteId)

  const indicator = document.createElement('div')
  indicator.className = 'roadmap-indicator'
  indicator.style.display = 'inline-flex'
  indicator.style.alignItems = 'center'
  indicator.style.justifyContent = 'center'
  indicator.style.width = '20px'
  indicator.style.height = '20px'
  indicator.style.cursor = 'pointer'
  indicator.style.borderRadius = '50%'
  indicator.style.fontSize = '14px'
  indicator.style.lineHeight = '1'
  indicator.style.userSelect = 'none'
  indicator.contentEditable = 'false'
  indicator.title =
    status === STATUS_COMPLETED
      ? 'Completed (Click to unread)'
      : status === STATUS_IN_PROGRESS
        ? 'In Progress (Click to complete)'
        : 'Unread (Click to mark in progress)'

  if (status === STATUS_UNREAD) {
    indicator.innerHTML = '○'
    indicator.style.color = 'var(--text-faint, #777)'
  } else if (status === STATUS_IN_PROGRESS) {
    indicator.innerHTML = '◐'
    indicator.style.color = 'var(--text-accent, #9d7cd8)'
  } else if (status === STATUS_COMPLETED) {
    indicator.innerHTML = '●'
    indicator.style.color = 'var(--text-accent, #9d7cd8)'
  }

  indicator.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    toggleNoteStatus(trackName, noteId)
    renderProgressIndicator(cellDom, trackName, noteId, view)
  })

  const source = cellDom.querySelector('.cm-atomic-table-cell-source')
  if (source) {
    source.parentElement.insertBefore(indicator, source)
    source.style.display = 'none'
  }
}
