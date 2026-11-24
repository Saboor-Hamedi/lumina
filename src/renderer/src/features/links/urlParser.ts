/**
 * Pure URL & YouTube validation, parsing, and display-formatting helpers
 * (zero DOM/React dependencies).
 */

export const MAX_URL_LENGTH = 2048
export const MAX_PATH_SEGMENTS = 64

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/
const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const TLD_RE = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i
const IPV4_STRICT_RE = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const RAW_HOST_RE = /^https?:\/\/([^/?#]+)/i

function isValidHost(rawUrl: string, parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase()
  if (!host || host.length > 253) return false

  // Inspect raw authority before WHATWG URL IPv4-integer normalization (e.g. `https://00` -> `0.0.0.0`)
  const rawMatch = rawUrl.match(RAW_HOST_RE)
  if (!rawMatch) return false
  let rawHost = rawMatch[1].toLowerCase()
  // Reject embedded credentials (already checked via parsed.username/password, double-check raw `@`)
  if (rawHost.includes('@')) return false
  // Strip optional port from raw host (skip IPv6 bracketed hosts)
  if (!rawHost.startsWith('[')) {
    const colonIdx = rawHost.indexOf(':')
    if (colonIdx !== -1) rawHost = rawHost.slice(0, colonIdx)
  }
  if (!rawHost) return false

  // Reject unspecified address (`0.0.0.0`, `00`, `0`)
  if (host === '0.0.0.0' || rawHost === '0.0.0.0' || /^0+$/.test(rawHost)) return false

  // Allow explicit localhost
  if (host === 'localhost' && rawHost === 'localhost') return true

  // Allow valid IPv6 literal
  if (host.startsWith('[') && host.endsWith(']')) {
    return rawHost.startsWith('[') && rawHost.endsWith(']')
  }

  // Allow strict 4-octet dotted IPv4 (reject shorthand integer/octal IPs like `00`, `01.02`, `2130706433`)
  if (IPV4_STRICT_RE.test(host)) {
    return rawHost === host
  }

  // Standard domain: must have at least two labels, no empty labels, valid DNS labels, and a valid TLD
  if (rawHost.includes('..') || rawHost.startsWith('.') || rawHost.endsWith('.')) return false
  const labels = host.split('.')
  if (labels.length < 2) return false
  for (const label of labels) {
    if (!DOMAIN_LABEL_RE.test(label)) return false
  }
  const tld = labels[labels.length - 1]
  return TLD_RE.test(tld)
}

/**
 * Validates that the input is a safe, well-formed `http://` or `https://` URL.
 * Rejects malformed/shorthand hosts (`https://00`, `https://12345`), control chars,
 * embedded credentials, excessively long URLs (>2048 chars), and extreme slug depth (>64 segments).
 */
export function isHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  const trimmed = rawUrl.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return false
  if (CONTROL_CHAR_RE.test(trimmed) || /\s/.test(trimmed) || /%00/i.test(trimmed)) return false

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false
  if (!isValidHost(trimmed, parsed)) return false

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length > MAX_PATH_SEGMENTS) return false

  return true
}

/**
 * Extracts the 11-character YouTube video ID from any valid standard YouTube URL:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 */
export function extractYouTubeId(
  rawUrl: string,
  options?: { allowRawId?: boolean }
): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (options?.allowRawId && YOUTUBE_ID_RE.test(trimmed)) return trimmed
  if (!isHttpUrl(trimmed)) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  const segments = parsed.pathname.split('/').filter(Boolean)
  let candidate: string | null = null

  if (host === 'youtu.be') {
    if (segments.length === 1) {
      candidate = segments[0]
    }
  } else if (
    host === 'youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'music.youtube.com'
  ) {
    if (segments.length === 1 && segments[0] === 'watch') {
      candidate = parsed.searchParams.get('v')
    } else if (
      segments.length === 2 &&
      ['embed', 'shorts', 'live', 'v'].includes(segments[0])
    ) {
      candidate = segments[1]
    }
  }

  return candidate && YOUTUBE_ID_RE.test(candidate) ? candidate : null
}

/**
 * Extracts optional start timestamp in seconds from `?t=1m30s`, `?t=90`, or `?start=45`.
 */
export function extractYouTubeStartSeconds(rawUrl: string): number | null {
  if (!isHttpUrl(rawUrl)) return null
  try {
    const parsed = new URL(rawUrl.trim())
    const raw = (parsed.searchParams.get('t') || parsed.searchParams.get('start') || '').trim()
    if (!raw || raw.length > 16) return null

    if (/^\d+$/.test(raw)) {
      const sec = parseInt(raw, 10)
      return Number.isFinite(sec) && sec > 0 && sec <= 86400 ? sec : null
    }

    const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
    if (!match || (!match[1] && !match[2] && !match[3])) return null
    const hours = parseInt(match[1] || '0', 10)
    const mins = parseInt(match[2] || '0', 10)
    const secs = parseInt(match[3] || '0', 10)
    const total = hours * 3600 + mins * 60 + secs
    return Number.isFinite(total) && total > 0 && total <= 86400 ? total : null
  } catch {
    return null
  }
}

/**
 * Builds a privacy-enhanced borderless YouTube embed URL.
 */
export function buildYouTubeEmbedUrl(videoId: string, startSeconds?: number | null): string {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1'
  })
  if (startSeconds && startSeconds > 0) {
    params.set('start', String(startSeconds))
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

/**
 * Returns the standard YouTube HQ thumbnail URL for a video ID.
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Extracts a clean display domain (without `www.`) from a URL.
 */
export function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl.trim()).hostname.replace(/^www\./i, '')
  } catch {
    return rawUrl.slice(0, 64)
  }
}

/**
 * Returns a reliable high-resolution favicon URL for any domain (used as fallback when `/favicon.ico` fails).
 */
export function getFallbackFaviconUrl(rawUrl: string): string {
  const domain = extractDomain(rawUrl)
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
}

/**
 * Produces a compact, readable display string for long URLs with many slugs/query params
 * (e.g. `example.com/docs/…/getting-started`) so cards never overflow or look noisy.
 */
export function formatDisplayUrl(rawUrl: string, maxLength = 88): string {
  try {
    const parsed = new URL(rawUrl.trim())
    const host = parsed.hostname.replace(/^www\./i, '')
    const segments = parsed.pathname.split('/').filter(Boolean)

    if (segments.length === 0) {
      return host
    }

    const decodeSafe = (seg: string): string => {
      try {
        return decodeURIComponent(seg)
      } catch {
        return seg
      }
    }

    const trimSeg = (seg: string, limit: number): string =>
      seg.length > limit ? `${seg.slice(0, limit - 1)}…` : seg

    let display: string
    if (segments.length <= 2) {
      display = `${host}/${segments.map((s) => trimSeg(decodeSafe(s), 32)).join('/')}`
    } else {
      const first = trimSeg(decodeSafe(segments[0]), 24)
      const last = trimSeg(decodeSafe(segments[segments.length - 1]), 28)
      display = `${host}/${first}/…/${last}`
    }

    return display.length > maxLength ? `${display.slice(0, maxLength - 1)}…` : display
  } catch {
    const clean = rawUrl.trim()
    return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean
  }
}

export interface LinkPlatform {
  id:
    | 'youtube'
    | 'pinterest'
    | 'x'
    | 'instagram'
    | 'reddit'
    | 'tiktok'
    | 'spotify'
    | 'github'
    | 'vimeo'
    | 'web'
  label: string
  accent: string
}

/**
 * Identifies well-known social / media platforms for tailored badges & hover accents.
 */
export function detectLinkPlatform(rawUrl: string): LinkPlatform {
  const domain = extractDomain(rawUrl).toLowerCase()
  if (
    domain === 'youtube.com' ||
    domain === 'youtu.be' ||
    domain === 'm.youtube.com' ||
    domain === 'music.youtube.com'
  ) {
    return { id: 'youtube', label: 'YouTube', accent: '#ef4444' }
  }
  if (domain === 'pin.it' || domain.includes('pinterest.')) {
    return { id: 'pinterest', label: 'Pinterest', accent: '#e60023' }
  }
  if (domain === 'x.com' || domain === 'twitter.com' || domain.endsWith('.twitter.com')) {
    return { id: 'x', label: 'X', accent: '#71717a' }
  }
  if (domain === 'instagram.com' || domain.endsWith('.instagram.com') || domain === 'threads.net') {
    return { id: 'instagram', label: 'Instagram', accent: '#e1306c' }
  }
  if (domain === 'reddit.com' || domain.endsWith('.reddit.com') || domain === 'redd.it') {
    return { id: 'reddit', label: 'Reddit', accent: '#ff4500' }
  }
  if (domain === 'tiktok.com' || domain.endsWith('.tiktok.com')) {
    return { id: 'tiktok', label: 'TikTok', accent: '#fe2c55' }
  }
  if (domain === 'open.spotify.com' || domain === 'spotify.com') {
    return { id: 'spotify', label: 'Spotify', accent: '#1db954' }
  }
  if (domain === 'github.com' || domain.endsWith('.github.com')) {
    return { id: 'github', label: 'GitHub', accent: '#6366f1' }
  }
  if (domain === 'vimeo.com') {
    return { id: 'vimeo', label: 'Vimeo', accent: '#1ab7ea' }
  }
  return { id: 'web', label: domain, accent: 'var(--text-accent)' }
}

export interface StandaloneLinkMatch {
  url: string
  label?: string
}

/**
 * Detects if a Markdown line consists solely of a bare URL (`https://...`) or autolink (`<https://...>`).
 * Named Markdown links (`[Google](https://...)`) are intentionally left as inline words so users
 * can hover them for the smart preview dropdown card.
 */
export function parseStandaloneLinkLine(lineText: string): StandaloneLinkMatch | null {
  const trimmed = lineText.trim()
  if (!trimmed || trimmed.startsWith('![')) return null
  if (trimmed.length > MAX_URL_LENGTH + 16) return null

  // Autolink: <https://...>
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    const inner = trimmed.slice(1, -1).trim()
    if (isHttpUrl(inner)) {
      return { url: inner }
    }
    return null
  }

  // Bare URL on its own line
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return isHttpUrl(trimmed) ? { url: trimmed } : null
  }

  return null
}

/**
 * Parses a link line inside a ```links grid block: supports bare URLs, `<https://...>`,
 * AND named Markdown links `[Custom Title](https://...)` (including balanced parens).
 */
export function parseGridLinkLine(lineText: string): StandaloneLinkMatch | null {
  const bare = parseStandaloneLinkLine(lineText)
  if (bare) return bare

  const trimmed = lineText.trim()
  if (!trimmed || trimmed.startsWith('![')) return null
  if (trimmed.length > MAX_URL_LENGTH + 256) return null

  if (trimmed.startsWith('[') && trimmed.endsWith(')')) {
    const sepIdx = trimmed.indexOf('](')
    if (sepIdx > 1) {
      const label = trimmed.slice(1, sepIdx).trim()
      const url = trimmed.slice(sepIdx + 2, -1).trim()
      if (label && !label.includes(']') && isHttpUrl(url)) {
        return { url, label }
      }
    }
  }

  return null
}
