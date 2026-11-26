/**
 * insertActions.ts
 * Handles inserting predefined snippets (e.g. Tables, Callouts) into the editor.
 */
import type { EditorView } from '@codemirror/view'

export const insertSnippet = (
  view: EditorView | null | undefined,
  snippetText: string
): void => {
  if (!view) return
  view.dispatch({
    changes: {
      from: view.state.selection.main.from,
      to: view.state.selection.main.to,
      insert: snippetText
    }
  })
  view.focus()
}
