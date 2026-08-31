/**
 * insertActions.js
 * Handles inserting predefined snippets (e.g. Tables, Callouts) into the editor.
 */
export const insertSnippet = (view, snippetText) => {
  if (!view) return
  view.dispatch({
    changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: snippetText }
  })
  view.focus()
}
