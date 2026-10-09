import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { handleExportZip, handleExportMarkdownBundle } from '../../src/export/exportBundle'

const showSaveDialog = vi.fn()
vi.mock('electron', () => ({
  dialog: { showSaveDialog: (...args) => showSaveDialog(...args) },
  BrowserWindow: vi.fn()
}))

describe('handleExportZip', () => {
  let tmpDir
  let zipPath

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-export-zip-'))
    zipPath = path.join(tmpDir, 'export.zip')
    showSaveDialog.mockReset()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('guarantees output file has .zip extension even if user or dialog supplied .md', async () => {
    const mdPath = path.join(tmpDir, 'export.md')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: mdPath })

    const result = await handleExportZip(null, {
      title: 'My Note.md',
      content: '# Note Heading\nSome content'
    })

    expect(result.success).toBe(true)
    expect(result.isZip).toBe(true)
    expect(result.filePath).toBe(zipPath)
    expect(result.filePath.endsWith('.zip')).toBe(true)

    // Check that file exists on disk and is a valid zip (starts with PK)
    const handle = await fs.open(result.filePath, 'r')
    const header = Buffer.alloc(4)
    await handle.read(header, 0, 4, 0)
    await handle.close()
    expect(header[0]).toBe(0x50)
    expect(header[1]).toBe(0x4b)
  })

  it('provides clean defaultPath and only ZIP filter in save dialog', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: zipPath })

    await handleExportZip(null, {
      title: 'Guide to Notes.md',
      content: '# Guide\nHello'
    })

    expect(showSaveDialog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        defaultPath: 'Guide to Notes.zip',
        filters: [{ name: 'ZIP Archive (*.zip)', extensions: ['zip'] }]
      })
    )
  })

  it('returns canceled when dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    const result = await handleExportZip(null, { title: 'Note', content: 'body' })
    expect(result).toEqual({ success: false, canceled: true })
  })

  it('creates zip when compressZip is true via handleExportMarkdownBundle', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: zipPath })

    const result = await handleExportMarkdownBundle(null, {
      title: 'Test Note',
      content: '# Testing bundle\nBody',
      compressZip: true
    })

    expect(result.success).toBe(true)
    expect(result.isZip).toBe(true)
    expect(result.filePath).toBe(zipPath)
  })
})

describe('handleExportBatch ZIP packaging', () => {
  let tmpDir
  let batchZipPath

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-batch-zip-'))
    batchZipPath = path.join(tmpDir, 'batch-export.zip')
    showSaveDialog.mockReset()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  // Helper to extract entry filenames from ZIP local headers
  async function readZipFilenames(filePath) {
    const buf = await fs.readFile(filePath)
    const names = []
    let offset = 0
    while (offset < buf.length - 4) {
      if (
        buf[offset] === 0x50 &&
        buf[offset + 1] === 0x4b &&
        buf[offset + 2] === 0x03 &&
        buf[offset + 3] === 0x04
      ) {
        const nameLen = buf.readUInt16LE(offset + 26)
        const extraLen = buf.readUInt16LE(offset + 28)
        const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen)
        names.push(name)
        offset += 30 + nameLen + extraLen
      } else {
        offset++
      }
    }
    return names
  }

  it('zips 10 markdown notes as 10 separate .md files in the archive without merging them', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: batchZipPath })

    const { handleExportBatch } = await import('../../src/export/exportBatch')

    const tenNotes = Array.from({ length: 10 }, (_, i) => ({
      id: `note-${i + 1}`,
      title: `Project Note ${i + 1}`,
      content: `# Note ${i + 1}\n\nThis is content for note number ${i + 1}.`
    }))

    const result = await handleExportBatch(null, {
      notes: tenNotes,
      format: 'markdown',
      compressZip: true,
      archiveTitle: 'My Project Notes'
    })

    expect(result.success).toBe(true)
    expect(result.isZip).toBe(true)
    expect(result.exported).toBe(10)
    expect(result.total).toBe(10)
    expect(result.filePath).toBe(batchZipPath)

    // Inspect the zip contents: must have 10 separate entries
    const fileNames = await readZipFilenames(batchZipPath)
    expect(fileNames.length).toBe(10)
    for (let i = 1; i <= 10; i++) {
      expect(fileNames).toContain(`Project Note ${i}.md`)
    }
  })

  it('handles format: "zip" directly by saving individual markdown notes in archive', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: batchZipPath })

    const { handleExportBatch } = await import('../../src/export/exportBatch')

    const notes = [
      { id: '1', title: 'Alpha', content: 'Alpha text' },
      { id: '2', title: 'Beta', content: 'Beta text' },
      { id: '3', title: 'Gamma', content: 'Gamma text' }
    ]

    const result = await handleExportBatch(null, {
      notes,
      format: 'zip',
      archiveTitle: 'Greek Alphabet'
    })

    expect(result.success).toBe(true)
    expect(result.isZip).toBe(true)
    expect(result.exported).toBe(3)

    const fileNames = await readZipFilenames(batchZipPath)
    expect(fileNames).toContain('Alpha.md')
    expect(fileNames).toContain('Beta.md')
    expect(fileNames).toContain('Gamma.md')
  })
})

