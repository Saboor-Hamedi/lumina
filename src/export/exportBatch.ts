/**
 * ============================================================================
 * Batch Export (`exportBatch.ts`)
 * ============================================================================
 * Exports multiple notes at once to a chosen folder with per-note progress
 * reporting and error recovery (a single failure never aborts the batch).
 * ============================================================================
 */

import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import path from 'path'
// @ts-ignore
import { renderMarkdown } from './exportUtils.js'
// @ts-ignore
import { generateCleanHTML } from './exportBundle.js'
// @ts-ignore
import { generatePDFHTML, PDF_PRINT_OPTIONS } from './exportPDF.js'
// @ts-ignore
import { buildDocsDocument } from './exportDocs.js'

export const BATCH_FORMATS = ['html', 'pdf', 'docs', 'markdown', 'text'] as const
export type BatchFormat = (typeof BATCH_FORMATS)[number]

export interface BatchNoteInput {
  id?: string
  title?: string
  content?: string
}

export interface BatchPayload {
  notes: BatchNoteInput[]
  format: BatchFormat
  outputDir?: string
}

export interface BatchProgress {
  phase: 'start' | 'done' | 'error' | 'complete'
  current: number
  total: number
  title?: string
  filePath?: string
  error?: string
}

export interface BatchExportResult {
  success: boolean
  canceled?: boolean
  outputDir?: string
  total?: number
  exported?: number
  failed?: number
  failures?: Array<{ id: string; title: string; error: string }>
  files?: Array<{ id: string; title: string; filePath: string }>
}

/**
 * Sanitises a note title into a safe filename (without extension).
 */
export function safeFileName(name?: string): string {
  const cleaned = String(name || 'Untitled')
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 32) // strip control characters
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 120)
  return cleaned || 'Untitled'
}

/**
 * Ensures a file path is unique within a directory by appending ` (1)`, ` (2)`…
 */
async function uniquePath(dir: string, base: string, ext: string): Promise<string> {
  let candidate = path.join(dir, `${base}${ext}`)
  let counter = 1
  for (;;) {
    try {
      await fs.access(candidate)
      candidate = path.join(dir, `${base} (${counter})${ext}`)
      counter += 1
    } catch {
      return candidate
    }
  }
}

/**
 * Converts rendered HTML to readable plain text.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/h[1-6]>|<\/div>|<\/li>|<\/blockquote>/gi, '\n\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]*>?/gm, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
}

/**
 * Renders and writes a single note for the given format.
 */
async function writeOne(
  note: { id: string; title: string; content: string },
  format: BatchFormat,
  outputDir: string,
  printWin: BrowserWindow | null
): Promise<string> {
  const title = note.title || 'Untitled'
  const content = note.content || ''
  const base = safeFileName(title)

  switch (format) {
    case 'html': {
      const filePath = await uniquePath(outputDir, base, '.html')
      await fs.writeFile(filePath, await generateCleanHTML(title, content), 'utf-8')
      return filePath
    }
    case 'pdf': {
      if (!printWin) throw new Error('Print window not initialized for PDF export')
      const filePath = await uniquePath(outputDir, base, '.pdf')
      const html = await generatePDFHTML(title, content)
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await printWin.webContents.executeJavaScript(`
        new Promise((resolve) => {
          if (document.body.classList.contains('mermaid-done')) {
            setTimeout(resolve, 300);
          } else {
            const observer = new MutationObserver(() => {
              if (document.body.classList.contains('mermaid-done')) {
                observer.disconnect();
                setTimeout(resolve, 300);
              }
            });
            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            setTimeout(resolve, 3000);
          }
        })
      `)
      const pdfData = await printWin.webContents.printToPDF(PDF_PRINT_OPTIONS)
      await fs.writeFile(filePath, pdfData)
      return filePath
    }
    case 'docs': {
      if (!printWin) throw new Error('Print window not initialized for DOCS export')
      const filePath = await uniquePath(outputDir, base, '.doc')
      const html = await buildDocsDocument(title, content)
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await printWin.webContents.executeJavaScript(`
        new Promise((resolve) => {
          if (document.body.classList.contains('mermaid-done')) {
            setTimeout(resolve, 300);
          } else {
            const observer = new MutationObserver(() => {
              if (document.body.classList.contains('mermaid-done')) {
                observer.disconnect();
                setTimeout(resolve, 300);
              }
            });
            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            setTimeout(resolve, 5000);
          }
        })
      `)
      const rendered = await printWin.webContents.executeJavaScript(
        'document.documentElement.outerHTML'
      )
      const cleanHtml = String(rendered || '').replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ''
      )
      await fs.writeFile(filePath, cleanHtml, 'utf-8')
      return filePath
    }
    case 'markdown': {
      const filePath = await uniquePath(outputDir, base, '.md')
      await fs.writeFile(filePath, content, 'utf-8')
      return filePath
    }
    case 'text': {
      const filePath = await uniquePath(outputDir, base, '.txt')
      const { html } = await renderMarkdown(content, { toc: false })
      const plain = htmlToPlainText(html)
      await fs.writeFile(filePath, plain, 'utf-8')
      return filePath
    }
    default:
      throw new Error(`Unsupported batch format: ${format}`)
  }
}

/**
 * Exports an array of notes to a user-selected folder.
 */
export async function handleExportBatch(
  mainWindow: BrowserWindow | null,
  payload: BatchPayload,
  onProgress?: (progress: BatchProgress) => void
): Promise<BatchExportResult> {
  const { notes = [], format = 'markdown' } = payload || {}

  if (!Array.isArray(notes) || notes.length === 0) {
    throw new Error('No notes provided for batch export')
  }
  if (!BATCH_FORMATS.includes(format)) {
    throw new Error(`Unsupported batch format: ${format}`)
  }

  // Normalise notes so downstream code can rely on id/title/content existing.
  const normalizedNotes = notes.map((n, i) => ({
    id: String(n?.id ?? `note-${i}`),
    title: String(n?.title || 'Untitled'),
    content: String(n?.content ?? '')
  }))

  // Resolve output directory (use provided, else prompt)
  let outputDir = payload.outputDir
  if (!outputDir) {
    const picked = await dialog.showOpenDialog(mainWindow as any, {
      title: 'Choose Export Destination Folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (picked.canceled || !picked.filePaths?.[0]) {
      return { success: false, canceled: true }
    }
    outputDir = picked.filePaths[0]
  }

  const needsPrintWindow = format === 'pdf' || format === 'docs'
  let printWin: BrowserWindow | null = null
  const succeeded: Array<{ id: string; title: string; filePath: string }> = []
  const failed: Array<{ id: string; title: string; error: string }> = []

  try {
    if (needsPrintWindow) {
      printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      })
    }

    for (let i = 0; i < normalizedNotes.length; i++) {
      const note = normalizedNotes[i]
      const title = note.title
      onProgress?.({ phase: 'start', current: i + 1, total: normalizedNotes.length, title })

      try {
        const filePath = await writeOne(note, format, outputDir, printWin)
        succeeded.push({ id: note.id, title, filePath })
        onProgress?.({
          phase: 'done',
          current: i + 1,
          total: normalizedNotes.length,
          title,
          filePath
        })
      } catch (err: any) {
        console.error('[exportBatch] Failed to export note:', title, err)
        failed.push({ id: note.id, title, error: err?.message || String(err) })
        onProgress?.({
          phase: 'error',
          current: i + 1,
          total: normalizedNotes.length,
          title,
          error: err?.message || String(err)
        })
      }
    }
  } finally {
    if (printWin && printWin.isDestroyed?.() !== true) {
      printWin.close()
    }
  }

  onProgress?.({
    phase: 'complete',
    current: normalizedNotes.length,
    total: normalizedNotes.length
  })
  return {
    success: true,
    outputDir,
    total: normalizedNotes.length,
    exported: succeeded.length,
    failed: failed.length,
    failures: failed,
    files: succeeded
  }
}
