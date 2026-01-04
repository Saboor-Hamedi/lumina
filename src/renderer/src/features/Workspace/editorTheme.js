import { EditorView } from 'codemirror'

/**
 * Base Editor Theme
 * Defines the structural styling for the CodeMirror instance to match Lumina's UI.
 */
export const seamlessTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--font-size-editor, 16px)',
    backgroundColor: 'transparent !important'
  },
  '.cm-content': {
    // Font family is handled by mode-specific classes in CSS, but this sets a default base
    fontFamily: "var(--font-editor, 'Inter', system-ui, sans-serif)",
    padding: '0',
    color: 'var(--text-main)',
    cursor: 'text'
  },
  '.cm-gutters': { display: 'none' },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': {
    backgroundColor: 'transparent !important', // Remove default background
    borderRadius: '2px'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--bg-selection, rgba(75, 135, 255, 0.3)) !important',
    opacity: '1 !important'
  }
})
