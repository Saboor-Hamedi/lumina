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
 */

const exportPayloadSchema = z.record(z.string(), z.any())

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
}
