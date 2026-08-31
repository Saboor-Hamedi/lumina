/**
 * clipboardActions.js
 * Handles clipboard operations (Copy, Cut, Paste) and selecting all text in the editor.
 */
export const selectAll = (view) => {
  if (!view) return
  view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
  view.focus()
}

export const cutText = () => document.execCommand('cut')
export const copyText = () => document.execCommand('copy')

export const pastePlainText = async (view) => {
  if (!view) return
  try {
    const text = await navigator.clipboard.readText()
    view.dispatch({
      changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: text }
    })
    view.focus()
  } catch (e) {
    console.error('Failed to read clipboard', e)
  }
}
