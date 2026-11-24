/**
 * Smart Inline Link Hover Card Popover (`linkHoverCard.ts`)
 *
 * When hovering any inline Markdown link (`[Google](url)`, `**[Google](url)**`, table links):
 * - Spawns a clean, flat, compact floating preview card confined STRICTLY inside the editor bounds.
 * - Smartly measures top/bottom/side gaps inside the editor and flips below or clamps horizontally.
 * - Supports hover bridge (move mouse into the card to Copy, Open, Peek image, or Play YouTube).
 */

import { syntaxTree } from '@codemirror/language'
import { EditorView, ViewPlugin } from '@codemirror/view'
import {
  detectLinkPlatform,
  extractDomain,
  extractYouTubeId,
  formatDisplayUrl,
  getYouTubeThumbnailUrl,
  isHttpUrl
} from './urlParser'
import { fetchLinkMetadata, getCachedLinkMetadata } from './linkMetadata'
import { createIconButton, LINK_ICONS, renderSiteIcon } from './linkIcons'
import {
  handleExternalLinkClick,
  openExternalUrl,
  openMediaPeekModal,
  openYouTubeModal
} from './mediaModal'

const OPEN_DELAY_MS = 180
const CLOSE_DELAY_MS = 170
const BOUNDS_GAP = 10
const ANCHOR_GAP = 6

export interface PopoverBounds {
  top: number
  bottom: number
  left: number
  right: number
}

interface ResolvedInlineLink {
  url: string
  label?: string
  anchorEl: HTMLElement
  cacheKey: string
}

export function computeSmartPopoverPosition(
  anchorRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width'>,
  popoverSize: { width: number; height: number },
  bounds: PopoverBounds | { width: number; height: number }
): { top: number; left: number; placement: 'top' | 'bottom' } {
  const b: PopoverBounds =
    'top' in bounds
      ? bounds
      : { top: 0, left: 0, right: bounds.width, bottom: bounds.height }

  const spaceAbove = anchorRect.top - (b.top + BOUNDS_GAP)
  const spaceBelow = b.bottom - BOUNDS_GAP - anchorRect.bottom

  const preferTop =
    spaceAbove >= popoverSize.height + ANCHOR_GAP || spaceAbove >= spaceBelow
  const placement: 'top' | 'bottom' = preferTop ? 'top' : 'bottom'

  let top =
    placement === 'top'
      ? anchorRect.top - popoverSize.height - ANCHOR_GAP
      : anchorRect.bottom + ANCHOR_GAP

  const minTop = b.top + BOUNDS_GAP
  const maxTop = Math.max(minTop, b.bottom - popoverSize.height - BOUNDS_GAP)
  top = Math.max(minTop, Math.min(top, maxTop))

  const idealLeft = anchorRect.left + anchorRect.width / 2 - popoverSize.width / 2
  const minLeft = b.left + BOUNDS_GAP
  const maxLeft = Math.max(minLeft, b.right - popoverSize.width - BOUNDS_GAP)
  const left = Math.max(minLeft, Math.min(idealLeft, maxLeft))

  return { top: Math.round(top), left: Math.round(left), placement }
}

function getEditorBounds(view: EditorView): PopoverBounds {
  const scroller = (view.dom.closest('.editor-scroller') || view.scrollDOM) as HTMLElement
  const scrollerRect = scroller.getBoundingClientRect()
  const contentRect = view.contentDOM.getBoundingClientRect()

  const left = Math.max(0, scrollerRect.left, contentRect.left)
  const right = Math.min(window.innerWidth, scrollerRect.right, contentRect.right)
  const top = Math.max(0, scrollerRect.top)
  const bottom = Math.min(window.innerHeight, scrollerRect.bottom)

  return {
    top,
    bottom: Math.max(top + 80, bottom),
    left,
    right: Math.max(left + 220, right)
  }
}

function resolveInlineLinkAtEvent(
  view: EditorView,
  event: MouseEvent
): ResolvedInlineLink | null {
  const target = event.target
  if (!(target instanceof HTMLElement)) return null
  if (!view.contentDOM.contains(target)) return null
  // Ignore standalone link cards/grids themselves
  if (target.closest('.lumina-link-card, .lumina-link-grid, .lumina-link-source-bar')) return null

  // 1. Links rendered inside Table cells (`.cm-atomic-table`)
  const tableEl = target.closest('.cm-atomic-table')
  if (tableEl && view.contentDOM.contains(tableEl)) {
    // Table cells render Markdown links as `<span class="cm-atomic-link-wrap" data-url="...">`
    const tableWrap = target.closest('.cm-atomic-link-wrap[data-url]') as HTMLElement | null
    if (tableWrap) {
      const rawUrl = (tableWrap.dataset.url || '').trim()
      if (isHttpUrl(rawUrl)) {
        const innerLabel = tableWrap.querySelector('.cm-atomic-link')?.textContent?.trim()
        const anchorEl = (tableWrap.querySelector('.cm-atomic-link') as HTMLElement | null) || tableWrap
        return { url: rawUrl, label: innerLabel || undefined, anchorEl, cacheKey: `table:${rawUrl}` }
      }
    }

    const tableAnchor = target.closest('a[href], [data-href]') as HTMLElement | null
    if (tableAnchor) {
      const rawHref = (
        tableAnchor.getAttribute('href') ||
        tableAnchor.getAttribute('data-href') ||
        ''
      ).trim()
      if (isHttpUrl(rawHref)) {
        const label = tableAnchor.textContent?.trim() || undefined
        return { url: rawHref, label, anchorEl: tableAnchor, cacheKey: `table:${rawHref}` }
      }
    }

    const cell = target.closest('td, th') as HTMLElement | null
    if (cell) {
      const cellText = cell.textContent?.trim() || ''
      if (/^https?:\/\/\S+$/i.test(cellText) && isHttpUrl(cellText)) {
        return { url: cellText, anchorEl: cell, cacheKey: `cell:${cellText}` }
      }
    }
    return null
  }

  // 2. Inline Markdown links — works for `[Google](url)`, `**[Google](url)**`, `*italic*`, etc.
  const directLinkEl = target.closest('.cm-atomic-link') as HTMLElement | null
  let pos: number | null = null

  if (directLinkEl && view.contentDOM.contains(directLinkEl)) {
    try {
      pos = view.posAtDOM(directLinkEl)
    } catch {
      pos = null
    }
  } else {
    pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  }

  if (pos === null || pos < 0) return null

  const tree = syntaxTree(view.state)
  let node: any = tree.resolveInner(pos, 1)

  // Walk up syntax tree: abort if inside inline/fenced code, stop at Link or URL
  while (node) {
    if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'CodeBlock') {
      return null
    }
    if (node.name === 'Link' || node.name === 'URL') {
      break
    }
    node = node.parent
  }
  if (!node) return null

  let url = ''
  if (node.name === 'URL') {
    url = view.state.doc.sliceString(node.from, node.to)
  } else {
    const urlNode = node.getChild('URL')
    if (!urlNode) return null
    url = view.state.doc.sliceString(urlNode.from, urlNode.to)
  }

  url = url.trim()
  if (!isHttpUrl(url)) return null

  const anchorEl = directLinkEl || target
  const label = (directLinkEl?.textContent || target.textContent || '').trim() || undefined
  return { url, label, anchorEl, cacheKey: `pos:${node.from}:${url}` }
}

class InlineLinkHoverController {
  private popoverEl: HTMLElement | null = null
  private activeAnchor: HTMLElement | null = null
  private activeKey: string | null = null
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private readonly view: EditorView

  constructor(view: EditorView) {
    this.view = view
    this.view.contentDOM.addEventListener('mouseover', this.onMouseOver)
    this.view.contentDOM.addEventListener('mouseout', this.onMouseOut)
    this.view.scrollDOM.addEventListener('scroll', this.dismissImmediate, { passive: true })
    window.addEventListener('keydown', this.onKeyDown, true)
  }

  private clearTimers() {
    if (this.openTimer) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
    if (this.closeTimer) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.popoverEl) {
      this.dismissImmediate()
    }
  }

  private onMouseOver = (e: MouseEvent) => {
    const resolved = resolveInlineLinkAtEvent(this.view, e)
    if (!resolved) return

    if (this.closeTimer) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    if (this.activeKey === resolved.cacheKey && this.popoverEl) return

    if (this.openTimer) clearTimeout(this.openTimer)
    this.openTimer = setTimeout(() => {
      if (!resolved.anchorEl.isConnected) return
      this.showPopover(resolved)
    }, OPEN_DELAY_MS)
  }

  private onMouseOut = (e: MouseEvent) => {
    if (!this.activeAnchor && !this.openTimer) return
    const next = e.relatedTarget as Node | null
    if (next && (this.activeAnchor?.contains(next) || this.popoverEl?.contains(next))) {
      return
    }
    if (this.openTimer) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
    this.scheduleClose()
  }

  private scheduleClose = () => {
    if (this.closeTimer) clearTimeout(this.closeTimer)
    this.closeTimer = setTimeout(() => {
      this.dismissImmediate()
    }, CLOSE_DELAY_MS)
  }

  private dismissImmediate = () => {
    this.clearTimers()
    this.activeAnchor = null
    this.activeKey = null
    if (this.popoverEl) {
      this.popoverEl.remove()
      this.popoverEl = null
    }
  }

  private positionActivePopover() {
    if (!this.popoverEl || !this.activeAnchor || !this.activeAnchor.isConnected) return
    const bounds = getEditorBounds(this.view)
    const availWidth = Math.max(200, bounds.right - bounds.left - BOUNDS_GAP * 2)
    this.popoverEl.style.maxWidth = `${Math.min(304, availWidth)}px`

    const anchorRect = this.activeAnchor.getBoundingClientRect()
    const popRect = this.popoverEl.getBoundingClientRect()
    const pos = computeSmartPopoverPosition(
      anchorRect,
      { width: Math.min(popRect.width || 304, availWidth), height: popRect.height || 84 },
      bounds
    )
    this.popoverEl.style.top = `${pos.top}px`
    this.popoverEl.style.left = `${pos.left}px`
    this.popoverEl.setAttribute('data-placement', pos.placement)
  }

  private showPopover(resolved: ResolvedInlineLink) {
    this.dismissImmediate()
    this.activeAnchor = resolved.anchorEl
    this.activeKey = resolved.cacheKey

    const { url, label } = resolved
    const platform = detectLinkPlatform(url)
    const domain = extractDomain(url)
    const ytId = extractYouTubeId(url)
    const cached = getCachedLinkMetadata(url)

    const pop = document.createElement('div')
    pop.className = 'lumina-link-popover'
    pop.style.setProperty('--link-accent', platform.accent)
    pop.setAttribute('role', 'tooltip')

    let currentImageUrl: string | null = cached?.image || null

    // Left text block
    const body = document.createElement('div')
    body.className = 'lumina-link-popover-body'

    const titleEl = document.createElement('div')
    titleEl.className = 'lumina-link-popover-title'
    titleEl.textContent = cached?.title || label || (ytId ? 'YouTube Video' : domain)
    body.appendChild(titleEl)

    const descEl = document.createElement('div')
    descEl.className = 'lumina-link-popover-desc'
    descEl.textContent =
      cached?.description ||
      (ytId ? 'Click to watch in cinema player' : formatDisplayUrl(url, 56))
    body.appendChild(descEl)

    const footer = document.createElement('div')
    footer.className = 'lumina-link-popover-footer'

    const meta = document.createElement('div')
    meta.className = 'lumina-link-popover-meta'

    const iconSlot = document.createElement('span')
    iconSlot.className = 'lumina-link-card-icon-slot'
    const setIcon = (faviconUrl?: string | null) => {
      renderSiteIcon(iconSlot, url, ytId ? 'youtube' : platform.id, faviconUrl)
    }
    setIcon(cached?.favicon)
    meta.appendChild(iconSlot)

    const sourceEl = document.createElement('span')
    sourceEl.className = 'lumina-link-popover-source'
    sourceEl.textContent = ytId
      ? cached?.author || 'YouTube'
      : cached?.site_name || (platform.id !== 'web' ? platform.label : domain)
    meta.appendChild(sourceEl)
    footer.appendChild(meta)

    const actions = document.createElement('div')
    actions.className = 'lumina-link-popover-actions'

    const copyBtn = createIconButton('lumina-link-card-action', LINK_ICONS.copy, 'Copy URL', () => {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(url).then(() => {
          copyBtn.innerHTML = LINK_ICONS.check
          copyBtn.classList.add('is-copied')
          setTimeout(() => {
            if (copyBtn.isConnected) {
              copyBtn.innerHTML = LINK_ICONS.copy
              copyBtn.classList.remove('is-copied')
            }
          }, 1200)
        })
      }
    })
    const openBtn = createIconButton(
      'lumina-link-card-action',
      LINK_ICONS.external,
      'Open link',
      () => {
        this.dismissImmediate()
        openExternalUrl(url)
      }
    )
    actions.appendChild(copyBtn)
    actions.appendChild(openBtn)
    footer.appendChild(actions)

    body.appendChild(footer)
    body.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.dismissImmediate()
      handleExternalLinkClick(url, titleEl.textContent || undefined)
    })
    pop.appendChild(body)

    // Compact right-aligned thumbnail (flat, clean, never bloated)
    const mediaWrap = document.createElement('div')
    mediaWrap.className = ytId
      ? 'lumina-link-popover-media is-yt'
      : 'lumina-link-popover-media'

    const attachImage = (imgUrl: string) => {
      if (mediaWrap.childElementCount > 0) return
      currentImageUrl = imgUrl
      const img = document.createElement('img')
      img.src = imgUrl
      img.alt = ''
      img.onload = () => this.positionActivePopover()
      img.onerror = () => {
        mediaWrap.remove()
        currentImageUrl = null
        this.positionActivePopover()
      }
      mediaWrap.appendChild(img)

      if (ytId) {
        const play = document.createElement('span')
        play.className = 'lumina-yt-play-badge'
        play.innerHTML = LINK_ICONS.play
        mediaWrap.appendChild(play)
        mediaWrap.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          this.dismissImmediate()
          openYouTubeModal(url, titleEl.textContent || undefined)
        })
      } else {
        const peek = document.createElement('span')
        peek.className = 'lumina-media-peek-badge'
        peek.innerHTML = LINK_ICONS.peek
        mediaWrap.appendChild(peek)
        mediaWrap.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          if (currentImageUrl) {
            this.dismissImmediate()
            openMediaPeekModal({
              imageUrl: currentImageUrl,
              url,
              title: titleEl.textContent || undefined,
              subtitle: sourceEl.textContent || domain
            })
          }
        })
      }
      pop.appendChild(mediaWrap)
      this.positionActivePopover()
    }

    if (ytId) {
      attachImage(getYouTubeThumbnailUrl(ytId))
    } else if (cached?.image) {
      attachImage(cached.image)
    }

    pop.addEventListener('mouseenter', () => {
      if (this.closeTimer) {
        clearTimeout(this.closeTimer)
        this.closeTimer = null
      }
    })
    pop.addEventListener('mouseleave', (e) => {
      const next = e.relatedTarget as Node | null
      if (next && this.activeAnchor?.contains(next)) return
      this.scheduleClose()
    })

    document.body.appendChild(pop)
    this.popoverEl = pop
    this.positionActivePopover()
    requestAnimationFrame(() => pop.classList.add('show'))

    if (!cached) {
      void fetchLinkMetadata(url).then((metaRes) => {
        if (!pop.isConnected) return
        if (metaRes.title) titleEl.textContent = metaRes.title
        if (metaRes.description && !ytId) descEl.textContent = metaRes.description
        if (metaRes.author || metaRes.site_name) {
          sourceEl.textContent = ytId
            ? metaRes.author || 'YouTube'
            : metaRes.site_name || metaRes.author || domain
        }
        if (metaRes.favicon && !ytId) setIcon(metaRes.favicon)
        if (metaRes.image && !ytId) attachImage(metaRes.image)
        this.positionActivePopover()
      })
    }
  }

  destroy() {
    this.dismissImmediate()
    this.view.contentDOM.removeEventListener('mouseover', this.onMouseOver)
    this.view.contentDOM.removeEventListener('mouseout', this.onMouseOut)
    this.view.scrollDOM.removeEventListener('scroll', this.dismissImmediate)
    window.removeEventListener('keydown', this.onKeyDown, true)
  }
}

export const inlineLinkHoverExtension = ViewPlugin.fromClass(InlineLinkHoverController)
