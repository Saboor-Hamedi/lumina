/**
 * =========================================================================================
 * Empty Line Selection Fix (`emptyLineSelectionFix.js`)
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
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
    if (pos === null) return false

    const line = view.state.doc.lineAt(pos)
    // Only intercept if the line is completely empty whitespace
    if (line.text.trim().length === 0) {
      e.preventDefault()
      view.dispatch({
        selection: { anchor: line.from }
      })
      return true
    }

    // Allow native CodeMirror / browser double-click word selection for all text
    return false
  }
})
