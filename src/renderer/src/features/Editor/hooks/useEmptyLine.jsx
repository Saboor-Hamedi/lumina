/**
 * =========================================================================================
 * Empty Line & Line Selection Fix Hook (`useEmptyLine.jsx`)
 * =========================================================================================
 *
 * Purpose:
 * Prevents full-width rectangular selection backgrounds when double-clicking on empty lines or
 * past the end of headings/paragraphs, and ensures triple-clicks select strictly the line content
 * (line.from to line.to) without capturing the trailing newline (\n) which spills onto next lines.
 * =========================================================================================
 */

import { EditorView } from '@codemirror/view'

export const emptyLineSelectionFix = EditorView.domEventHandlers({
  dblclick(e, view) {
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

  click(e, view) {
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
