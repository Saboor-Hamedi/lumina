/**
 * Borderless Cinema & Visual Peek Modals (`mediaModal.ts`)
 *
 * - `openYouTubeModal`: Borderless 16:9 YouTube iframe modal with instant audio stop on close.
 * - `openMediaPeekModal`: Borderless high-res image/pin peek modal for Pinterest, social posts & OG media.
 * - `openExternalUrl` & `handleExternalLinkClick`: Shared validated external link router.
 */

import {
  buildYouTubeEmbedUrl,
  extractYouTubeId,
  extractYouTubeStartSeconds,
  isHttpUrl
} from './urlParser'
import { useSettingStore } from '../../core/store/SettingStore'
import { resolveLinkCardSettings } from './linkCardConfig'
import { createIconButton, LINK_ICONS } from './linkIcons'
import './linkEmbed.css'

let activeCloseFn: (() => void) | null = null

export function closeYouTubeModal(): void {
  if (activeCloseFn) {
    activeCloseFn()
  }
}

export function openExternalUrl(url: string): void {
  if (!url || !isHttpUrl(url)) return
  const api = (window as any).api
  if (api?.openExternal) {
    api.openExternal(url)
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function mountModalOverlay(
  overlay: HTMLElement,
  stage: HTMLElement,
  externalUrl: string,
  externalLabel: string,
  onBeforeClose?: () => void
): () => void {
  closeYouTubeModal()

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    if (activeCloseFn === close) activeCloseFn = null
    overlay.classList.remove('show')
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('close-lightbox', close)
    onBeforeClose?.()
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    }, 160)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      close()
    }
  }

  const controls = document.createElement('div')
  controls.className = 'yt-modal-controls'
  controls.appendChild(
    createIconButton('yt-modal-ctrl-btn', LINK_ICONS.externalLg, externalLabel, () =>
      openExternalUrl(externalUrl)
    )
  )
  controls.appendChild(
    createIconButton('yt-modal-ctrl-btn', LINK_ICONS.closeLg, 'Close (Esc)', close)
  )
  stage.appendChild(controls)
  overlay.appendChild(stage)
  document.body.appendChild(overlay)

  activeCloseFn = close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  stage.addEventListener('click', (e) => e.stopPropagation())
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('close-lightbox', close)

  requestAnimationFrame(() => overlay.classList.add('show'))
  return close
}

/**
 * Opens a borderless 16:9 YouTube iframe modal for the given URL or 11-char video ID.
 */
export function openYouTubeModal(urlOrId: string, title?: string): boolean {
  const videoId = extractYouTubeId(urlOrId, { allowRawId: true })
  if (!videoId || typeof document === 'undefined') return false

  const startSec = extractYouTubeStartSeconds(urlOrId)
  const embedUrl = buildYouTubeEmbedUrl(videoId, startSec)
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}${startSec ? `&t=${startSec}s` : ''}`

  const overlay = document.createElement('div')
  overlay.className = 'yt-modal-overlay image-lightbox-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', title || 'YouTube Video')

  const stage = document.createElement('div')
  stage.className = 'yt-modal-stage'

  const iframe = document.createElement('iframe')
  iframe.className = 'yt-modal-iframe'
  iframe.src = embedUrl
  iframe.title = title || 'YouTube video player'
  iframe.allow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
  iframe.allowFullscreen = true
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  stage.appendChild(iframe)

  mountModalOverlay(overlay, stage, watchUrl, 'Open on YouTube', () => {
    iframe.src = 'about:blank'
  })
  return true
}

export interface MediaPeekOptions {
  imageUrl: string
  url: string
  title?: string
  subtitle?: string
}

/**
 * Opens a borderless high-res Visual Media Peek modal (Pinterest pins, social posts, OG visuals).
 */
export function openMediaPeekModal(opts: MediaPeekOptions): boolean {
  if (!opts.imageUrl || !isHttpUrl(opts.imageUrl) || typeof document === 'undefined') {
    return false
  }

  const overlay = document.createElement('div')
  overlay.className = 'yt-modal-overlay peek-modal-overlay image-lightbox-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', opts.title || 'Media preview')

  const stage = document.createElement('div')
  stage.className = 'peek-modal-stage'

  const img = document.createElement('img')
  img.className = 'peek-modal-img'
  img.src = opts.imageUrl
  img.alt = opts.title || ''
  stage.appendChild(img)

  if (opts.title || opts.subtitle) {
    const caption = document.createElement('div')
    caption.className = 'peek-modal-caption'
    if (opts.title) {
      const t = document.createElement('div')
      t.className = 'peek-modal-title'
      t.textContent = opts.title
      caption.appendChild(t)
    }
    if (opts.subtitle) {
      const s = document.createElement('div')
      s.className = 'peek-modal-sub'
      s.textContent = opts.subtitle
      caption.appendChild(s)
    }
    stage.appendChild(caption)
  }

  mountModalOverlay(overlay, stage, opts.url, 'Open original link')
  return true
}

/**
 * Shared external link click router:
 * - YouTube URLs -> opens the borderless 16:9 YouTube iframe modal (when enabled in settings).
 * - All other URLs -> opens in the user's system browser.
 */
export function handleExternalLinkClick(url: string, title?: string): void {
  if (!url || !isHttpUrl(url)) return
  const cfg = resolveLinkCardSettings(useSettingStore.getState().settings)
  if (cfg.youtubeOpenInModal && extractYouTubeId(url) && openYouTubeModal(url, title)) return
  openExternalUrl(url)
}
