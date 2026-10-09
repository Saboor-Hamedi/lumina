import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { createZipArchive, createZipBuffer } from '../../src/export/zipExporter'

describe('zipExporter', () => {
  const tempDirsToClean = []

  afterEach(async () => {
    while (tempDirsToClean.length > 0) {
      const dir = tempDirsToClean.pop()
      try {
        await fs.rm(dir, { recursive: true, force: true })
      } catch {}
    }
  })

  async function createTempDir() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-zip-test-'))
    tempDirsToClean.push(dir)
    return dir
  }

  describe('createZipArchive', () => {
    it('creates a zip archive on disk with file and buffer entries', async () => {
      const tempDir = await createTempDir()
      const sampleFilePath = path.join(tempDir, 'sample.txt')
      await fs.writeFile(sampleFilePath, 'Hello Lumina Zip Archive', 'utf8')

      const zipOutputPath = path.join(tempDir, 'output.zip')

      const entries = [
        {
          source: sampleFilePath,
          entryName: 'docs/sample.txt'
        },
        {
          source: Buffer.from('# Note 2\n\nInline content', 'utf8'),
          entryName: 'notes/note2.md'
        }
      ]

      const stats = await createZipArchive(entries, zipOutputPath, { compressionLevel: 6 })

      expect(stats.totalEntries).toBe(2)
      expect(stats.totalBytes).toBeGreaterThan(0)
      expect(stats.outputPath).toBe(zipOutputPath)

      // Verify file exists on disk
      const zipStat = await fs.stat(zipOutputPath)
      expect(zipStat.size).toBeGreaterThan(0)

      // Verify zip magic bytes (PK\x03\x04 = 0x50 0x4B 0x03 0x04)
      const handle = await fs.open(zipOutputPath, 'r')
      const headerBuf = Buffer.alloc(4)
      await handle.read(headerBuf, 0, 4, 0)
      await handle.close()

      expect(headerBuf[0]).toBe(0x50) // 'P'
      expect(headerBuf[1]).toBe(0x4b) // 'K'
      expect(headerBuf[2]).toBe(0x03)
      expect(headerBuf[3]).toBe(0x04)
    })

    it('creates an empty archive when entries array is empty', async () => {
      const tempDir = await createTempDir()
      const zipOutputPath = path.join(tempDir, 'empty.zip')

      const stats = await createZipArchive([], zipOutputPath)
      expect(stats.totalEntries).toBe(0)
      expect(stats.totalBytes).toBeGreaterThan(0) // An empty zip file is ~22 bytes (end of central directory record)

      const zipStat = await fs.stat(zipOutputPath)
      expect(zipStat.size).toBeGreaterThanOrEqual(22)
    })
  })

  describe('createZipBuffer', () => {
    it('creates an in-memory zip archive buffer', async () => {
      const entries = [
        {
          source: Buffer.from('console.log("hello world");'),
          entryName: 'script.js'
        },
        {
          source: Buffer.from('body { margin: 0; }'),
          entryName: 'styles/app.css'
        }
      ]

      const zipBuffer = await createZipBuffer(entries, { compressionLevel: 9 })
      expect(zipBuffer).toBeInstanceOf(Buffer)
      expect(zipBuffer.length).toBeGreaterThan(0)

      // Verify ZIP magic header
      expect(zipBuffer[0]).toBe(0x50)
      expect(zipBuffer[1]).toBe(0x4b)
      expect(zipBuffer[2]).toBe(0x03)
      expect(zipBuffer[3]).toBe(0x04)
    })
  })
})
