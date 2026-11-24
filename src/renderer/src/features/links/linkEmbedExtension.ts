/**
 * CodeMirror 6 Smart Link Strip, Multi-Column Grid & Inline Hover Extension (`linkEmbedExtension.ts`)
 *
 * Rock-solid Mermaid-style preview/source lifecycle:
 * - Standalone bare URLs & ```links [1-4] grids render as `block: true` replace widgets
 *   (so no stray text cursor ever appears on the right side of the wrapper).
 * - Clicking on/near a preview never flips it to source.
 * - Clicking Edit/Source opens Source mode with mapped document positions (`tr.changes.mapPos`)
 *   so typing/adding lines NEVER snaps back to preview.
 * - Stays in Source mode until the user explicitly clicks the "Preview" pill or presses Escape.
 */

import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension
} from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view'
import { isInsideCodeFence } from '../../core/editor/useList'
import { useSettingStore } from '../../core/store/SettingStore'
import { extractYouTubeId, parseGridLinkLine, parseStandaloneLinkLine } from './urlParser'
import {
  applyLinkCardDomAttributes,
  LINK_CARDS_CONFIG_EVENT,
  resolveLinkCardSettings,
  type LinkCardColumns
} from './linkCardConfig'
import { LinkCardWidget } from './LinkCardWidget'
import { LinkGridWidget, type LinkGridItem } from './LinkGridWidget'
import { inlineLinkHoverExtension } from './linkHoverCard'
import './linkEmbed.css'

const refreshLinkCardsEffect = StateEffect.define<null>()
const openLinkSourceEffect = StateEffect.define<{ from: number; to: number }>()
const closeLinkSourceEffect = StateEffect.define<null>()

const sourceLineDeco = Decoration.line({ class: 'lumina-link-source-line' })

const LINKS_FENCE_OPEN_RE = /^`{3,}\s*(?:links?|links?-grid)(?:\s+(\d+))?\s*$/i
const FENCE_CLOSE_RE = /^`{3,}\s*$/

export function parseLinkGridHeader(lineText: string): {
  isGridOpen: boolean
  explicitCols?: LinkCardColumns
} {
  const match = lineText.trim().match(LINKS_FENCE_OPEN_RE)
  if (!match) return { isGridOpen: false }
  if (!match[1]) return { isGridOpen: true, explicitCols: undefined }
  const rawNum = parseInt(match[1], 10)
  const clamped = Math.min(3, Math.max(1, Number.isFinite(rawNum) ? rawNum : 1)) as LinkCardColumns
  return { isGridOpen: true, explicitCols: clamped }
}

class ExitSourcePillWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(view: EditorView): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'lumina-link-source-bar'
    bar.setAttribute('contenteditable', 'false')

    const label = document.createElement('span')
    label.className = 'lumina-link-source-hint'
    label.textContent = 'Source'
    bar.appendChild(label)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'lumina-link-source-done-btn'
    btn.textContent = 'Preview'
    btn.title = 'Return to link preview (Esc)'
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({ effects: closeLinkSourceEffect.of(null) })
    })
    bar.appendChild(btn)
    return bar
  }

  ignoreEvent(): boolean {
    return true
  }
}

const exitSourcePillDeco = Decoration.widget({
  widget: new ExitSourcePillWidget(),
  block: true,
  side: -1
})

interface SourceEditRange {
  from: number
  to: number
}

interface LinkEmbedState {
  sourceRange: SourceEditRange | null
  decorations: DecorationSet
}

function enterSourceForPositions(from: number, to: number) {
  return (view: EditorView, _pos: number) => {
    const docLen = view.state.doc.length
    const safeFrom = Math.min(Math.max(0, from), docLen)
    const safeTo = Math.min(Math.max(safeFrom, to), docLen)
    view.dispatch({
      effects: openLinkSourceEffect.of({ from: safeFrom, to: safeTo }),
      selection: { anchor: safeFrom },
      scrollIntoView: true
    })
    view.focus()
  }
}

function isRangeInSource(
  sourceRange: SourceEditRange | null,
  from: number,
  to: number
): boolean {
  if (!sourceRange) return false
  return from <= sourceRange.to && to >= sourceRange.from
}

function buildLinkEmbedDecorations(
  state: EditorState,
  sourceRange: SourceEditRange | null
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cfg = resolveLinkCardSettings(useSettingStore.getState().settings)
  if (!cfg.linkCardsEnabled) {
    return builder.finish()
  }

  const doc = state.doc
  let l = 1

  while (l <= doc.lines) {
    const line = doc.line(l)
    const header = parseLinkGridHeader(line.text)

    // 1. Explicit ```links [1|2|3|4] fenced grid block
    if (header.isGridOpen) {
      let endLineNum = -1
      const items: LinkGridItem[] = []
      for (let k = l + 1; k <= doc.lines; k++) {
        const inner = doc.line(k)
        if (FENCE_CLOSE_RE.test(inner.text.trim())) {
          endLineNum = k
          break
        }
        const parsed = parseGridLinkLine(inner.text)
        if (parsed) {
          items.push({ ...parsed, youtubeId: extractYouTubeId(parsed.url) })
        }
      }

      if (endLineNum !== -1 && items.length > 0) {
        const endLine = doc.line(endLineNum)
        if (isRangeInSource(sourceRange, line.from, endLine.to)) {
          builder.add(line.from, line.from, exitSourcePillDeco)
          for (let k = l; k <= endLineNum; k++) {
            const srcLine = doc.line(k)
            builder.add(srcLine.from, srcLine.from, sourceLineDeco)
          }
        } else {
          const cols: LinkCardColumns =
            header.explicitCols ??
            (Math.min(3, Math.max(1, items.length)) as LinkCardColumns)
          builder.add(
            line.from,
            endLine.to,
            Decoration.replace({
              widget: new LinkGridWidget(
                items,
                cols,
                line.from,
                enterSourceForPositions(line.from, endLine.to)
              ),
              block: true
            })
          )
        }
        l = endLineNum + 1
        continue
      }
    }

    // 2. Standalone bare URL line(s)
    if (!line.text.includes('http://') && !line.text.includes('https://')) {
      l++
      continue
    }
    if (isInsideCodeFence(state, line.from)) {
      l++
      continue
    }

    const parsed = parseStandaloneLinkLine(line.text)
    if (!parsed) {
      l++
      continue
    }

    // Group consecutive bare links into a side-by-side grid when Columns > 1 in Settings
    if (cfg.linkCardColumns > 1 && !isRangeInSource(sourceRange, line.from, line.to)) {
      const groupItems: LinkGridItem[] = [
        { ...parsed, youtubeId: extractYouTubeId(parsed.url) }
      ]
      let endL = l
      while (endL + 1 <= doc.lines) {
        const nextNum = endL + 1
        const nextLine = doc.line(nextNum)
        if (isRangeInSource(sourceRange, nextLine.from, nextLine.to)) break
        if (isInsideCodeFence(state, nextLine.from)) break
        const nextParsed = parseStandaloneLinkLine(nextLine.text)
        if (!nextParsed) break
        groupItems.push({ ...nextParsed, youtubeId: extractYouTubeId(nextParsed.url) })
        endL = nextNum
      }

      if (groupItems.length >= 2) {
        const cols = Math.min(cfg.linkCardColumns, groupItems.length) as LinkCardColumns
        const endLine = doc.line(endL)
        builder.add(
          line.from,
          endLine.to,
          Decoration.replace({
            widget: new LinkGridWidget(
              groupItems,
              cols,
              line.from,
              enterSourceForPositions(line.from, endLine.to)
            ),
            block: true
          })
        )
        l = endL + 1
        continue
      }
    }

    // Explicit Source mode (never auto-closes while editing!)
    if (isRangeInSource(sourceRange, line.from, line.to)) {
      builder.add(line.from, line.from, exitSourcePillDeco)
      builder.add(line.from, line.from, sourceLineDeco)
      l++
      continue
    }

    // Render standalone strip as a true `block: true` widget so no stray cursor appears on the right edge
    const ytId = extractYouTubeId(parsed.url)
    builder.add(
      line.from,
      line.to,
      Decoration.replace({
        widget: new LinkCardWidget(
          parsed.url,
          parsed.label,
          ytId,
          line.from,
          enterSourceForPositions(line.from, line.to)
        ),
        block: true
      })
    )
    l++
  }

  return builder.finish()
}

const linkEmbedField = StateField.define<LinkEmbedState>({
  create(state) {
    applyLinkCardDomAttributes(useSettingStore.getState().settings)
    return {
      sourceRange: null,
      decorations: buildLinkEmbedDecorations(state, null)
    }
  },
  update(prev, tr) {
    let sourceRange = prev.sourceRange
    let rangeChanged = false

    // Keep sourceRange accurately mapped across insertions/deletions so typing never snaps to preview
    if (sourceRange && tr.docChanged) {
      sourceRange = {
        from: tr.changes.mapPos(sourceRange.from, -1),
        to: tr.changes.mapPos(sourceRange.to, 1)
      }
    }

    for (const effect of tr.effects) {
      if (effect.is(openLinkSourceEffect)) {
        sourceRange = effect.value
        rangeChanged = true
      } else if (effect.is(closeLinkSourceEffect)) {
        if (sourceRange !== null) {
          sourceRange = null
          rangeChanged = true
        }
      }
    }

    const configChanged = tr.effects.some((e) => e.is(refreshLinkCardsEffect))
    if (tr.docChanged || rangeChanged || configChanged) {
      return {
        sourceRange,
        decorations: buildLinkEmbedDecorations(tr.state, sourceRange)
      }
    }

    return {
      sourceRange,
      decorations: prev.decorations.map(tr.changes)
    }
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations)
})

const linkEmbedConfigListener = ViewPlugin.fromClass(
  class {
    private readonly view: EditorView
    private readonly onConfigChange: () => void
    private readonly onKeyDown: (e: KeyboardEvent) => void

    constructor(view: EditorView) {
      this.view = view
      this.onConfigChange = () => {
        view.dispatch({ effects: refreshLinkCardsEffect.of(null) })
      }
      this.onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && view.state.field(linkEmbedField).sourceRange) {
          e.preventDefault()
          view.dispatch({ effects: closeLinkSourceEffect.of(null) })
        }
      }
      if (typeof window !== 'undefined') {
        window.addEventListener(LINK_CARDS_CONFIG_EVENT, this.onConfigChange)
      }
      view.contentDOM.addEventListener('keydown', this.onKeyDown)
    }

    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener(LINK_CARDS_CONFIG_EVENT, this.onConfigChange)
      }
      this.view.contentDOM.removeEventListener('keydown', this.onKeyDown)
    }
  }
)

export const linkEmbedExtension: Extension = [
  linkEmbedField,
  linkEmbedConfigListener,
  inlineLinkHoverExtension
]

export default linkEmbedExtension
