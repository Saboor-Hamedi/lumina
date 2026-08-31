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

const safeDispatch = (view, transaction) => {
  try {
    if (!view || view.isDestroyed) return
    const docLength = view.state.doc.length
    if (transaction.selection) {
      const { anchor, head } = transaction.selection.main || transaction.selection || {}
      if (typeof anchor === 'number' && (anchor > docLength || head > docLength)) {
        console.warn('Wikilink caret fix: invalid selection range', { anchor, head, docLength })
        return
      }
    }
    view.dispatch(transaction)
  } catch (err) {
    console.error('Wikilink caret fix failed:', err)
  }
}

export const wikilinkCaretFix = EditorView.domEventHandlers({
  mousedown(e, view) {
    const target = e.target
    if (!target || target.closest('.cm-atomic-table')) return false

    let wikilink =
      target.closest('.cm-atomic-wiki-link') ||
      target.closest('.cm-atomic-wikilink-wrap') ||
      target.closest('.cm-atomic-wiki-link-hidden-syntax')

    const parentLine = target.closest('.cm-line')

    if (!wikilink && parentLine) {
      // If clicking on the line space after/before a wikilink, find the link on this line
      const linksOnLine = Array.from(
        parentLine.querySelectorAll('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, .cm-atomic-wiki-link-hidden-syntax')
      )
      if (linksOnLine.length > 0) {
        // Pick the link closest to click position
        wikilink = linksOnLine.reduce((closest, el) => {
          const r = el.getBoundingClientRect()
          const dist = Math.min(Math.abs(e.clientX - r.left), Math.abs(e.clientX - r.right))
          const closestDist = Math.min(
            Math.abs(e.clientX - closest.getBoundingClientRect().left),
            Math.abs(e.clientX - closest.getBoundingClientRect().right)
          )
          return dist < closestDist ? el : closest
        }, linksOnLine[0])
      }
    }

    if (!wikilink) return false

    // Prevent CodeMirror's basicMouseSelection from crashing on internal widget nodes
    e.preventDefault()
    e.stopPropagation()

    const rect = wikilink.getBoundingClientRect()
    const isRightHalf = e.clientX >= (rect.left + rect.width / 2)

    // Find the line containing the wikilink
    let linePos = 0
    try {
      if (parentLine) {
        linePos = view.posAtDOM(parentLine)
      } else {
        const coords = view.posAtCoords({ x: Math.max(0, rect.left - 5), y: rect.top + (rect.height / 2) })
        linePos = coords?.pos ?? 0
      }
    } catch {
      linePos = 0
    }

    const line = view.state.doc.lineAt(linePos)
    const lineText = line.text

    // If target is the hidden syntax mark directly, resolve from its DOM position
    let linkFrom = line.from
    let linkTo = line.to

    try {
      if (wikilink.classList.contains('cm-atomic-wiki-link-hidden-syntax')) {
        const domPos = view.posAtDOM(wikilink)
        if (domPos >= line.from && domPos <= line.to) {
          const offsetInLine = domPos - line.from
          const remaining = lineText.slice(offsetInLine)
          const m = remaining.match(/^\[\[(.*?)\]\]/)
          if (m) {
            linkFrom = domPos
            linkTo = domPos + m[0].length
          }
        }
      }
    } catch {}

    if (linkTo === line.to && linkFrom === line.from) {
      // Find all [[...]] in this line and match by DOM index among links in this line
      const linksInLine = parentLine
        ? Array.from(parentLine.querySelectorAll('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, .cm-atomic-wiki-link-hidden-syntax'))
        : [wikilink]
      const linkIndex = linksInLine.indexOf(wikilink)

      const regex = /\[\[(.*?)\]\]/g
      let match
      let count = 0

      while ((match = regex.exec(lineText)) !== null) {
        if (count === linkIndex || linkIndex === -1) {
          linkFrom = line.from + match.index
          linkTo = linkFrom + match[0].length
          break
        }
        count++
      }
    }

    const targetPos = isRightHalf ? linkTo : linkFrom

    safeDispatch(view, {
      selection: { anchor: targetPos, head: targetPos },
      userEvent: 'select'
    })
    view.focus()
    return true
  }
})
