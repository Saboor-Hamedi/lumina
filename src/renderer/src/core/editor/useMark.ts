import React from 'react'
import { Prec, type Extension } from '@codemirror/state'
import { keymap, type EditorView } from '@codemirror/view'

/**
 * Toggles or converts lines to markdown task items (`- [ ]` <-> `- [x]`).
 * Supports single line caret position and multi-line range selections.
 */
export function toggleTaskMark(view: EditorView): boolean {
  if (!view || !view.state) return false

  const state = view.state
  const sel = state.selection?.main
  if (!sel) return false

  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)

  const changes = []
  for (let l = startLine.number; l <= endLine.number; l++) {
    const line = state.doc.line(l)
    const text = line.text

    if (text.includes('- [ ]')) {
      changes.push({ from: line.from, to: line.to, insert: text.replace('- [ ]', '- [x]') })
    } else if (text.includes('- [x]') || text.includes('- [X]')) {
      changes.push({ from: line.from, to: line.to, insert: text.replace(/- \[[xX]\]/, '- [ ]') })
    } else if (text.match(/^\s*[-*+]\s+/)) {
      // Convert bullet to task item
      changes.push({ from: line.from, to: line.to, insert: text.replace(/^(\s*)[-*+]\s+/, '$1- [ ] ') })
    } else {
      // Convert plain text line to task item
      const matchIndent = text.match(/^(\s*)(.*)$/)
      const indent = matchIndent ? matchIndent[1] : ''
      const rest = matchIndent ? matchIndent[2] : text
      changes.push({ from: line.from, to: line.to, insert: `${indent}- [ ] ${rest}` })
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes, scrollIntoView: true })
    return true
  }
  return false
}

/**
 * Handles Enter key on task list lines:
 * - If task line is empty (`- [ ] `), clears it and exits task list.
 * - If task line has content, auto-continues next line with `- [ ] `.
 * Returns true if handled, false otherwise.
 */
export function handleTaskEnter(view: EditorView): boolean {
  if (!view || !view.state) return false

  const state = view.state
  const pos = state.selection?.main?.head
  if (typeof pos !== 'number') return false

  const line = state.doc.lineAt(pos)
  const lineText = line.text

  // 1. Exit empty task item on Enter
  const emptyTaskMatch = lineText.match(/^(\s*[-*+]\s+\[[ xX]?\]\s*)$/)
  if (emptyTaskMatch && pos === line.to) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
      scrollIntoView: true
    })
    return true
  }

  // 2. Continue active task item on Enter
  const textBefore = lineText.slice(0, pos - line.from)
  const taskMatch = textBefore.match(/^(\s*[-*+]\s+\[[ xX]?\])\s+(.*)$/)
  if (taskMatch) {
    const indentAndBox = taskMatch[1].replace(/\[[xX]\]/, '[ ]')
    const insertText = `\n${indentAndBox} `
    view.dispatch({
      changes: { from: pos, insert: insertText },
      selection: { anchor: pos + insertText.length },
      scrollIntoView: true
    })
    return true
  }

  return false
}

/**
 * CodeMirror Keymap Extension for Task Marks (`Ctrl+Shift+X` / `Cmd+Shift+X`).
 */
export function taskMarkKeymap(isActiveRef?: React.RefObject<boolean> | React.MutableRefObject<boolean>): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: 'Mod-Shift-x',
        run: (view: EditorView) => {
          if (isActiveRef && !isActiveRef.current) return false
          return toggleTaskMark(view)
        }
      },
      {
        key: 'Mod-Shift-X',
        run: (view: EditorView) => {
          if (isActiveRef && !isActiveRef.current) return false
          return toggleTaskMark(view)
        }
      }
    ])
  )
}
