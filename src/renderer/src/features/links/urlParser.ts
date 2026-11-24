/**
 * Pure URL & YouTube parsing helpers (zero DOM/React dependencies).
 */

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/

/**
 * Extracts the 11-character YouTube video ID from any standard YouTube URL:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 */
export function extractYouTubeId(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  let candidate: string | null = null

  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (parsed.pathname === '/watch') {
      candidate = parsed.searchParams.get('v')
    } else {
      const segments = parsed.pathname.split('/').filter(Boolean)
      if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
        candidate = segments[1]
      }
    }
  }

  return candidate && YOUTUBE_ID_RE.test(candidate) ? candidate : null
}

/**
 * Extracts optional start timestamp in seconds from `?t=1m30s`, `?t=90`, or `?start=45`.
 */
export function extractYouTubeStartSeconds(rawUrl: string): number | null {
  try {
    const parsed = new URL(rawUrl.trim())
    const raw = parsed.searchParams.get('t') || parsed.searchParams.get('start')
    if (!raw) return null

    if (/^\d+$/.test(raw)) {
      const sec = parseInt(raw, 10)
      return sec > 0 ? sec : null
    }

    const match = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i)
    if (!match) return null
    const hours = parseInt(match[1] || '0', 10)
    const mins = parseInt(match[2] || '0', 10)
    const secs = parseInt(match[3] || '0', 10)
    const total = hours * 3600 + mins * 60 + secs
    return total > 0 ? total : null
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
 * Returns true if the input is a valid `http://` or `https://` URL.
 */
export function isHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  try {
    const u = new URL(rawUrl.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Extracts a clean display domain (without `www.`) from a URL.
 */
export function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl.trim()).hostname.replace(/^www\./i, '')
  } catch {
    return rawUrl
  }
}

export interface StandaloneLinkMatch {
  url: string
  label?: string
}

/**
 * Detects if a Markdown line consists solely of a standalone `http(s)` URL
 * (`https://...`) or a standalone Markdown link (`[Label](https://...)`).
 * Ignores image syntax (`![alt](url)`).
 */
export function parseStandaloneLinkLine(lineText: string): StandaloneLinkMatch | null {
  const trimmed = lineText.trim()
  if (!trimmed || trimmed.startsWith('![')) return null

  // Bare URL on its own line
  if (/^https?:\/\/\S+$/i.test(trimmed) && isHttpUrl(trimmed)) {
    return { url: trimmed }
  }

  // Standalone Markdown link: [Label](https://...)
  const mdMatch = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i)
  if (mdMatch && isHttpUrl(mdMatch[2])) {
    return { url: mdMatch[2], label: mdMatch[1].trim() }
  }

  return null
}
