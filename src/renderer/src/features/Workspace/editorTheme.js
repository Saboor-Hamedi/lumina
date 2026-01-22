import { EditorView } from 'codemirror'

/**
 * Base Editor Theme
 * Defines the structural styling for the CodeMirror instance to match Lumina's UI.
 * Includes dynamic cursor styling that responds to CSS variables for smooth updates.
 */
export const seamlessTheme = EditorView.theme({
  '&': {
    height: '100%'
  },
  fontSize: 'var(--font-size-editor, 16px)',
  backgroundColor: 'transparent !important',
  '.cm-scroller': {
    height: '100%',
    overflow: 'auto'
  },
  '.cm-scroller::-webkit-scrollbar': {
    display: 'none'
  },
  '.cm-scroller': {
    scrollbarWidth: 'none'
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
  // The CSS file provides the actual styling with !important overrides
  // This theme sets up the structure and basic properties
  '.cm-cursor': {
    // Use CSS variables - the CSS file will override with !important if needed
    borderLeftWidth: 'var(--caret-width, 2px)',
    borderLeftColor: 'var(--caret-color)',
    borderLeftStyle: 'solid',
    marginLeft: 'calc(-1 * var(--caret-width, 2px) / 2)',
    transition: 'border-color 0.15s ease, border-width 0.15s ease, background-color 0.15s ease',
    pointerEvents: 'none'
  },
  // Block cursor style - uses background instead of border
  '.cursor-block .cm-cursor': {
    borderLeft: 'none',
    backgroundColor: 'var(--caret-color)',
    width: '0.6em',
    opacity: '0.7',
    marginLeft: '0',
    transition: 'background-color 0.15s ease, opacity 0.2s ease'
  },
  // Smooth cursor style (default) - additional transitions
  '.cursor-smooth .cm-cursor, .cursor-bar .cm-cursor': {
    transition:
      'transform 0.1s cubic-bezier(0, 0, 0.2, 1), opacity 0.2s, border-color 0.15s ease, border-width 0.15s ease'
  },
  // Sharp cursor style - no opacity transition
  '.cursor-sharp .cm-cursor, .cursor-line .cm-cursor': {
    opacity: '1',
    transition: 'border-color 0.15s ease, border-width 0.15s ease'
  }
})
