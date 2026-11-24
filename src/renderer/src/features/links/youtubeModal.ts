/**
 * Borderless 16:9 YouTube Cinema Lightbox Modal (`youtubeModal.ts`)
 *
 * Opens any YouTube URL or video ID in a clean, borderless edge-to-edge iframe modal
 * with subtle hover-revealed controls (Open on YouTube / Close), Escape key teardown,
 * and instant iframe cleanup so audio stops immediately on close.
 */

import {
  buildYouTubeEmbedUrl,
  extractYouTubeId,
  extractYouTubeStartSeconds
} from './urlParser'
import './linkEmbed.css'

let activeCloseFn: (() => void) | null = null

export function closeYouTubeModal(): void {
  if (activeCloseFn) {
    activeCloseFn()
  }
}

/**
 * Opens a borderless YouTube iframe modal for the given URL or 11-char video ID.
 * Returns `true` if the URL was a valid YouTube video and the modal opened.
 */
export function openYouTubeModal(urlOrId: string, title?: string): boolean {
  const videoId = extractYouTubeId(urlOrId)
  if (!videoId) return false
  if (typeof document === 'undefined') return false

  // Close any existing YouTube modal before opening a new one
  closeYouTubeModal()

  const startSec = extractYouTubeStartSeconds(urlOrId)
  const embedUrl = buildYouTubeEmbedUrl(videoId, startSec)
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}${startSec ? `&t=${startSec}s` : ''}`

  // Reuses `.image-lightbox-overlay` so Lumina's global Escape stack recognizes it automatically
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

  // Floating subtle top-right pill (hover-revealed)
  const controls = document.createElement('div')
  controls.className = 'yt-modal-controls'

  const externalBtn = document.createElement('button')
  externalBtn.type = 'button'
  externalBtn.className = 'yt-modal-ctrl-btn'
  externalBtn.title = 'Open on YouTube'
  externalBtn.setAttribute('aria-label', 'Open on YouTube')
  externalBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
  externalBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const api = (window as any).api
    if (api?.openExternal) {
      api.openExternal(watchUrl)
    } else {
      window.open(watchUrl, '_blank', 'noopener,noreferrer')
    }
  })

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'yt-modal-ctrl-btn'
  closeBtn.title = 'Close (Esc)'
  closeBtn.setAttribute('aria-label', 'Close video')
  closeBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

  controls.appendChild(externalBtn)
  controls.appendChild(closeBtn)

  stage.appendChild(iframe)
  stage.appendChild(controls)
  overlay.appendChild(stage)
  document.body.appendChild(overlay)

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    if (activeCloseFn === close) activeCloseFn = null
    overlay.classList.remove('show')
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('close-lightbox', close)
    // Detach iframe immediately so audio stops with zero delay
    iframe.src = 'about:blank'
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

  activeCloseFn = close
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    close()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  stage.addEventListener('click', (e) => e.stopPropagation())
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('close-lightbox', close)

  requestAnimationFrame(() => overlay.classList.add('show'))
  return true
}

/**
 * Shared external link click router:
 * - YouTube URLs -> opens the borderless 16:9 YouTube iframe modal.
 * - All other URLs -> opens in the user's system browser.
 */
export function handleExternalLinkClick(url: string, title?: string): void {
  if (!url) return
  if (openYouTubeModal(url, title)) return

  const api = (window as any).api
  if (api?.openExternal) {
    api.openExternal(url)
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
