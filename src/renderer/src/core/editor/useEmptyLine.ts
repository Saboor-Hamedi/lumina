import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/**
 * =========================================================================================
 * Empty Line & Line Selection Fix Hook (`useEmptyLine.ts`)
 * =========================================================================================
 *
 * Purpose:
 * Prevents full-width rectangular selection backgrounds when double-clicking on empty lines or
 * past the end of headings/paragraphs, and ensures triple-clicks select strictly the line content
 * (line.from to line.to) without capturing the trailing newline (\n) which spills onto next lines.
 * Ensures clicks in the empty trailing space of a line clamp to line.to rather than jumping to next line.
 * =========================================================================================
 */
export const emptyLineSelectionFix: Extension = EditorView.domEventHandlers({
  mousedown(e: MouseEvent, view: EditorView) {
    // Only handle primary button single clicks
    if (e.button !== 0 || e.detail > 1) return false
    const target = e.target as HTMLElement | null
    if (!target || target.closest('.cm-atomic-table') || target.closest('.cm-button')) return false

    const lineEl = target.closest('.cm-line') as HTMLElement | null
    if (!lineEl) return false

    try {
      const coords = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (!coords || typeof coords.pos !== 'number') return false

      const domPos = typeof view.posAtDOM === 'function' ? view.posAtDOM(lineEl) : -1
      if (typeof domPos !== 'number' || domPos < 0) return false

      const line = view.state.doc.lineAt(domPos)

      // If clicked inside this line element but the coordinates resolved past line.to
      // (into the next line/paragraph), clamp the cursor to line.to so it stays at the end of this sentence.
      if (coords.pos > line.to) {
        e.preventDefault()
        view.focus()
        view.dispatch({
          selection: { anchor: line.to, head: line.to },
          userEvent: 'select'
        })
        return true
      }
    } catch {
      return false
    }

    return false
  },

  dblclick(e: MouseEvent, view: EditorView) {
    try {
      const coords = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (!coords || typeof coords.pos !== 'number') return false

      const line = view.state.doc.lineAt(coords.pos)
      // 1. If the line is empty whitespace, collapse caret to line.from
      if (line.text.trim().length === 0) {
        e.preventDefault()
        view.dispatch({
          selection: { anchor: line.from }
        })
        return true
      }

      // 2. If double-clicking past the text on the line, simply place the caret at line.to without selecting full block
      if (coords.pos >= line.to) {
        e.preventDefault()
        view.dispatch({
          selection: { anchor: line.to }
        })
        return true
      }
    } catch {
      return false
    }

    return false
  },

  click(e: MouseEvent, view: EditorView) {
    // 3. Triple-click on a line: select strictly the line text without capturing trailing newline
    if (e.detail === 3) {
      try {
        const coords = view.posAtCoords({ x: e.clientX, y: e.clientY })
        if (!coords || typeof coords.pos !== 'number') return false

        const line = view.state.doc.lineAt(coords.pos)
        e.preventDefault()
        view.dispatch({
          selection: { anchor: line.from, head: line.to }
        })
        return true
      } catch {
        return false
      }
    }
    return false
  }
})

export default emptyLineSelectionFix
