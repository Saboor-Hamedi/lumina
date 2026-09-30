import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  sanitizeExportTitle,
  combinedDefaultName,
  buildCombinedMarkdown,
  buildCombinedText,
  buildCombinedSections,
  buildCombinedHTMLDocument,
  handleExportCombined
} from '../../src/export/exportCombined'

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

const notes = [
  { id: '1', title: 'First Note', content: '# First\n\nHello **world**' },
  { id: '2', title: 'Second Note', content: 'Body two' },
  { id: '3', title: 'Third Note', content: 'Body three' }
]

describe('exportCombined.sanitizeExportTitle', () => {
  it('removes invalid filename characters', () => {
    expect(sanitizeExportTitle('a/b:c*d?e"f<g>h|i')).toBe('a_b_c_d_e_f_g_h_i')
  })

  it('truncates very long titles with an ellipsis', () => {
    const long = 'x'.repeat(200)
    const result = sanitizeExportTitle(long)
    expect(result.length).toBeLessThanOrEqual(120)
    expect(result.endsWith('…')).toBe(true)
  })

  it('falls back to Untitled for empty input', () => {
    expect(sanitizeExportTitle('')).toBe('Untitled')
    expect(sanitizeExportTitle(undefined)).toBe('Untitled')
  })
})

describe('exportCombined.combinedDefaultName', () => {
  it('uses the note title for a single note', () => {
    expect(combinedDefaultName([notes[0]], 'pdf')).toBe('First Note.pdf')
  })

  it('uses a count label for multiple notes', () => {
    expect(combinedDefaultName(notes, 'markdown')).toBe('Combined Export (3 notes).md')
  })

  it('maps extensions per format', () => {
    expect(combinedDefaultName(notes, 'text')).toBe('Combined Export (3 notes).txt')
    expect(combinedDefaultName(notes, 'docs')).toBe('Combined Export (3 notes).doc')
  })
})

describe('exportCombined.buildCombinedMarkdown', () => {
  it('merges notes with titles and separators', () => {
    const md = buildCombinedMarkdown(notes)
    expect(md).toContain('# First Note')
    expect(md).toContain('# Second Note')
    expect(md).toContain('---')
  })
})

describe('exportCombined.buildCombinedText', () => {
  it('strips markdown syntax', async () => {
    const text = await buildCombinedText([{ title: 'T', content: '# Heading\n\n**bold**' }])
    expect(text).not.toContain('**')
    expect(text).not.toContain('#')
    expect(text).toContain('Heading')
    expect(text).toContain('bold')
  })
})

describe('exportCombined.buildCombinedSections', () => {
  it('creates one section per note with stable ids', async () => {
    const { html, ids } = await buildCombinedSections(notes)
    expect(ids).toEqual(['note-0', 'note-1', 'note-2'])
    expect(html.match(/<section/g)?.length).toBe(3)
  })

  it('marks notes after the first with a page break', async () => {
    const { html } = await buildCombinedSections(notes)
    expect(html.match(/data-page-break="true"/g)?.length).toBe(2)
  })

  it('builds a table of contents for multiple notes', async () => {
    const { toc } = await buildCombinedSections(notes)
    expect(toc).toContain('href="#note-0"')
    expect(toc).toContain('First Note')
  })

  it('omits the table of contents for a single note', async () => {
    const { toc } = await buildCombinedSections([notes[0]])
    expect(toc).toBe('')
  })

  it('does not inject a title when the note already starts with a heading', async () => {
    const { html } = await buildCombinedSections([{ title: 'T', content: '# T\n\nbody' }])
    expect(html).not.toContain('note-title')
    expect(html.match(/<h1/g)?.length).toBe(1)
  })

  it('injects a title when the note has no heading', async () => {
    const { html } = await buildCombinedSections([{ title: 'T', content: 'just body' }])
    expect(html).toContain('note-title')
    expect(html).toContain('>T</h1>')
  })
})

describe('exportCombined.buildCombinedHTMLDocument', () => {
  it('escapes the document title', () => {
    const html = buildCombinedHTMLDocument('<b>Hi</b>', '<section></section>')
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;')
  })
})

describe('exportCombined.handleExportCombined', () => {
  let tmpDir

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-combined-'))
    showSaveDialog.mockReset()
    mockExecuteJavaScript.mockReset().mockResolvedValue(undefined)
    mockPrintToPDF.mockReset().mockResolvedValue(Buffer.from('mock-pdf'))
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

  it('writes one merged markdown file', async () => {
    const filePath = path.join(tmpDir, 'combined.md')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await handleExportCombined(null, { notes, format: 'markdown' })

    expect(result).toMatchObject({ success: true, total: 3, combined: true })
    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('# First Note')
    expect(written).toContain('# Third Note')
  })

  it('writes a single PDF via one print run', async () => {
    const filePath = path.join(tmpDir, 'combined.pdf')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await handleExportCombined(null, { notes, format: 'pdf' })

    expect(result).toMatchObject({ success: true, total: 3, combined: true })
    expect(mockPrintToPDF).toHaveBeenCalledTimes(1)
    const written = await fs.readFile(filePath)
    expect(written.toString()).toBe('mock-pdf')
  })

  it('writes one merged HTML file', async () => {
    const filePath = path.join(tmpDir, 'combined.html')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await handleExportCombined(null, { notes, format: 'html' })

    expect(result).toMatchObject({ success: true, combined: true })
    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('First Note')
    expect(written).toContain('Third Note')
    // HTML format must not spin up a print window
    expect(mockPrintToPDF).not.toHaveBeenCalled()
  })

  it('writes one merged text file', async () => {
    const filePath = path.join(tmpDir, 'combined.txt')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await handleExportCombined(null, { notes, format: 'text' })

    expect(result).toMatchObject({ success: true, combined: true })
    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('First Note')
  })

  it('writes one merged Word document via the render window', async () => {
    const filePath = path.join(tmpDir, 'combined.doc')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })
    mockExecuteJavaScript.mockResolvedValue('<html><body>rendered</body></html>')

    const result = await handleExportCombined(null, { notes, format: 'docs' })

    expect(result).toMatchObject({ success: true, combined: true })
    expect(mockWithRenderedHtml).toHaveBeenCalledTimes(1)
    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toBe('<html><body>rendered</body></html>')
  })

  it('returns canceled when the save dialog is dismissed', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    const result = await handleExportCombined(null, { notes, format: 'pdf' })
    expect(result).toEqual({ success: false, canceled: true })
    expect(mockPrintToPDF).not.toHaveBeenCalled()
  })

  it('throws for an unsupported format', async () => {
    await expect(handleExportCombined(null, { notes, format: 'nope' })).rejects.toThrow(
      'Unsupported combined format'
    )
  })

  it('throws when no notes are provided', async () => {
    await expect(handleExportCombined(null, { notes: [], format: 'pdf' })).rejects.toThrow(
      'No notes provided'
    )
  })
})
