import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'

class Mutex {
  constructor() {
    this.queue = []
    this.locked = false
  }
  async lock() {
    return new Promise((resolve) => {
      if (this.locked) {
        this.queue.push(resolve)
      } else {
        this.locked = true
        resolve()
      }
    })
  }
  unlock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      next()
    } else {
      this.locked = false
    }
  }
}

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
    this._worker = null
    this._workerRequestId = 0
    this._workerPending = new Map()
    this.isIndexing = false
    this.indexQueue = new Set()
    this.writeLock = new Mutex()
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

    // Validate existing index
    await this.validateIndex()
  }

  /**
   * Ensure worker thread is alive for embedding computation
   */
  async _ensureWorker() {
    if (this._worker) return this._worker

    const { Worker } = await import('worker_threads')

    this._worker = new Worker(new URL('./indexer-worker.js', import.meta.url))

    this._worker.on('message', (msg) => {
      if (msg.type === 'warmup-done') {
        // Worker model pre-warmed, nothing else to do
      } else if (msg.type === 'embeddings' && msg.batchId !== undefined) {
        const resolve = this._workerPending.get(msg.batchId)
        if (resolve) {
          this._workerPending.delete(msg.batchId)
          resolve(msg.results)
        }
      } else if (msg.type === 'error' && msg.batchId !== undefined) {
        const reject = this._workerPending.get(msg.batchId)
        if (reject) {
          this._workerPending.delete(msg.batchId)
          reject(new Error(msg.error))
        }
      }
    })

    this._worker.on('error', (err) => {
      console.error('[VaultIndexer] Worker error:', err)
      this._worker = null
    })

    this._worker.on('exit', (code) => {
      console.info(`[VaultIndexer] Worker exited with code ${code}`)
      this._worker = null
    })

    return this._worker
  }

  async warmWorker() {
    try {
      const worker = await this._ensureWorker()
      worker.postMessage({ type: 'warmup' })
    } catch (err) {
      console.warn('[VaultIndexer] Worker pre-warm failed:', err)
    }
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

      if (!indexExists || !embeddingsExists || !stateExists) {
        console.info('[VaultIndexer] Index missing, will rebuild on next index')
        return { valid: false, reason: 'missing' }
      }

      // Check version compatibility
      const state = await this.loadState()
      if (state?.version !== this.version) {
        console.info('[VaultIndexer] Version mismatch, will rebuild')
        return { valid: false, reason: 'version_mismatch' }
      }

      const stats = await fs.stat(this.embeddingsPath)
      if (stats.size === 0) {
        console.warn('[VaultIndexer] Embeddings file is empty, will rebuild')
        return { valid: false, reason: 'empty_embeddings' }
      }

      const indexStats = await fs.stat(this.indexPath)
      if (indexStats.size === 0) {
        console.warn('[VaultIndexer] Index file is empty, will rebuild')
        return { valid: false, reason: 'empty_index' }
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
      const functionRegex =
        /(?:^|\n)(?:export\s+)?(?:async\s+)?(?:function|class|const\s+\w+\s*=\s*(?:async\s+)?\(|let\s+\w+\s*=\s*(?:async\s+)?\(|var\s+\w+\s*=\s*(?:async\s+)?\()/gm
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
        const maxChunkSize = 400
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
        const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 50)
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
      const maxChunkSize = 400
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
    return chunks.filter((chunk) => chunk.text.length >= 50)
  }

  /**
   * Generate embedding via worker thread
   */
  async generateEmbedding(text) {
    const worker = await this._ensureWorker()
    const id = this._workerRequestId++

    return new Promise((resolve, reject) => {
      this._workerPending.set(id, (results) => {
        if (results && results.length > 0) resolve(results[0])
        else reject(new Error('No embedding returned'))
      })
      worker.postMessage({ type: 'embed-batch', texts: [text], batchId: id })
    })
  }

  /**
   * Fast check if file needs indexing without reading contents
   */
  async needsIndexing(filePath, force = false, state = null) {
    if (force) return true

    try {
      const stats = await fs.stat(filePath)
      if (!state?.files?.[filePath]) return true

      const fileState = state.files[filePath]

      const mtimeMatch = Math.abs(fileState.mtime - stats.mtimeMs) < 1000 // 1 second tolerace
      const sizeMatch = fileState.size === stats.size

      if (mtimeMatch && sizeMatch && fileState.indexed) {
        return false
      }
      return true
    } catch (err) {
      return true
    }
  }

  /**
   * Index a single file
   */
  async indexFile(filePath, force = false, state = null) {
    try {
      const stats = await fs.stat(filePath)
      state = state || await this.loadState()

      // Quick fast-path check without reading file content or hashing
      if (!force && state?.files?.[filePath]) {
        const fileState = state.files[filePath]
        if (
          fileState.size === stats.size &&
          fileState.mtime === stats.mtimeMs &&
          fileState.indexed
        ) {
          return { indexed: false, reason: 'unchanged' }
        }
      }

      // If file size/mtime changed (or it's new), compute checksum to be absolutely sure
      const checksum = await this.computeChecksum(filePath)

      if (!force && state?.files?.[filePath]) {
        const fileState = state.files[filePath]
        if (fileState.checksum === checksum && fileState.indexed) {
          return { 
            indexed: false, 
            reason: 'unchanged_checksum',
            stateUpdate: {
              ...fileState,
              mtime: stats.mtimeMs,
              size: stats.size,
              lastIndexed: Date.now()
            }
          }
        }
      }

      // Read and chunk file
      const content = await fs.readFile(filePath, 'utf-8')
      if (!content.trim()) {
        return { 
          indexed: true, 
          chunkCount: 0, 
          reason: 'empty',
          stateUpdate: { mtime: stats.mtimeMs, size: stats.size, checksum, indexed: true, chunkCount: 0, lastIndexed: Date.now() }
        }
      }

      const metadata = {
        mtime: stats.mtimeMs,
        size: stats.size,
        checksum
      }

      const chunks = this.chunkContent(filePath, content, metadata)
      if (chunks.length === 0) {
        return { 
          indexed: true, 
          chunkCount: 0, 
          reason: 'no_chunks',
          stateUpdate: { mtime: stats.mtimeMs, size: stats.size, checksum, indexed: true, chunkCount: 0, lastIndexed: Date.now() }
        }
      }

      // Generate embeddings for all chunks
      const chunkRecords = []
      const embeddingsBuffer = Buffer.alloc(chunks.length * 384 * 4) // 384 dims * 4 bytes

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = await this.generateEmbedding(chunk.text)

        // Ensure embedding is correct size (384 dims)
        if (embedding.length !== 384) {
          console.warn(
            `[VaultIndexer] Unexpected embedding size: ${embedding.length}, expected 384`
          )
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

      return {
        indexed: true,
        chunkCount: chunks.length,
        filePath,
        chunkRecords,
        embeddingsBuffer,
        stateUpdate: {
          mtime: stats.mtimeMs,
          size: stats.size,
          checksum,
          indexed: true,
          chunkCount: chunks.length,
          lastIndexed: Date.now()
        }
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
  async appendToIndex(chunkRecords, embeddingsBuffer, updatedFiles) {
    await this.writeLock.lock()
    try {
      const updatedFilesSet = new Set(updatedFiles || [])
      // Load existing index to remove old chunks from updated files
      const existingIndex = await this.loadIndex()
      const filteredIndex = existingIndex.filter((chunk) => !updatedFilesSet.has(chunk.filePath))

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
      filteredIndex.forEach((chunk) => {
        chunk.embeddingOffset = currentOffset
        chunk.embeddingLength = 384
        currentOffset += 384 * 4
      })

      // Calculate offsets for new chunks (append after existing)
      chunkRecords.forEach((chunk) => {
        chunk.embeddingOffset = currentOffset
        chunk.embeddingLength = 384
        currentOffset += 384 * 4
      })

      // Write updated index
      const indexLines = filteredIndex.map((chunk) => JSON.stringify(chunk))
      chunkRecords.forEach((chunk) => indexLines.push(JSON.stringify(chunk)))
      await fs.writeFile(this.indexPath, indexLines.join('\n') + '\n', 'utf-8')

      // Rebuild embeddings file with correct order
      const allEmbeddingsParts = [...existingEmbeddingsParts, embeddingsBuffer]
      const newEmbeddings = Buffer.concat(allEmbeddingsParts)
      await fs.writeFile(this.embeddingsPath, newEmbeddings)
    } finally {
      this.writeLock.unlock()
    }
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
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
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
        console.warn('[VaultIndexer] No state file found, creating new')
        return { version: this.version, files: {} }
      }

      const content = await fs.readFile(this.statePath, 'utf-8')
      if (!content || content.trim() === '') {
        console.warn('[VaultIndexer] State file empty, creating new')
        return { version: this.version, files: {} }
      }
      const parsed = JSON.parse(content)

      // Ensure files object exists
      if (!parsed.files || typeof parsed.files !== 'object') {
        console.warn('[VaultIndexer] State missing files object, resetting')
        parsed.files = {}
      }

      // Log how many files are tracked
      console.log(
        `[VaultIndexer] Loaded state with ${Object.keys(parsed.files).length} tracked files`
      )

      return parsed
    } catch (err) {
      console.warn(
        '[VaultIndexer] State file corrupted or unreadable. Automatically rebuilding index state.'
      )
      return { version: this.version, files: {} }
    }
  }

  /**
   * Update file state
   */
  async updateFileState(filePath, fileState) {
    await this.writeLock.lock()
    try {
      const state = await this.loadState()
      state.files = state.files || {}
      state.files[filePath] = { ...state.files[filePath], ...fileState }
      state.files[filePath].indexed = true // Force set this
      state.version = this.version
      state.lastIndexTime = Date.now()

      await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8')
      // Verify it saved
      const saved = await fs.readFile(this.statePath, 'utf-8')
      console.log('[VaultIndexer] State saved, size:', saved.length)
    } finally {
      this.writeLock.unlock()
    }
  }

  /**
   * Index entire vault directory
   */
  async indexVault(vaultPath, options = {}) {
    if (this.isIndexing) {
      console.info('[VaultIndexer] Indexing already in progress, queuing...')
      return { queued: true }
    }

    const validation = await this.validateIndex()
    const shouldRebuild = !validation.valid
    if (shouldRebuild) {
        console.info('[VaultIndexer] Rebuild required, clearing index...')
        await this.clearIndex()
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

      if (onProgress) {
        onProgress({
          progress: 0,
          indexed: 0,
          total: 0,
          chunks: 0,
          stage: 'starting'
        })
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      // Get all text files
      const files = await this.scanVaultFiles(vaultPath, onProgress)
      this.stats.totalFiles = files.length
      if (onProgress) {
        onProgress({
          progress: 0,
          indexed: 0,
          total: files.length,
          found: files.length,
          stage: 'scanned'
        })
      }
      const state = await this.loadState()
      console.log('[VaultIndexer] State files count:', Object.keys(state.files || {}).length)

      const filesToProcess = []
      const batchSize = 100
      let lastYieldTime = Date.now()
      let checkedCount = 0

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        const results = await Promise.all(
          batch.map(async (filePath) => {
            const needs = await this.needsIndexing(filePath, force, state)
            return { filePath, needs }
          })
        )

        for (const res of results) {
          if (res.needs) {
            filesToProcess.push(res.filePath)
          }
        }
        checkedCount += batch.length

        if (onProgress && Date.now() - lastYieldTime > 16) {
          onProgress({
            progress: 0,
            indexed: 0,
            total: files.length,
            checked: checkedCount,
            stage: 'checking'
          })
          lastYieldTime = Date.now()
        }
        
        // CRITICAL: Yield to OS message pump after EVERY batch of 100 files
        // to prevent window drag/resize from freezing on massive vaults.
        await new Promise((resolve) => setTimeout(resolve, 2))
      }
      console.log('[VaultIndexer] Files to process:', filesToProcess.length)

      if (filesToProcess.length === 0) {
        if (onProgress) {
          onProgress({
            progress: 100,
            indexed: 0,
            total: files.length,
            chunks: this.stats.totalChunks,
            stage: 'up-to-date'
          })
        }

        console.info('[VaultIndexer] ✓ Index up to date (0 files modified)')
        return {
          indexedFiles: 0,
          totalChunks: this.stats.totalChunks,
          errors: 0
        }
      }

      console.info(`[VaultIndexer] Found ${filesToProcess.length} files that need indexing`)

      // Broadcast initial progress immediately so UI pops up before ONNX model blocks thread
      if (onProgress) {
        onProgress({
          progress: 0,
          indexed: 0,
          total: filesToProcess.length,
          chunks: this.stats.totalChunks
        })
      }

      // Index files and collect results
      const allChunkRecords = []
      const allEmbeddingsBuffers = []
      const updatedFilesSet = new Set()
      const accumulatedFileStates = {}

      for (let i = 0; i < filesToProcess.length; i++) {
        const filePath = filesToProcess[i]
        try {
          const result = await this.indexFile(filePath, force, state)
          
          if (result.stateUpdate) {
            accumulatedFileStates[filePath] = result.stateUpdate
          }

          if (result.indexed) {
            this.stats.indexedFiles++
            this.stats.totalChunks += result.chunkCount
            updatedFilesSet.add(filePath)

            if (result.chunkRecords && result.chunkRecords.length > 0) {
              allChunkRecords.push(...result.chunkRecords)
              allEmbeddingsBuffers.push(result.embeddingsBuffer)
            }
          }
        } catch (err) {
          this.stats.errors++
          console.error(`[VaultIndexer] Error indexing ${filePath}:`, err)
        }

        if (onProgress) {
          onProgress({
            progress: ((i + 1) / filesToProcess.length) * 100,
            indexed: this.stats.indexedFiles,
            total: filesToProcess.length,
            chunks: this.stats.totalChunks
          })
        }
      }

      // Batch write index and embeddings
      if (updatedFilesSet.size > 0) {
        const combinedEmbeddings = Buffer.concat(allEmbeddingsBuffers)
        await this.appendToIndex(allChunkRecords, combinedEmbeddings, Array.from(updatedFilesSet))
      }

      // Batch write state
      const finalState = await this.loadState()
      finalState.files = { ...finalState.files, ...accumulatedFileStates }
      finalState.stats = this.stats
      finalState.lastIndexTime = Date.now()
      await fs.writeFile(this.statePath, JSON.stringify(finalState, null, 2), 'utf-8')

      // Final progress broadcast to ensure UI closes
      if (onProgress) {
        onProgress({
          progress: 100,
          indexed: this.stats.indexedFiles,
          total: filesToProcess.length,
          chunks: this.stats.totalChunks
        })
      }

      console.info(
        `[VaultIndexer] ✓ Index complete: ${this.stats.indexedFiles} files, ${this.stats.totalChunks} chunks`
      )

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

  async clearIndex() {
  await this.writeLock.lock()
  try {
    await fs.writeFile(this.indexPath, '', 'utf-8')
    await fs.writeFile(this.embeddingsPath, Buffer.alloc(0))
    await fs.writeFile(this.statePath, JSON.stringify({ 
      version: this.version, 
      files: {} 
    }, null, 2))
    console.info('[VaultIndexer] ✓ Index cleared')
  } finally {
    this.writeLock.unlock()
  }
}

  /**
   * Scan vault for indexable files
   */
  async scanVaultFiles(vaultPath, onProgress = null) {
    // Validate input
    if (!vaultPath || typeof vaultPath !== 'string') {
      console.error('[VaultIndexer] scanVaultFiles: Invalid path:', vaultPath)
      return []
    }

    const files = []
    const supportedExts = [
      '.md',
      '.txt',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.json',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.html',
      '.css'
    ]
    let entryCount = 0

    let lastYieldTime = Date.now()

    async function scanDir(dir) {
      if (typeof dir !== 'string') {
        console.warn('[VaultIndexer] scanDir: Invalid directory path:', dir)
        return
      }
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          entryCount += 1
          const fullPath = path.join(dir, entry.name)

          if (
            entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === '.git'
          ) {
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

          // UI Progress and Yielding - max 60fps (16ms)
          if (onProgress && Date.now() - lastYieldTime > 16) {
            onProgress({
              progress: 0,
              indexed: 0,
              total: 0,
              found: files.length,
              checked: entryCount,
              stage: 'scanning'
            })
            lastYieldTime = Date.now()
          }
          
          // CRITICAL: Yield to OS message pump after EVERY 50 files
          // to prevent window drag/resize from freezing on massive vaults.
          if (entryCount % 50 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 2))
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
  async rebuildIndex(vaultPath, options = {}) {
    console.info('[VaultIndexer] Rebuilding index from scratch...')

    await this.writeLock.lock()
    try {
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
      await fs.writeFile(
        this.statePath,
        JSON.stringify({ version: this.version, files: {} }, null, 2)
      )
    } finally {
      this.writeLock.unlock()
    }

    // Re-index
    return await this.indexVault(vaultPath, { force: true, ...options })
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
