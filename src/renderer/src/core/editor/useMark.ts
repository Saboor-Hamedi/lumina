import React from 'react'
import { Prec, type Extension } from '@codemirror/state'
import { keymap, type EditorView } from '@codemirror/view'
import { isInsideCodeFence, parseListLine } from './useList'

/**
 * Toggles or converts lines to markdown task items (`- [ ]` <-> `- [x]`).
 * Supports single line caret position, multi-line range selections, and quoted tasks (`> - [ ]`).
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
    const parsed = parseListLine(text)

    if (parsed?.kind === 'task') {
      const nextState = parsed.taskState === 'x' || parsed.taskState === 'X' ? ' ' : 'x'
      const bullet = parsed.bullet ?? '-'
      const nextLine = `${parsed.quotePrefix}${parsed.indent}${bullet} [${nextState}] ${parsed.content}`
      changes.push({ from: line.from, to: line.to, insert: nextLine })
    } else if (parsed && (parsed.kind === 'bullet' || parsed.kind === 'ordered-num' || parsed.kind === 'ordered-alpha')) {
      // Convert existing bullet/ordered item to a task item, preserving quotePrefix & indent
      const nextLine = `${parsed.quotePrefix}${parsed.indent}- [ ] ${parsed.content}`
      changes.push({ from: line.from, to: line.to, insert: nextLine })
    } else {
      // Convert plain text (or plain blockquote) line to task item
      const quoteMatch = text.match(/^(\s*(?:>\s*)+)?(\s*)(.*)$/)
      const qp = quoteMatch?.[1] ?? ''
      const indent = quoteMatch?.[2] ?? ''
      const rest = quoteMatch?.[3] ?? text
      changes.push({ from: line.from, to: line.to, insert: `${qp}${indent}- [ ] ${rest}` })
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes, scrollIntoView: true })
    return true
  }
  return false
}

/**
 * Handles Enter key on task list lines (including quoted tasks `> - [ ]`):
 * - Skips inside fenced code blocks.
 * - If task line is empty:
 *   - If indented -> outdents one level instead of destroying nesting.
 *   - If quoted (`> - [ ] `) -> strips task marker and keeps `> `.
 *   - Otherwise clears it and exits task list.
 * - If task line has content -> replaces selection and auto-continues with unchecked `- [ ] `.
 */
export function handleTaskEnter(view: EditorView): boolean {
  if (!view || !view.state) return false

  const state = view.state
  const sel = state.selection?.main
  if (!sel) return false

  if (isInsideCodeFence(state, sel.from)) return false

  const line = state.doc.lineAt(sel.from)
  if (sel.to > line.to) return false

  const parsed = parseListLine(line.text)
  if (!parsed || parsed.kind !== 'task') return false

  const col = sel.from - line.from
  const bullet = parsed.bullet ?? '-'
  const isEmptyTask = parsed.content.trim() === ''

  // 1. Exit or outdent empty task item on Enter
  if (isEmptyTask && sel.empty && col >= line.text.trimEnd().length) {
    if (parsed.indent.length > 0) {
      const newIndent = parsed.indent.endsWith('\t')
        ? parsed.indent.slice(0, -1)
        : parsed.indent.endsWith('  ')
          ? parsed.indent.slice(0, -2)
          : parsed.indent.slice(0, -1)
      const replacement = `${parsed.quotePrefix}${newIndent}${bullet} [ ] `
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: replacement },
        selection: { anchor: line.from + replacement.length },
        scrollIntoView: true
      })
      return true
    }

    if (parsed.quotePrefix.length > 0) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: parsed.quotePrefix },
        selection: { anchor: line.from + parsed.quotePrefix.length },
        scrollIntoView: true
      })
      return true
    }

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
      scrollIntoView: true
    })
    return true
  }

  // If cursor is inside the task marker prefix itself, let default newline run
  if (col < parsed.prefixLength) {
    return false
  }

  // 2. Continue active task item on Enter (always unchecked `[ ]`)
  const insertText = `\n${parsed.quotePrefix}${parsed.indent}${bullet} [ ] `
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: insertText },
    selection: { anchor: sel.from + insertText.length },
    scrollIntoView: true
  })
  return true
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
