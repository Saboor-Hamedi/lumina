/**
 * =========================================================================
 * Quote.tsx — Standalone Blockquote (`>`) Extension for CodeMirror 6
 * =========================================================================
 *
 * Completely separated from Callouts (`useCallout.ts` / `callout.css`).
 * Renders a plain, flat header bar above every standalone `>` blockquote
 * with a subtle flat Copy button and a reliable Collapse/Expand dropdown
 * chevron on the right.
 *
 * Folding architecture:
 * - Expanded: block widget header (`side: -1` at `startLine.from`) + styled
 *   `.lumina-quote-line` body lines underneath.
 * - Collapsed: atomic block `Decoration.replace` over `startLine.from..lastLine.to`
 *   showing only the collapsed flat header bar (with preview text & line count).
 * - Clicking the chevron or header dispatches `toggleQuoteFoldEffect` using the
 *   stored `blockStartPos`, guaranteeing 100% reliable fold AND unfold for both
 *   single-line and multi-line quotes.
 */

import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { parseCalloutHeaderLine } from './useCallout'

const QUOTE_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path></svg>`
const COPY_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
const CHEVRON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`

function fallbackCopyText(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    textarea.setAttribute('readonly', '')
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export const toggleQuoteFoldEffect = StateEffect.define<{ pos: number }>()

export const quoteFoldField = StateField.define<Map<number, boolean>>({
  create() {
    return new Map()
  },
  update(value, tr) {
    let next = value
    let cloned = false
    const ensureCloned = () => {
      if (!cloned) {
        next = new Map(value)
        cloned = true
      }
      return next
    }

    if (tr.docChanged && value.size > 0) {
      const remapped = new Map<number, boolean>()
      value.forEach((collapsed, pos) => {
        const mapped = tr.changes.mapPos(pos, -1)
        if (mapped >= 0) remapped.set(mapped, collapsed)
      })
      next = remapped
      cloned = true
    }

    for (const effect of tr.effects) {
      if (effect.is(toggleQuoteFoldEffect)) {
        const map = ensureCloned()
        const pos = effect.value.pos
        const current = map.get(pos) === true
        map.set(pos, !current)
      }
    }

    return next
  }
})

function collectQuoteText(state: EditorState, blockStartPos: number): string {
  const doc = state.doc
  if (blockStartPos < 0 || blockStartPos > doc.length) return ''
  const startLine = doc.lineAt(blockStartPos)
  const lines: string[] = []
  for (let ln = startLine.number; ln <= doc.lines; ln++) {
    const line = doc.line(ln)
    if (!/^\s*>/.test(line.text)) break
    if (parseCalloutHeaderLine(line.text)) break
    lines.push(line.text.replace(/^\s*(?:>\s?)+/, ''))
  }
  return lines.join('\n').trim()
}

export class QuoteHeaderWidget extends WidgetType {
  readonly blockStartPos: number
  readonly lineCount: number
  readonly preview: string
  readonly isCollapsed: boolean

  constructor(blockStartPos: number, lineCount: number, preview: string, isCollapsed: boolean) {
    super()
    this.blockStartPos = blockStartPos
    this.lineCount = lineCount
    this.preview = preview
    this.isCollapsed = isCollapsed
  }

  eq(other: QuoteHeaderWidget): boolean {
    return (
      other.blockStartPos === this.blockStartPos &&
      other.lineCount === this.lineCount &&
      other.preview === this.preview &&
      other.isCollapsed === this.isCollapsed
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const bar = document.createElement('div')
    bar.className = `lumina-quote-header${this.isCollapsed ? ' is-collapsed' : ''}`
    bar.setAttribute('contenteditable', 'false')

    const left = document.createElement('span')
    left.className = 'lumina-quote-header-left'

    const icon = document.createElement('span')
    icon.className = 'lumina-quote-header-icon'
    icon.innerHTML = QUOTE_ICON_SVG

    const label = document.createElement('span')
    label.className = 'lumina-quote-header-title'
    label.textContent = 'Quote'

    left.appendChild(icon)
    left.appendChild(label)

    if (this.isCollapsed) {
      if (this.preview) {
        const previewEl = document.createElement('span')
        previewEl.className = 'lumina-quote-header-preview'
        previewEl.textContent = this.preview
        left.appendChild(previewEl)
      }
      if (this.lineCount > 1) {
        const countEl = document.createElement('span')
        countEl.className = 'lumina-quote-header-count'
        countEl.textContent = `${this.lineCount} lines`
        left.appendChild(countEl)
      }
    }

    const actions = document.createElement('span')
    actions.className = 'lumina-quote-header-actions'

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'lumina-quote-copy-btn'
    copyBtn.title = 'Copy quote'
    copyBtn.setAttribute('aria-label', 'Copy quote')
    copyBtn.innerHTML = COPY_ICON_SVG

    copyBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const payload = collectQuoteText(view.state, this.blockStartPos)
      if (!payload) return
      const triggerSuccess = () => {
        copyBtn.classList.add('copied')
        copyBtn.innerHTML = CHECK_ICON_SVG
        window.setTimeout(() => {
          copyBtn.classList.remove('copied')
          copyBtn.innerHTML = COPY_ICON_SVG
        }, 1400)
      }
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(payload)
          .then(triggerSuccess)
          .catch(() => {
            if (fallbackCopyText(payload)) triggerSuccess()
          })
      } else if (fallbackCopyText(payload)) {
        triggerSuccess()
      }
    })

    const foldBtn = document.createElement('button')
    foldBtn.type = 'button'
    foldBtn.className = `lumina-quote-fold-btn${this.isCollapsed ? ' is-collapsed' : ''}`
    foldBtn.title = this.isCollapsed ? 'Expand quote' : 'Collapse quote'
    foldBtn.setAttribute('aria-label', foldBtn.title)
    foldBtn.setAttribute('aria-expanded', String(!this.isCollapsed))
    foldBtn.innerHTML = CHEVRON_SVG

    actions.appendChild(copyBtn)
    actions.appendChild(foldBtn)

    bar.appendChild(left)
    bar.appendChild(actions)

    const toggleFold = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest('.lumina-quote-copy-btn')) return
      e.preventDefault()
      e.stopPropagation()

      const willCollapse = !this.isCollapsed
      const doc = view.state.doc
      let nextSelection: { anchor: number } | undefined

      if (willCollapse && this.blockStartPos >= 0 && this.blockStartPos <= doc.length) {
        // Compute end of this quote block so if the caret is currently inside it,
        // we move the caret cleanly outside in the same transaction; otherwise
        // `selectionInside` would immediately keep the block unfolded.
        const startLine = doc.lineAt(this.blockStartPos)
        let endTo = startLine.to
        for (let ln = startLine.number + 1; ln <= doc.lines; ln++) {
          const nextLine = doc.line(ln)
          if (!/^\s*>/.test(nextLine.text) || parseCalloutHeaderLine(nextLine.text)) break
          endTo = nextLine.to
        }
        const sel = view.state.selection.main
        if (sel.from >= startLine.from && sel.from <= endTo) {
          const outsidePos =
            endTo < doc.length ? endTo + 1 : startLine.from > 0 ? startLine.from - 1 : 0
          if (outsidePos < startLine.from || outsidePos > endTo) {
            nextSelection = { anchor: outsidePos }
          }
        }
      }

      view.dispatch({
        effects: toggleQuoteFoldEffect.of({ pos: this.blockStartPos }),
        ...(nextSelection ? { selection: nextSelection } : {})
      })
    }

    bar.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement | null)?.closest('.lumina-quote-copy-btn')) return
      e.preventDefault()
      e.stopPropagation()
    })
    bar.addEventListener('click', toggleFold)

    return bar
  }

  ignoreEvent(): boolean {
    return true
  }
}

interface QuoteBlockRange {
  startLineNum: number
  endLineNum: number
  startFrom: number
  endTo: number
  lineCount: number
  preview: string
}

function findStandaloneQuoteBlocks(doc: EditorState['doc']): QuoteBlockRange[] {
  const blocks: QuoteBlockRange[] = []
  let inCodeFence = false
  let l = 1

  while (l <= doc.lines) {
    const line = doc.line(l)
    if (/^\s*(```|~~~)/.test(line.text)) {
      inCodeFence = !inCodeFence
      l++
      continue
    }
    if (inCodeFence) {
      l++
      continue
    }

    const quotePrefixMatch = line.text.match(/^\s*(?:>\s*)+/)
    if (!quotePrefixMatch) {
      l++
      continue
    }

    // Skip entire callout blocks (`> [!type]` and their body lines) — owned by useCallout.ts
    const calloutHeader = parseCalloutHeaderLine(line.text)
    if (calloutHeader) {
      l++
      while (l <= doc.lines) {
        const nextLine = doc.line(l)
        const nextPrefix = nextLine.text.match(/^\s*(?:>\s*)+/)
        if (!nextPrefix) break
        const nextLevel = nextPrefix[0].match(/>/g)?.length || 0
        if (nextLevel < calloutHeader.level) break
        if (parseCalloutHeaderLine(nextLine.text)) break
        l++
      }
      continue
    }

    // Standalone blockquote group
    const startLineNum = l
    const startFrom = line.from
    let endLineNum = l
    let endTo = line.to
    let preview = ''

    while (l <= doc.lines) {
      const curr = doc.line(l)
      if (!/^\s*>/.test(curr.text)) break
      if (parseCalloutHeaderLine(curr.text)) break
      if (!preview) {
        const cleaned = curr.text.replace(/^\s*(?:>\s?)+/, '').trim()
        if (cleaned) {
          preview = cleaned.length > 64 ? `${cleaned.slice(0, 64)}…` : cleaned
        }
      }
      endLineNum = l
      endTo = curr.to
      l++
    }

    blocks.push({
      startLineNum,
      endLineNum,
      startFrom,
      endTo,
      lineCount: endLineNum - startLineNum + 1,
      preview
    })
  }

  return blocks
}

function buildQuoteDecorations(state: EditorState): DecorationSet {
  const builder: any[] = []
  const doc = state.doc
  const foldMap = state.field(quoteFoldField, false)
  const blocks = findStandaloneQuoteBlocks(doc)

  for (const block of blocks) {
    const requestedCollapsed = foldMap?.get(block.startFrom) === true
    // Only auto-unfold if the caret is strictly inside the collapsed quote text
    // AND the document has somewhere outside the quote (so a doc containing only
    // a single quote can still stay collapsed cleanly).
    const hasRoomOutside = block.startFrom > 0 || block.endTo < doc.length
    const selectionInside =
      requestedCollapsed &&
      hasRoomOutside &&
      state.selection.ranges.some(
        (range) => range.from >= block.startFrom && range.from <= block.endTo
      )
    const isCollapsed = requestedCollapsed && !selectionInside

    if (isCollapsed) {
      builder.push(
        Decoration.replace({
          widget: new QuoteHeaderWidget(block.startFrom, block.lineCount, block.preview, true),
          block: true
        }).range(block.startFrom, block.endTo)
      )
    } else {
      builder.push(
        Decoration.widget({
          widget: new QuoteHeaderWidget(block.startFrom, block.lineCount, block.preview, false),
          block: true,
          side: -1
        }).range(block.startFrom)
      )

      for (let ln = block.startLineNum; ln <= block.endLineNum; ln++) {
        const line = doc.line(ln)
        const isLast = ln === block.endLineNum
        builder.push(
          Decoration.line({
            class: isLast ? 'lumina-quote-line lumina-quote-line-last' : 'lumina-quote-line'
          }).range(line.from)
        )
      }
    }
  }

  return Decoration.set(builder, true)
}

export const quoteDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildQuoteDecorations(state)
  },
  update(decorations, tr) {
    if (
      tr.docChanged ||
      tr.selection ||
      tr.effects.some((e) => e.is(toggleQuoteFoldEffect))
    ) {
      return buildQuoteDecorations(tr.state)
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field)
})

export const quoteExtension: Extension = [quoteFoldField, quoteDecorationsField]

export default quoteExtension
