import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { handleExportPDF, generatePDFHTML } from '../../src/export/exportPDF'

const showSaveDialog = vi.fn()
const mockExecuteJavaScript = vi.fn()
const mockPrintToPDF = vi.fn()
const mockClose = vi.fn()
const mockWithRenderedHtml = vi.fn()

vi.mock('electron', () => ({
  dialog: { showSaveDialog: (...args) => showSaveDialog(...args) }
}))

vi.mock('../../src/export/renderWindow.js', () => ({
  withRenderedHtml: (...args) => mockWithRenderedHtml(...args)
}))

describe('handleExportPDF', () => {
  let tmpDir
  let filePath

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-export-pdf-'))
    filePath = path.join(tmpDir, 'export.pdf')
    showSaveDialog.mockReset()
    mockExecuteJavaScript.mockReset().mockResolvedValue(undefined)
    mockPrintToPDF.mockReset().mockResolvedValue(Buffer.from('mock-pdf-data'))
    mockClose.mockReset()
    mockWithRenderedHtml.mockReset().mockImplementation(async (_html, fn) =>
      fn({
        webContents: {
          printToPDF: (...a) => mockPrintToPDF(...a),
          executeJavaScript: (...a) => mockExecuteJavaScript(...a)
        },
        isDestroyed: () => false,
        close: () => mockClose()
      })
    )
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('writes PDF data to the chosen file', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await handleExportPDF(null, {
      title: 'My Note',
      content: '# Heading\nBody'
    })

    expect(result).toEqual({ success: true, filePath })
    const written = await fs.readFile(filePath)
    expect(written.toString()).toBe('mock-pdf-data')
  })

  it('renders the generated HTML in a hidden render window', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportPDF(null, { title: 'Note', content: 'body' })

    expect(mockWithRenderedHtml).toHaveBeenCalledTimes(1)
    expect(mockWithRenderedHtml.mock.calls[0][0]).toContain('<!DOCTYPE html>')
  })

  it('calls printToPDF with A4 settings', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportPDF(null, { title: 'Note', content: 'body' })

    expect(mockPrintToPDF).toHaveBeenCalledWith(
      expect.objectContaining({ printBackground: true, pageSize: 'A4' })
    )
  })

  it('adds a page-number footer so exports are print-ready', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportPDF(null, { title: 'Note', content: 'body' })

    const options = mockPrintToPDF.mock.calls[0][0]
    expect(options.displayHeaderFooter).toBe(true)
    expect(options.footerTemplate).toContain('pageNumber')
    expect(options.footerTemplate).toContain('text-align:right')
    // Only the number should appear — no "Page"/"of" labels.
    expect(options.footerTemplate).not.toContain('Page')
    expect(options.footerTemplate).not.toContain('totalPages')
  })

  it('converts wikilinks in the printed HTML', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportPDF(null, { title: 'Note', content: 'See [[Other]]' })

    const htmlArg = mockWithRenderedHtml.mock.calls[0][0]
    expect(htmlArg).toContain('<a href="#">Other</a>')
  })

  it('returns canceled when dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    const result = await handleExportPDF(null, { title: 'Note', content: 'body' })
    expect(result).toEqual({ success: false, canceled: true })
    expect(mockPrintToPDF).not.toHaveBeenCalled()
  })

  it('throws when no content provided', async () => {
    await expect(handleExportPDF(null, { title: 'Empty' })).rejects.toThrow('No content provided')
    expect(showSaveDialog).not.toHaveBeenCalled()
  })

  it('uses Untitled as default dialog name', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportPDF(null, { content: 'body' })
    expect(showSaveDialog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ defaultPath: 'Untitled.pdf' })
    )
  })
})

describe('generatePDFHTML', () => {
  it('adds a clean title heading when the note has no heading', async () => {
    const html = await generatePDFHTML('My Note', 'just a paragraph')
    expect(html).toMatch(/<h1>My Note<\/h1>/)
  })

  it('does not duplicate the title when the note already starts with a heading', async () => {
    const html = await generatePDFHTML('My Note', '# Different Heading\n\nbody')
    expect(html).not.toMatch(/<h1>My Note<\/h1>/)
    expect(html).toMatch(/<h1[^>]*>Different Heading<\/h1>/)
  })

  it('does not include the old "Exported from Lumina" metadata band', async () => {
    const html = await generatePDFHTML('My Note', 'body')
    expect(html).not.toContain('Exported from Lumina')
    expect(html).not.toContain('doc-header')
  })
})
