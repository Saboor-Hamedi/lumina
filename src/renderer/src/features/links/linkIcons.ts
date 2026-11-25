/**
 * Shared inline SVG icons & micro action button builder for Link Strips & Modals (`linkIcons.ts`).
 */

import { getFallbackFaviconUrl, type LinkPlatform } from './urlParser'

export const LINK_ICONS = {
  copy: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  peek: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  external: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  externalLg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  closeLg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  edit: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  trash: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  refresh: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  globe: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  play: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`,
  youtube: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>`,
  pinterest: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.43 7.63 11.17-.1-.95-.2-2.4.04-3.44.22-.94 1.4-5.95 1.4-5.95s-.36-.72-.36-1.78c0-1.67.97-2.92 2.17-2.92 1.02 0 1.52.77 1.52 1.69 0 1.03-.66 2.57-1 4-.28 1.2.6 2.17 1.78 2.17 2.13 0 3.77-2.25 3.77-5.5 0-2.87-2.06-4.88-5.01-4.88-3.41 0-5.42 2.56-5.42 5.2 0 1.03.4 2.14.9 2.74.1.12.11.22.08.34-.09.38-.3 1.2-.34 1.37-.05.22-.18.27-.4.16-1.5-.7-2.44-2.89-2.44-4.65 0-3.78 2.75-7.26 7.93-7.26 4.16 0 7.4 2.97 7.4 6.93 0 4.14-2.61 7.47-6.23 7.47-1.22 0-2.36-.63-2.75-1.38l-.75 2.85c-.27 1.04-1 2.35-1.49 3.15 1.12.35 2.31.53 3.55.53 6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg>`
} as const

export function createIconButton(
  className: string,
  iconSvg: string,
  title: string,
  onClick: (e: MouseEvent) => void,
  tooltipPos: 'top' | 'bottom' | 'left' | 'right' = 'top'
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = className
  btn.setAttribute('data-tooltip', title)
  btn.setAttribute('data-tooltip-pos', tooltipPos)
  btn.setAttribute('aria-label', title)
  btn.innerHTML = iconSvg
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick(e)
  })
  return btn
}

/**
 * Renders a crisp, reliable site favicon into `slot` with automatic Google high-res favicon
 * fallback and offline globe fallback (shared DRY helper across Strips, Grids, and Hover Cards).
 */
export function renderSiteIcon(
  slot: HTMLElement,
  url: string,
  platformId: LinkPlatform['id'],
  primaryFavicon?: string | null,
  sizeClass = 'lumina-link-card-favicon'
): void {
  if (platformId === 'youtube') {
    slot.innerHTML = LINK_ICONS.youtube
    slot.className = 'lumina-link-card-icon-slot is-yt'
    return
  }
  if (platformId === 'pinterest') {
    slot.innerHTML = LINK_ICONS.pinterest
    slot.className = 'lumina-link-card-icon-slot is-pinterest'
    return
  }

  const fallbackUrl = getFallbackFaviconUrl(url)
  const firstSrc = primaryFavicon || fallbackUrl
  let triedFallback = firstSrc === fallbackUrl

  const img = document.createElement('img')
  img.className = sizeClass
  img.src = firstSrc
  img.alt = ''
  img.decoding = 'async'
  img.loading = 'lazy'
  img.onerror = () => {
    if (!triedFallback) {
      triedFallback = true
      img.src = fallbackUrl
    } else {
      slot.innerHTML = LINK_ICONS.globe
    }
  }
  slot.innerHTML = ''
  slot.appendChild(img)
}
