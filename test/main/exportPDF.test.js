import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { handleExportPDF } from '../../src/export/exportPDF'

const showSaveDialog = vi.fn()
const mockLoadURL = vi.fn()
const mockExecuteJavaScript = vi.fn()
const mockPrintToPDF = vi.fn()
const mockClose = vi.fn()

const { MockBrowserWindow } = vi.hoisted(() => {
  return {
    MockBrowserWindow: class MockBrowserWindow {
      constructor() {
        this.show = false
        this.webContents = {
          executeJavaScript: (...args) => mockExecuteJavaScript(...args),
          printToPDF: (...args) => mockPrintToPDF(...args)
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

describe('handleExportPDF', () => {
  let tmpDir
  let filePath

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-export-pdf-'))
    filePath = path.join(tmpDir, 'export.pdf')
    showSaveDialog.mockReset()
    mockLoadURL.mockReset()
    mockExecuteJavaScript.mockReset().mockResolvedValue(undefined)
    mockPrintToPDF.mockReset().mockResolvedValue(Buffer.from('mock-pdf-data'))
    mockClose.mockReset()
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

  it('loads HTML into a hidden browser window', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportPDF(null, { title: 'Note', content: 'body' })

    expect(mockLoadURL).toHaveBeenCalledTimes(1)
    expect(mockLoadURL.mock.calls[0][0]).toContain('data:text/html')
  })

  it('calls printToPDF with A4 settings', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportPDF(null, { title: 'Note', content: 'body' })

    expect(mockPrintToPDF).toHaveBeenCalledWith(
      expect.objectContaining({ printBackground: true, pageSize: 'A4' })
    )
  })

  it('converts wikilinks in the printed HTML', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await handleExportPDF(null, { title: 'Note', content: 'See [[Other]]' })

    const url = mockLoadURL.mock.calls[0][0]
    expect(decodeURIComponent(url)).toContain('<a href="#">Other</a>')
  })

  it('returns canceled when dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    const result = await handleExportPDF(null, { title: 'Note', content: 'body' })
    expect(result).toEqual({ success: false, canceled: true })
    expect(mockPrintToPDF).not.toHaveBeenCalled()
  })

  it('throws when no content provided', async () => {
    await expect(handleExportPDF(null, { title: 'Empty' })).rejects.toThrow(
      'No content provided'
    )
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
