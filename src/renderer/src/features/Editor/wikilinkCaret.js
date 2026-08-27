/**
 * wikilinkCaret.js
 * 
 * WHY WE NEED THIS:
 * CodeMirror 6 and Chrome have a notorious bug where clicking the right edge of an 
 * inline replacement widget (like our wikilink) incorrectly snaps the cursor to the 
 * LEFT side (front) of the widget if it's the absolute last item on a line.
 * 
 * Instead of hacking the DOM with zero-width spaces (which failed), we intercept 
 * the mouse click directly. If the user clicks the right half of a wikilink, we 
 * calculate the length of the `[[wikilink]]` syntax in the document, and manually 
 * force CodeMirror's selection to the exact character position AFTER the link.
 */
import { EditorView } from '@codemirror/view'

export const wikilinkCaretFix = EditorView.domEventHandlers({
  mousedown(e, view) {
    const target = e.target
    const wikilink = target.closest('.cm-atomic-wiki-link') || target.closest('.cm-atomic-wikilink-wrap')
    
    if (!wikilink) return false

    const rect = wikilink.getBoundingClientRect()
    // Check if user clicked on the right half of the wikilink widget
    const isRightHalf = e.clientX > rect.left + (rect.width / 2)

    if (isRightHalf) {
      // Get the document position BEFORE the widget
      const pos = view.posAtDOM(wikilink)
      if (pos !== null) {
        // Read the text ahead to find the exact length of the [[...]] syntax
        const textAhead = view.state.doc.sliceString(pos, Math.min(pos + 200, view.state.doc.length))
        const match = textAhead.match(/^\[\[.*?\]\]/)
        
        if (match) {
          const endPos = pos + match[0].length
          
          // Force CodeMirror to set the cursor AFTER the wikilink
          view.dispatch({
            selection: { anchor: endPos, head: endPos },
            userEvent: 'select'
          })
          
          // Prevent browser from overriding our explicit selection
          e.preventDefault()
          return true
        }
      }
    }
    
    return false
  }
})
