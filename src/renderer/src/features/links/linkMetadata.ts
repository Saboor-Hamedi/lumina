/**
 * In-memory cached link metadata fetcher backed by the native Rust `fetch_link_metadata` command.
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
}

const MAX_CACHE_ENTRIES = 200
const metadataCache = new Map<string, LinkMetadata>()
const inflightRequests = new Map<string, Promise<LinkMetadata>>()

function cacheSet(url: string, meta: LinkMetadata): void {
  if (metadataCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = metadataCache.keys().next().value
    if (oldestKey !== undefined) {
      metadataCache.delete(oldestKey)
    }
  }
  metadataCache.set(url, meta)
}

export function getCachedLinkMetadata(url: string): LinkMetadata | undefined {
  return metadataCache.get(url)
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const cached = metadataCache.get(url)
  if (cached) return cached

  const fallback: LinkMetadata = {
    url,
    title: extractDomain(url),
    site_name: extractDomain(url)
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
          const safeImage = typeof res.image === 'string' && isHttpUrl(res.image) ? res.image : null
          const safeFavicon =
            typeof res.favicon === 'string' && isHttpUrl(res.favicon) ? res.favicon : null
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
              typeof res.author === 'string' && res.author.trim() ? res.author.trim() : null
          }
          cacheSet(url, meta)
          return meta
        }
      }
    } catch {
      // Fall back gracefully on offline/blocked URLs
    }

    cacheSet(url, fallback)
    return fallback
  })()

  inflightRequests.set(url, promise)
  try {
    return await promise
  } finally {
    inflightRequests.delete(url)
  }
}
