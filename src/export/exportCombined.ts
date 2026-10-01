/**
 * ============================================================================
 * Combined Export (`exportCombined.ts`)
 * ============================================================================
 * Merges many notes into a SINGLE output file with page breaks between notes,
 * instead of writing one file per note. This is what "select 10 notes → export
 * as PDF" should produce: one PDF containing all 10 notes, in order.
 *
 * Supports: pdf, html, docs (Word), markdown, text.
 *
 * Robustness:
 *  - Titles are sanitised/truncated for filenames and headings.
 *  - Each note is rendered with the same pipeline as the single-note exporters
 *    (images embedded, wikilinks, Mermaid).
 *  - A combined table of contents links to every note.
 *  - A single failure while rendering a note is contained (it becomes a small
 *    notice) so the whole document still exports.
 * ============================================================================
 */

import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { renderMarkdown, escapeHtml } from './exportUtils'
import { buildPDFDocument, PDF_PRINT_OPTIONS } from './exportPDF'
import { buildDocsDocument } from './exportDocs'
import { withRenderedHtml } from './renderWindow'
import { stripMermaidScripts } from './mermaidRuntime'

export const COMBINED_FORMATS = ['pdf', 'html', 'docs', 'markdown', 'text'] as const

export type CombinedFormat = (typeof COMBINED_FORMATS)[number]

export interface CombinedNote {
  id?: string
  title?: string
  content: string
}

export interface CombinedPayload {
  notes?: CombinedNote[]
  format?: string
  filePath?: string
  toc?: boolean
  title?: string
}

export interface CombinedSectionsResult {
  html: string
  toc: string
  ids: string[]
}

export interface CombinedProgress {
  phase: string
  current: number
  total: number
  title?: string
}

export interface CombinedResult {
  success: boolean
  filePath?: string
  total?: number
  combined?: boolean
  canceled?: boolean
}

/** Hard cap so a pathological title cannot bloat a filename. */
const MAX_TITLE_LENGTH = 120

/**
 * Sanitises a note title for safe use in a filename (without extension),
 * truncating very long titles with an ellipsis.
 */
export function sanitizeExportTitle(name?: string): string {
  const cleaned = String(name || 'Untitled')
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 32) // strip control characters
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  if (cleaned.length === 0) return 'Untitled'
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned
  return `${cleaned.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`
}

/**
 * Produces a sensible default filename for a combined export.
 */
export function combinedDefaultName(notes: Array<{ title?: string }>, format: string): string {
  const ext =
    format === 'text' ? 'txt' : format === 'markdown' ? 'md' : format === 'docs' ? 'doc' : format
  const base =
    notes.length === 1
      ? sanitizeExportTitle(notes[0]?.title)
      : `Combined Export (${notes.length} notes)`
  return `${base}.${ext}`
}

/**
 * Builds the merged HTML body for a set of notes and a matching table of
 * contents. Every note after the first starts on a new page (print) / new
 * section (screen).
 */
export async function buildCombinedSections(
  notes: Array<{ title?: string; content: string }>,
  opts: { mermaid?: boolean; toc?: boolean } = {}
): Promise<CombinedSectionsResult> {
  const { mermaid = false, toc: showToc = false } = opts
  const sections: string[] = []
  const tocItems: string[] = []
  const ids: string[] = []

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i] || { content: '' }
    const title = note.title || 'Untitled'
    const id = `note-${i}`
    ids.push(id)

    if (showToc) {
      tocItems.push(`<li><a href="#${id}">${escapeHtml(title)}</a></li>`)
    }

    let bodyHtml: string
    try {
      const rendered = await renderMarkdown(note.content || '', {
        wikilinkMode: 'span',
        mermaid,
        toc: false
      })
      bodyHtml = rendered.html
    } catch (err) {
      console.error('[exportCombined] Failed to render note:', title, err)
      bodyHtml = `<p class="note-error">This note could not be rendered.</p>`
    }

    const pageBreak = i > 0 ? ' data-page-break="true"' : ''
    sections.push(
      `<section class="note" id="${id}"${pageBreak}>${bodyHtml}</section>`
    )
  }

  const toc =
    showToc && tocItems.length > 1
      ? `<nav class="combined-toc"><h2 class="combined-toc-title">Contents</h2><ol>${tocItems.join(
          ''
        )}</ol></nav>`
      : ''

  return { html: sections.join('\n'), toc, ids }
}

/**
 * Builds a single self-contained HTML document containing all notes.
 */
export function buildCombinedHTMLDocument(
  title: string,
  sectionsHtml: string,
  tocHtml: string = ''
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.7;
      color: #1e293b;
      background: #ffffff;
      padding: 48px 24px;
    }
    html { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
    ::-webkit-scrollbar { width: 11px; height: 11px; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }
    .container { max-width: 820px; margin: 0 auto; }
    .combined-toc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 22px; margin-bottom: 2em; }
    .combined-toc-title { font-size: 1em; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 0.6em; }
    .combined-toc ol { padding-left: 1.3em; }
    .combined-toc a { color: #2563eb; text-decoration: none; }
    .combined-toc a:hover { text-decoration: underline; }
    .note { padding-top: 0.5em; }
    .note[data-page-break='true'] { margin-top: 2.4em; }
    .note-title { font-size: 1.7em; color: #0f172a; margin-bottom: 0.8em; }
    .note-error { color: #94a3b8; font-style: italic; }
    h1, h2, h3, h4, h5, h6 { color: #0f172a; margin: 1.4em 0 0.5em; line-height: 1.3; }
    p { margin-bottom: 1em; text-align: justify; text-justify: inter-word; }
    ul, ol { margin: 0 0 1em; padding-left: 1.5em; }
    code { font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; font-size: 0.88em; background: #f1f5f9; color: #e11d48; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 18px; overflow-x: auto; margin: 1.2em 0; }
    pre code { background: transparent; color: #334155; padding: 0; }
    blockquote { border-left: 3px solid #6366f1; background: #f8fafc; padding: 10px 16px; border-radius: 0 6px 6px 0; margin: 1.2em 0; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin: 1.2em 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background: #f8fafc; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.6em 0; }
    @media print {
      body { padding: 0; }
      .container { max-width: none; }
      .note[data-page-break='true'] { break-before: page; border-top: none; margin-top: 0; padding-top: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${tocHtml}
    ${sectionsHtml}
  </div>
</body>
</html>`
}

/**
 * Builds merged markdown for all notes.
 */
export function buildCombinedMarkdown(notes: Array<{ title?: string; content: string }>): string {
  return notes
    .map((note) => (note.content || '').trim())
    .filter(Boolean)
    .join('\n\n---\n\n')
}

/**
 * Builds merged plain text for all notes (markdown stripped).
 */
export async function buildCombinedText(
  notes: Array<{ title?: string; content: string }>
): Promise<string> {
  const parts: string[] = []
  for (const note of notes) {
    const { html } = await renderMarkdown(note.content || '', { toc: false })
    const plain = html
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
    if (plain) {
      parts.push(plain)
    }
  }
  return parts.join('\n\n\n')
}

// ── Export orchestration ────────────────────────────────────────────────────

async function renderPdfBuffer(html: string): Promise<Buffer> {
  return withRenderedHtml(html, (win) => win.webContents.printToPDF(PDF_PRINT_OPTIONS))
}

async function renderDocsHtml(html: string): Promise<string> {
  return withRenderedHtml(html, async (win) => {
    const rendered = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
    return stripMermaidScripts(String(rendered || ''))
  })
}

/**
 * Exports all notes into a single merged file.
 */
export async function handleExportCombined(
  mainWindow: BrowserWindow | null,
  payload: CombinedPayload,
  onProgress?: (progress: CombinedProgress) => void
): Promise<CombinedResult> {
  const { notes = [], format = 'pdf' } = payload || {}

  if (!Array.isArray(notes) || notes.length === 0) {
    throw new Error('No notes provided for combined export')
  }
  if (!COMBINED_FORMATS.includes(format as CombinedFormat)) {
    throw new Error(`Unsupported combined format: ${format}`)
  }

  let filePath = payload.filePath
  if (!filePath) {
    const filters =
      format === 'pdf'
        ? [{ name: 'PDF Files', extensions: ['pdf'] }]
        : format === 'docs'
          ? [{ name: 'Word Document', extensions: ['doc'] }]
          : format === 'html'
            ? [{ name: 'HTML Document', extensions: ['html', 'htm'] }]
            : format === 'markdown'
              ? [{ name: 'Markdown Document', extensions: ['md', 'markdown'] }]
              : [{ name: 'Text Files', extensions: ['txt'] }]
    const picked = await dialog.showSaveDialog(mainWindow as any, {
      title: 'Save Combined Export',
      defaultPath: combinedDefaultName(notes, format),
      filters
    })
    if (picked.canceled || !picked.filePath) {
      return { success: false, canceled: true }
    }
    filePath = picked.filePath
  }

  const docTitle = payload.title || (notes.length === 1 ? notes[0]?.title || 'Untitled' : 'Combined Export')
  const showToc = payload.toc ?? false

  onProgress?.({ phase: 'start', current: 0, total: notes.length, title: 'Preparing…' })

  if (format === 'pdf') {
    const { html: sectionsHtml, toc } = await buildCombinedSections(notes, {
      mermaid: true,
      toc: showToc
    })
    const html = buildPDFDocument(docTitle, sectionsHtml, toc)
    const data = await renderPdfBuffer(html)
    await fs.writeFile(filePath, data)
  } else if (format === 'docs') {
    const { html: sectionsHtml, toc } = await buildCombinedSections(notes, {
      mermaid: true,
      toc: showToc
    })
    const html = buildDocsDocument(docTitle, sectionsHtml, toc)
    const clean = await renderDocsHtml(html)
    await fs.writeFile(filePath, clean, 'utf-8')
  } else if (format === 'html') {
    const { html: sectionsHtml, toc } = await buildCombinedSections(notes, {
      mermaid: false,
      toc: showToc
    })
    await fs.writeFile(filePath, buildCombinedHTMLDocument(docTitle, sectionsHtml, toc), 'utf-8')
  } else if (format === 'markdown') {
    await fs.writeFile(filePath, buildCombinedMarkdown(notes), 'utf-8')
  } else {
    await fs.writeFile(filePath, await buildCombinedText(notes), 'utf-8')
  }

  onProgress?.({ phase: 'complete', current: notes.length, total: notes.length })
  return { success: true, filePath, total: notes.length, combined: true }
}
