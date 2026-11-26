/**
 * =========================================================================================
 * Lumina PDF Knowledge Index Barrel (`src/renderer/src/features/media/pdf/index.ts`)
 * =========================================================================================
 */

export * from './types'
export {
  pdfIndexClient,
  normalizePdfRelativePath,
  isPdfSnippetOrPath,
  resolvePdfRelativePath
} from './pdfIndexClient'
export {
  enqueuePdfIndexing,
  enqueueManyPdfs,
  subscribePdfIndexStatus,
  getCachedPdfIndexingState,
  resetPdfIndexingStateCache
} from './pdfEmbeddingQueue'
export { searchPdfIndex, formatPdfHitsForPrompt } from './pdfSearchService'
export { usePdfIndexStatus } from './hooks/usePdfIndexStatus'
