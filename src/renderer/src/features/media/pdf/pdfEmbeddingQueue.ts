/**
 * Two-stage, non-blocking background PDF indexing & local embedding queue.
 *
 * - Stage 1 (instant, milliseconds): Native Rust extracts text page-by-page and
 *   populates the invisible FTS5 keyword index so search works immediately.
 * - Stage 2 (lazy background): Computes semantic vectors via Lumina's existing
 *   local `Xenova/all-MiniLM-L6-v2` Web Worker in small batches, storing them as
 *   compact Int8 vectors (4x smaller on disk).
 */

import { generateEmbedding } from '../../AI/services/aiWorkerManager'
import { normalizePdfRelativePath, pdfIndexClient } from './pdfIndexClient'
import type {
  PdfChunkEmbeddingInput,
  PdfDocumentStatus,
  PdfIndexingState
} from './types'

const EMBED_BATCH_SIZE = 6
const BATCH_YIELD_MS = 24

type StatusListener = (state: PdfIndexingState) => void

const statusCache = new Map<string, PdfIndexingState>()
const inFlightTasks = new Map<string, Promise<PdfIndexingState | null>>()
const listeners = new Set<StatusListener>()

function publishState(next: PdfIndexingState): void {
  statusCache.set(next.relativePath, next)
  listeners.forEach((cb) => {
    try {
      cb(next)
    } catch {
      // Isolate listener errors
    }
  })
}

function statusFromDoc(doc: PdfDocumentStatus): PdfIndexingState {
  const isComplete = doc.chunkCount === 0 || doc.embeddedCount >= doc.chunkCount
  return {
    relativePath: doc.relativePath,
    phase: isComplete ? 'ready' : 'embedding',
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    embeddedCount: doc.embeddedCount
  }
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, BATCH_YIELD_MS))
}

/** Subscribes to live PDF indexing status updates (returns unsubscribe fn). */
export function subscribePdfIndexStatus(listener: StatusListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Returns the last known indexing state for a PDF path, if any. */
export function getCachedPdfIndexingState(relativePath: string): PdfIndexingState | null {
  const clean = normalizePdfRelativePath(relativePath)
  return statusCache.get(clean) || null
}

/**
 * Ensures a PDF is extracted and indexed (Stage 1), then quietly embeds any
 * remaining chunks in the background (Stage 2).
 *
 * Deduplicates concurrent calls for the same PDF path.
 */
export function enqueuePdfIndexing(
  relativePath: string,
  options?: { embedInBackground?: boolean }
): Promise<PdfIndexingState | null> {
  const clean = normalizePdfRelativePath(relativePath)
  if (!clean || !pdfIndexClient.isAvailable()) {
    return Promise.resolve(null)
  }

  const existing = inFlightTasks.get(clean)
  if (existing) return existing

  const embedInBackground = options?.embedInBackground !== false

  const task = (async (): Promise<PdfIndexingState | null> => {
    try {
      publishState({
        relativePath: clean,
        phase: 'extracting',
        pageCount: statusCache.get(clean)?.pageCount ?? 0,
        chunkCount: statusCache.get(clean)?.chunkCount ?? 0,
        embeddedCount: statusCache.get(clean)?.embeddedCount ?? 0
      })

      const indexed = await pdfIndexClient.indexFile(clean)
      if (!indexed?.document) {
        return null
      }

      const doc = indexed.document
      const afterExtract = statusFromDoc(doc)
      publishState(afterExtract)

      // Already fully embedded or empty PDF -> done!
      if (!embedInBackground || doc.chunkCount === 0 || doc.embeddedCount >= doc.chunkCount) {
        const readyState: PdfIndexingState = { ...afterExtract, phase: 'ready' }
        publishState(readyState)
        return readyState
      }

      // Stage 2: Embed pending chunks in small non-blocking batches
      let embeddedCount = doc.embeddedCount
      while (true) {
        const pending = await pdfIndexClient.getPendingChunks(clean, EMBED_BATCH_SIZE)
        if (pending.length === 0) break

        const batchEntries: PdfChunkEmbeddingInput[] = []
        for (const chunk of pending) {
          try {
            const vector = await generateEmbedding(chunk.content.slice(0, 1500))
            if (Array.isArray(vector) && vector.length > 0) {
              batchEntries.push({ chunkId: chunk.chunkId, embedding: vector })
            }
          } catch (embedErr) {
            // Embedding worker unavailable (e.g., offline without cached model):
            // Keep FTS5 keyword search ready and stop background embedding cleanly.
            console.warn('[PdfEmbeddingQueue] Local embedding unavailable, keeping keyword index:', embedErr)
            const fallbackReady: PdfIndexingState = {
              relativePath: clean,
              phase: 'ready',
              pageCount: doc.pageCount,
              chunkCount: doc.chunkCount,
              embeddedCount
            }
            publishState(fallbackReady)
            return fallbackReady
          }
        }

        if (batchEntries.length === 0) break

        const saved = await pdfIndexClient.saveEmbeddings(batchEntries)
        embeddedCount = Math.min(doc.chunkCount, embeddedCount + saved)
        publishState({
          relativePath: clean,
          phase: embeddedCount >= doc.chunkCount ? 'ready' : 'embedding',
          pageCount: doc.pageCount,
          chunkCount: doc.chunkCount,
          embeddedCount
        })

        if (pending.length < EMBED_BATCH_SIZE) break
        await yieldToMainThread()
      }

      const finalState: PdfIndexingState = {
        relativePath: clean,
        phase: 'ready',
        pageCount: doc.pageCount,
        chunkCount: doc.chunkCount,
        embeddedCount: Math.max(embeddedCount, doc.chunkCount)
      }
      publishState(finalState)
      return finalState
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err || 'PDF indexing failed')
      const errState: PdfIndexingState = {
        relativePath: clean,
        phase: 'error',
        pageCount: 0,
        chunkCount: 0,
        embeddedCount: 0,
        error: message
      }
      publishState(errState)
      return errState
    } finally {
      inFlightTasks.delete(clean)
    }
  })()

  inFlightTasks.set(clean, task)
  return task
}

/**
 * Enqueues multiple PDFs sequentially without saturating CPU or memory.
 */
export async function enqueueManyPdfs(relativePaths: string[]): Promise<void> {
  const unique = Array.from(
    new Set(relativePaths.map(normalizePdfRelativePath).filter((p) => /\.pdf$/i.test(p)))
  )
  for (const rel of unique) {
    await enqueuePdfIndexing(rel)
  }
}

/** Clears in-memory status cache (useful in tests or workspace switches). */
export function resetPdfIndexingStateCache(): void {
  statusCache.clear()
  inFlightTasks.clear()
}
