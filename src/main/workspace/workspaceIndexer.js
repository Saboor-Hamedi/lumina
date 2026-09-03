import fs from 'fs/promises'
import fsSync from 'fs'
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

class WorkspaceIndexer {
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

  async init(userDataPath) {
    const indexDir = path.join(userDataPath, 'vault-index')
    await fs.mkdir(indexDir, { recursive: true })

    this.indexPath = path.join(indexDir, 'vault_index.jsonl')
    this.embeddingsPath = path.join(indexDir, 'embeddings.bin')
    this.statePath = path.join(indexDir, 'vault_state.json')
    this.chunksPath = path.join(indexDir, 'chunks.json')

    await this.validateIndex()
  }

  _resolveWorkerTarget() {
    try {
      const u1 = new URL('./indexer-worker.js', import.meta.url)
      if (fsSync.existsSync(u1)) return u1
    } catch (e) {}
    try {
      const u2 = new URL('../indexer-worker.js', import.meta.url)
      if (fsSync.existsSync(u2)) return u2
    } catch (e) {}
    if (typeof __dirname !== 'undefined') {
      const p1 = path.join(__dirname, 'indexer-worker.js')
      if (fsSync.existsSync(p1)) return p1
      const p2 = path.join(__dirname, '../indexer-worker.js')
      if (fsSync.existsSync(p2)) return p2
    }
    return new URL('./indexer-worker.js', import.meta.url)
  }

  async _ensureWorker() {
    if (this._worker) return this._worker

    const { Worker } = await import('worker_threads')

    this._worker = new Worker(this._resolveWorkerTarget())

    this._worker.on('message', (msg) => {
      if (msg.type === 'warmup-done') {
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
      console.error('[WorkspaceIndexer] Worker error:', err)
      this._worker = null
    })

    this._worker.on('exit', (code) => {
      console.info(`[WorkspaceIndexer] Worker exited with code ${code}`)
      this._worker = null
    })

    return this._worker
  }

  async warmWorker() {
    try {
      const worker = await this._ensureWorker()
      worker.postMessage({ type: 'warmup' })
    } catch (err) {
      console.warn('[WorkspaceIndexer] Worker pre-warm failed:', err)
    }
  }

  async validateIndex() {
    try {
      const indexExists = await this.fileExists(this.indexPath)
      const embeddingsExists = await this.fileExists(this.embeddingsPath)
      const stateExists = await this.fileExists(this.statePath)

      if (!indexExists || !embeddingsExists || !stateExists) {
        console.info('[WorkspaceIndexer] Index missing, will rebuild on next index')
        return { valid: false, reason: 'missing' }
      }

      const state = await this.loadState()
      if (state?.version !== this.version) {
        console.info('[WorkspaceIndexer] Version mismatch, will rebuild')
        return { valid: false, reason: 'version_mismatch' }
      }

      const stats = await fs.stat(this.embeddingsPath)
      if (stats.size === 0) {
        console.warn('[WorkspaceIndexer] Embeddings file is empty, will rebuild')
        return { valid: false, reason: 'empty_embeddings' }
      }

      const indexStats = await fs.stat(this.indexPath)
      if (indexStats.size === 0) {
        console.warn('[WorkspaceIndexer] Index file is empty, will rebuild')
        return { valid: false, reason: 'empty_index' }
      }

      return { valid: true }
    } catch (err) {
      console.error('[WorkspaceIndexer] Validation error:', err)
      return { valid: false, reason: 'validation_error', error: err.message }
    }
  }

  async computeChecksum(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return createHash('sha256').update(content).digest('hex')
    } catch (err) {
      return null
    }
  }

  chunkContent(filePath, content, metadata = {}) {
    const chunks = []
    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath)

    if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c'].includes(ext)) {
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

    return chunks.filter((chunk) => chunk.text.length >= 50)
  }

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

  async needsIndexing(filePath, force = false, state = null) {
    if (force) return true

    try {
      const stats = await fs.stat(filePath)
      if (!state?.files?.[filePath]) return true

      const fileState = state.files[filePath]

      const mtimeMatch = Math.abs(fileState.mtime - stats.mtimeMs) < 1000
      const sizeMatch = fileState.size === stats.size

      if (mtimeMatch && sizeMatch && fileState.indexed) {
        return false
      }
      return true
    } catch (err) {
      return true
    }
  }

  async indexFile(filePath, force = false, state = null) {
    try {
      const stats = await fs.stat(filePath)
      state = state || (await this.loadState())

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

      const content = await fs.readFile(filePath, 'utf-8')
      if (!content.trim()) {
        return {
          indexed: true,
          chunkCount: 0,
          reason: 'empty',
          stateUpdate: {
            mtime: stats.mtimeMs,
            size: stats.size,
            checksum,
            indexed: true,
            chunkCount: 0,
            lastIndexed: Date.now()
          }
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
          stateUpdate: {
            mtime: stats.mtimeMs,
            size: stats.size,
            checksum,
            indexed: true,
            chunkCount: 0,
            lastIndexed: Date.now()
          }
        }
      }

      const chunkRecords = []
      const embeddingsBuffer = Buffer.alloc(chunks.length * 384 * 4)

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = await this.generateEmbedding(chunk.text)

        if (embedding.length !== 384) {
          console.warn(
            `[WorkspaceIndexer] Unexpected embedding size: ${embedding.length}, expected 384`
          )
        }

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
          embeddingOffset: offset,
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
      console.error(`[WorkspaceIndexer] Failed to index ${filePath}:`, err)
      this.stats.errors++
      throw err
    }
  }

  async appendToIndex(chunkRecords, embeddingsBuffer, updatedFiles) {
    await this.writeLock.lock()
    try {
      const updatedFilesSet = new Set(
        (updatedFiles || [])
          .map((f) =>
            typeof f === 'string' ? path.resolve(f).replace(/\\/g, '/').toLowerCase() : ''
          )
          .filter(Boolean)
      )

      const existingIndex = await this.loadIndex()
      const filteredIndex = existingIndex.filter((chunk) => {
        if (!chunk?.filePath) return false
        const chunkNorm = path.resolve(chunk.filePath).replace(/\\/g, '/').toLowerCase()
        return !updatedFilesSet.has(chunkNorm)
      })

      const existingEmbeddingsParts = []
      if (await this.fileExists(this.embeddingsPath)) {
        const fullBuffer = await fs.readFile(this.embeddingsPath)

        for (const chunk of filteredIndex) {
          const offset = chunk.embeddingOffset || 0
          const length = (chunk.embeddingLength || 384) * 4
          if (offset + length <= fullBuffer.length) {
            existingEmbeddingsParts.push(fullBuffer.slice(offset, offset + length))
          }
        }
      }

      let currentOffset = 0
      filteredIndex.forEach((chunk) => {
        chunk.embeddingOffset = currentOffset
        chunk.embeddingLength = 384
        currentOffset += 384 * 4
      })

      chunkRecords.forEach((chunk) => {
        chunk.embeddingOffset = currentOffset
        chunk.embeddingLength = 384
        currentOffset += 384 * 4
      })

      const indexLines = filteredIndex.map((chunk) => JSON.stringify(chunk))
      chunkRecords.forEach((chunk) => indexLines.push(JSON.stringify(chunk)))
      await fs.writeFile(
        this.indexPath,
        indexLines.length ? indexLines.join('\n') + '\n' : '',
        'utf-8'
      )

      const allEmbeddingsParts = [...existingEmbeddingsParts]
      if (embeddingsBuffer && embeddingsBuffer.length > 0) {
        allEmbeddingsParts.push(embeddingsBuffer)
      }
      const newEmbeddings = Buffer.concat(allEmbeddingsParts)
      await fs.writeFile(this.embeddingsPath, newEmbeddings)
    } finally {
      this.writeLock.unlock()
    }
  }

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
      console.error('[WorkspaceIndexer] Failed to load index:', err)
      return []
    }
  }

  async loadEmbeddingsBuffer(chunks) {
    try {
      if (!(await this.fileExists(this.embeddingsPath)) || chunks.length === 0) {
        return Buffer.alloc(0)
      }

      const fullBuffer = await fs.readFile(this.embeddingsPath)

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
      console.error('[WorkspaceIndexer] Failed to load embeddings:', err)
      return Buffer.alloc(0)
    }
  }

  async loadState() {
    try {
      if (!(await this.fileExists(this.statePath))) {
        return { version: this.version, files: {} }
      }

      const content = await fs.readFile(this.statePath, 'utf-8')
      if (!content || content.trim() === '') {
        return { version: this.version, files: {} }
      }
      const parsed = JSON.parse(content)

      if (!parsed.files || typeof parsed.files !== 'object') {
        parsed.files = {}
      }

      return parsed
    } catch (err) {
      return { version: this.version, files: {} }
    }
  }

  async updateFileState(filePath, fileState) {
    await this.writeLock.lock()
    try {
      const state = await this.loadState()
      state.files = state.files || {}
      state.files[filePath] = { ...state.files[filePath], ...fileState }
      state.files[filePath].indexed = true
      state.version = this.version
      state.lastIndexTime = Date.now()

      await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8')
    } finally {
      this.writeLock.unlock()
    }
  }

  async removeFile(filePath) {
    return await this.removeFiles([filePath])
  }

  async removeFiles(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return true
    try {
      await this.appendToIndex([], Buffer.alloc(0), filePaths)
      await this.writeLock.lock()
      try {
        const state = await this.loadState()
        const normDeleted = new Set(
          filePaths
            .map((f) =>
              typeof f === 'string' ? path.resolve(f).replace(/\\/g, '/').toLowerCase() : ''
            )
            .filter(Boolean)
        )
        if (state?.files) {
          for (const key of Object.keys(state.files)) {
            const normKey = path.resolve(key).replace(/\\/g, '/').toLowerCase()
            if (normDeleted.has(normKey)) {
              delete state.files[key]
            }
          }
          await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8')
        }
      } finally {
        this.writeLock.unlock()
      }
      return true
    } catch (err) {
      console.error(`[WorkspaceIndexer] Failed to remove files from index:`, err)
      return false
    }
  }

  async deleteChunksForFile(filePathOrTitle) {
    return await this.deleteChunksForFiles([filePathOrTitle])
  }

  async deleteChunksForFiles(targets) {
    if (!Array.isArray(targets) || targets.length === 0) return true
    const normalizedTargets = targets
      .map((t) => (typeof t === 'string' ? t.replace(/\\/g, '/').toLowerCase().trim() : ''))
      .filter(Boolean)
    const targetBases = targets
      .map((t) =>
        typeof t === 'string' ? path.basename(t, path.extname(t)).toLowerCase().trim() : ''
      )
      .filter(Boolean)

    const existingIndex = await this.loadIndex()
    const matchingFiles = new Set()

    for (const chunk of existingIndex) {
      if (!chunk?.filePath) continue
      const normPath = path.resolve(chunk.filePath).replace(/\\/g, '/').toLowerCase()
      const normBase = path.basename(chunk.filePath, path.extname(chunk.filePath)).toLowerCase()

      const matched =
        normalizedTargets.some(
          (target) =>
            normPath === target ||
            normPath.endsWith(`/${target}`) ||
            normPath.endsWith(`/${target}.md`) ||
            normBase === target
        ) || targetBases.some((base) => normBase === base)

      if (matched) {
        matchingFiles.add(chunk.filePath)
      }
    }

    const filesToRemove = Array.from(matchingFiles)
    if (filesToRemove.length > 0) {
      await this.removeFiles(filesToRemove)
    } else {
      await this.removeFiles(targets)
    }
    return true
  }

  async indexVault(vaultPath, options = {}) {
    if (this.isIndexing) {
      console.info('[WorkspaceIndexer] Indexing already in progress, queuing...')
      return { queued: true }
    }

    const validation = await this.validateIndex()
    const shouldRebuild = !validation.valid
    if (shouldRebuild) {
      console.info('[WorkspaceIndexer] Rebuild required, clearing index...')
      await this.clearIndex()
    }

    if (!vaultPath || typeof vaultPath !== 'string') {
      console.error('[WorkspaceIndexer] Invalid vaultPath:', vaultPath)
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
      console.log('[WorkspaceIndexer] State files count:', Object.keys(state.files || {}).length)

      const currentFilesSet = new Set(files)
      const deletedFiles = Object.keys(state.files || {}).filter((f) => !currentFilesSet.has(f))

      if (deletedFiles.length > 0) {
        console.info(
          `[WorkspaceIndexer] Found ${deletedFiles.length} deleted files to remove from index`
        )
        await this.appendToIndex([], Buffer.alloc(0), deletedFiles)
        for (const df of deletedFiles) {
          delete state.files[df]
        }
      }

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

        await new Promise((resolve) => setTimeout(resolve, 2))
      }
      console.log('[WorkspaceIndexer] Files to process:', filesToProcess.length)

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

        console.info('[WorkspaceIndexer] ✓ Index up to date (0 files modified)')
        return {
          indexedFiles: 0,
          totalChunks: this.stats.totalChunks,
          errors: 0
        }
      }

      console.info(`[WorkspaceIndexer] Found ${filesToProcess.length} files that need indexing`)

      if (onProgress) {
        onProgress({
          progress: 0,
          indexed: 0,
          total: filesToProcess.length,
          chunks: this.stats.totalChunks
        })
      }

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
          console.error(`[WorkspaceIndexer] Error indexing ${filePath}:`, err)
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

      if (updatedFilesSet.size > 0) {
        const combinedEmbeddings = Buffer.concat(allEmbeddingsBuffers)
        await this.appendToIndex(allChunkRecords, combinedEmbeddings, Array.from(updatedFilesSet))
      }

      const finalState = await this.loadState()
      finalState.files = { ...finalState.files, ...accumulatedFileStates }
      finalState.stats = this.stats
      finalState.lastIndexTime = Date.now()
      await fs.writeFile(this.statePath, JSON.stringify(finalState, null, 2), 'utf-8')

      if (onProgress) {
        onProgress({
          progress: 100,
          indexed: this.stats.indexedFiles,
          total: filesToProcess.length,
          chunks: this.stats.totalChunks
        })
      }

      console.info(
        `[WorkspaceIndexer] ✓ Index complete: ${this.stats.indexedFiles} files, ${this.stats.totalChunks} chunks`
      )

      return {
        success: true,
        stats: this.stats
      }
    } catch (err) {
      console.error('[WorkspaceIndexer] Indexing failed:', err)
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
      await fs.writeFile(
        this.statePath,
        JSON.stringify(
          {
            version: this.version,
            files: {}
          },
          null,
          2
        )
      )
      console.info('[WorkspaceIndexer] ✓ Index cleared')
    } finally {
      this.writeLock.unlock()
    }
  }

  async scanVaultFiles(vaultPath, onProgress = null) {
    if (!vaultPath || typeof vaultPath !== 'string') {
      console.error('[WorkspaceIndexer] scanVaultFiles: Invalid path:', vaultPath)
      return []
    }

    const files = []
    const supportedExts = ['.md', '.markdown', '.txt']
    let entryCount = 0

    let lastYieldTime = Date.now()

    async function scanDir(dir) {
      if (typeof dir !== 'string') {
        console.warn('[WorkspaceIndexer] scanDir: Invalid directory path:', dir)
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
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === 'log'
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

          if (entryCount % 50 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 2))
          }
        }
      } catch (err) {
        console.warn(`[WorkspaceIndexer] Error scanning ${dir}:`, err)
      }
    }

    await scanDir(vaultPath)
    return files
  }

  async rebuildIndex(vaultPath, options = {}) {
    console.info('[WorkspaceIndexer] Rebuilding index from scratch...')

    await this.writeLock.lock()
    try {
      try {
        if (await this.fileExists(this.indexPath)) {
          await fs.copyFile(this.indexPath, this.indexPath + '.bak')
        }
        if (await this.fileExists(this.embeddingsPath)) {
          await fs.copyFile(this.embeddingsPath, this.embeddingsPath + '.bak')
        }
      } catch (err) {
        console.warn('[WorkspaceIndexer] Backup failed:', err)
      }

      await fs.writeFile(this.indexPath, '', 'utf-8')
      await fs.writeFile(this.embeddingsPath, Buffer.alloc(0))
      await fs.writeFile(
        this.statePath,
        JSON.stringify({ version: this.version, files: {} }, null, 2)
      )
    } finally {
      this.writeLock.unlock()
    }

    return await this.indexVault(vaultPath, { force: true, ...options })
  }

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

  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}

export default new WorkspaceIndexer()
