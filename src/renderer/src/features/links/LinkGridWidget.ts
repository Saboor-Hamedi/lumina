/**
 * CodeMirror 6 Multi-Column Link Grid Widget (`LinkGridWidget.ts`)
 *
 * Uses the exact same `createLinkCardElement()` as standalone pasted links so
 * ```links [1|2|3] cards and pasted links share 100% identical flat UI (zero duplication).
 */

import { EditorView, WidgetType } from '@codemirror/view'
import type { StandaloneLinkMatch } from './urlParser'
import type { LinkCardColumns } from './linkCardConfig'
import { createIconButton, LINK_ICONS } from './linkIcons'
import { createLinkCardElement } from './LinkCardWidget'

export interface LinkGridItem extends StandaloneLinkMatch {
  youtubeId: string | null
}

export class LinkGridWidget extends WidgetType {
  readonly items: LinkGridItem[]
  readonly columns: LinkCardColumns
  readonly blockFrom: number
  readonly onEnterSource: (view: EditorView, pos: number) => void

  constructor(
    items: LinkGridItem[],
    columns: LinkCardColumns,
    blockFrom: number,
    onEnterSource: (view: EditorView, pos: number) => void
  ) {
    super()
    this.items = items
    this.columns = columns
    this.blockFrom = blockFrom
    this.onEnterSource = onEnterSource
  }

  get estimatedHeight(): number {
    const rows = Math.ceil(this.items.length / this.columns)
    return rows * 52
  }

  eq(other: LinkGridWidget): boolean {
    if (other.columns !== this.columns || other.items.length !== this.items.length) return false
    return this.items.every(
      (it, idx) => it.url === other.items[idx].url && it.label === other.items[idx].label
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = `lumina-link-grid cols-${this.columns}`
    wrap.setAttribute('contenteditable', 'false')

    const editBtn = createIconButton('lumina-link-grid-edit', LINK_ICONS.edit, 'Edit source links', () => {
      this.onEnterSource(view, Math.min(this.blockFrom, view.state.doc.length))
    })
    wrap.appendChild(editBtn)

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]
      const card = createLinkCardElement({
        url: item.url,
        label: item.label,
        youtubeId: item.youtubeId,
        inGrid: true
      })
      // If a 2-column grid has an odd number of links (e.g. 3 links), span the last card cleanly across both columns
      if (this.columns === 2 && this.items.length % 2 === 1 && i === this.items.length - 1) {
        card.classList.add('is-grid-span-full')
      }
      wrap.appendChild(card)
    }

    return wrap
  }

  ignoreEvent(event: Event): boolean {
    const target = event.target as HTMLElement | null
    if (target?.closest('button')) return true
    if (
      event.type === 'mousedown' ||
      event.type === 'mousemove' ||
      event.type === 'mouseup' ||
      event.type === 'selectstart'
    ) {
      return false
    }
    return true
  }
}
