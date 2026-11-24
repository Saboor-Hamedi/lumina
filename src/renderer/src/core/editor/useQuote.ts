import type { EditorView } from '@codemirror/view'
import { isInsideCodeFence, parseListLine } from './useList'

/**
 * Returns the blockquote depth (number of `>`) of a line, or 0 if not a blockquote.
 * Handles both `>>` and `> >` space-separated markdown syntaxes.
 */
export function getQuoteDepth(text: string): number {
  if (!text) return 0
  const match = text.match(/^(\s*(?:>\s*)+)/)
  if (!match) return 0
  const arrows = match[0].match(/>/g)
  return arrows ? arrows.length : 0
}

/**
 * Returns the blockquote prefix for a given depth, e.g. depth=2 → `>> `.
 */
export function quotePrefix(depth: number): string {
  return depth > 0 ? '>'.repeat(depth) + ' ' : ''
}

/**
 * Toggles or wraps lines as markdown blockquotes (`> `).
 * - If ALL selected lines are already quoted → removes the blockquote marker.
 * - Otherwise → adds `> ` to all selected lines.
 * Supports single caret and multi-line range selections.
 */
export function toggleQuoteMark(view: EditorView): boolean {
  if (!view || !view.state) return false

  const state = view.state
  const sel = state.selection?.main
  if (!sel) return false

  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)

  const lines = []
  for (let l = startLine.number; l <= endLine.number; l++) {
    lines.push(state.doc.line(l))
  }

  const allQuoted = lines.every((line) => getQuoteDepth(line.text) >= 1)

  const changes = lines.map((line) => {
    if (allQuoted) {
      // Remove quote prefix
      const stripped = line.text.replace(/^(\s*(?:>\s*)+)/, '')
      return { from: line.from, to: line.to, insert: stripped }
    } else {
      // Add level 1 quote
      return { from: line.from, insert: '> ' }
    }
  })

  if (changes.length > 0) {
    view.dispatch({ changes })
    return true
  }
  return false
}

/**
 * Handles Enter key on blockquote lines:
 * - Skips inside fenced code blocks.
 * - Defers quoted list/task lines (`> - item`, `> 1. item`, `> - [ ] task`) to `handleListEnter`/`handleTaskEnter`.
 * - If the current quote line is empty:
 *   - Nested (`>> ` / `> > `) → steps down one quote level (`> `).
 *   - Depth 1 (`> `) → clears the marker and exits.
 * - If the line has content → replaces selection and auto-continues at the same depth.
 */
export function handleQuoteEnter(view: EditorView): boolean {
  if (!view || !view.state) return false

  const state = view.state
  const sel = state.selection?.main
  if (!sel) return false

  if (isInsideCodeFence(state, sel.from)) return false

  const line = state.doc.lineAt(sel.from)
  if (sel.to > line.to) return false

  const lineText = line.text

  // Let list/task handlers manage quoted lists (`> - item`, `> 1. item`, `> - [ ] task`)
  if (parseListLine(lineText) !== null) return false

  const col = sel.from - line.from

  // 1. Empty blockquote line on Enter (step down nested depth, or exit depth 1)
  const emptyQuoteMatch = lineText.match(/^(\s*(?:>\s*)+)$/)
  if (emptyQuoteMatch && sel.empty && col >= lineText.trimEnd().length) {
    const depth = getQuoteDepth(lineText)
    const leadingIndent = lineText.match(/^(\s*)/)?.[1] ?? ''
    const replacement = depth > 1 ? `${leadingIndent}${quotePrefix(depth - 1)}` : ''
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: replacement },
      selection: { anchor: line.from + replacement.length },
      scrollIntoView: true
    })
    return true
  }

  // 2. Continue active blockquote at the same depth on Enter
  const quoteMatch = lineText.match(/^(\s*(?:>\s*)+)(.*)$/)
  if (quoteMatch && quoteMatch[2].trim().length > 0) {
    const prefixLen = quoteMatch[1].length
    if (col < prefixLen) return false

    const leadingIndent = lineText.match(/^(\s*)/)?.[1] ?? ''
    const marker = quoteMatch[1].trim()
    const insertText = `\n${leadingIndent}${marker} `
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: insertText },
      selection: { anchor: sel.from + insertText.length },
      scrollIntoView: true
    })
    return true
  }

  return false
}
