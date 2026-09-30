import { ipcMain, BrowserWindow } from 'electron'
// @ts-ignore
import { handleExportDocs } from '../../export/exportDocs'
// @ts-ignore
import { handleExportPDF } from '../../export/exportPDF'
// @ts-ignore
import { handleExportMarkdown } from '../../export/exportMarkdown'
// @ts-ignore
import { handleExportText } from '../../export/exportText'
// @ts-ignore
import { handleExportCleanHTML, handleExportMarkdownBundle } from '../../export/exportBundle'
// @ts-ignore
import { buildPreview, SUPPORTED_PREVIEW_FORMATS } from '../../export/preview'
// @ts-ignore
import { handleExportBatch, BATCH_FORMATS } from '../../export/exportBatch'
// @ts-ignore
import { handleExportCombined, COMBINED_FORMATS } from '../../export/exportCombined'
import { validateIpc, z } from './ipcValidation'

/**
 * ============================================================================
 * Document Export IPC Handlers
 * ============================================================================
 *
 * Handles multi-format document generation and file export dialogs:
 * - HTML (`window:export-html`): Standalone self-contained HTML with inline styles.
 * - Word (`window:export-docs`): Microsoft Word (.doc) format with embedded diagrams.
 * - PDF (`window:export-pdf`): Print-ready PDF with Mermaid diagrams & custom typography.
 * - Markdown (`window:export-markdown`): Plain markdown file output.
 * - Markdown Bundle (`window:export-markdown-bundle`): Note markdown plus copied assets.
 * - Plain Text (`window:export-text`): Stripped plaintext document.
 * - Preview (`window:export-preview`): Renders an export document without saving.
 * - Batch (`window:export-batch`): Exports many notes to a folder with progress events.
 */

const exportPayloadSchema = z.record(z.string(), z.any())

const previewPayloadSchema = z.object({
  format: z.string(),
  title: z.string().optional(),
  content: z.string(),
  theme: z.record(z.string(), z.string()).optional()
})

const batchNoteSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  content: z.string()
})

const batchPayloadSchema = z.object({
  notes: z.array(batchNoteSchema).min(1),
  format: z.string(),
  outputDir: z.string().optional()
})

const combinedPayloadSchema = z.object({
  notes: z.array(batchNoteSchema).min(1),
  format: z.string(),
  filePath: z.string().optional()
})

export function registerExportHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Export active note to self-contained HTML
  ipcMain.handle('window:export-html', async (_, payload) => {
    const valid = validateIpc(exportPayloadSchema, payload)
    return handleExportCleanHTML(getMainWindow(), valid)
  })

  // Export active note to Microsoft Word (.doc) format
  ipcMain.handle('window:export-docs', async (_, payload) => {
    const valid = validateIpc(exportPayloadSchema, payload)
    return handleExportDocs(getMainWindow(), valid)
  })

  // Export active note to high-resolution print PDF
  ipcMain.handle('window:export-pdf', async (_, payload) => {
    const valid = validateIpc(exportPayloadSchema, payload)
    return handleExportPDF(getMainWindow(), valid)
  })

  // Export active note to a standalone Markdown file (.md)
  ipcMain.handle('window:export-markdown', async (_, payload) => {
    const valid = validateIpc(exportPayloadSchema, payload)
    return handleExportMarkdown(getMainWindow(), valid)
  })

  // Export active note with an assets subfolder for embedded images
  ipcMain.handle('window:export-markdown-bundle', async (_, payload) => {
    const valid = validateIpc(exportPayloadSchema, payload)
    return handleExportMarkdownBundle(getMainWindow(), valid)
  })

  // Export active note to simple text format (.txt)
  ipcMain.handle('window:export-text', async (_, payload) => {
    const valid = validateIpc(exportPayloadSchema, payload)
    return handleExportText(getMainWindow(), valid)
  })

  // Render a preview document for the export dialog (no file written)
  ipcMain.handle('window:export-preview', async (_, payload) => {
    const valid = validateIpc(previewPayloadSchema, payload)
    if (!SUPPORTED_PREVIEW_FORMATS.includes(valid.format)) {
      throw new Error(`Unsupported preview format: ${valid.format}`)
    }
    return buildPreview(valid.format, valid.title || 'Untitled', valid.content, valid.theme)
  })

  // Batch export multiple notes to a folder, streaming progress events
  ipcMain.handle('window:export-batch', async (_, payload) => {
    const valid = validateIpc(batchPayloadSchema, payload)
    if (!BATCH_FORMATS.includes(valid.format)) {
      throw new Error(`Unsupported batch format: ${valid.format}`)
    }

    const win = getMainWindow()
    const send = (progress: any) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('export:batch-progress', progress)
      }
    }

    return handleExportBatch(win, valid, send)
  })

  // Merge multiple notes into a SINGLE file (e.g. one PDF containing all notes)
  ipcMain.handle('window:export-combined', async (_, payload) => {
    const valid = validateIpc(combinedPayloadSchema, payload)
    if (!COMBINED_FORMATS.includes(valid.format)) {
      throw new Error(`Unsupported combined format: ${valid.format}`)
    }

    const win = getMainWindow()
    const send = (progress: any) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('export:batch-progress', progress)
      }
    }

    return handleExportCombined(win, valid, send)
  })
}
