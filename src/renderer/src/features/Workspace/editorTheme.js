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
  // Note: These styles are minimal - the injected style element and direct DOM manipulation handle the actual styling
  // This prevents CodeMirror from setting default 1px black cursor
  '.cm-cursor': {
    // Don't set border here - let CSS and injected styles handle it
    // This prevents CodeMirror from applying default 1px black border
    transition: 'border-color 0.15s ease, border-width 0.15s ease, background-color 0.15s ease'
  },
  // Block cursor style override
  '.cursor-block .cm-cursor': {
    // Don't set styles here - let injected styles handle it
    transition: 'background-color 0.15s ease, opacity 0.2s ease'
  }
})
