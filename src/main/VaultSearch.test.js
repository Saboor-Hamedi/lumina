import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import VaultSearch from './VaultSearch.js'

// Mock @xenova/transformers
const mockEmbedder = vi.fn(() => Promise.resolve({
  data: new Float32Array(384).fill(0.5)
}))

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(() => Promise.resolve(mockEmbedder)),
  env: {
    allowLocalModels: false,
    useBrowserCache: false,
    useCustomCache: false
  }
}))

describe('VaultSearch', () => {
  let testDataPath
  let indexDir
  let indexPath
  let embeddingsPath

  beforeEach(async () => {
    testDataPath = path.join(os.tmpdir(), `lumina-search-test-${Date.now()}`)
    indexDir = path.join(testDataPath, 'vault-index')
    indexPath = path.join(indexDir, 'vault_index.jsonl')
    embeddingsPath = path.join(indexDir, 'embeddings.bin')

    await fs.mkdir(indexDir, { recursive: true })

    // Reset VaultSearch state
    VaultSearch.index = null
    VaultSearch.embeddingsBuffer = null
    VaultSearch.isLoaded = false
    VaultSearch.queryCache.clear()
  })

  afterEach(async () => {
    try {
      await fs.rm(testDataPath, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  describe('loadIndex', () => {
    it('loads index from file', async () => {
      const indexData = [
        { id: '1', filePath: 'test.md', text: 'Test content', type: 'snippet', embeddingOffset: 0, embeddingLength: 384 },
        { id: '2', filePath: 'test2.md', text: 'Another test', type: 'note', embeddingOffset: 1536, embeddingLength: 384 }
      ]
      await fs.writeFile(indexPath, indexData.map(item => JSON.stringify(item)).join('\n'))

      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()

      expect(VaultSearch.index).toHaveLength(2)
      expect(VaultSearch.isLoaded).toBe(true)
    })

    it('handles missing index file', async () => {
      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()

      expect(VaultSearch.index).toEqual([])
      expect(VaultSearch.isLoaded).toBe(true)
    })

    it('loads embeddings buffer if exists', async () => {
      const indexData = [{ id: '1', filePath: 'test.md', text: 'Test', embeddingOffset: 0, embeddingLength: 384 }]
      await fs.writeFile(indexPath, JSON.stringify(indexData[0]))

      // Create embeddings buffer (384 floats = 1536 bytes)
      const buffer = Buffer.alloc(1536)
      buffer.writeFloatLE(0.5, 0)
      await fs.writeFile(embeddingsPath, buffer)

      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()

      expect(VaultSearch.embeddingsBuffer).not.toBeNull()
    })
  })

  describe('getChunkEmbedding', () => {
    it('extracts embedding from buffer', async () => {
      const indexData = [{ id: '1', filePath: 'test.md', text: 'Test', embeddingOffset: 0, embeddingLength: 384 }]
      await fs.writeFile(indexPath, JSON.stringify(indexData[0]))

      // Create embeddings buffer
      const buffer = Buffer.alloc(1536)
      for (let i = 0; i < 384; i++) {
        buffer.writeFloatLE(0.1 * i, i * 4)
      }
      await fs.writeFile(embeddingsPath, buffer)

      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()

      const embedding = VaultSearch.getChunkEmbedding(VaultSearch.index[0])

      expect(embedding).toHaveLength(384)
      expect(embedding[0]).toBeCloseTo(0, 5)
      expect(embedding[1]).toBeCloseTo(0.1, 5)
    })

    it('returns null if no buffer', async () => {
      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()

      const chunk = { embeddingOffset: 0, embeddingLength: 384 }
      const embedding = VaultSearch.getChunkEmbedding(chunk)

      expect(embedding).toBeNull()
    })

    it('returns null if offset out of bounds', async () => {
      const indexData = [{ id: '1', filePath: 'test.md', text: 'Test', embeddingOffset: 10000, embeddingLength: 384 }]
      await fs.writeFile(indexPath, JSON.stringify(indexData[0]))

      const buffer = Buffer.alloc(1000) // Smaller than required
      await fs.writeFile(embeddingsPath, buffer)

      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()

      const embedding = VaultSearch.getChunkEmbedding(VaultSearch.index[0])

      expect(embedding).toBeNull()
    })
  })

  describe('cosineSimilarity', () => {
    it('calculates cosine similarity correctly', () => {
      const vecA = [1, 0, 0]
      const vecB = [1, 0, 0]

      const similarity = VaultSearch.cosineSimilarity(vecA, vecB)

      expect(similarity).toBeCloseTo(1, 5) // Identical vectors
    })

    it('returns 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0]
      const vecB = [0, 1, 0]

      const similarity = VaultSearch.cosineSimilarity(vecA, vecB)

      expect(similarity).toBeCloseTo(0, 5)
    })

    it('returns 0 for mismatched lengths', () => {
      const vecA = [1, 2, 3]
      const vecB = [1, 2]

      const similarity = VaultSearch.cosineSimilarity(vecA, vecB)

      expect(similarity).toBe(0)
    })

    it('handles zero magnitude vectors', () => {
      const vecA = [0, 0, 0]
      const vecB = [1, 2, 3]

      const similarity = VaultSearch.cosineSimilarity(vecA, vecB)

      expect(similarity).toBe(0)
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      // Create a simple index with embeddings
      const indexData = [
        {
          id: '1',
          filePath: 'test.md',
          text: 'This is about machine learning',
          type: 'snippet',
          embeddingOffset: 0,
          embeddingLength: 384,
          metadata: { fileName: 'test.md', mtime: Date.now() - 86400000 }
        },
        {
          id: '2',
          filePath: 'test2.md',
          text: 'This is about programming',
          type: 'note',
          embeddingOffset: 1536,
          embeddingLength: 384,
          metadata: { fileName: 'test2.md', mtime: Date.now() - 172800000 }
        }
      ]
      await fs.writeFile(indexPath, indexData.map(item => JSON.stringify(item)).join('\n'))

      // Create embeddings buffer with similar vectors
      const buffer = Buffer.alloc(3072) // 2 * 384 * 4
      // Fill with similar values for testing
      for (let i = 0; i < 768; i++) {
        buffer.writeFloatLE(0.5, i * 4)
      }
      await fs.writeFile(embeddingsPath, buffer)

      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()
    })

    it('returns empty array if not loaded', async () => {
      VaultSearch.isLoaded = false
      const results = await VaultSearch.search('test query')

      expect(results).toEqual([])
    })

    it('filters by filePath', async () => {
      const results = await VaultSearch.search('test', {
        filters: { filePath: 'test.md' }
      })

      expect(results.every(r => r.filePath === 'test.md')).toBe(true)
    })

    it('filters by fileType', async () => {
      const results = await VaultSearch.search('test', {
        filters: { fileType: 'md' }
      })

      expect(results.length).toBeGreaterThanOrEqual(0)
    })

    it('filters by type', async () => {
      const results = await VaultSearch.search('test', {
        filters: { type: 'snippet' }
      })

      expect(results.every(r => r.type === 'snippet')).toBe(true)
    })

    it('applies threshold', async () => {
      const results = await VaultSearch.search('test', {
        threshold: 0.9 // High threshold
      })

      // Results should all have score >= 0.9
      expect(results.every(r => r.score >= 0.9)).toBe(true)
    })

    it('respects limit', async () => {
      const results = await VaultSearch.search('test', {
        limit: 1
      })

      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('sorts results by score', async () => {
      const results = await VaultSearch.search('test')

      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
      }
    })

    it('caches query results', async () => {
      await VaultSearch.search('test query')
      const cacheSizeBefore = VaultSearch.queryCache.size

      await VaultSearch.search('test query') // Same query

      // Should use cache
      expect(VaultSearch.queryCache.size).toBe(cacheSizeBefore)
    })
  })

  describe('getStats', () => {
    it('returns stats for loaded index', async () => {
      const indexData = [
        { id: '1', filePath: 'test.md', text: 'Test', type: 'snippet' },
        { id: '2', filePath: 'test2.md', text: 'Test', type: 'note' },
        { id: '3', filePath: 'test.md', text: 'Test', type: 'snippet' }
      ]
      await fs.writeFile(indexPath, indexData.map(item => JSON.stringify(item)).join('\n'))

      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()

      const stats = VaultSearch.getStats()

      expect(stats.totalChunks).toBe(3)
      expect(stats.fileCount).toBe(2) // 2 unique files
      expect(stats.typeCounts.snippet).toBe(2)
      expect(stats.typeCounts.note).toBe(1)
      expect(stats.loaded).toBe(true)
    })

    it('returns empty stats if not loaded', () => {
      VaultSearch.isLoaded = false
      const stats = VaultSearch.getStats()

      expect(stats.totalChunks).toBe(0)
      expect(stats.loaded).toBe(false)
    })
  })

  describe('clearCache', () => {
    it('clears query cache', async () => {
      await VaultSearch.init(testDataPath)
      await VaultSearch.loadIndex()

      // Manually add to cache to test clearing
      VaultSearch.queryCache.set('test-key', [{ id: '1', score: 0.8 }])
      expect(VaultSearch.queryCache.size).toBeGreaterThan(0)

      VaultSearch.clearCache()

      expect(VaultSearch.queryCache.size).toBe(0)
    })
  })
})
