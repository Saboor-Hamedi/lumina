import { EditorView } from 'codemirror'

/**
 * Base Editor Theme
 * Defines the structural styling for the CodeMirror instance to match Lumina's UI.
 * Includes dynamic cursor styling that responds to CSS variables for smooth updates.
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
  },
  // Dynamic cursor styling - uses CSS variables for real-time updates
  '.cm-cursor': {
    borderLeft: 'var(--caret-width, 2px) solid var(--caret-color, var(--text-accent))',
    marginLeft: 'calc(-1 * var(--caret-width, 2px) / 2)',
    transition: 'border-color 0.15s ease, border-width 0.15s ease'
  },
  // Block cursor style override
  '.cursor-block .cm-cursor': {
    borderLeft: 'none',
    backgroundColor: 'var(--caret-color, var(--text-accent))',
    width: '0.6em',
    opacity: '0.7',
    marginLeft: '0'
  }
})
