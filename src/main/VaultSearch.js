import fs from 'fs/promises'
import path from 'path'

/**
 * Robust Vault Search Engine
 *
 * Features:
 * - Fast in-memory search with cosine similarity
 * - Filtering by file type, path, date
 * - Result ranking and re-ranking
 * - Query caching
 * - Memory-efficient loading
 */
class VaultSearch {
  constructor() {
    this.indexPath = null
    this.embeddingsPath = null
    this.index = null
    this.embeddingsBuffer = null
    this.embedder = null
    this.queryCache = new Map()
    this.cacheMaxSize = 100
    this.isLoaded = false
  }

  /**
   * Initialize search engine
   */
  async init(userDataPath) {
    const indexDir = path.join(userDataPath, 'vault-index')
    this.indexPath = path.join(indexDir, 'vault_index.jsonl')
    this.embeddingsPath = path.join(indexDir, 'embeddings.bin')

    // Initialize embedder
    try {
      const { pipeline, env } = await import('@xenova/transformers')
      env.allowLocalModels = false
      env.useBrowserCache = false
      env.useCustomCache = false

      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { progress_callback: null }
      )
      console.log('[VaultSearch] ✓ Embedder initialized')
    } catch (err) {
      console.error('[VaultSearch] Failed to load embedder:', err)
      console.error('[VaultSearch] Error details:', err.message, err.stack)
      throw new Error(`Failed to initialize embedding model: ${err.message}`)
    }

    // Load index into memory
    await this.loadIndex()
  }

  /**
   * Load index and embeddings into memory
   */
  async loadIndex() {
    try {
      // Load index metadata
      if (!(await this.fileExists(this.indexPath))) {
        console.warn('[VaultSearch] Index file not found')
        this.index = []
        this.embeddingsBuffer = null
        this.isLoaded = true
        return
      }

      const content = await fs.readFile(this.indexPath, 'utf-8')
      this.index = content
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))

      // Load embeddings buffer
      if (await this.fileExists(this.embeddingsPath)) {
        this.embeddingsBuffer = await fs.readFile(this.embeddingsPath)
      } else {
        this.embeddingsBuffer = null
      }

      this.isLoaded = true
      console.log(`[VaultSearch] ✓ Loaded ${this.index.length} chunks into memory`)
    } catch (err) {
      console.error('[VaultSearch] Failed to load index:', err)
      this.index = []
      this.embeddingsBuffer = null
      this.isLoaded = true
    }
  }

  /**
   * Reload index (call after indexing)
   */
  async reload() {
    this.isLoaded = false
    this.queryCache.clear()
    await this.loadIndex()
  }

  /**
   * Generate embedding for query
   */
  async generateQueryEmbedding(query) {
    if (!this.embedder) {
      throw new Error('Embedder not initialized. Please wait for initialization to complete.')
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Query must be a non-empty string')
    }

    try {
      const output = await this.embedder(query, { pooling: 'mean', normalize: true })
      const embedding = Array.from(output.data)

      // Validate embedding size
      if (embedding.length !== 384) {
        console.warn(`[VaultSearch] Unexpected embedding size: ${embedding.length}, expected 384`)
      }

      return embedding
    } catch (err) {
      console.error('[VaultSearch] Query embedding failed:', err)
      throw new Error(`Failed to generate query embedding: ${err.message}`)
    }
  }

  /**
   * Get embedding vector for a chunk
   */
  getChunkEmbedding(chunk) {
    if (!this.embeddingsBuffer) {
      return null
    }

    const offset = chunk.embeddingOffset || 0
    const dims = chunk.embeddingLength || 384
    const requiredSize = offset + (dims * 4)

    // Validate buffer size
    if (requiredSize > this.embeddingsBuffer.length) {
      console.warn(`[VaultSearch] Chunk embedding out of bounds: offset=${offset}, required=${requiredSize}, buffer=${this.embeddingsBuffer.length}`)
      return null
    }

    const embedding = new Float32Array(dims)
    for (let i = 0; i < dims; i++) {
      embedding[i] = this.embeddingsBuffer.readFloatLE(offset + i * 4)
    }

    return Array.from(embedding)
  }

  /**
   * Compute cosine similarity
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0

    let dot = 0
    let magA = 0
    let magB = 0

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i]
      magA += vecA[i] * vecA[i]
      magB += vecB[i] * vecB[i]
    }

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB)
    return magnitude > 0 ? dot / magnitude : 0
  }

  /**
   * Search with filters and ranking
   */
  async search(query, options = {}) {
    const {
      threshold = 0.3,
      limit = 20,
      filters = {},
      rerank = true
    } = options

    if (!this.isLoaded || !this.index || this.index.length === 0) {
      return []
    }

    // Check cache
    const cacheKey = JSON.stringify({ query, threshold, filters })
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query)

      // Apply filters first (faster than computing similarity for all)
      let candidates = this.index

      if (filters.filePath) {
        const pattern = filters.filePath instanceof RegExp
          ? filters.filePath
          : new RegExp(filters.filePath, 'i')
        candidates = candidates.filter(chunk => pattern.test(chunk.filePath))
      }

      if (filters.fileType) {
        const ext = filters.fileType.startsWith('.') ? filters.fileType : `.${filters.fileType}`
        candidates = candidates.filter(chunk =>
          path.extname(chunk.filePath).toLowerCase() === ext.toLowerCase()
        )
      }

      if (filters.type) {
        candidates = candidates.filter(chunk => chunk.type === filters.type)
      }

      // Compute similarities
      const results = []

      for (const chunk of candidates) {
        const chunkEmbedding = this.getChunkEmbedding(chunk)
        if (!chunkEmbedding) continue

        const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding)

        if (similarity >= threshold) {
          results.push({
            ...chunk,
            score: similarity
          })
        }
      }

      // Sort by score
      results.sort((a, b) => b.score - a.score)

      // Re-ranking: boost recent files, boost exact matches in text
      if (rerank && results.length > 0) {
        const queryLower = query.toLowerCase()
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

        results.forEach(result => {
          let boost = 1.0

          // Boost if query words appear in text
          const textLower = result.text.toLowerCase()
          const wordMatches = queryWords.filter(word => textLower.includes(word)).length
          boost += wordMatches * 0.1

          // Boost recent files (if metadata has mtime)
          if (result.metadata?.mtime) {
            const age = Date.now() - result.metadata.mtime
            const daysOld = age / (1000 * 60 * 60 * 24)
            if (daysOld < 7) boost += 0.05
            if (daysOld < 1) boost += 0.1
          }

          // Boost if file name matches
          if (result.metadata?.fileName) {
            const fileNameLower = result.metadata.fileName.toLowerCase()
            if (queryWords.some(word => fileNameLower.includes(word))) {
              boost += 0.15
            }
          }

          result.finalScore = result.score * boost
        })

        // Re-sort by final score
        results.sort((a, b) => (b.finalScore || b.score) - (a.finalScore || a.score))
      }

      // Apply limit
      const finalResults = results.slice(0, limit)

      // Cache result
      if (this.queryCache.size >= this.cacheMaxSize) {
        const firstKey = this.queryCache.keys().next().value
        this.queryCache.delete(firstKey)
      }
      this.queryCache.set(cacheKey, finalResults)

      return finalResults
    } catch (err) {
      console.error('[VaultSearch] Search failed:', err)
      return []
    }
  }

  /**
   * Get chunks by file path
   */
  getChunksByFile(filePath) {
    if (!this.isLoaded || !this.index) return []
    return this.index.filter(chunk => chunk.filePath === filePath)
  }

  /**
   * Get similar chunks to a given chunk
   */
  async findSimilar(chunkId, limit = 10) {
    if (!this.isLoaded || !this.index) return []

    const chunk = this.index.find(c => c.id === chunkId)
    if (!chunk) return []

    const chunkEmbedding = this.getChunkEmbedding(chunk)
    if (!chunkEmbedding) return []

    const results = []

    for (const otherChunk of this.index) {
      if (otherChunk.id === chunkId) continue

      const otherEmbedding = this.getChunkEmbedding(otherChunk)
      if (!otherEmbedding) continue

      const similarity = this.cosineSimilarity(chunkEmbedding, otherEmbedding)
      if (similarity > 0.3) {
        results.push({
          ...otherChunk,
          score: similarity
        })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Get index statistics
   */
  getStats() {
    if (!this.isLoaded || !this.index) {
      return { totalChunks: 0, loaded: false }
    }

    const fileCount = new Set(this.index.map(c => c.filePath)).size
    const typeCounts = {}
    this.index.forEach(chunk => {
      typeCounts[chunk.type] = (typeCounts[chunk.type] || 0) + 1
    })

    return {
      totalChunks: this.index.length,
      fileCount,
      typeCounts,
      loaded: true,
      cacheSize: this.queryCache.size
    }
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear()
  }

  /**
   * Utility: Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}

export default new VaultSearch()
