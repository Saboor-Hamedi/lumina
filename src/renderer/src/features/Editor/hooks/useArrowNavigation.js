/**
 * useArrowNavigation.js
 * 
 * Custom ArrowUp & ArrowDown navigation for CodeMirror 6:
 * Respects visual soft-wrapped lines while seamlessly stepping over
 * multi-line replaced widgets (Mermaid diagrams, Tables, Fenced Code widgets)
 * without trapping the caret inside hidden source lines.
 */

import { EditorView } from '@codemirror/view'
import {
  cursorLineUp as defaultCursorLineUp,
  cursorLineDown as defaultCursorLineDown
} from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import { completionStatus } from '@codemirror/autocomplete'

/**
 * Checks if a given position falls inside a replaced multi-line block widget.
 */
function getReplacedBlock(view, pos) {
  const tree = syntaxTree(view.state)
  let block = null
  tree.iterate({
    from: Math.max(0, pos - 5),
    to: Math.min(view.state.doc.length, pos + 5),
    enter(node) {
      if (node.name === 'FencedCode') {
        const text = view.state.sliceDoc(node.from, node.to)
        if (text.startsWith('```mermaid') || text.startsWith('~~~mermaid')) {
          if (pos >= node.from && pos <= node.to) {
            block = { from: node.from, to: node.to }
            return false
          }
        }
      } else if (node.name === 'Table') {
        if (pos >= node.from && pos <= node.to) {
          block = { from: node.from, to: node.to }
          return false
        }
      }
    }
  })
  return block
}

/**
 * Handles ArrowUp navigation by visual line, with multi-line block widget bypass.
 */
export function handleArrowUp(view) {
  // If autocompletion list or slash popup is active, yield to completion keymap
  if (completionStatus(view.state) !== null) {
    return false
  }

  const sel = view.state.selection.main
  if (!sel.empty) return defaultCursorLineUp(view)

  // Move up by one visual line
  const moved = defaultCursorLineUp(view)
  if (!moved) {
    // If at the very top, collapse to start of doc
    if (sel.head !== 0) {
      view.dispatch({
        selection: { anchor: 0 },
        scrollIntoView: true
      })
      return true
    }
    return false
  }

  // If new position is inside a multi-line replaced widget, step above the entire widget
  const newPos = view.state.selection.main.head
  const block = getReplacedBlock(view, newPos)
  if (block) {
    const targetPos = Math.max(0, block.from - 1)
    view.dispatch({
      selection: { anchor: targetPos },
      effects: EditorView.scrollIntoView(targetPos, { y: 'nearest', yMargin: 40 }),
      userEvent: 'select'
    })
    return true
  }

  return true
}

/**
 * Handles ArrowDown navigation by visual line, with multi-line block widget bypass.
 */
export function handleArrowDown(view) {
  // If autocompletion list or slash popup is active, yield to completion keymap
  if (completionStatus(view.state) !== null) {
    return false
  }

  const sel = view.state.selection.main
  if (!sel.empty) return defaultCursorLineDown(view)

  // Move down by one visual line
  const moved = defaultCursorLineDown(view)
  if (!moved) {
    // If at the very bottom, collapse to end of doc
    const docLength = view.state.doc.length
    if (sel.head !== docLength) {
      view.dispatch({
        selection: { anchor: docLength },
        scrollIntoView: true
      })
      return true
    }
    return false
  }

  // If new position is inside a multi-line replaced widget, step below the entire widget
  const newPos = view.state.selection.main.head
  const block = getReplacedBlock(view, newPos)
  if (block) {
    const targetPos = Math.min(view.state.doc.length, block.to + 1)
    view.dispatch({
      selection: { anchor: targetPos },
      effects: EditorView.scrollIntoView(targetPos, { y: 'nearest', yMargin: 40 }),
      userEvent: 'select'
    })
    return true
  }

  return true
}
