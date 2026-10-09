/**
 * ============================================================================
 * ZIP Exporter (`zipExporter.ts`)
 * ============================================================================
 * High-performance streaming ZIP archive generator using `archiver`.
 * 
 * Features:
 *  - Native streaming direct to disk or in-memory Buffer.
 *  - Maximum zlib level 9 compression with customizable levels.
 *  - Clean error recovery and partial file cleanup on failure.
 *  - Supports file paths on disk, Buffer objects, and UTF-8 strings.
 *  - Compatible with archiver 8.0.0+ ESM (ZipArchive) and legacy CJS.
 * ============================================================================
 */

import * as archiverModule from 'archiver'
import fs from 'fs'
import fsPromises from 'fs/promises'

export interface ZipFileEntry {
  /** Relative path inside the archive, e.g. "note.md" or "assets/photo.png" */
  name?: string
  entryName?: string
  /** Data payload: Buffer, string, or filesystem path */
  data?: Buffer | string | Uint8Array
  source?: Buffer | string | Uint8Array
  /** Optional file date */
  date?: Date
}

export interface CreateZipOptions {
  /** Compression level 0-9. Default: 9 */
  level?: number
  compressionLevel?: number
  /** Optional comment stored in the zip header */
  comment?: string
}

export interface CreateZipResult {
  outputPath: string
  filePath: string
  totalBytes: number
  totalEntries: number
  entryCount: number
}

function createZipInstance(options: any): any {
  if (typeof (archiverModule as any).ZipArchive === 'function') {
    return new (archiverModule as any).ZipArchive(options)
  }
  const defaultExport = (archiverModule as any).default || archiverModule
  if (typeof defaultExport === 'function') {
    return defaultExport('zip', options)
  }
  if (typeof defaultExport?.ZipArchive === 'function') {
    return new defaultExport.ZipArchive(options)
  }
  throw new Error('Could not instantiate ZipArchive from archiver module')
}

function normalizeEntry(entry: ZipFileEntry): { name: string; content: Buffer | string; isFile: boolean } {
  const name = entry.name || entry.entryName || 'file'
  const rawData = entry.data !== undefined ? entry.data : entry.source

  if (typeof rawData === 'string' && fs.existsSync(rawData)) {
    try {
      const stat = fs.statSync(rawData)
      if (stat.isFile()) {
        return { name, content: rawData, isFile: true }
      }
    } catch {}
  }

  if (Buffer.isBuffer(rawData)) {
    return { name, content: rawData, isFile: false }
  }
  if (rawData instanceof Uint8Array) {
    return { name, content: Buffer.from(rawData), isFile: false }
  }
  if (typeof rawData === 'string') {
    return { name, content: rawData, isFile: false }
  }

  return { name, content: Buffer.alloc(0), isFile: false }
}

/**
 * Creates a .zip archive file containing all provided `entries`.
 * Supports both signatures:
 *  - createZipArchive(outputFilePath, entries, options)
 *  - createZipArchive(entries, outputFilePath, options)
 */
export async function createZipArchive(
  arg1: string | ZipFileEntry[],
  arg2: string | ZipFileEntry[],
  options: CreateZipOptions = {}
): Promise<CreateZipResult> {
  let outputFilePath: string
  let entries: ZipFileEntry[]

  if (typeof arg1 === 'string') {
    outputFilePath = arg1
    entries = Array.isArray(arg2) ? arg2 : []
  } else {
    entries = Array.isArray(arg1) ? arg1 : []
    outputFilePath = typeof arg2 === 'string' ? arg2 : ''
  }

  if (!outputFilePath) {
    throw new Error('outputFilePath must be a non-empty string')
  }

  const level = options.compressionLevel ?? options.level ?? 9
  const comment = options.comment ?? 'Exported from Lumina'

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFilePath)
    const archive = createZipInstance({
      zlib: { level },
      comment
    })

    let totalBytes = 0

    output.on('close', () => {
      const bytes = archive.pointer?.() || totalBytes
      resolve({
        outputPath: outputFilePath,
        filePath: outputFilePath,
        totalBytes: bytes,
        totalEntries: entries.length,
        entryCount: entries.length
      })
    })

    output.on('error', async (err: any) => {
      try {
        await fsPromises.unlink(outputFilePath)
      } catch {}
      reject(err)
    })

    archive.on('error', async (err: any) => {
      try {
        await fsPromises.unlink(outputFilePath)
      } catch {}
      reject(err)
    })

    archive.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length
    })

    archive.pipe(output)

    for (const entry of entries) {
      const { name, content, isFile } = normalizeEntry(entry)
      if (isFile && typeof content === 'string') {
        archive.file(content, { name, date: entry.date || new Date() })
      } else {
        archive.append(content, { name, date: entry.date || new Date() })
      }
    }

    archive.finalize()
  })
}

/**
 * Creates an in-memory ZIP archive returned as a single Buffer.
 */
export async function createZipBuffer(
  entries: ZipFileEntry[],
  options: CreateZipOptions = {}
): Promise<Buffer> {
  const level = options.compressionLevel ?? options.level ?? 9
  const comment = options.comment ?? 'Exported from Lumina'

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const archive = createZipInstance({
      zlib: { level },
      comment
    })

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    archive.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    archive.on('error', (err: any) => {
      reject(err)
    })

    for (const entry of entries) {
      const { name, content, isFile } = normalizeEntry(entry)
      if (isFile && typeof content === 'string') {
        archive.file(content, { name, date: entry.date || new Date() })
      } else {
        archive.append(content, { name, date: entry.date || new Date() })
      }
    }

    archive.finalize()
  })
}
