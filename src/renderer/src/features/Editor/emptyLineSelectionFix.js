import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'

/**
 * Prevents full-width selection background rectangles from appearing on empty lines
 * when double-clicking or selecting empty whitespace/newlines.
 */
export const emptyLineSelectionFix = [
  EditorView.domEventHandlers({
    dblclick(e, view) {
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos)
        if (line.text.trim().length === 0) {
          e.preventDefault()
          e.stopPropagation()
          view.dispatch({
            selection: { anchor: line.from },
            scrollIntoView: true
          })
          view.focus()
          return true
        }
      }
      return false
    }
  }),
  EditorState.transactionFilter.of((tr) => {
    if (tr.selection && tr.isUserEvent('select')) {
      const sel = tr.selection.main
      if (!sel.empty) {
        const line = tr.state.doc.lineAt(sel.from)
        // If the selection is solely covering an empty line / newline
        if (line.text.trim().length === 0 && sel.to <= line.to + 1) {
          return [tr, { selection: { anchor: line.from } }]
        }
      }
    }
    return tr
  })
]
