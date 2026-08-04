import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { handleExportText } from '../../src/export/exportText'

const showSaveDialog = vi.fn()
vi.mock('electron', () => ({
  dialog: { showSaveDialog: (...args) => showSaveDialog(...args) },
  BrowserWindow: vi.fn()
}))

describe('handleExportText', () => {
  let tmpDir
  let filePath

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-export-txt-'))
    filePath = path.join(tmpDir, 'export.txt')
    showSaveDialog.mockReset()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('writes plain text to the chosen file', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await handleExportText(null, {
      title: 'My Note',
      content: 'Just some plain text'
    })

    expect(result).toEqual({ success: true, filePath })
    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('Just some plain text')
  })

  it('strips markdown formatting to plain text', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportText(null, {
      title: 'Note',
      content: '# Heading\n\n**bold** text'
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('Heading')
    expect(written).toContain('bold text')
    expect(written).not.toContain('**')
  })

  it('converts markdown lists to hyphenated plain text', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportText(null, {
      title: 'Note',
      content: '- item one\n- item two'
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('- item one')
    expect(written).toContain('- item two')
  })

  it('resolves wikilinks to their display text', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportText(null, {
      title: 'Note',
      content: 'See [[Other Note]] for details'
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('Other Note')
    expect(written).not.toContain('[[')
  })

  it('returns canceled when dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    const result = await handleExportText(null, { title: 'Note', content: 'body' })
    expect(result).toEqual({ success: false, canceled: true })
  })

  it('throws when no content provided', async () => {
    await expect(handleExportText(null, { title: 'Empty' })).rejects.toThrow(
      'No content provided'
    )
    expect(showSaveDialog).not.toHaveBeenCalled()
  })
})
