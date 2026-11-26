/**
 * High-level Hybrid PDF Search & AI Context Formatter.
 *
 * Combines Lumina's local MiniLM query embeddings with native SQLite FTS5
 * keyword search via Reciprocal Rank Fusion (RRF). Automatically falls back to
 * instant keyword search if the embedding worker is unavailable or slow.
 */

import { generateEmbedding } from '../../AI/services/aiWorkerManager'
import { enqueuePdfIndexing } from './pdfEmbeddingQueue'
import { normalizePdfRelativePath, pdfIndexClient } from './pdfIndexClient'
import type { PdfSearchHit, PdfSearchOptions } from './types'

const QUERY_EMBED_TIMEOUT_MS = 2500

async function tryEmbedQuery(query: string): Promise<number[] | null> {
  const trimmed = query.trim().slice(0, 400)
  if (!trimmed) return null

  try {
    const vector = await Promise.race<number[] | null>([
      generateEmbedding(trimmed).then((v) => (Array.isArray(v) && v.length > 0 ? v : null)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), QUERY_EMBED_TIMEOUT_MS))
    ])
    return vector
  } catch {
    return null
  }
}

/**
 * Searches indexed PDFs using hybrid (semantic + keyword BM25) retrieval.
 * If `relativePath` is provided and not yet indexed, extracts it first so
 * questions about a newly-opened or @-mentioned PDF work immediately.
 */
export async function searchPdfIndex(
  query: string,
  options?: PdfSearchOptions
): Promise<PdfSearchHit[]> {
  if (!pdfIndexClient.isAvailable()) return []
  const cleanQuery = query.trim()
  if (!cleanQuery) return []

  const relPath = options?.relativePath ? normalizePdfRelativePath(options.relativePath) : null
  if (relPath) {
    const existing = await pdfIndexClient.getStatus(relPath)
    if (!existing) {
      // Ensure Stage 1 extraction completes right away; kick off embeddings in background
      await pdfIndexClient.indexFile(relPath)
      void enqueuePdfIndexing(relPath, { embedInBackground: true })
    }
  }

  const queryEmbedding = options?.keywordOnly ? null : await tryEmbedQuery(cleanQuery)

  return pdfIndexClient.search(cleanQuery, {
    queryEmbedding,
    relativePath: relPath,
    limit: options?.limit ?? 8
  })
}

/**
 * Formats retrieved PDF chunks into a clean, page-cited block suitable for
 * Lumina AI prompt injection (e.g., `[p. 14]`).
 */
export function formatPdfHitsForPrompt(hits: PdfSearchHit[], maxCharsPerHit = 1200): string {
  if (!hits || hits.length === 0) return ''
  return hits
    .map((hit) => {
      const excerpt = hit.content.trim().slice(0, maxCharsPerHit)
      return `[${hit.title}.pdf — p. ${hit.pageNumber}]\n${excerpt}`
    })
    .join('\n\n')
}
