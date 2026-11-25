/**
 * Persistent (localStorage + 24h TTL) & in-memory link metadata cache
 * backed by the native Rust `fetch_link_metadata` command.
 *
 * - Successful fetches persist across app restarts (24h TTL, max 200 entries).
 * - Failed/offline fetches are never permanently persisted and support explicit retry.
 */

import { extractDomain, isHttpUrl } from './urlParser'

export interface LinkMetadata {
  url: string
  title?: string | null
  description?: string | null
  image?: string | null
  favicon?: string | null
  site_name?: string | null
  author?: string | null
  /** True when the last fetch failed (e.g. offline/timeout) and returned fallback metadata. */
  failed?: boolean
}

interface StoredEntry {
  meta: LinkMetadata
  expiresAt: number
}

const STORAGE_KEY = 'lumina_link_metadata_v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const FAILURE_COOLDOWN_MS = 15 * 1000 // 15 seconds before auto-retry
const MAX_CACHE_ENTRIES = 200

const metadataCache = new Map<string, StoredEntry>()
const inflightRequests = new Map<string, Promise<LinkMetadata>>()
let hydrated = false
let persistTimer: ReturnType<typeof setTimeout> | null = null

function hydrateCacheOnce(): void {
  if (hydrated) return
  hydrated = true
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const now = Date.now()
    for (const item of parsed) {
      if (
        item &&
        typeof item.url === 'string' &&
        typeof item.expiresAt === 'number' &&
        item.expiresAt > now &&
        item.meta &&
        !item.meta.failed
      ) {
        metadataCache.set(item.url, { meta: item.meta, expiresAt: item.expiresAt })
      }
    }
  } catch {
    // Ignore corrupted storage gracefully
  }
}

function schedulePersist(): void {
  if (typeof localStorage === 'undefined') return
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      const now = Date.now()
      const serializable: Array<{ url: string; meta: LinkMetadata; expiresAt: number }> = []
      for (const [url, entry] of metadataCache.entries()) {
        if (!entry.meta.failed && entry.expiresAt > now) {
          serializable.push({ url, meta: entry.meta, expiresAt: entry.expiresAt })
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable.slice(-MAX_CACHE_ENTRIES)))
    } catch {
      // Ignore quota errors gracefully
    }
  }, 250)
}

function cacheSet(url: string, meta: LinkMetadata, ttlMs: number): void {
  if (metadataCache.size >= MAX_CACHE_ENTRIES && !metadataCache.has(url)) {
    const oldestKey = metadataCache.keys().next().value
    if (oldestKey !== undefined) {
      metadataCache.delete(oldestKey)
    }
  }
  metadataCache.set(url, { meta, expiresAt: Date.now() + ttlMs })
  if (!meta.failed) {
    schedulePersist()
  }
}

export function getCachedLinkMetadata(url: string): LinkMetadata | undefined {
  hydrateCacheOnce()
  const entry = metadataCache.get(url)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    metadataCache.delete(url)
    return undefined
  }
  return entry.meta
}

export function clearLinkMetadataCache(): void {
  metadataCache.clear()
  inflightRequests.clear()
  hydrated = true
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

export async function fetchLinkMetadata(
  url: string,
  options?: { forceRefresh?: boolean }
): Promise<LinkMetadata> {
  hydrateCacheOnce()

  if (!options?.forceRefresh) {
    const cached = getCachedLinkMetadata(url)
    if (cached) return cached
  } else {
    metadataCache.delete(url)
  }

  const fallback: LinkMetadata = {
    url,
    title: extractDomain(url),
    site_name: extractDomain(url),
    failed: true
  }

  if (!isHttpUrl(url)) {
    return fallback
  }

  const existing = inflightRequests.get(url)
  if (existing) return existing

  const promise = (async (): Promise<LinkMetadata> => {
    try {
      const api = (window as any).api
      if (api && typeof api.fetchLinkMetadata === 'function') {
        const res = await api.fetchLinkMetadata(url)
        if (res && typeof res === 'object') {
          const safeImage =
            typeof res.image === 'string' && isHttpUrl(res.image) ? res.image : null
          const safeFavicon =
            typeof res.favicon === 'string' && isHttpUrl(res.favicon) ? res.favicon : null
          const hasUsefulData = Boolean(
            (typeof res.title === 'string' && res.title.trim()) ||
              (typeof res.description === 'string' && res.description.trim()) ||
              safeImage
          )
          const meta: LinkMetadata = {
            url,
            title: (typeof res.title === 'string' && res.title.trim()) || fallback.title,
            description:
              typeof res.description === 'string' && res.description.trim()
                ? res.description.trim()
                : null,
            image: safeImage,
            favicon: safeFavicon,
            site_name:
              (typeof res.site_name === 'string' && res.site_name.trim()) || fallback.site_name,
            author:
              typeof res.author === 'string' && res.author.trim() ? res.author.trim() : null,
            failed: !hasUsefulData
          }
          cacheSet(url, meta, hasUsefulData ? CACHE_TTL_MS : FAILURE_COOLDOWN_MS)
          return meta
        }
      }
    } catch {
      // Fall back gracefully on offline/blocked URLs; short cooldown allows auto-retry later
    }

    cacheSet(url, fallback, FAILURE_COOLDOWN_MS)
    return fallback
  })()

  inflightRequests.set(url, promise)
  try {
    return await promise
  } finally {
    inflightRequests.delete(url)
  }
}
