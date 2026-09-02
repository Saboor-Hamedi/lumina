import { ViewPlugin, Decoration } from '@codemirror/view'

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
 * Returns the blockquote depth (number of `>`) of a line, or 0 if not a blockquote.
 * Handles both `>>` and `> >` space-separated markdown syntaxes.
 * @param {string} text
 * @returns {number}
 */
function getQuoteDepth(text) {
  const match = text.match(/^(\s*(?:>\s*)+)/)
  if (!match) return 0
  const arrows = match[0].match(/>/g)
  return arrows ? arrows.length : 0
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
 * Toggles or cycles blockquote depth (`> ` → `>> ` → `>>> ` → plain text).
 * - If not quoted → adds level 1 (`> `).
 * - If already quoted at depth 1 or 2 → increases to depth 2 or 3 (`>> `, `>>> `).
 * - If already quoted at depth ≥3 → clears quote markers back to plain text.
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

  const changes = lines.map((line) => {
    const depth = getQuoteDepth(line.text)
    if (depth === 0) {
      return { from: line.from, insert: '> ' }
    } else if (depth >= 3) {
      // Clear quote prefix back to normal text
      const stripped = line.text.replace(/^(\s*(?:>\s*)+)/, '')
      return { from: line.from, to: line.to, insert: stripped }
    } else {
      // Advance to next depth level
      const match = line.text.match(/^(\s*(?:>\s*)+)(.*)$/)
      const content = match ? match[2] : ''
      const newPrefix = '>'.repeat(depth + 1) + ' '
      return { from: line.from, to: line.to, insert: newPrefix + content }
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
 * Handles Backspace key on blockquote lines:
 * - If line is an empty quote (e.g. `> `, `>> ` with no text) → dedents by one level or clears.
 * - If cursor is at or before the prefix boundary → dedents depth by one level (`>>> ` → `>> ` → `> ` → plain text).
 *
 * @param {import('@codemirror/view').EditorView} view
 * @returns {boolean}
 */
export function handleQuoteBackspace(view) {
  const state = view.state
  const sel = state.selection.main
  if (!sel.empty) return false

  const pos = sel.head
  const line = state.doc.lineAt(pos)
  const lineText = line.text

  const quoteMatch = lineText.match(/^(\s*)(>+)(\s?)(.*)$/)
  if (!quoteMatch) return false

  const ws = quoteMatch[1]
  const markers = quoteMatch[2]
  const sp = quoteMatch[3]
  const content = quoteMatch[4]
  const prefixLength = ws.length + markers.length + sp.length
  const prefixEndPos = line.from + prefixLength

  // 1. Empty quote line: `> `, `>> `, `>>> `
  if (!content.trim()) {
    if (markers.length > 1) {
      const newMarkers = markers.slice(0, -1)
      const newText = `${ws}${newMarkers} `
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
        selection: { anchor: line.from + newText.length }
      })
      return true
    } else {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: ws },
        selection: { anchor: line.from + ws.length }
      })
      return true
    }
  }

  // 2. Cursor at or before prefix boundary (start of line content)
  if (pos <= prefixEndPos) {
    if (markers.length > 1) {
      const newMarkers = markers.slice(0, -1)
      const newText = `${ws}${newMarkers} ${content}`
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
        selection: { anchor: line.from + ws.length + newMarkers.length + 1 }
      })
      return true
    } else {
      const newText = `${ws}${content}`
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: newText },
        selection: { anchor: line.from + ws.length }
      })
      return true
    }
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

/**
 * CodeMirror Extension for Nested Blockquotes.
 * - Inspects lines and measures blockquote depth (> = 1, >> = 2, >>> = 3, etc.)
 * - Applies tiered line classes: `cm-atomic-blockquote cm-blockquote-depth-${depth}`
 * - In preview mode (cursor off-line), hides leading markdown markers `>+ ` for clean typography.
 */
export const quoteExtension = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view)
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view) {
      const builder = []
      const doc = view.state.doc
      const cursor = view.state.selection.main.head

      for (let { from, to } of view.visibleRanges) {
        let lineIdx = doc.lineAt(from).number
        const endLineIdx = doc.lineAt(to).number

        for (; lineIdx <= endLineIdx; lineIdx++) {
          const line = doc.line(lineIdx)
          const text = line.text

          // Match blockquote: e.g. `>`, `>>`, `>>>` or `> >`, `> > >`
          const match = text.match(/^(\s*(?:>\s*)+)/)
          if (match) {
            const isCallout = /^\s*(?:>\s*)+\[![a-zA-Z]+\]/.test(text)
            if (!isCallout) {
              const depth = getQuoteDepth(text)
              const depthClamped = Math.min(Math.max(depth, 1), 6)

              // Line decoration for tiered borders and background
              builder.push(
                Decoration.line({
                  class: `cm-atomic-blockquote cm-blockquote-depth-${depthClamped}`
                }).range(line.from)
              )

              // Hide marker when cursor is NOT on this line
              const isCursorOnLine = cursor >= line.from && cursor <= line.to
              if (!isCursorOnLine) {
                const markerLen = match[0].length
                if (markerLen > 0) {
                  builder.push(
                    Decoration.replace({}).range(line.from, line.from + markerLen)
                  )
                }
              }
            }
          }
        }
      }

      return Decoration.set(
        builder.sort((a, b) => a.from - b.from),
        true
      )
    }
  },
  {
    decorations: (v) => v.decorations
  }
)
