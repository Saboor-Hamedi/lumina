/**
 * useQuote.js
 *
 * Modular helper for Markdown Blockquote Marks (`> `).
 * Handles blockquote creation, toggling, nested quoting (Tab to indent depth,
 * Shift+Tab to dedent), Enter auto-continuation, and empty quote clearing.
 *
 * Nesting levels:
 *   >       = level 1
 *   >>      = level 2
 *   >>>     = level 3  ...and so on
 */

/**
 * Returns the blockquote depth (number of leading `>`) of a line, or 0 if not a blockquote.
 * @param {string} text
 * @returns {number}
 */
function getQuoteDepth(text) {
  const match = text.match(/^(\s*)(>+)/)
  return match ? match[2].length : 0
}

/**
 * Returns the blockquote prefix for a given depth, e.g. depth=2 → `>> `.
 * @param {number} depth
 * @returns {string}
 */
function quotePrefix(depth) {
  return depth > 0 ? '>'.repeat(depth) + ' ' : ''
}

/**
 * Toggles or wraps lines as markdown blockquotes (`> `).
 * - If ALL selected lines are already quoted at depth ≥1 → removes one level.
 * - Otherwise → adds one level to all selected lines.
 * Supports single caret and multi-line range selections.
 *
 * @param {import('@codemirror/view').EditorView} view
 * @returns {boolean}
 */
export function toggleQuoteMark(view) {
  const state = view.state
  const sel = state.selection.main

  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)

  const lines = []
  for (let l = startLine.number; l <= endLine.number; l++) {
    lines.push(state.doc.line(l))
  }

  const allQuoted = lines.every((line) => getQuoteDepth(line.text) >= 1)

  const changes = lines.map((line) => {
    const depth = getQuoteDepth(line.text)
    if (allQuoted) {
      // Remove one `>` level — strip leading `> ` or `>`
      const stripped = line.text.replace(/^(\s*)>([ ]?)/, '$1')
      return { from: line.from, to: line.to, insert: stripped }
    } else {
      // Add one level
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
 * Increases blockquote depth by one level for all selected lines (Tab inside a quote).
 * Only fires when all selected lines are already inside a blockquote.
 *
 * @param {import('@codemirror/view').EditorView} view
 * @returns {boolean}
 */
export function indentQuote(view) {
  const state = view.state
  const sel = state.selection.main

  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)

  const lines = []
  for (let l = startLine.number; l <= endLine.number; l++) {
    lines.push(state.doc.line(l))
  }

  // Only act if at least the first line is a blockquote
  if (getQuoteDepth(lines[0].text) === 0) return false

  const changes = lines.map((line) => {
    const depth = getQuoteDepth(line.text)
    if (depth === 0) return null
    // Insert an extra `>` right after the existing markers
    const newText = line.text.replace(/^(\s*)(>+)(\s?)/, (_, ws, arrows, sp) => {
      return `${ws}${arrows}>${sp || ' '}`
    })
    return { from: line.from, to: line.to, insert: newText }
  }).filter(Boolean)

  if (changes.length > 0) {
    view.dispatch({ changes })
    return true
  }
  return false
}

/**
 * Decreases blockquote depth by one level for all selected lines (Shift+Tab inside a quote).
 * If already at depth 1, exits the blockquote entirely.
 *
 * @param {import('@codemirror/view').EditorView} view
 * @returns {boolean}
 */
export function dedentQuote(view) {
  const state = view.state
  const sel = state.selection.main

  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)

  const lines = []
  for (let l = startLine.number; l <= endLine.number; l++) {
    lines.push(state.doc.line(l))
  }

  if (getQuoteDepth(lines[0].text) === 0) return false

  const changes = lines.map((line) => {
    const depth = getQuoteDepth(line.text)
    if (depth === 0) return null
    // Remove one `>` from the leading markers
    const newText = line.text.replace(/^(\s*)(>+)([ ]?)/, (_, ws, arrows, sp) => {
      const newArrows = arrows.slice(0, -1) // drop last `>`
      return newArrows.length > 0 ? `${ws}${newArrows}${sp || ' '}` : `${ws}`
    })
    return { from: line.from, to: line.to, insert: newText }
  }).filter(Boolean)

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
 *   e.g. pressing Enter on `>> some text` inserts `\n>> ` so nesting is preserved.
 *
 * @param {import('@codemirror/view').EditorView} view
 * @returns {boolean}
 */
export function handleQuoteEnter(view) {
  const state = view.state
  const pos = state.selection.main.head
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
  // Matches `> `, `>> `, `>>> ` etc. with optional leading whitespace
  const quoteMatch = lineText.match(/^(\s*>+)\s+(.*)$/)
  if (quoteMatch) {
    const marker = quoteMatch[1] // e.g. `>>` for depth-2
    const insertText = `\n${marker} `
    view.dispatch({
      changes: { from: pos, insert: insertText },
      selection: { anchor: pos + insertText.length }
    })
    return true
  }

  return false
}
