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
  getYouTubeThumbnailUrl
} from './urlParser'
import { fetchLinkMetadata, getCachedLinkMetadata } from './linkMetadata'
import { resolveLinkCardSettings } from './linkCardConfig'
import { createIconButton, LINK_ICONS, renderSiteIcon } from './linkIcons'
import {
  handleExternalLinkClick,
  openExternalUrl,
  openMediaPeekModal,
  openYouTubeModal
} from './mediaModal'

function resolveWidgetHeight(): number {
  const cfg = resolveLinkCardSettings(useSettingStore.getState().settings)
  if (cfg.linkCardStyle === 'minimal') return 30
  if (cfg.linkCardStyle === 'card') return 72
  if (!cfg.linkCardShowDescription) return 34
  if (cfg.linkCardSize === 'compact') return 36
  if (cfg.linkCardSize === 'large') return 54
  return 44
}

export interface CreateLinkCardOptions {
  url: string
  label?: string
  youtubeId: string | null
  onEdit?: () => void
  inGrid?: boolean
}

/**
 * Shared DRY DOM factory for both standalone pasted links and ```links grid items.
 */
export function createLinkCardElement(opts: CreateLinkCardOptions): HTMLElement {
  const { url, label, youtubeId, onEdit, inGrid } = opts
  const platform = detectLinkPlatform(url)
  const domain = extractDomain(url)
  const displayPath = formatDisplayUrl(url, 68)
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
  card.title = formatDisplayUrl(url, 120)

  let currentImageUrl: string | null = cached?.image || null

  // ── Left Content Column ──
  const body = document.createElement('div')
  body.className = 'lumina-link-card-body'

  const topRow = document.createElement('div')
  topRow.className = 'lumina-link-card-top'

  const iconSlot = document.createElement('span')
  iconSlot.className = 'lumina-link-card-icon-slot'
  const setIcon = (faviconUrl?: string | null) => {
    renderSiteIcon(iconSlot, url, youtubeId ? 'youtube' : platform.id, faviconUrl)
  }
  setIcon(cached?.favicon)
  topRow.appendChild(iconSlot)

  const titleEl = document.createElement('span')
  titleEl.className = 'lumina-link-card-title'
  titleEl.textContent =
    label ||
    cached?.title ||
    (youtubeId ? 'YouTube Video' : platform.id !== 'web' ? platform.label : domain)
  topRow.appendChild(titleEl)

  const sourceTag = document.createElement('span')
  sourceTag.className = 'lumina-link-card-source'
  const buildSourceText = (site?: string | null, author?: string | null) => {
    const primary = youtubeId
      ? author || 'YouTube'
      : site || (platform.id !== 'web' ? platform.label : domain)
    if (!youtubeId && author && author.toLowerCase() !== primary.toLowerCase()) {
      return `${primary} · ${author}`
    }
    return primary
  }
  sourceTag.textContent = buildSourceText(cached?.site_name, cached?.author)
  topRow.appendChild(sourceTag)

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

  const openExtBtn = createIconButton(
    'lumina-link-card-action',
    LINK_ICONS.external,
    'Open in browser',
    () => openExternalUrl(url)
  )

  actions.appendChild(peekBtn)
  actions.appendChild(copyBtn)
  actions.appendChild(openExtBtn)

  if (onEdit) {
    const editBtn = createIconButton(
      'lumina-link-card-action',
      LINK_ICONS.edit,
      'Edit source URL',
      onEdit
    )
    actions.appendChild(editBtn)
  }

  topRow.appendChild(actions)
  body.appendChild(topRow)

  const descEl = document.createElement('div')
  descEl.className = 'lumina-link-card-desc'
  if (cached?.description) {
    descEl.textContent = cached.description
  } else if (youtubeId) {
    descEl.textContent = cached?.author
      ? `${cached.author} · Click to play borderless`
      : 'Click to play in borderless cinema modal'
  } else {
    descEl.textContent = displayPath
  }
  body.appendChild(descEl)
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

    mediaSlot.title = 'Click to peek image'
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
    img.loading = 'lazy'
    img.onerror = () => img.remove()
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

  if (!cached) {
    void fetchLinkMetadata(url).then((meta) => {
      if (!card.isConnected) return
      if (!label && meta.title) titleEl.textContent = meta.title
      sourceTag.textContent = buildSourceText(meta.site_name, meta.author)
      if (meta.description && !youtubeId) {
        descEl.textContent = meta.description
      } else if (youtubeId && meta.author) {
        descEl.textContent = `${meta.author} · Click to play borderless`
      }
      if (meta.favicon && !youtubeId) setIcon(meta.favicon)
      if (meta.image && !youtubeId) attachOgImage(meta.image)
    })
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
    const card = createLinkCardElement({
      url: this.url,
      label: this.label,
      youtubeId: this.youtubeId,
      onEdit: () => {
        let targetPos = this.lineFrom
        try {
          const pos = view.posAtDOM(card)
          if (typeof pos === 'number' && pos >= 0) targetPos = pos
        } catch {
          // Fallback to constructor lineFrom
        }
        this.onEnterSource(view, Math.min(targetPos, view.state.doc.length))
      }
    })
    return card
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
