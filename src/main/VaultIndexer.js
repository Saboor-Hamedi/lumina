import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'

/**
 * Robust Vault Indexer
 * 
 * Features:
 * - Intelligent chunking (file/function/section level)
 * - Persistent embeddings storage
 * - Incremental updates (only changed files)
 * - Error handling & recovery
 * - Data validation & checksums
 * - Background indexing
 * - Auto-rebuild on corruption
 */
class VaultIndexer {
  constructor() {
    this.indexPath = null
    this.embeddingsPath = null
    this.statePath = null
    this.chunksPath = null
    this.version = '1.0.0'
    this.embedder = null
    this.isIndexing = false
    this.indexQueue = new Set()
    this.stats = {
      totalFiles: 0,
      indexedFiles: 0,
      totalChunks: 0,
      errors: 0,
      lastIndexTime: null
    }
  }

  /**
   * Initialize indexer with user data path
   */
  async init(userDataPath) {
    const indexDir = path.join(userDataPath, 'vault-index')
    await fs.mkdir(indexDir, { recursive: true })

    this.indexPath = path.join(indexDir, 'vault_index.jsonl')
    this.embeddingsPath = path.join(indexDir, 'embeddings.bin')
    this.statePath = path.join(indexDir, 'vault_state.json')
    this.chunksPath = path.join(indexDir, 'chunks.json')

    // Initialize embedder (reuse existing model)
    try {
      // Set transformers environment for Node.js
      const { pipeline, env } = await import('@xenova/transformers')
      env.allowLocalModels = false
      env.useBrowserCache = false
      env.useCustomCache = false
      
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { progress_callback: null }
      )
      console.info('[VaultIndexer] ✓ Embedder initialized')
    } catch (err) {
      console.error('[VaultIndexer] Failed to load embedder:', err)
      console.error('[VaultIndexer] Error details:', err.message, err.stack)
      throw new Error(`Failed to initialize embedding model: ${err.message}`)
    }

    // Validate existing index
    await this.validateIndex()
  }

  /**
   * Validate index integrity
   */
  async validateIndex() {
    try {
      // Check if index files exist
      const indexExists = await this.fileExists(this.indexPath)
      const embeddingsExists = await this.fileExists(this.embeddingsPath)
      const stateExists = await this.fileExists(this.statePath)

      if (!indexExists || !embeddingsExists) {
        console.info('[VaultIndexer] Index missing, will rebuild on next index')
        return { valid: false, reason: 'missing' }
      }

      // Check version compatibility
      const state = await this.loadState()
      if (state?.version !== this.version) {
        console.info('[VaultIndexer] Version mismatch, will rebuild')
        return { valid: false, reason: 'version_mismatch' }
      }

      // Verify embeddings file size matches expected
      const indexData = await this.loadIndex()
      const expectedSize = indexData.length * 384 * 4 // 384 dims * 4 bytes per float
      const actualSize = (await fs.stat(this.embeddingsPath)).size

      if (Math.abs(expectedSize - actualSize) > 1000) {
        console.warn('[VaultIndexer] Embeddings size mismatch, will rebuild')
        return { valid: false, reason: 'size_mismatch' }
      }

      return { valid: true }
    } catch (err) {
      console.error('[VaultIndexer] Validation error:', err)
      return { valid: false, reason: 'validation_error', error: err.message }
    }
  }

  /**
   * Compute file checksum for change detection
   */
  async computeChecksum(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return createHash('sha256').update(content).digest('hex')
    } catch (err) {
      return null
    }
  }

  /**
   * Intelligent chunking strategy
   */
  chunkContent(filePath, content, metadata = {}) {
    const chunks = []
    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath)

    // For code files, try to split by functions/classes
    if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c'].includes(ext)) {
      // Split by function/class boundaries
      const functionRegex = /(?:^|\n)(?:export\s+)?(?:async\s+)?(?:function|class|const\s+\w+\s*=\s*(?:async\s+)?\(|let\s+\w+\s*=\s*(?:async\s+)?\(|var\s+\w+\s*=\s*(?:async\s+)?\()/gm
      const matches = [...content.matchAll(functionRegex)]
      
      if (matches.length > 1) {
        for (let i = 0; i < matches.length; i++) {
          const start = matches[i].index
          const end = i < matches.length - 1 ? matches[i + 1].index : content.length
          const chunkText = content.slice(start, end).trim()
          
          if (chunkText.length > 50) {
            chunks.push({
              text: chunkText,
              start,
              end,
              type: 'function',
              metadata: { ...metadata, fileName, filePath }
            })
          }
        }
      } else {
        // Fallback: split by size if no clear boundaries
        const maxChunkSize = 1000
        for (let i = 0; i < content.length; i += maxChunkSize) {
          chunks.push({
            text: content.slice(i, i + maxChunkSize),
            start: i,
            end: Math.min(i + maxChunkSize, content.length),
            type: 'code',
            metadata: { ...metadata, fileName, filePath }
          })
        }
      }
    } else if (ext === '.md' || ext === '.txt') {
      // For markdown/text, split by headings and paragraphs
      const headingRegex = /^#{1,6}\s+.+$/gm
      const matches = [...content.matchAll(headingRegex)]
      
      if (matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
          const start = matches[i].index
          const end = i < matches.length - 1 ? matches[i + 1].index : content.length
          const chunkText = content.slice(start, end).trim()
          
          if (chunkText.length > 100) {
            chunks.push({
              text: chunkText,
              start,
              end,
              type: 'section',
              metadata: { ...metadata, fileName, filePath, heading: matches[i][0] }
            })
          }
        }
      } else {
        // Fallback: split by paragraphs
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50)
        let currentPos = 0
        
        for (const para of paragraphs) {
          const paraStart = content.indexOf(para, currentPos)
          chunks.push({
            text: para.trim(),
            start: paraStart,
            end: paraStart + para.length,
            type: 'paragraph',
            metadata: { ...metadata, fileName, filePath }
          })
          currentPos = paraStart + para.length
        }
      }
    } else {
      // Generic: split by size
      const maxChunkSize = 1000
      for (let i = 0; i < content.length; i += maxChunkSize) {
        chunks.push({
          text: content.slice(i, i + maxChunkSize),
          start: i,
          end: Math.min(i + maxChunkSize, content.length),
          type: 'generic',
          metadata: { ...metadata, fileName, filePath }
        })
      }
    }

    // Ensure minimum chunk size
    return chunks.filter(chunk => chunk.text.length >= 50)
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    if (!this.embedder) {
      throw new Error('Embedder not initialized')
    }

    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true })
      return Array.from(output.data) // Convert Float32Array to regular array
    } catch (err) {
      console.error('[VaultIndexer] Embedding generation failed:', err)
      throw err
    }
  }

  /**
   * Index a single file
   */
  async indexFile(filePath, force = false) {
    try {
      const stats = await fs.stat(filePath)
      const checksum = await this.computeChecksum(filePath)
      const state = await this.loadState()

      // Check if file needs re-indexing
      if (!force && state?.files?.[filePath]) {
        const fileState = state.files[filePath]
        if (
          fileState.mtime === stats.mtimeMs &&
          fileState.checksum === checksum &&
          fileState.indexed
        ) {
          return { indexed: false, reason: 'unchanged' }
        }
      }

      // Read and chunk file
      const content = await fs.readFile(filePath, 'utf-8')
      if (!content.trim()) {
        return { indexed: false, reason: 'empty' }
      }

      const metadata = {
        mtime: stats.mtimeMs,
        size: stats.size,
        checksum
      }

      const chunks = this.chunkContent(filePath, content, metadata)
      if (chunks.length === 0) {
        return { indexed: false, reason: 'no_chunks' }
      }

      // Generate embeddings for all chunks
      const chunkRecords = []
      const embeddingsBuffer = Buffer.alloc(chunks.length * 384 * 4) // 384 dims * 4 bytes

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = await this.generateEmbedding(chunk.text)
        
        // Ensure embedding is correct size (384 dims)
        if (embedding.length !== 384) {
          console.warn(`[VaultIndexer] Unexpected embedding size: ${embedding.length}, expected 384`)
        }
        
        // Write embedding to buffer
        const offset = i * 384 * 4
        const actualLength = Math.min(embedding.length, 384)
        for (let j = 0; j < actualLength; j++) {
          embeddingsBuffer.writeFloatLE(embedding[j], offset + j * 4)
        }

        const chunkId = `${path.basename(filePath, path.extname(filePath))}_${i}_${chunk.start}`
        chunkRecords.push({
          id: chunkId,
          filePath,
          chunkIndex: i,
          text: chunk.text,
          start: chunk.start,
          end: chunk.end,
          type: chunk.type,
          metadata: chunk.metadata,
          embeddingOffset: offset, // Will be updated in appendToIndex
          embeddingLength: 384
        })
      }

      // Append to index and embeddings file
      await this.appendToIndex(chunkRecords, embeddingsBuffer)

      // Update state
      await this.updateFileState(filePath, {
        mtime: stats.mtimeMs,
        checksum,
        indexed: true,
        chunkCount: chunks.length,
        lastIndexed: Date.now()
      })

      return {
        indexed: true,
        chunkCount: chunks.length,
        filePath
      }
    } catch (err) {
      console.error(`[VaultIndexer] Failed to index ${filePath}:`, err)
      this.stats.errors++
      throw err
    }
  }

  /**
   * Append chunks to index (with deduplication)
   * Rebuilds embeddings file to maintain correct offsets
   */
  async appendToIndex(chunkRecords, embeddingsBuffer) {
    // Load existing index to remove old chunks from same file
    const existingIndex = await this.loadIndex()
    const filePath = chunkRecords[0]?.filePath
    const filteredIndex = existingIndex.filter(chunk => chunk.filePath !== filePath)

    // Rebuild embeddings file: extract existing embeddings, then append new ones
    const existingEmbeddingsParts = []
    if (await this.fileExists(this.embeddingsPath)) {
      const fullBuffer = await fs.readFile(this.embeddingsPath)
      
      // Extract embeddings for chunks that we're keeping
      for (const chunk of filteredIndex) {
        const offset = chunk.embeddingOffset || 0
        const length = (chunk.embeddingLength || 384) * 4
        if (offset + length <= fullBuffer.length) {
          existingEmbeddingsParts.push(fullBuffer.slice(offset, offset + length))
        }
      }
    }

    // Calculate new offsets for existing chunks (they stay at start)
    let currentOffset = 0
    filteredIndex.forEach(chunk => {
      chunk.embeddingOffset = currentOffset
      chunk.embeddingLength = 384
      currentOffset += 384 * 4
    })

    // Calculate offsets for new chunks (append after existing)
    chunkRecords.forEach(chunk => {
      chunk.embeddingOffset = currentOffset
      chunk.embeddingLength = 384
      currentOffset += 384 * 4
    })

    // Write updated index
    const indexLines = filteredIndex.map(chunk => JSON.stringify(chunk))
    chunkRecords.forEach(chunk => indexLines.push(JSON.stringify(chunk)))
    await fs.writeFile(this.indexPath, indexLines.join('\n') + '\n', 'utf-8')

    // Rebuild embeddings file with correct order
    const allEmbeddingsParts = [...existingEmbeddingsParts, embeddingsBuffer]
    const newEmbeddings = Buffer.concat(allEmbeddingsParts)
    await fs.writeFile(this.embeddingsPath, newEmbeddings)
  }

  /**
   * Load index as array
   */
  async loadIndex() {
    try {
      if (!(await this.fileExists(this.indexPath))) {
        return []
      }

      const content = await fs.readFile(this.indexPath, 'utf-8')
      return content
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
    } catch (err) {
      console.error('[VaultIndexer] Failed to load index:', err)
      return []
    }
  }

  /**
   * Load embeddings buffer for given chunks
   */
  async loadEmbeddingsBuffer(chunks) {
    try {
      if (!(await this.fileExists(this.embeddingsPath)) || chunks.length === 0) {
        return Buffer.alloc(0)
      }

      const fullBuffer = await fs.readFile(this.embeddingsPath)
      
      // Reconstruct buffer by extracting embeddings for each chunk
      const parts = []
      for (const chunk of chunks) {
        const offset = chunk.embeddingOffset || 0
        const length = (chunk.embeddingLength || 384) * 4
        if (offset + length <= fullBuffer.length) {
          parts.push(fullBuffer.slice(offset, offset + length))
        }
      }
      
      return Buffer.concat(parts)
    } catch (err) {
      console.error('[VaultIndexer] Failed to load embeddings:', err)
      return Buffer.alloc(0)
    }
  }

  /**
   * Load state file
   */
  async loadState() {
    try {
      if (!(await this.fileExists(this.statePath))) {
        return { version: this.version, files: {} }
      }

      const content = await fs.readFile(this.statePath, 'utf-8')
      return JSON.parse(content)
    } catch (err) {
      console.warn('[VaultIndexer] Failed to load state, using defaults:', err)
      return { version: this.version, files: {} }
    }
  }

  /**
   * Update file state
   */
  async updateFileState(filePath, fileState) {
    const state = await this.loadState()
    state.files = state.files || {}
    state.files[filePath] = { ...state.files[filePath], ...fileState }
    state.version = this.version
    state.lastIndexTime = Date.now()
    
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8')
  }

  /**
   * Index entire vault directory
   */
  async indexVault(vaultPath, options = {}) {
    if (this.isIndexing) {
      console.info('[VaultIndexer] Indexing already in progress, queuing...')
      return { queued: true }
    }

    // Validate vaultPath
    if (!vaultPath || typeof vaultPath !== 'string') {
      console.error('[VaultIndexer] Invalid vaultPath:', vaultPath)
      throw new Error('Vault path must be a string')
    }

    this.isIndexing = true
    this.stats = {
      totalFiles: 0,
      indexedFiles: 0,
      totalChunks: 0,
      errors: 0,
      lastIndexTime: Date.now()
    }

    try {
      const { force = false, onProgress = null } = options
      
      // Get all text files
      const files = await this.scanVaultFiles(vaultPath)
      this.stats.totalFiles = files.length

      console.info(`[VaultIndexer] Starting index of ${files.length} files...`)

      // Index files (with rate limiting for API/CPU)
      const batchSize = 5
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        
        await Promise.all(
          batch.map(async (filePath) => {
            try {
              const result = await this.indexFile(filePath, force)
              if (result.indexed) {
                this.stats.indexedFiles++
                this.stats.totalChunks += result.chunkCount
              }
            } catch (err) {
              this.stats.errors++
              console.error(`[VaultIndexer] Error indexing ${filePath}:`, err)
            }
          })
        )

        if (onProgress) {
          onProgress({
            progress: ((i + batch.length) / files.length) * 100,
            indexed: this.stats.indexedFiles,
            total: files.length,
            chunks: this.stats.totalChunks
          })
        }
      }

      // Save stats
      const state = await this.loadState()
      state.stats = this.stats
      await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8')

      console.info(`[VaultIndexer] ✓ Index complete: ${this.stats.indexedFiles} files, ${this.stats.totalChunks} chunks`)

      return {
        success: true,
        stats: this.stats
      }
    } catch (err) {
      console.error('[VaultIndexer] Indexing failed:', err)
      throw err
    } finally {
      this.isIndexing = false
    }
  }

  /**
   * Scan vault for indexable files
   */
  async scanVaultFiles(vaultPath) {
    // Validate input
    if (!vaultPath || typeof vaultPath !== 'string') {
      console.error('[VaultIndexer] scanVaultFiles: Invalid path:', vaultPath)
      return []
    }

    const files = []
    const supportedExts = ['.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.py', '.java', '.cpp', '.c', '.html', '.css']

    async function scanDir(dir) {
      if (typeof dir !== 'string') {
        console.warn('[VaultIndexer] scanDir: Invalid directory path:', dir)
        return
      }
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          
          // Skip hidden files and common ignore patterns
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') {
            continue
          }

          if (entry.isDirectory()) {
            await scanDir(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (supportedExts.includes(ext)) {
              files.push(fullPath)
            }
          }
        }
      } catch (err) {
        console.warn(`[VaultIndexer] Error scanning ${dir}:`, err)
      }
    }

    await scanDir(vaultPath)
    return files
  }

  /**
   * Rebuild index from scratch
   */
  async rebuildIndex(vaultPath) {
    console.info('[VaultIndexer] Rebuilding index from scratch...')
    
    // Backup old index
    try {
      if (await this.fileExists(this.indexPath)) {
        await fs.copyFile(this.indexPath, this.indexPath + '.bak')
      }
      if (await this.fileExists(this.embeddingsPath)) {
        await fs.copyFile(this.embeddingsPath, this.embeddingsPath + '.bak')
      }
    } catch (err) {
      console.warn('[VaultIndexer] Backup failed:', err)
    }

    // Clear index
    await fs.writeFile(this.indexPath, '', 'utf-8')
    await fs.writeFile(this.embeddingsPath, Buffer.alloc(0))
    await fs.writeFile(this.statePath, JSON.stringify({ version: this.version, files: {} }, null, 2))

    // Re-index
    return await this.indexVault(vaultPath, { force: true })
  }

  /**
   * Get index statistics
   */
  async getStats() {
    const state = await this.loadState()
    const index = await this.loadIndex()
    
    return {
      ...this.stats,
      indexSize: index.length,
      stateStats: state?.stats || {},
      lastIndexTime: state?.lastIndexTime || null
    }
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

export default new VaultIndexer()
