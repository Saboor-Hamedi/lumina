/**
 * Brain Indexer & Semantic Search Service
 *
 * Provides dedicated, non-blocking, silent semantic indexing and retrieval for
 * Lumina's built-in /brain documentation, guides, specs, and architectural references.
 *
 * Key Design Principles:
 * 1. Silent & Non-Blocking: Offloads embeddings to the background worker thread.
 * 2. Error-Tolerant & Defensive: Never crashes if /brain is missing or files fail to read.
 * 3. Dynamic Discovery: Recursively indexes all existing and future .md files in /brain.
 * 4. Heading-Based Chunking: Slices markdown by headings (#, ##, ###) for surgical precision.
 * 5. Isolated: Operates independently of user vault indexing (Indexing.jsx is untouched).
 */

import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { app } from 'electron'
import type { Worker } from 'worker_threads'

export interface BrainChunk {
  id: string
  filePath: string
  relPath: string
  docTitle: string
  heading: string
  breadcrumb: string
  text: string
  start: number
  end: number
  embeddingOffset?: number
  embeddingLength?: number
}

export interface BrainFileState {
  mtime: number
  size: number
  checksum: string
  chunkCount: number
  lastIndexed: number
}

export interface BrainIndexState {
  version: string
  files: Record<string, BrainFileState>
  totalChunks: number
  lastIndexTime: number | null
}

export interface BrainSearchResult extends BrainChunk {
  score: number
  finalScore: number
}

export interface BrainSearchOptions {
  threshold?: number
  limit?: number
}

export class BrainIndexer {
  private indexPath: string | null = null
  private embeddingsPath: string | null = null
  private statePath: string | null = null
  private brainRootPath: string | null = null

  private index: BrainChunk[] = []
  private embeddingsBuffer: Buffer | null = null
  private state: BrainIndexState = {
    version: '1.0.0',
    files: {},
    totalChunks: 0,
    lastIndexTime: null
  }

  private isIndexing: boolean = false
  private isLoaded: boolean = false

  private _worker: Worker | null = null
  private _workerRequestId: number = 0
  private _workerPending: Map<number, (results: any) => void> = new Map()

  /**
   * Initializes the Brain Indexer with persistent storage paths.
   * Defensive: If directories cannot be created or files don't exist, fails gracefully.
   */
  async init(userDataPath: string): Promise<void> {
    try {
      const indexDir = path.join(userDataPath, 'brain-index')
      await fs.mkdir(indexDir, { recursive: true }).catch(() => {})

      this.indexPath = path.join(indexDir, 'brain_index.jsonl')
      this.embeddingsPath = path.join(indexDir, 'brain_embeddings.bin')
      this.statePath = path.join(indexDir, 'brain_state.json')

      this.brainRootPath = this.resolveBrainDirectory()

      await this.loadExistingIndex()
    } catch (err) {
      // Defensive: log error quietly, never crash
      console.warn('[BrainIndexer] Initialization warning (continuing with empty index):', err)
    }
  }

  /**
   * Dynamically resolves the path to the /brain directory.
   * Handles development, production packaged builds (extraResources), and fallback locations.
   */
  resolveBrainDirectory(): string | null {
    const candidates: string[] = []

    try {
      if (typeof app?.getAppPath === 'function') {
        const appPath = app.getAppPath()
        candidates.push(path.join(appPath, 'brain'))
      }
    } catch (_) {}

    try {
      if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'brain'))
      }
    } catch (_) {}

    try {
      candidates.push(path.join(process.cwd(), 'brain'))
    } catch (_) {}

    try {
      if (typeof __dirname !== 'undefined') {
        candidates.push(path.join(__dirname, '../../brain'))
        candidates.push(path.join(__dirname, '../../../brain'))
      }
    } catch (_) {}

    for (const cand of candidates) {
      try {
        if (fsSync.existsSync(cand) && fsSync.statSync(cand).isDirectory()) {
          return cand
        }
      } catch (_) {}
    }

    return null
  }

  /**
   * Resolves the target for indexer-worker.js
   */
  private _resolveWorkerTarget(): URL | string {
    try {
      const u1 = new URL('./indexer-worker.js', import.meta.url)
      if (fsSync.existsSync(u1)) return u1
    } catch (_) {}

    try {
      const u2 = new URL('../indexer-worker.js', import.meta.url)
      if (fsSync.existsSync(u2)) return u2
    } catch (_) {}

    if (typeof __dirname !== 'undefined') {
      const p1 = path.join(__dirname, 'indexer-worker.js')
      if (fsSync.existsSync(p1)) return p1
      const p2 = path.join(__dirname, '../indexer-worker.js')
      if (fsSync.existsSync(p2)) return p2
    }

    return new URL('./indexer-worker.js', import.meta.url)
  }

  /**
   * Ensures the embedding worker thread is active.
   */
  private async _ensureWorker(): Promise<Worker | null> {
    if (this._worker) return this._worker

    try {
      const { Worker } = await import('worker_threads')
      const target = this._resolveWorkerTarget()
      this._worker = new Worker(target)

      this._worker.on('message', (msg: any) => {
        if (msg.type === 'embeddings' && msg.batchId !== undefined) {
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

      this._worker.on('error', (err: any) => {
        console.warn('[BrainIndexer] Worker error:', err)
        this._worker = null
      })

      this._worker.on('exit', () => {
        this._worker = null
      })

      return this._worker
    } catch (err) {
      console.warn('[BrainIndexer] Unable to spawn embedding worker:', err)
      return null
    }
  }

  /**
   * Generates embeddings in batches using the worker thread.
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][] | null> {
    const worker = await this._ensureWorker()
    if (!worker) return null

    const batchId = this._workerRequestId++

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this._workerPending.has(batchId)) {
          this._workerPending.delete(batchId)
          resolve(null)
        }
      }, 30000)

      this._workerPending.set(batchId, (results: any) => {
        clearTimeout(timer)
        resolve(results)
      })

      try {
        worker.postMessage({ type: 'embed-batch', texts, batchId })
      } catch (err) {
        clearTimeout(timer)
        this._workerPending.delete(batchId)
        resolve(null)
      }
    })
  }

  /**
   * Loads cached index, embeddings, and state from disk.
   */
  async loadExistingIndex(): Promise<void> {
    try {
      if (this.statePath && fsSync.existsSync(this.statePath)) {
        const rawState = await fs.readFile(this.statePath, 'utf-8')
        this.state = JSON.parse(rawState)
      }

      if (this.indexPath && fsSync.existsSync(this.indexPath)) {
        const content = await fs.readFile(this.indexPath, 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean)
        this.index = lines.map((line) => JSON.parse(line))
      }

      if (this.embeddingsPath && fsSync.existsSync(this.embeddingsPath)) {
        this.embeddingsBuffer = await fs.readFile(this.embeddingsPath)
      }

      this.isLoaded = true
    } catch (err) {
      console.warn('[BrainIndexer] Failed to load cached index, will build cleanly:', err)
      this.index = []
      this.embeddingsBuffer = null
    }
  }

  /**
   * Recursively scans directory for all Markdown (.md) files.
   * Defensive: If directory cannot be read, returns empty array without throwing.
   */
  private async scanMarkdownFiles(dir: string): Promise<string[]> {
    const results: string[] = []
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const nested = await this.scanMarkdownFiles(fullPath)
            results.push(...nested)
          }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          results.push(fullPath)
        }
      }
    } catch (_) {
      // Ignore directory read errors
    }
    return results
  }

  /**
   * Calculates SHA-256 checksum of file content.
   */
  private computeChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Chunks Markdown document by headings (#, ##, ###) with breadcrumb metadata.
   */
  private chunkMarkdown(filePath: string, relPath: string, content: string): BrainChunk[] {
    const chunks: BrainChunk[] = []
    const lines = content.split('\n')

    // Document-level title resolution
    let docTitle = path.basename(relPath, '.md')
    const firstH1 = lines.find((l) => /^#\s+(.+)$/.test(l.trim()))
    if (firstH1) {
      docTitle = firstH1.replace(/^#\s+/, '').trim()
    }

    const headingRegex = /^(#{1,6})\s+(.+)$/
    let currentHeading = docTitle
    let currentLevel = 1
    let headingStack: Array<{ level: number; text: string }> = [
      { level: 1, text: docTitle }
    ]
    let sectionLines: string[] = []
    let sectionStart = 0

    const flushSection = (endIndex: number) => {
      const rawText = sectionLines.join('\n').trim()
      if (rawText.length >= 30) {
        const breadcrumb = headingStack.map((h) => h.text).join(' > ')
        const slug = currentHeading
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 50)

        // If a section is very large (> 2500 chars), split into sub-chunks
        const MAX_CHUNK_CHARS = 1800
        if (rawText.length > MAX_CHUNK_CHARS) {
          const paragraphs = rawText.split(/\n\s*\n/)
          let currentSub = ''
          let subIdx = 0

          for (const p of paragraphs) {
            if (currentSub.length + p.length > MAX_CHUNK_CHARS && currentSub.trim().length > 0) {
              chunks.push({
                id: `brain:${relPath}#${slug}-${subIdx++}`,
                filePath,
                relPath,
                docTitle,
                heading: currentHeading,
                breadcrumb,
                text: currentSub.trim(),
                start: sectionStart,
                end: endIndex
              })
              currentSub = ''
            }
            currentSub += (currentSub ? '\n\n' : '') + p
          }

          if (currentSub.trim().length > 0) {
            chunks.push({
              id: `brain:${relPath}#${slug}-${subIdx}`,
              filePath,
              relPath,
              docTitle,
              heading: currentHeading,
              breadcrumb,
              text: currentSub.trim(),
              start: sectionStart,
              end: endIndex
            })
          }
        } else {
          chunks.push({
            id: `brain:${relPath}#${slug}`,
            filePath,
            relPath,
            docTitle,
            heading: currentHeading,
            breadcrumb,
            text: rawText,
            start: sectionStart,
            end: endIndex
          })
        }
      }
      sectionLines = []
    }

    let charOffset = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = line.match(headingRegex)

      if (match) {
        flushSection(charOffset)
        sectionStart = charOffset

        const level = match[1].length
        const headingText = match[2].trim()

        // Maintain hierarchical heading stack
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop()
        }
        headingStack.push({ level, text: headingText })

        currentLevel = level
        currentHeading = headingText
        sectionLines.push(line)
      } else {
        sectionLines.push(line)
      }

      charOffset += line.length + 1
    }

    flushSection(charOffset)
    return chunks
  }

  /**
   * Indexes the /brain folder silently in the background.
   * Compares file mtime & checksums against state to finish in < 5ms if unchanged.
   */
  async indexBrain(force: boolean = false): Promise<{ indexed: boolean; totalFiles: number; totalChunks: number }> {
    if (this.isIndexing) {
      return { indexed: false, totalFiles: 0, totalChunks: this.index.length }
    }

    this.isIndexing = true

    try {
      if (!this.brainRootPath) {
        this.brainRootPath = this.resolveBrainDirectory()
      }

      if (!this.brainRootPath || !fsSync.existsSync(this.brainRootPath)) {
        this.isIndexing = false
        return { indexed: false, totalFiles: 0, totalChunks: 0 }
      }

      const filePaths = await this.scanMarkdownFiles(this.brainRootPath)
      if (filePaths.length === 0) {
        this.isIndexing = false
        return { indexed: false, totalFiles: 0, totalChunks: 0 }
      }

      // Check if anything actually changed
      let needsReindex = force || !this.embeddingsBuffer || this.index.length === 0
      const currentFilesMap: Record<string, { stats: any; relPath: string }> = {}

      for (const fp of filePaths) {
        try {
          const stats = await fs.stat(fp)
          const relPath = path.relative(this.brainRootPath, fp).replace(/\\/g, '/')
          currentFilesMap[relPath] = { stats, relPath }

          if (!needsReindex) {
            const cached = this.state.files[relPath]
            if (
              !cached ||
              cached.size !== stats.size ||
              Math.abs(cached.mtime - stats.mtimeMs) > 1000
            ) {
              needsReindex = true
            }
          }
        } catch (_) {}
      }

      // Check for deleted files
      if (!needsReindex) {
        const cachedKeys = Object.keys(this.state.files)
        if (cachedKeys.length !== filePaths.length) {
          needsReindex = true
        }
      }

      // If up-to-date, finish instantly
      if (!needsReindex) {
        this.isIndexing = false
        return { indexed: false, totalFiles: filePaths.length, totalChunks: this.index.length }
      }

      // Build new chunks
      const allChunks: BrainChunk[] = []
      const newFilesState: Record<string, BrainFileState> = {}

      for (const fp of filePaths) {
        try {
          const relPath = path.relative(this.brainRootPath, fp).replace(/\\/g, '/')
          const content = await fs.readFile(fp, 'utf-8')
          const checksum = this.computeChecksum(content)
          const stats = await fs.stat(fp)

          const chunks = this.chunkMarkdown(fp, relPath, content)
          allChunks.push(...chunks)

          newFilesState[relPath] = {
            mtime: stats.mtimeMs,
            size: stats.size,
            checksum,
            chunkCount: chunks.length,
            lastIndexed: Date.now()
          }
        } catch (_) {}
      }

      if (allChunks.length === 0) {
        this.isIndexing = false
        return { indexed: true, totalFiles: filePaths.length, totalChunks: 0 }
      }

      // Generate embeddings in batches of 16
      const BATCH_SIZE = 16
      const allEmbeddings: number[][] = []
      const textsToEmbed = allChunks.map((c) => `[${c.breadcrumb}]\n${c.text.slice(0, 500)}`)

      for (let i = 0; i < textsToEmbed.length; i += BATCH_SIZE) {
        const batch = textsToEmbed.slice(i, i + BATCH_SIZE)
        const batchEmbeddings = await this.generateEmbeddings(batch)

        if (batchEmbeddings && batchEmbeddings.length > 0) {
          allEmbeddings.push(...batchEmbeddings)
        } else {
          // Fallback: fill with zeroes if worker failed for this chunk
          for (let k = 0; k < batch.length; k++) {
            allEmbeddings.push(new Array(384).fill(0))
          }
        }
      }

      // Serialize embeddings binary buffer
      const buffer = Buffer.alloc(allChunks.length * 384 * 4)
      for (let i = 0; i < allChunks.length; i++) {
        const offset = i * 384 * 4
        allChunks[i].embeddingOffset = offset
        allChunks[i].embeddingLength = 384

        const emb = allEmbeddings[i] || new Array(384).fill(0)
        for (let j = 0; j < 384; j++) {
          buffer.writeFloatLE(emb[j] || 0, offset + j * 4)
        }
      }

      // Save index & embeddings
      if (this.indexPath && this.embeddingsPath && this.statePath) {
        const jsonlContent = allChunks.map((c) => JSON.stringify(c)).join('\n')
        await fs.writeFile(this.indexPath, jsonlContent, 'utf-8').catch(() => {})
        await fs.writeFile(this.embeddingsPath, buffer).catch(() => {})

        this.state = {
          version: '1.0.0',
          files: newFilesState,
          totalChunks: allChunks.length,
          lastIndexTime: Date.now()
        }
        await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8').catch(() => {})
      }

      this.index = allChunks
      this.embeddingsBuffer = buffer
      this.isLoaded = true
      this.isIndexing = false

      return { indexed: true, totalFiles: filePaths.length, totalChunks: allChunks.length }
    } catch (err) {
      console.warn('[BrainIndexer] Indexing completed with notice:', err)
      this.isIndexing = false
      return { indexed: false, totalFiles: 0, totalChunks: this.index.length }
    }
  }

  /**
   * Computes cosine similarity between two vectors.
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0
    let dot = 0
    let magA = 0
    let magB = 0

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i]
      magA += vecA[i] * vecA[i]
      magB += vecB[i] * vecB[i]
    }

    const mag = Math.sqrt(magA) * Math.sqrt(magB)
    return mag > 0 ? dot / mag : 0
  }

  /**
   * Extracts embedding vector for a given chunk from binary buffer.
   */
  private getChunkEmbedding(chunk: BrainChunk): number[] | null {
    if (!this.embeddingsBuffer) return null
    const offset = chunk.embeddingOffset || 0
    const dims = chunk.embeddingLength || 384
    const requiredSize = offset + dims * 4

    if (requiredSize > this.embeddingsBuffer.length) return null

    const vec: number[] = new Array(dims)
    for (let i = 0; i < dims; i++) {
      vec[i] = this.embeddingsBuffer.readFloatLE(offset + i * 4)
    }
    return vec
  }

  /**
   * Semantic vector + keyword search over all /brain chunks.
   */
  async search(query: string, options: BrainSearchOptions = {}): Promise<BrainSearchResult[]> {
    const { threshold = 0.25, limit = 3 } = options

    if (!query || !query.trim() || !this.index || this.index.length === 0) {
      return []
    }

    const cleanQuery = query.trim().toLowerCase()
    const queryTerms = cleanQuery.split(/\s+/).filter((t) => t.length >= 3)

    let queryVec: number[] | null = null
    const queryEmbeddings = await this.generateEmbeddings([query.slice(0, 500)])
    if (queryEmbeddings && queryEmbeddings.length > 0) {
      queryVec = queryEmbeddings[0]
    }

    const results: BrainSearchResult[] = []

    for (const chunk of this.index) {
      let score = 0

      // Cosine vector similarity
      if (queryVec) {
        const chunkVec = this.getChunkEmbedding(chunk)
        if (chunkVec) {
          score = this.cosineSimilarity(queryVec, chunkVec)
        }
      }

      // Keyword and heading boost
      let keywordBoost = 0
      const lowerHeading = chunk.heading.toLowerCase()
      const lowerBreadcrumb = chunk.breadcrumb.toLowerCase()
      const lowerText = chunk.text.toLowerCase()

      for (const term of queryTerms) {
        if (lowerHeading.includes(term)) keywordBoost += 0.08
        else if (lowerBreadcrumb.includes(term)) keywordBoost += 0.05
        else if (lowerText.includes(term)) keywordBoost += 0.02
      }

      const finalScore = score + Math.min(keywordBoost, 0.25)

      if (finalScore >= threshold) {
        results.push({
          ...chunk,
          score,
          finalScore
        })
      }
    }

    results.sort((a, b) => b.finalScore - a.finalScore)
    return results.slice(0, limit)
  }

  /**
   * Returns current statistics of the brain index.
   */
  getStats(): { totalFiles: number; totalChunks: number; lastIndexTime: number | null; isLoaded: boolean } {
    return {
      totalFiles: Object.keys(this.state.files).length,
      totalChunks: this.index.length,
      lastIndexTime: this.state.lastIndexTime,
      isLoaded: this.isLoaded
    }
  }
}

export default new BrainIndexer()
