import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { registerOpenNoteHandler } from '../../src/main/handlers/useOpenNote'

const ipcHandle = vi.fn()
const showOpenDialog = vi.fn()

vi.mock('electron', () => ({
  default: {
    dialog: { showOpenDialog: (...args) => showOpenDialog(...args) },
    ipcMain: { handle: (...args) => ipcHandle(...args) }
  },
  dialog: { showOpenDialog: (...args) => showOpenDialog(...args) },
  ipcMain: { handle: (...args) => ipcHandle(...args) }
}))

describe('registerOpenNoteHandler', () => {
  let tmpDir
  let handler

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-open-note-'))
    ipcHandle.mockReset()
    showOpenDialog.mockReset()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  const register = () => {
    registerOpenNoteHandler()
    expect(ipcHandle).toHaveBeenCalledTimes(1)
    const [channel, fn] = ipcHandle.mock.calls[0]
    expect(channel).toBe('dialog:openFile')
    handler = fn
  }

  it('registers a dialog:openFile handler', () => {
    register()
    expect(typeof handler).toBe('function')
  })

  it('returns null when the dialog is canceled', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    register()
    const result = await handler()
    expect(result).toBeNull()
  })

  it('returns null when no file paths are selected', async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [] })
    register()
    const result = await handler()
    expect(result).toBeNull()
  })

  it('reads the file content and returns path/name', async () => {
    const filePath = path.join(tmpDir, 'My Note.md')
    await fs.writeFile(filePath, '# Hello world', 'utf-8')

    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })
    register()

    const result = await handler()
    expect(result).toEqual({
      path: filePath,
      content: '# Hello world',
      name: 'My Note.md'
    })
  })

  it('filters dialogs to markdown/txt extensions', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    register()
    await handler()
    expect(showOpenDialog).toHaveBeenCalledWith({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    })
  })

  it('throws when the file cannot be read', async () => {
    const missingPath = path.join(tmpDir, 'does-not-exist.md')
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [missingPath] })
    register()

    await expect(handler()).rejects.toThrow()
  })
})
