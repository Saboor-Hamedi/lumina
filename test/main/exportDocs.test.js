import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { handleExportDocs } from '../../src/export/exportDocs'

const showSaveDialog = vi.fn()
const mockLoadURL = vi.fn()
const mockExecuteJavaScript = vi.fn()
const mockClose = vi.fn()

const { MockBrowserWindow } = vi.hoisted(() => {
  return {
    MockBrowserWindow: class MockBrowserWindow {
      constructor() {
        this.show = false
        this.webContents = {
          executeJavaScript: (...args) => mockExecuteJavaScript(...args)
        }
        this.loadURL = (...args) => mockLoadURL(...args)
        this.close = () => mockClose()
      }
    }
  }
})

vi.mock('electron', () => ({
  dialog: { showSaveDialog: (...args) => showSaveDialog(...args) },
  BrowserWindow: MockBrowserWindow
}))

describe('handleExportDocs', () => {
  let tmpDir
  let filePath
  const renderedHtml = '<html><body><h1>Note</h1><script>mermaid()</script></body></html>'

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-export-docs-'))
    filePath = path.join(tmpDir, 'export.doc')
    showSaveDialog.mockReset()
    mockLoadURL.mockReset()
    mockExecuteJavaScript.mockReset().mockResolvedValue(renderedHtml)
    mockClose.mockReset()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('writes cleaned HTML to the chosen file', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await handleExportDocs(null, {
      title: 'My Note',
      content: '# Heading\nBody'
    })

    expect(result).toEqual({ success: true, filePath })
    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('<h1>Note</h1>')
    expect(written).toContain('</html>')
  })

  it('strips script tags from the final document', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportDocs(null, { title: 'Note', content: 'body' })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).not.toContain('<script')
    expect(written).not.toContain('mermaid()')
  })

  it('loads the generated HTML into a hidden window', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportDocs(null, { title: 'Note', content: 'body' })

    expect(mockLoadURL).toHaveBeenCalledTimes(1)
    expect(mockLoadURL.mock.calls[0][0]).toContain('data:text/html')
  })

  it('includes mermaid rendering script in generated HTML', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportDocs(null, { title: 'Note', content: '```mermaid\ngraph TD\n```' })

    const url = mockLoadURL.mock.calls[0][0]
    expect(decodeURIComponent(url)).toContain('mermaid.initialize')
  })

  it('returns canceled when dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    const result = await handleExportDocs(null, { title: 'Note', content: 'body' })
    expect(result).toEqual({ success: false, canceled: true })
    expect(mockExecuteJavaScript).not.toHaveBeenCalled()
  })

  it('throws when no content provided', async () => {
    await expect(handleExportDocs(null, { title: 'Empty' })).rejects.toThrow(
      'No content provided'
    )
    expect(showSaveDialog).not.toHaveBeenCalled()
  })

  it('uses Untitled as default dialog name', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportDocs(null, { content: 'body' })
    expect(showSaveDialog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ defaultPath: 'Untitled.doc' })
    )
  })
})
