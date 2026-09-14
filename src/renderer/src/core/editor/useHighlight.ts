/**
 * =========================================================================================
 * Highlight Extension (`useHighlight.ts`)
 * =========================================================================================
 *
 * Purpose:
 * Renders live-preview text highlights for markdown `==content==` syntax (e.g., `== Hello ==` or `==Hello==`).
 *
 * Behavior:
 * - When cursor is OUTSIDE the highlight:
 *   Hides the `==` delimiters and wraps the inner content in a luminous, theme-aware highlight card (`.cm-highlight`).
 * - When cursor is INSIDE the highlight:
 *   Keeps `==` delimiters visible (`.cm-highlight-mark`) so the user can easily edit, type, or delete them.
 * - Keyboard shortcut `Mod-Shift-h` / `Mod-Shift-H`:
 *   Toggles `==` around selection or inserts `====` at cursor.
 * - Ignores code fences and inline backtick code blocks.
 * =========================================================================================
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap
} from '@codemirror/view'
import { RangeSetBuilder, type Extension, Prec } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

/**
 * Regular expression matching `==content==` (non-greedy, on the same line).
 * Ensures `=` before and after are not part of `===`.
 */
const HIGHLIGHT_REGEX = /(?<!=)==(?!=)([^=\n]+?)(?<!=)==(?!=)/g

/**
 * Checks if a document position is inside a code block or inline code.
 */
function isInsideCode(view: EditorView, pos: number): boolean {
  try {
    const tree = syntaxTree(view.state)
    if (!tree) return false
    const node = tree.resolveInner(pos, 1)
    let curr: typeof node | null = node
    while (curr) {
      const name = curr.name
      if (
        name === 'FencedCode' ||
        name === 'CodeBlock' ||
        name === 'CodeText' ||
        name === 'InlineCode'
      ) {
        return true
      }
      curr = curr.parent
    }
  } catch {
    // Fallback: syntaxTree not ready
  }
  return false
}

/**
 * Builds CodeMirror decorations for visible ranges containing `==...==`.
 */
export function buildHighlightDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { state } = view
  const doc = state.doc
  const selection = state.selection

  let lastLineNumber = -1
  let lastDecoratedPos = -1

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.number === lastLineNumber) {
        pos = line.to + 1
        continue
      }
      lastLineNumber = line.number
      const lineText = line.text

      if (lineText.includes('==')) {
        HIGHLIGHT_REGEX.lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = HIGHLIGHT_REGEX.exec(lineText)) !== null) {
          const content = match[1]
          if (!content) continue

          const matchFrom = line.from + match.index
          const openEnd = matchFrom + 2
          const closeStart = matchFrom + 2 + content.length
          const matchTo = closeStart + 2

          // Prevent any out-of-order additions to builder
          if (matchFrom < lastDecoratedPos) continue

          // Ignore matches inside code fences or inline backticks
          if (isInsideCode(view, matchFrom)) continue

          // Check if cursor is touching or inside this highlight
          const isCursorInside =
            view.hasFocus &&
            selection.ranges.some((r) => r.from <= matchTo && r.to >= matchFrom)

          lastDecoratedPos = matchTo

          if (isCursorInside) {
            // Cursor inside: show `==` delimiters faintly so they can be edited
            builder.add(
              matchFrom,
              openEnd,
              Decoration.mark({ class: 'cm-highlight-mark cm-highlight-mark-active' })
            )
            builder.add(
              openEnd,
              closeStart,
              Decoration.mark({ class: 'cm-highlight' })
            )
            builder.add(
              closeStart,
              matchTo,
              Decoration.mark({ class: 'cm-highlight-mark cm-highlight-mark-active' })
            )
          } else {
            // Cursor outside: collapse delimiters and show clean highlighted text
            builder.add(matchFrom, openEnd, Decoration.replace({}))
            builder.add(
              openEnd,
              closeStart,
              Decoration.mark({ class: 'cm-highlight' })
            )
            builder.add(closeStart, matchTo, Decoration.replace({}))
          }
        }
      }

      pos = line.to + 1
    }
  }

  return builder.finish()
}

/**
 * ViewPlugin providing the dynamic highlight decorations.
 */
export const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildHighlightDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged
      ) {
        this.decorations = buildHighlightDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

/**
 * Toggles `==` highlight marks on the current selection or inserts `====` at the cursor.
 */
export function toggleHighlight(view: EditorView | null | undefined): boolean {
  if (!view || !view.state) return false

  const { state, dispatch } = view
  const sel = state.selection.main
  const { from, to } = sel

  if (from === to) {
    // No selection: insert `====` and place cursor inside
    dispatch({
      changes: { from, to, insert: '====' },
      selection: { anchor: from + 2 },
      scrollIntoView: true
    })
    return true
  }

  const selectedText = state.sliceDoc(from, to)

  // 1. Check if selection is already wrapped with `==...==`
  if (
    selectedText.startsWith('==') &&
    selectedText.endsWith('==') &&
    selectedText.length >= 4
  ) {
    // Unwrap from inside
    dispatch({
      changes: { from, to, insert: selectedText.slice(2, -2) },
      selection: { anchor: from, head: to - 4 },
      scrollIntoView: true
    })
    return true
  }

  // 2. Check if `==` delimiters are just outside selection
  const before = state.sliceDoc(Math.max(0, from - 2), from)
  const after = state.sliceDoc(to, Math.min(state.doc.length, to + 2))
  if (before === '==' && after === '==') {
    // Unwrap from outside
    dispatch({
      changes: [
        { from: from - 2, to: from, insert: '' },
        { from: to, to: to + 2, insert: '' }
      ],
      selection: { anchor: from - 2, head: to - 2 },
      scrollIntoView: true
    })
    return true
  }

  // 3. Wrap selection with `==`
  dispatch({
    changes: [
      { from, insert: '==' },
      { from: to, insert: '==' }
    ],
    selection: { anchor: from + 2, head: to + 2 },
    scrollIntoView: true
  })
  return true
}

/**
 * Keymap binding `Mod-Shift-h` / `Mod-Shift-H` to toggle highlight.
 */
export const highlightKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Mod-Shift-h',
      run: (view: EditorView) => toggleHighlight(view)
    },
    {
      key: 'Mod-Shift-H',
      run: (view: EditorView) => toggleHighlight(view)
    }
  ])
)

/**
 * Combined CodeMirror extension for markdown highlights.
 */
export const highlightExtension: Extension = [highlightPlugin, highlightKeymap]

export default highlightExtension
