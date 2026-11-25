/**
 * Unified Flat Link & YouTube Card Builder + CodeMirror Widget (`LinkCardWidget.ts`)
 *
 * `createLinkCardElement()` is shared by BOTH standalone pasted URLs (`LinkCardWidget`)
 * AND multi-column ` ```links ` grids (`LinkGridWidget`) so every link card looks 100% identical.
 */

import { EditorView, WidgetType } from '@codemirror/view'
import { useSettingStore } from '../../core/store/SettingStore'
import {
  detectLinkPlatform,
  extractDomain,
  formatDisplayUrl,
  formatHostnameTitle,
  getYouTubeFallbackThumbnailUrl,
  getYouTubeThumbnailUrl,
  normalizeLinkTitle,
  normalizeSiteName,
  resolveLinkDescription
} from './urlParser'
import { fetchLinkMetadata, getCachedLinkMetadata } from './linkMetadata'
import { resolveLinkCardSettings } from './linkCardConfig'
import { createIconButton, LINK_ICONS, renderSiteIcon } from './linkIcons'
import {
  handleExternalLinkClick,
  openMediaPeekModal,
  openYouTubeModal
} from './mediaModal'
import { createLinkWrapperElement } from './LinkWrapper'

function resolveWidgetHeight(): number {
  const cfg = resolveLinkCardSettings(useSettingStore.getState().settings)
  if (cfg.linkCardStyle === 'minimal') return 36
  if (cfg.linkCardStyle === 'card') return 90
  if (!cfg.linkCardShowDescription) return 54
  if (cfg.linkCardSize === 'compact') return 60
  if (cfg.linkCardSize === 'large') return 94
  return 78
}

export interface CreateLinkCardOptions {
  url: string
  label?: string
  youtubeId: string | null
  onEdit?: () => void
  onDelete?: () => void
  inGrid?: boolean
}

/**
 * Shared DRY DOM factory for both standalone pasted links and ```links grid items.
 */
export function createLinkCardElement(opts: CreateLinkCardOptions): HTMLElement {
  const { url, label, youtubeId, onEdit, onDelete, inGrid } = opts
  const platform = detectLinkPlatform(url)
  const domain = extractDomain(url)
  const cached = getCachedLinkMetadata(url)

  const card = document.createElement('div')
  card.className = [
    'lumina-link-card',
    youtubeId ? 'is-youtube' : `is-website is-platform-${platform.id}`,
    inGrid ? 'is-in-grid' : ''
  ]
    .filter(Boolean)
    .join(' ')
  card.setAttribute('contenteditable', 'false')
  card.setAttribute('role', 'button')
  card.setAttribute('tabindex', '0')
  card.setAttribute('aria-label', formatDisplayUrl(url, 120))
  card.dataset.url = url

  let currentImageUrl: string | null = cached?.image || null

  // ── Left Content Column (Clean 3-tier editorial layout matching hover popover) ──
  const body = document.createElement('div')
  body.className = 'lumina-link-card-body'

  const titleEl = document.createElement('div')
  titleEl.className = 'lumina-link-card-title'
  const resolveTitle = (rawTitle?: string | null) => {
    if (label && label.trim()) return label.trim()
    if (rawTitle && rawTitle.trim()) return normalizeLinkTitle(rawTitle, url)
    return youtubeId ? 'YouTube Video' : formatHostnameTitle(url)
  }
  const initialTitle = resolveTitle(cached?.title)
  titleEl.textContent = initialTitle
  card.dataset.title = initialTitle
  body.appendChild(titleEl)

  const descEl = document.createElement('div')
  descEl.className = 'lumina-link-card-desc'
  body.appendChild(descEl)

  // Bottom footer row: [Favicon + Source/Domain] on left, [Actions] on right
  const footer = document.createElement('div')
  footer.className = 'lumina-link-card-footer'

  const metaWrap = document.createElement('div')
  metaWrap.className = 'lumina-link-card-meta'

  const iconSlot = document.createElement('span')
  iconSlot.className = 'lumina-link-card-icon-slot'
  const setIcon = (faviconUrl?: string | null) => {
    renderSiteIcon(iconSlot, url, youtubeId ? 'youtube' : platform.id, faviconUrl)
  }
  setIcon(cached?.favicon)
  metaWrap.appendChild(iconSlot)

  const sourceTag = document.createElement('span')
  sourceTag.className = 'lumina-link-card-source'
  const buildSourceText = (site?: string | null, author?: string | null) => {
    if (youtubeId) {
      return (author && author.trim()) || 'YouTube'
    }
    return normalizeSiteName(site, url)
  }
  const updateSourceDisplay = (_titleText: string, site?: string | null, author?: string | null) => {
    const nextSource = buildSourceText(site, author)
    sourceTag.textContent = nextSource
    return nextSource
  }
  const initialSource = updateSourceDisplay(initialTitle, cached?.site_name, cached?.author)
  metaWrap.appendChild(sourceTag)
  footer.appendChild(metaWrap)

  // Inline hover actions
  const actions = document.createElement('div')
  actions.className = 'lumina-link-card-actions'

  const peekBtn = createIconButton('lumina-link-card-action', LINK_ICONS.peek, 'Quick peek preview', () => {
    if (youtubeId) {
      openYouTubeModal(url, titleEl.textContent || undefined)
    } else if (currentImageUrl) {
      openMediaPeekModal({
        imageUrl: currentImageUrl,
        url,
        title: titleEl.textContent || undefined,
        subtitle: sourceTag.textContent || domain
      })
    }
  })
  peekBtn.style.display = youtubeId || currentImageUrl ? '' : 'none'

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
        }, 1300)
      })
    }
  })

  const retryBtn = createIconButton(
    'lumina-link-card-action',
    LINK_ICONS.refresh,
    'Retry loading preview',
    () => {
      void runFetch(true)
    }
  )
  retryBtn.style.display = cached?.failed ? '' : 'none'

  actions.appendChild(retryBtn)
  actions.appendChild(peekBtn)
  actions.appendChild(copyBtn)

  if (onDelete) {
    const deleteBtn = createIconButton(
      'lumina-link-card-action is-delete',
      LINK_ICONS.trash,
      'Delete link',
      onDelete
    )
    actions.appendChild(deleteBtn)
  }

  if (onEdit) {
    const editBtn = createIconButton(
      'lumina-link-card-action',
      LINK_ICONS.edit,
      'Edit source URL',
      onEdit
    )
    actions.appendChild(editBtn)
  }

  footer.appendChild(actions)
  body.appendChild(footer)

  const updateDescDisplay = (
    rawDesc: string | null | undefined,
    titleText: string,
    sourceText: string,
    author?: string | null
  ) => {
    if (youtubeId) {
      descEl.textContent = author
        ? `${author} · Watch in borderless cinema player`
        : 'Click to watch in borderless cinema player'
      descEl.style.display = ''
      card.classList.remove('is-single-line')
      return
    }
    const resolved = resolveLinkDescription(rawDesc, titleText, sourceText, url)
    if (resolved) {
      descEl.textContent = resolved
      descEl.style.display = ''
      card.classList.remove('is-single-line')
    } else {
      descEl.textContent = ''
      descEl.style.display = 'none'
      card.classList.add('is-single-line')
    }
  }
  updateDescDisplay(cached?.description, initialTitle, initialSource, cached?.author)
  card.appendChild(body)

  // ── Right Column: Compact Edge-to-Edge Thumbnail ──
  const mediaSlot = document.createElement('div')
  mediaSlot.className = youtubeId
    ? 'lumina-link-card-media is-yt-media'
    : 'lumina-link-card-media is-og-media'

  const attachOgImage = (imgUrl: string) => {
    if (mediaSlot.childElementCount > 0) return
    currentImageUrl = imgUrl
    peekBtn.style.display = ''

    const ogImg = document.createElement('img')
    ogImg.src = imgUrl
    ogImg.alt = ''
    ogImg.decoding = 'async'
    ogImg.loading = 'lazy'
    ogImg.onerror = () => {
      mediaSlot.remove()
      card.classList.remove('has-media')
      currentImageUrl = null
      peekBtn.style.display = 'none'
    }
    mediaSlot.appendChild(ogImg)

    const peekHint = document.createElement('span')
    peekHint.className = 'lumina-media-peek-badge'
    peekHint.innerHTML = LINK_ICONS.peek
    mediaSlot.appendChild(peekHint)

    mediaSlot.setAttribute('data-tooltip', 'Click to peek image')
    mediaSlot.setAttribute('data-tooltip-pos', 'top')
    mediaSlot.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (currentImageUrl) {
        openMediaPeekModal({
          imageUrl: currentImageUrl,
          url,
          title: titleEl.textContent || undefined,
          subtitle: sourceTag.textContent || domain
        })
      }
    })

    card.appendChild(mediaSlot)
    card.classList.add('has-media')
  }

  if (youtubeId) {
    const img = document.createElement('img')
    img.src = getYouTubeThumbnailUrl(youtubeId)
    img.alt = label || 'YouTube thumbnail'
    img.decoding = 'async'
    img.loading = 'lazy'
    let triedMqFallback = false
    const fallbackToMq = () => {
      if (!triedMqFallback) {
        triedMqFallback = true
        img.src = getYouTubeFallbackThumbnailUrl(youtubeId)
      } else {
        img.remove()
      }
    }
    // YouTube returns a 120x90 gray placeholder when maxresdefault is unavailable
    img.onload = () => {
      if (!triedMqFallback && img.naturalWidth > 0 && img.naturalWidth <= 120) {
        fallbackToMq()
      }
    }
    img.onerror = fallbackToMq
    mediaSlot.appendChild(img)

    const playBadge = document.createElement('span')
    playBadge.className = 'lumina-yt-play-badge'
    playBadge.innerHTML = LINK_ICONS.play
    mediaSlot.appendChild(playBadge)

    card.appendChild(mediaSlot)
    card.classList.add('has-media')
  } else if (cached?.image) {
    attachOgImage(cached.image)
  }

  // Distinguish click vs mouse-drag selection
  let downX = 0
  let downY = 0
  let wasDrag = false
  card.addEventListener('mousedown', (e) => {
    downX = e.clientX
    downY = e.clientY
    wasDrag = false
  })
  card.addEventListener('mouseup', (e) => {
    wasDrag = Math.hypot(e.clientX - downX, e.clientY - downY) > 4
  })

  const activate = (e: Event) => {
    if (e instanceof MouseEvent && (e.button !== 0 || e.ctrlKey || e.metaKey)) {
      return
    }
    if (wasDrag) {
      wasDrag = false
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const cfg = resolveLinkCardSettings(useSettingStore.getState().settings)
    if (youtubeId && cfg.youtubeOpenInModal) {
      openYouTubeModal(url, titleEl.textContent || undefined)
    } else {
      handleExternalLinkClick(url, titleEl.textContent || undefined)
    }
  }

  card.addEventListener('click', activate)
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') activate(e)
  })

  const applyMeta = (meta: {
    title?: string | null
    description?: string | null
    image?: string | null
    favicon?: string | null
    site_name?: string | null
    author?: string | null
    failed?: boolean
  }) => {
    if (!card.isConnected) return
    const nextTitle = resolveTitle(meta.title)
    titleEl.textContent = nextTitle
    card.dataset.title = nextTitle
    const nextSource = updateSourceDisplay(nextTitle, meta.site_name, meta.author)
    updateDescDisplay(meta.description, nextTitle, nextSource, meta.author)
    if (meta.favicon && !youtubeId) setIcon(meta.favicon)
    if (meta.image && !youtubeId) attachOgImage(meta.image)
    retryBtn.style.display = meta.failed ? '' : 'none'
  }

  const runFetch = async (forceRefresh = false) => {
    card.classList.add('is-loading')
    retryBtn.style.display = 'none'
    try {
      const meta = await fetchLinkMetadata(url, { forceRefresh })
      applyMeta(meta)
    } finally {
      if (card.isConnected) {
        card.classList.remove('is-loading')
      }
    }
  }

  if (!cached) {
    void runFetch(false)
  }

  return card
}

export class LinkCardWidget extends WidgetType {
  readonly url: string
  readonly label?: string
  readonly youtubeId: string | null
  readonly lineFrom: number
  readonly onEnterSource: (view: EditorView, pos: number) => void

  constructor(
    url: string,
    label: string | undefined,
    youtubeId: string | null,
    lineFrom: number,
    onEnterSource: (view: EditorView, pos: number) => void
  ) {
    super()
    this.url = url
    this.label = label
    this.youtubeId = youtubeId
    this.lineFrom = lineFrom
    this.onEnterSource = onEnterSource
  }

  get estimatedHeight(): number {
    return resolveWidgetHeight()
  }

  eq(other: LinkCardWidget): boolean {
    return (
      other.url === this.url &&
      other.label === this.label &&
      other.youtubeId === this.youtubeId
    )
  }

  toDOM(view: EditorView): HTMLElement {
    let wrapEl: HTMLElement
    wrapEl = createLinkWrapperElement({
      items: [{ url: this.url, label: this.label, youtubeId: this.youtubeId }],
      columns: 1,
      onEdit: () => {
        let targetPos = this.lineFrom
        try {
          const pos = view.posAtDOM(wrapEl)
          if (typeof pos === 'number' && pos >= 0) targetPos = pos
        } catch {
          // Fallback to constructor lineFrom
        }
        this.onEnterSource(view, Math.min(targetPos, view.state.doc.length))
      }
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
      event.type === 'selectstart'
    ) {
      return false
    }
    return true
  }
}
