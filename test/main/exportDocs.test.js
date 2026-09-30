import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { handleExportDocs } from '../../src/export/exportDocs'

const showSaveDialog = vi.fn()
const mockExecuteJavaScript = vi.fn()
const mockWithRenderedHtml = vi.fn()

vi.mock('electron', () => ({
  dialog: { showSaveDialog: (...args) => showSaveDialog(...args) }
}))

vi.mock('../../src/export/renderWindow.js', () => ({
  withRenderedHtml: (...args) => mockWithRenderedHtml(...args)
}))

describe('handleExportDocs', () => {
  let tmpDir
  let filePath
  const renderedHtml = '<html><body><h1>Note</h1><script>mermaid()</script></body></html>'

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-export-docs-'))
    filePath = path.join(tmpDir, 'export.doc')
    showSaveDialog.mockReset()
    mockExecuteJavaScript.mockReset().mockResolvedValue(renderedHtml)
    mockWithRenderedHtml.mockReset().mockImplementation(async (_html, fn) =>
      fn({
        webContents: {
          executeJavaScript: (...a) => mockExecuteJavaScript(...a)
        },
        isDestroyed: () => false,
        close: () => {}
      })
    )
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

  it('renders the generated HTML in a hidden render window', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportDocs(null, { title: 'Note', content: 'body' })

    expect(mockWithRenderedHtml).toHaveBeenCalledTimes(1)
  })

  it('includes mermaid rendering script in generated HTML', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportDocs(null, { title: 'Note', content: '```mermaid\ngraph TD\n```' })

    const htmlArg = mockWithRenderedHtml.mock.calls[0][0]
    expect(htmlArg).toContain('mermaid.initialize')
  })

  it('returns canceled when dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    const result = await handleExportDocs(null, { title: 'Note', content: 'body' })
    expect(result).toEqual({ success: false, canceled: true })
    expect(mockExecuteJavaScript).not.toHaveBeenCalled()
  })

  it('throws when no content provided', async () => {
    await expect(handleExportDocs(null, { title: 'Empty' })).rejects.toThrow('No content provided')
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
