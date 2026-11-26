import type { EditorSelection, TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

type EditorViewWithDestroyed = EditorView & { isDestroyed?: boolean }

interface WikilinkMatch {
  from: number
  to: number
  text: string
}

const safeDispatch = (
  view: EditorViewWithDestroyed | null | undefined,
  transaction: TransactionSpec
): void => {
  try {
    if (!view || view.isDestroyed) return
    const docLength = view.state.doc.length
    if (transaction.selection) {
      const sel = transaction.selection as EditorSelection | { anchor: number; head?: number }
      const mainSel = 'main' in sel ? sel.main : sel
      const anchor = mainSel.anchor
      const head = mainSel.head
      if (
        typeof anchor === 'number' &&
        (anchor > docLength || (typeof head === 'number' && head > docLength))
      ) {
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
  mousedown(e: MouseEvent, view: EditorView) {
    const target = e.target as Element | null
    if (!target || typeof target.closest !== 'function' || target.closest('.cm-atomic-table')) return false

    let wikilink: Element | null =
      target.closest('.cm-atomic-wiki-link') ||
      target.closest('.cm-atomic-wikilink-wrap') ||
      target.closest('.cm-atomic-wiki-link-hidden-syntax')

    const parentLine = target.closest('.cm-line')

    if (!wikilink && parentLine) {
      const clickX = e.clientX
      const linksOnLine = Array.from(
        parentLine.querySelectorAll(
          '.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, .cm-atomic-wiki-link-hidden-syntax'
        )
      )
      if (linksOnLine.length > 0) {
        wikilink = linksOnLine.reduce<Element | null>((closest, el) => {
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

    const domPos = typeof view.posAtDOM === 'function' ? view.posAtDOM(wikilink) : 0
    const line = view.state.doc.lineAt(domPos)
    const lineText = line.text

    const linkRegex = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g
    const matches: WikilinkMatch[] = []
    let m: RegExpExecArray | null
    while ((m = linkRegex.exec(lineText)) !== null) {
      matches.push({
        from: line.from + m.index,
        to: line.from + m.index + m[0].length,
        text: m[0]
      })
    }

    if (matches.length === 0) {
      return false
    }

    let targetLink: WikilinkMatch | undefined

    if (wikilink.classList?.contains?.('cm-atomic-wiki-link-hidden-syntax')) {
      const hiddenDomPos = typeof view.posAtDOM === 'function' ? view.posAtDOM(wikilink) : 0
      targetLink = matches.find((link) => hiddenDomPos >= link.from && hiddenDomPos <= link.to)
    }

    if (!targetLink) {
      const targetText =
        (typeof wikilink.getAttribute === 'function' &&
          (wikilink.getAttribute('data-wiki-link-target') ||
            wikilink.getAttribute('data-target'))) ||
        (wikilink instanceof HTMLElement ? wikilink.innerText : wikilink.textContent)
          ?.replace(/[[\]]/g, '')
          .trim()

      if (targetText) {
        targetLink = matches.find((link) => link.text.includes(targetText))
      }
    }

    if (!targetLink) {
      const linksInLine =
        parentLine && typeof parentLine.querySelectorAll === 'function'
          ? Array.from(
              parentLine.querySelectorAll(
                '.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, .cm-atomic-wiki-link-hidden-syntax'
              )
            )
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
        userEvent: 'select'
      })
      return true
    }

    return false
  }
})

export default wikilinkCaretFix
