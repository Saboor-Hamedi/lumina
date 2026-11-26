import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../AI/services/aiWorkerManager', () => ({
  generateEmbedding: vi.fn()
}))

import { generateEmbedding } from '../../../AI/services/aiWorkerManager'
import {
  enqueuePdfIndexing,
  formatPdfHitsForPrompt,
  isPdfSnippetOrPath,
  normalizePdfRelativePath,
  resetPdfIndexingStateCache,
  resolvePdfRelativePath,
  searchPdfIndex,
  subscribePdfIndexStatus
} from '../index'
import type { PdfIndexingState, PdfSearchHit } from '../types'

describe('PDF Knowledge Index & Hybrid Search', () => {
  const mockApi = {
    pdfIndexFile: vi.fn(),
    pdfGetPendingChunks: vi.fn(),
    pdfSaveEmbeddings: vi.fn(),
    pdfSearch: vi.fn(),
    pdfGetStatus: vi.fn()
  }

  beforeEach(() => {
    vi.resetAllMocks()
    resetPdfIndexingStateCache()
    ;(window as any).api = mockApi
  })

  afterEach(() => {
    delete (window as any).api
  })

  it('normalizes and resolves PDF relative paths accurately', () => {
    expect(normalizePdfRelativePath('\\papers\\attention.pdf')).toBe('papers/attention.pdf')
    expect(isPdfSnippetOrPath('notes/thesis.PDF')).toBe(true)
    expect(isPdfSnippetOrPath({ type: 'pdf', title: 'Attention' })).toBe(true)
    expect(isPdfSnippetOrPath({ type: 'markdown', title: 'Notes.md' })).toBe(false)
    expect(
      resolvePdfRelativePath({ folderId: 'papers', fileName: 'attention.pdf' })
    ).toBe('papers/attention.pdf')
  })

  it('runs two-stage indexing (instant extract + batched background embeddings) and deduplicates', async () => {
    mockApi.pdfIndexFile.mockResolvedValue({
      alreadyIndexed: false,
      document: {
        relativePath: 'papers/attention.pdf',
        title: 'attention',
        fileHash: 'abc123',
        fileSize: 2048,
        pageCount: 2,
        chunkCount: 2,
        embeddedCount: 0,
        indexedAt: 1000
      }
    })
    mockApi.pdfGetPendingChunks.mockResolvedValueOnce([
      {
        chunkId: 1,
        relativePath: 'papers/attention.pdf',
        pageNumber: 1,
        chunkIndex: 0,
        content: 'Multi-head attention allows joint focus.'
      },
      {
        chunkId: 2,
        relativePath: 'papers/attention.pdf',
        pageNumber: 2,
        chunkIndex: 0,
        content: 'Table 3 reports BLEU 28.4.'
      }
    ])
    ;(generateEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3, 0.4])
    mockApi.pdfSaveEmbeddings.mockResolvedValue(2)

    const phases: string[] = []
    const unsub = subscribePdfIndexStatus((s: PdfIndexingState) => phases.push(s.phase))

    // Concurrent calls for the same PDF should share one in-flight task
    const [r1, r2] = await Promise.all([
      enqueuePdfIndexing('papers/attention.pdf'),
      enqueuePdfIndexing('papers/attention.pdf')
    ])
    unsub()

    expect(mockApi.pdfIndexFile).toHaveBeenCalledTimes(1)
    expect(mockApi.pdfSaveEmbeddings).toHaveBeenCalledTimes(1)
    expect(r1?.phase).toBe('ready')
    expect(r2?.phase).toBe('ready')
    expect(r1?.embeddedCount).toBe(2)
    expect(phases).toContain('extracting')
    expect(phases).toContain('ready')
  })

  it('falls back gracefully to ready keyword index if local embedding worker fails', async () => {
    mockApi.pdfIndexFile.mockResolvedValue({
      alreadyIndexed: false,
      document: {
        relativePath: 'offline.pdf',
        title: 'offline',
        fileHash: 'xyz',
        fileSize: 1024,
        pageCount: 1,
        chunkCount: 1,
        embeddedCount: 0,
        indexedAt: 1000
      }
    })
    mockApi.pdfGetPendingChunks.mockResolvedValueOnce([
      {
        chunkId: 11,
        relativePath: 'offline.pdf',
        pageNumber: 1,
        chunkIndex: 0,
        content: 'Offline content'
      }
    ])
    ;(generateEmbedding as any).mockRejectedValueOnce(new Error('Model not cached'))

    const result = await enqueuePdfIndexing('offline.pdf')
    expect(result?.phase).toBe('ready')
    expect(result?.pageCount).toBe(1)
    expect(mockApi.pdfSaveEmbeddings).not.toHaveBeenCalled()
  })

  it('auto-indexes unindexed PDF on search and formats page citations', async () => {
    mockApi.pdfGetStatus.mockResolvedValueOnce(null)
    mockApi.pdfIndexFile.mockResolvedValue({
      alreadyIndexed: false,
      document: {
        relativePath: 'papers/rag.pdf',
        title: 'rag',
        fileHash: 'h1',
        fileSize: 512,
        pageCount: 3,
        chunkCount: 3,
        embeddedCount: 3,
        indexedAt: 1000
      }
    })
    ;(generateEmbedding as any).mockResolvedValueOnce([0.5, 0.5, 0.5, 0.5])

    const hits: PdfSearchHit[] = [
      {
        chunkId: 42,
        relativePath: 'papers/rag.pdf',
        title: 'rag',
        pageNumber: 3,
        chunkIndex: 0,
        content: 'Retrieval-augmented generation grounds answers in external documents.',
        score: 0.032,
        matchKind: 'hybrid'
      }
    ]
    mockApi.pdfSearch.mockResolvedValueOnce(hits)

    const result = await searchPdfIndex('how does RAG ground answers?', {
      relativePath: 'papers/rag.pdf',
      limit: 5
    })

    expect(mockApi.pdfIndexFile).toHaveBeenCalledWith('papers/rag.pdf')
    expect(mockApi.pdfSearch).toHaveBeenCalledWith('how does RAG ground answers?', {
      queryEmbedding: [0.5, 0.5, 0.5, 0.5],
      relativePath: 'papers/rag.pdf',
      limit: 5
    })
    expect(result).toHaveLength(1)

    const promptBlock = formatPdfHitsForPrompt(result)
    expect(promptBlock).toContain('[rag.pdf — p. 3]')
    expect(promptBlock).toContain('Retrieval-augmented generation')
  })
})
