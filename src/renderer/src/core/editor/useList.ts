import type { EditorView } from '@codemirror/view'

/**
 * Handles Enter key on list lines:
 * - If list item is empty (e.g. `- `, `1. `), clears it and exits list.
 * - If list item has content, increments numeral/letter or repeats bullet marker.
 * Returns true if handled, false otherwise.
 */
export function handleListEnter(view: EditorView): boolean {
  if (!view || !view.state) return false

  const state = view.state
  const pos = state.selection?.main?.head
  if (typeof pos !== 'number') return false

  const line = state.doc.lineAt(pos)
  const lineText = line.text

  // 1. Exit empty list item on Enter
  const emptyListMatch = lineText.match(/^(\s*)([-*+]|\d+[.\-)]|[a-zA-Z][.\-)])\s*$/)
  if (emptyListMatch && pos === line.to) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from }
    })
    return true
  }

  // 2. Continue active list format
  const textBefore = lineText.slice(0, pos - line.from)
  const listMatch = textBefore.match(/^(\s*)([-*+]|(\d+)([.\-)])|([a-zA-Z])([.\-)]))\s+(.*)$/)
  if (listMatch) {
    const indent = listMatch[1]
    const fullMarker = listMatch[2]
    const num = listMatch[3]
    const numDelim = listMatch[4]
    const letter = listMatch[5]
    const letterDelim = listMatch[6]

    let nextMarker = fullMarker
    if (num !== undefined && numDelim) {
      const nextNum = parseInt(num, 10) + 1
      nextMarker = `${nextNum}${numDelim}`
    } else if (letter !== undefined && letterDelim) {
      const charCode = letter.charCodeAt(0)
      let nextChar = letter
      if (letter === 'z') nextChar = 'aa'
      else if (letter === 'Z') nextChar = 'AA'
      else nextChar = String.fromCharCode(charCode + 1)
      nextMarker = `${nextChar}${letterDelim}`
    }

    const insertText = `\n${indent}${nextMarker} `
    view.dispatch({
      changes: { from: pos, insert: insertText },
      selection: { anchor: pos + insertText.length }
    })
    return true
  }

  return false
}

/**
 * Checks if line is a list item for Tab / Shift-Tab indentation.
 */
export function isListLine(lineText: string): boolean {
  if (!lineText) return false
  return Boolean(lineText.match(/^(\s*)([-*+](\s+\[[ xX]?\])?|\d+[.\-)]|[a-zA-Z][.\-)])\s+/))
}
