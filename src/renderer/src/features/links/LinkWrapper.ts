/**
 * Unified Link Preview Wrapper (`LinkWrapper.ts`)
 *
 * Single source of truth for rendering BOTH standalone bare URLs
 * (`https://www.youtube.com/watch?v=...`) AND fenced ` ```links ` blocks
 * so they always produce the exact same preview layout, spacing, and controls.
 *
 * Completely independent from code block wrappers (`codeBlockHeader.ts` / `codeWrapper.css`).
 */

import { EditorView, WidgetType } from '@codemirror/view'
import type { StandaloneLinkMatch } from './urlParser'
import type { LinkCardColumns } from './linkCardConfig'
import { createIconButton, LINK_ICONS } from './linkIcons'
import { createLinkCardElement } from './LinkCardWidget'
import './linkWrapper.css'

export interface LinkWrapperItem extends StandaloneLinkMatch {
  youtubeId: string | null
}

export interface CreateLinkWrapperOptions {
  items: LinkWrapperItem[]
  columns: LinkCardColumns
  onEdit?: () => void
  onDeleteItem?: (index: number) => void
}

/**
 * Pure DOM factory for the unified link preview wrapper.
 * Used identically for single standalone URLs (1-column) and multi-link grids (1–3 columns).
 */
export function createLinkWrapperElement(opts: CreateLinkWrapperOptions): HTMLElement {
  const { items, columns, onEdit, onDeleteItem } = opts

  const wrap = document.createElement('div')
  wrap.className = `lumina-link-wrapper lumina-link-grid cols-${columns}`
  wrap.setAttribute('contenteditable', 'false')

  if (onEdit) {
    const editBtn = createIconButton(
      'lumina-link-wrapper-edit lumina-link-grid-edit',
      LINK_ICONS.edit,
      'Edit source links',
      onEdit
    )
    wrap.appendChild(editBtn)
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const card = createLinkCardElement({
      url: item.url,
      label: item.label,
      youtubeId: item.youtubeId,
      onDelete: onDeleteItem ? () => onDeleteItem(i) : undefined,
      inGrid: true
    })
    // If a 2-column grid has an odd number of links (e.g. 3 links), span the last card cleanly across both columns
    if (columns === 2 && items.length % 2 === 1 && i === items.length - 1) {
      card.classList.add('is-grid-span-full')
    }
    wrap.appendChild(card)
  }

  return wrap
}

/**
 * CodeMirror 6 block widget wrapping one or more link preview cards in the unified `LinkWrapper`.
 */
export class LinkWrapperWidget extends WidgetType {
  readonly items: LinkWrapperItem[]
  readonly columns: LinkCardColumns
  readonly blockFrom: number
  readonly blockTo: number
  readonly onEnterSource: (view: EditorView, pos: number) => void
  readonly onDeleteItem?: (view: EditorView, itemIndex: number, from: number, to: number) => void

  constructor(
    items: LinkWrapperItem[],
    columns: LinkCardColumns,
    blockFrom: number,
    blockTo: number,
    onEnterSource: (view: EditorView, pos: number) => void,
    onDeleteItem?: (view: EditorView, itemIndex: number, from: number, to: number) => void
  ) {
    super()
    this.items = items
    this.columns = columns
    this.blockFrom = blockFrom
    this.blockTo = blockTo
    this.onEnterSource = onEnterSource
    this.onDeleteItem = onDeleteItem
  }

  get estimatedHeight(): number {
    const rows = Math.ceil(this.items.length / this.columns)
    return rows * 86
  }

  eq(other: LinkWrapperWidget): boolean {
    if (other.columns !== this.columns || other.items.length !== this.items.length) return false
    return this.items.every(
      (it, idx) =>
        it.url === other.items[idx].url &&
        it.label === other.items[idx].label &&
        it.youtubeId === other.items[idx].youtubeId
    )
  }

  private resolveLiveRange(view: EditorView, wrapEl: HTMLElement): { from: number; to: number } {
    const docLen = view.state.doc.length
    const span = Math.max(0, this.blockTo - this.blockFrom)
    let from = Math.min(Math.max(0, this.blockFrom), docLen)
    try {
      const domPos = view.posAtDOM(wrapEl)
      if (typeof domPos === 'number' && domPos >= 0) {
        from = Math.min(domPos, docLen)
      }
    } catch {
      // Fallback to constructor blockFrom
    }
    const to = Math.min(docLen, Math.max(from, from + span))
    return { from, to }
  }

  private selectBlockInEditor(view: EditorView, wrapEl: HTMLElement): void {
    const { from, to } = this.resolveLiveRange(view, wrapEl)
    const sel = view.state.selection.main
    // Preserve an existing larger selection that already covers this link block
    if (!sel.empty && sel.from <= from && sel.to >= to) {
      return
    }
    view.dispatch({
      selection: { anchor: from, head: to }
    })
    view.focus()
  }

  toDOM(view: EditorView): HTMLElement {
    let wrapEl: HTMLElement
    wrapEl = createLinkWrapperElement({
      items: this.items,
      columns: this.columns,
      onEdit: () => {
        const { from } = this.resolveLiveRange(view, wrapEl)
        this.onEnterSource(view, from)
      },
      onDeleteItem: this.onDeleteItem
        ? (itemIndex: number) => {
            const { from, to } = this.resolveLiveRange(view, wrapEl)
            this.onDeleteItem?.(view, itemIndex, from, to)
          }
        : undefined
    })

    wrapEl.dataset.linkBlockFrom = String(this.blockFrom)
    wrapEl.dataset.linkBlockTo = String(this.blockTo)

    // Right-click (Windows/Linux) or Ctrl+Click (macOS): select the link block in CodeMirror
    // so Cut / Copy / Ask Lumina in the context menu immediately work on the link source.
    wrapEl.addEventListener('contextmenu', () => {
      this.selectBlockInEditor(view, wrapEl)
    })

    // Left-button drag across the card selects the link block cleanly instead of opening it
    let dragStartX = 0
    let dragStartY = 0
    let trackingDrag = false
    wrapEl.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('button')) return
      if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
        this.selectBlockInEditor(view, wrapEl)
        return
      }
      if (e.button === 0) {
        dragStartX = e.clientX
        dragStartY = e.clientY
        trackingDrag = true
      }
    })
    wrapEl.addEventListener('mousemove', (e: MouseEvent) => {
      if (!trackingDrag || (e.buttons & 1) === 0) {
        trackingDrag = false
        return
      }
      if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 6) {
        trackingDrag = false
        this.selectBlockInEditor(view, wrapEl)
      }
    })
    wrapEl.addEventListener('mouseup', () => {
      trackingDrag = false
    })

    return wrapEl
  }

  ignoreEvent(event: Event): boolean {
    const target = event.target as HTMLElement | null
    if (target?.closest('button')) return true
    if (
      event.type === 'mousedown' ||
      event.type === 'mousemove' ||
      event.type === 'mouseup' ||
      event.type === 'selectstart' ||
      event.type === 'contextmenu'
    ) {
      return false
    }
    return true
  }
}
