import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { handleExportMarkdown } from '../../src/export/exportMarkdown'

const showSaveDialog = vi.fn()
vi.mock('electron', () => ({
  dialog: { showSaveDialog: (...args) => showSaveDialog(...args) },
  BrowserWindow: vi.fn()
}))

describe('handleExportMarkdown', () => {
  let tmpDir
  let filePath

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-export-md-'))
    filePath = path.join(tmpDir, 'export.md')
    showSaveDialog.mockReset()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('writes content to the chosen file', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await handleExportMarkdown(null, {
      title: 'My Note',
      content: '# Heading\nBody text'
    })

    expect(result).toEqual({ success: true, filePath })
    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('# Heading')
    expect(written).toContain('Body text')
  })

  it('returns canceled when dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    const result = await handleExportMarkdown(null, { title: 'Note', content: 'body' })
    expect(result).toEqual({ success: false, canceled: true })
  })

  it('returns canceled when filePath is missing', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: undefined })

    const result = await handleExportMarkdown(null, { title: 'Note', content: 'body' })
    expect(result).toEqual({ success: false, canceled: true })
  })

  it('uses Untitled as default dialog name', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportMarkdown(null, { content: 'body' })
    expect(showSaveDialog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ defaultPath: 'Untitled.md' })
    )
  })

  it('throws when no content provided', async () => {
    await expect(handleExportMarkdown(null, { title: 'Empty' })).rejects.toThrow(
      'No content provided'
    )
    expect(showSaveDialog).not.toHaveBeenCalled()
  })

  it('passes content through unchanged (markdown stays markdown)', async () => {
    const content = '**bold**\n\n- item one\n- item two'
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportMarkdown(null, { title: 'Note', content })
    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toBe(content)
  })
})
