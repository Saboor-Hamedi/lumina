/**
 * useArrowNavigation.js
 * 
 * Custom ArrowUp & ArrowDown navigation for CodeMirror 6:
 * Inspects the Markdown syntax tree to seamlessly step over multi-line replaced
 * widgets (Mermaid diagrams, Tables, Fenced Code widgets) without trapping the
 * caret inside hidden source lines.
 */

import { EditorView } from '@codemirror/view'
import { cursorLineUp as defaultCursorLineUp, cursorLineDown as defaultCursorLineDown } from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import { completionStatus } from '@codemirror/autocomplete'

/**
 * Handles ArrowUp navigation with multi-line block widget bypass.
 */
export function handleArrowUp(view) {
  // If autocompletion list or slash popup is active, yield to completion keymap
  if (completionStatus(view.state) !== null) {
    return false
  }

  const sel = view.state.selection.main
  if (!sel.empty) return defaultCursorLineUp(view)

  const pos = sel.head
  const doc = view.state.doc
  const currentLine = doc.lineAt(pos)

  if (currentLine.number <= 1) {
    if (pos !== currentLine.from) {
      view.dispatch({ selection: { anchor: currentLine.from }, scrollIntoView: true })
      return true
    }
    return defaultCursorLineUp(view)
  }

  const col = pos - currentLine.from
  let targetLineNumber = currentLine.number - 1
  let targetLine = doc.line(targetLineNumber)

  // If target line is inside a multi-line replaced block widget (e.g. Mermaid or Table), step above the whole widget
  const tree = syntaxTree(view.state)
  let block = null
  tree.iterate({
    from: Math.max(0, targetLine.from - 5),
    to: Math.min(doc.length, targetLine.to + 5),
    enter(node) {
      if (node.name === 'FencedCode') {
        const text = view.state.sliceDoc(node.from, node.to)
        if (text.startsWith('```mermaid') || text.startsWith('~~~mermaid')) {
          if (targetLine.from >= node.from && targetLine.to <= node.to) {
            block = { from: node.from, to: node.to }
            return false
          }
        }
      } else if (node.name === 'Table') {
        if (targetLine.from >= node.from && targetLine.to <= node.to) {
          block = { from: node.from, to: node.to }
          return false
        }
      }
    }
  })

  if (block) {
    const blockStartLine = doc.lineAt(block.from)
    targetLineNumber = blockStartLine.number > 1 ? blockStartLine.number - 1 : 1
    targetLine = doc.line(targetLineNumber)
  }

  const targetCol = Math.min(col, targetLine.length)
  const targetPos = targetLine.from + targetCol

  view.dispatch({
    selection: { anchor: targetPos },
    effects: EditorView.scrollIntoView(targetPos, { y: 'nearest', yMargin: 40 }),
    userEvent: 'select'
  })
  return true
}

/**
 * Handles ArrowDown navigation with multi-line block widget bypass.
 */
export function handleArrowDown(view) {
  // If autocompletion list or slash popup is active, yield to completion keymap
  if (completionStatus(view.state) !== null) {
    return false
  }

  const sel = view.state.selection.main
  if (!sel.empty) return defaultCursorLineDown(view)

  const pos = sel.head
  const doc = view.state.doc
  const currentLine = doc.lineAt(pos)

  if (currentLine.number >= doc.lines) {
    if (pos !== currentLine.to) {
      view.dispatch({
        selection: { anchor: currentLine.to },
        effects: EditorView.scrollIntoView(currentLine.to, { y: 'nearest', yMargin: 40 })
      })
      return true
    }
    return defaultCursorLineDown(view)
  }

  const col = pos - currentLine.from
  let targetLineNumber = currentLine.number + 1
  let targetLine = doc.line(targetLineNumber)

  // If target line is inside a multi-line replaced block widget (e.g. Mermaid or Table), step below the whole widget
  const tree = syntaxTree(view.state)
  let block = null
  tree.iterate({
    from: Math.max(0, targetLine.from - 5),
    to: Math.min(doc.length, targetLine.to + 5),
    enter(node) {
      if (node.name === 'FencedCode') {
        const text = view.state.sliceDoc(node.from, node.to)
        if (text.startsWith('```mermaid') || text.startsWith('~~~mermaid')) {
          if (targetLine.from >= node.from && targetLine.to <= node.to) {
            block = { from: node.from, to: node.to }
            return false
          }
        }
      } else if (node.name === 'Table') {
        if (targetLine.from >= node.from && targetLine.to <= node.to) {
          block = { from: node.from, to: node.to }
          return false
        }
      }
    }
  })

  if (block) {
    const blockEndLine = doc.lineAt(block.to)
    targetLineNumber = blockEndLine.number < doc.lines ? blockEndLine.number + 1 : doc.lines
    targetLine = doc.line(targetLineNumber)
  }

  const targetCol = Math.min(col, targetLine.length)
  const targetPos = targetLine.from + targetCol

  view.dispatch({
    selection: { anchor: targetPos },
    effects: EditorView.scrollIntoView(targetPos, { y: 'nearest', yMargin: 40 }),
    userEvent: 'select'
  })
  return true
}
