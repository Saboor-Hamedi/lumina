/**
 * =========================================================================================
 * Empty Line Selection Fix Hook (`useEmptyLine.jsx`)
 * =========================================================================================
 *
 * Purpose:
 * Prevents full-width rectangular selection backgrounds when double-clicking on empty lines,
 * while ensuring 100% smooth, native word selection, paragraph selection, and drag selection.
 * =========================================================================================
 */

import { EditorView } from '@codemirror/view'

export const emptyLineSelectionFix = EditorView.domEventHandlers({
  dblclick(e, view) {
    try {
      const coords = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (!coords || typeof coords.pos !== 'number') return false

      const line = view.state.doc.lineAt(coords.pos)
      // Only intercept if the line is completely empty whitespace
      if (line.text.trim().length === 0) {
        e.preventDefault()
        view.dispatch({
          selection: { anchor: line.from }
        })
        return true
      }
    } catch {
      return false
    }

    // Allow native CodeMirror / browser double-click word selection for all text
    return false
  }
})

export default emptyLineSelectionFix
