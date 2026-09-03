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
      const clickX = e.clientX
      const linksOnLine = Array.from(
        parentLine.querySelectorAll('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, .cm-atomic-wiki-link-hidden-syntax')
      )
      if (linksOnLine.length > 0) {
        wikilink = linksOnLine.reduce((closest, el) => {
          const rect = el.getBoundingClientRect()
          const distToClosest = closest
            ? Math.min(
                Math.abs(clickX - closest.getBoundingClientRect().left),
                Math.abs(clickX - closest.getBoundingClientRect().right)
              )
            : Infinity
          const distToEl = Math.min(Math.abs(clickX - rect.left), Math.abs(clickX - rect.right))
          return distToEl < distToClosest ? el : closest
        }, null)
      }
    }

    if (!wikilink) return false

    const docLength = view.state.doc.length
    if (docLength === 0) return false

    const clickX = e.clientX
    const rect = wikilink.getBoundingClientRect()
    const isRightHalf = clickX > rect.left + rect.width / 2

    const lineBlock = view.lineBlockAt(view.posAtDOM(wikilink))
    const lineText = view.state.doc.sliceString(lineBlock.from, lineBlock.to)

    const linkRegex = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g
    const matches = []
    let m
    while ((m = linkRegex.exec(lineText)) !== null) {
      matches.push({
        from: lineBlock.from + m.index,
        to: lineBlock.from + m.index + m[0].length,
        text: m[0]
      })
    }

    if (matches.length === 0) {
      return false
    }

    let targetLink = null

    if (wikilink.classList.contains('cm-atomic-wiki-link-hidden-syntax')) {
      const domPos = view.posAtDOM(wikilink)
      targetLink = matches.find((link) => domPos >= link.from && domPos <= link.to)
    }

    if (!targetLink) {
      const targetText =
        wikilink.getAttribute('data-wiki-link-target') ||
        wikilink.getAttribute('data-target') ||
        wikilink.innerText?.replace(/[\[\]]/g, '').trim()

      if (targetText) {
        targetLink = matches.find((link) => link.text.includes(targetText))
      }
    }

    if (!targetLink) {
      const linksInLine = parentLine
        ? Array.from(parentLine.querySelectorAll('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, .cm-atomic-wiki-link-hidden-syntax'))
        : [wikilink]
      const linkIndex = linksInLine.indexOf(wikilink)
      if (linkIndex !== -1 && matches[linkIndex]) {
        targetLink = matches[linkIndex]
      }
    }

    if (!targetLink) {
      targetLink = matches[0]
    }

    if (targetLink) {
      const targetPos = isRightHalf ? targetLink.to : targetLink.from

      e.preventDefault()
      e.stopPropagation()

      view.focus()
      safeDispatch(view, {
        selection: { anchor: targetPos, head: targetPos },
        scrollIntoView: true
      })
      return true
    }

    return false
  }
})

export default wikilinkCaretFix
