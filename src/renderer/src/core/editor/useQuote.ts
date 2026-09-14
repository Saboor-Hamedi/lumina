import type { EditorView } from '@codemirror/view'

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
 * - If the current quote line is empty (`> ` with no content) → clears the marker and exits.
 * - If the line has content → auto-continues the next line with the same depth marker.
 */
export function handleQuoteEnter(view: EditorView): boolean {
  if (!view || !view.state) return false

  const state = view.state
  const pos = state.selection?.main?.head
  if (typeof pos !== 'number') return false

  const line = state.doc.lineAt(pos)
  const lineText = line.text

  // 1. Exit empty blockquote line on Enter (any depth: `> `, `>> `, `>>> `)
  const emptyQuoteMatch = lineText.match(/^(\s*>+\s*)$/)
  if (emptyQuoteMatch && pos === line.to) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from }
    })
    return true
  }

  // 2. Continue active blockquote at the same depth on Enter
  const quoteMatch = lineText.match(/^(\s*(?:>\s*)+)(.*)$/)
  if (quoteMatch && quoteMatch[2].trim().length > 0) {
    const marker = quoteMatch[1].trim()
    const insertText = `\n${marker} `
    view.dispatch({
      changes: { from: pos, insert: insertText },
      selection: { anchor: pos + insertText.length }
    })
    return true
  }

  return false
}
