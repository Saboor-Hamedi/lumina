/**
 * In-memory cached link metadata fetcher backed by the native Rust `fetch_link_metadata` command.
 */

import { extractDomain } from './urlParser'

export interface LinkMetadata {
  url: string
  title?: string | null
  description?: string | null
  image?: string | null
  favicon?: string | null
  site_name?: string | null
}

const metadataCache = new Map<string, LinkMetadata>()
const inflightRequests = new Map<string, Promise<LinkMetadata>>()

export function getCachedLinkMetadata(url: string): LinkMetadata | undefined {
  return metadataCache.get(url)
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const cached = metadataCache.get(url)
  if (cached) return cached

  const existing = inflightRequests.get(url)
  if (existing) return existing

  const promise = (async (): Promise<LinkMetadata> => {
    const fallback: LinkMetadata = {
      url,
      title: extractDomain(url),
      site_name: extractDomain(url)
    }

    try {
      const api = (window as any).api
      if (api && typeof api.fetchLinkMetadata === 'function') {
        const res = await api.fetchLinkMetadata(url)
        if (res && typeof res === 'object') {
          const meta: LinkMetadata = {
            url,
            title: res.title || fallback.title,
            description: res.description || null,
            image: res.image || null,
            favicon: res.favicon || null,
            site_name: res.site_name || fallback.site_name
          }
          metadataCache.set(url, meta)
          return meta
        }
      }
    } catch {
      // Fall back gracefully on offline/blocked URLs
    }

    metadataCache.set(url, fallback)
    return fallback
  })()

  inflightRequests.set(url, promise)
  try {
    return await promise
  } finally {
    inflightRequests.delete(url)
  }
}
