/**
 * useQuote.js
 * 
 * Modular helper for Markdown Blockquote Marks (`> `).
 * Handles blockquote creation, toggling, Enter auto-continuation, and empty quote clearing.
 */

/**
 * Toggles or converts lines to markdown blockquotes (`> `).
 * Supports single line caret position and multi-line range selections.
 */
export function toggleQuoteMark(view) {
  const state = view.state
  const sel = state.selection.main

  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)

  const changes = []
  for (let l = startLine.number; l <= endLine.number; l++) {
    const line = state.doc.line(l)
    const text = line.text

    if (text.startsWith('> ')) {
      changes.push({ from: line.from, to: line.from + 2, insert: '' })
    } else if (text.startsWith('>')) {
      changes.push({ from: line.from, to: line.from + 1, insert: '' })
    } else {
      changes.push({ from: line.from, insert: '> ' })
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes })
    return true
  }
  return false
}

/**
 * Handles Enter key on blockquote lines:
 * - If quote line is empty (`> `), clears it and exits blockquote.
 * - If quote line has content, auto-continues next line with `> `.
 * Returns true if handled, false otherwise.
 */
export function handleQuoteEnter(view) {
  const state = view.state
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const lineText = line.text

  // 1. Exit empty blockquote line on Enter
  const emptyQuoteMatch = lineText.match(/^(\s*>+\s*)$/)
  if (emptyQuoteMatch && pos === line.to) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from }
    })
    return true
  }

  // 2. Continue active blockquote on Enter
  const textBefore = lineText.slice(0, pos - line.from)
  const quoteMatch = textBefore.match(/^(\s*>+)\s+(.*)$/)
  if (quoteMatch) {
    const marker = quoteMatch[1]
    const insertText = `\n${marker} `
    view.dispatch({
      changes: { from: pos, insert: insertText },
      selection: { anchor: pos + insertText.length }
    })
    return true
  }

  return false
}
