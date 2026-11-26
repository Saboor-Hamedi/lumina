/**
 * Thin, safe typed IPC client for Lumina's native PDF index commands.
 * Gracefully returns empty/null values in non-Tauri or unit-test environments.
 */

import type {
  PdfChunkEmbeddingInput,
  PdfDocumentStatus,
  PdfIndexResult,
  PdfIndexStats,
  PdfPendingChunk,
  PdfSearchHit
} from './types'

interface NativePdfApi {
  pdfIndexFile?: (relativePath: string) => Promise<PdfIndexResult | null>
  pdfGetPendingChunks?: (
    relativePath?: string | null,
    limit?: number
  ) => Promise<PdfPendingChunk[] | null>
  pdfSaveEmbeddings?: (entries: PdfChunkEmbeddingInput[]) => Promise<number>
  pdfSearch?: (
    query: string,
    options?: {
      queryEmbedding?: number[] | null
      relativePath?: string | null
      limit?: number
    }
  ) => Promise<PdfSearchHit[] | null>
  pdfGetStatus?: (relativePath: string) => Promise<PdfDocumentStatus | null>
  pdfListDocuments?: () => Promise<PdfDocumentStatus[] | null>
  pdfGetStats?: () => Promise<PdfIndexStats | null>
  pdfRemoveDocument?: (relativePath: string) => Promise<boolean>
  pdfPruneMissing?: () => Promise<number>
}

function getNativePdfApi(): NativePdfApi | null {
  if (typeof window === 'undefined') return null
  return ((window as unknown as { api?: NativePdfApi }).api ?? null) as NativePdfApi | null
}

/** Normalizes any workspace-relative path to clean forward slashes. */
export function normalizePdfRelativePath(rawPath?: string | null): string {
  return String(rawPath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
}

/** Returns true if a path or snippet represents a PDF document. */
export function isPdfSnippetOrPath(target?: {
  type?: string
  ext?: string
  fileName?: string
  relativePath?: string
  title?: string
} | string | null): boolean {
  if (!target) return false
  if (typeof target === 'string') {
    return /\.pdf$/i.test(target.trim())
  }
  if (target.type === 'pdf') return true
  if (target.ext && target.ext.toLowerCase().replace(/^\./, '') === 'pdf') return true
  const candidate = target.relativePath || target.fileName || target.title || ''
  return /\.pdf$/i.test(candidate.trim())
}

/** Derives the workspace-relative path for a PDF snippet object. */
export function resolvePdfRelativePath(snippet?: {
  relativePath?: string
  folderId?: string
  fileName?: string
  title?: string
} | null): string {
  if (!snippet) return ''
  if (snippet.relativePath) return normalizePdfRelativePath(snippet.relativePath)
  const fileName =
    snippet.fileName ||
    (snippet.title ? (/\.pdf$/i.test(snippet.title) ? snippet.title : `${snippet.title}.pdf`) : '')
  if (!fileName) return ''
  const folder = normalizePdfRelativePath(snippet.folderId)
  return folder ? `${folder}/${fileName}` : normalizePdfRelativePath(fileName)
}

export const pdfIndexClient = {
  isAvailable(): boolean {
    const api = getNativePdfApi()
    return Boolean(api?.pdfIndexFile && api?.pdfSearch)
  },

  async indexFile(relativePath: string): Promise<PdfIndexResult | null> {
    const api = getNativePdfApi()
    const clean = normalizePdfRelativePath(relativePath)
    if (!api?.pdfIndexFile || !clean) return null
    return api.pdfIndexFile(clean)
  },

  async getPendingChunks(
    relativePath?: string | null,
    limit: number = 12
  ): Promise<PdfPendingChunk[]> {
    const api = getNativePdfApi()
    if (!api?.pdfGetPendingChunks) return []
    const clean = relativePath ? normalizePdfRelativePath(relativePath) : null
    const res = await api.pdfGetPendingChunks(clean || null, limit)
    return Array.isArray(res) ? res : []
  },

  async saveEmbeddings(entries: PdfChunkEmbeddingInput[]): Promise<number> {
    const api = getNativePdfApi()
    if (!api?.pdfSaveEmbeddings || entries.length === 0) return 0
    return api.pdfSaveEmbeddings(entries)
  },

  async search(
    query: string,
    options?: {
      queryEmbedding?: number[] | null
      relativePath?: string | null
      limit?: number
    }
  ): Promise<PdfSearchHit[]> {
    const api = getNativePdfApi()
    if (!api?.pdfSearch || !query.trim()) return []
    const cleanPath = options?.relativePath
      ? normalizePdfRelativePath(options.relativePath)
      : null
    const res = await api.pdfSearch(query.trim(), {
      queryEmbedding: options?.queryEmbedding ?? null,
      relativePath: cleanPath || null,
      limit: options?.limit ?? 8
    })
    return Array.isArray(res) ? res : []
  },

  async getStatus(relativePath: string): Promise<PdfDocumentStatus | null> {
    const api = getNativePdfApi()
    const clean = normalizePdfRelativePath(relativePath)
    if (!api?.pdfGetStatus || !clean) return null
    return api.pdfGetStatus(clean)
  },

  async listDocuments(): Promise<PdfDocumentStatus[]> {
    const api = getNativePdfApi()
    if (!api?.pdfListDocuments) return []
    const res = await api.pdfListDocuments()
    return Array.isArray(res) ? res : []
  },

  async getStats(): Promise<PdfIndexStats | null> {
    const api = getNativePdfApi()
    if (!api?.pdfGetStats) return null
    return api.pdfGetStats()
  },

  async removeDocument(relativePath: string): Promise<boolean> {
    const api = getNativePdfApi()
    const clean = normalizePdfRelativePath(relativePath)
    if (!api?.pdfRemoveDocument || !clean) return false
    return api.pdfRemoveDocument(clean)
  },

  async pruneMissing(): Promise<number> {
    const api = getNativePdfApi()
    if (!api?.pdfPruneMissing) return 0
    return api.pdfPruneMissing()
  }
}
