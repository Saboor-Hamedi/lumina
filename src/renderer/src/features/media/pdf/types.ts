/**
 * Shared TypeScript types for Lumina's PDF Knowledge Index & Hybrid Search.
 * Mirrors the camelCase serde payloads emitted by `lumina_core::pdf`.
 */

export interface PdfDocumentStatus {
  relativePath: string
  title: string
  fileHash: string
  fileSize: number
  pageCount: number
  chunkCount: number
  embeddedCount: number
  indexedAt: number
}

export interface PdfIndexResult {
  document: PdfDocumentStatus
  alreadyIndexed: boolean
}

export interface PdfPendingChunk {
  chunkId: number
  relativePath: string
  pageNumber: number
  chunkIndex: number
  content: string
}

export interface PdfChunkEmbeddingInput {
  chunkId: number
  embedding: number[]
}

export type PdfMatchKind = 'hybrid' | 'keyword' | 'semantic'

export interface PdfSearchHit {
  chunkId: number
  relativePath: string
  title: string
  pageNumber: number
  chunkIndex: number
  content: string
  score: number
  matchKind: PdfMatchKind
}

export interface PdfIndexStats {
  totalDocuments: number
  totalPages: number
  totalChunks: number
  embeddedChunks: number
  dbSizeBytes: number
}

export type PdfIndexingPhase = 'idle' | 'extracting' | 'embedding' | 'ready' | 'error'

export interface PdfIndexingState {
  relativePath: string
  phase: PdfIndexingPhase
  pageCount: number
  chunkCount: number
  embeddedCount: number
  error?: string
}

export interface PdfSearchOptions {
  /** Restrict search to a single workspace-relative PDF path. */
  relativePath?: string | null
  /** Maximum number of page chunks to return (default: 8). */
  limit?: number
  /** Skip computing a query embedding and run instant keyword search only. */
  keywordOnly?: boolean
}
