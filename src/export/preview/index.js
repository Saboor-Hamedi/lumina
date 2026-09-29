/**
 * ============================================================================
 * Export Preview (`preview/index.js`)
 * ============================================================================
 * Dispatch layer for export previews. Each format lives in its own module so
 * changes stay isolated and robust:
 *   - documentPreview.js → PDF / Word / HTML (rendered markdown, full-width)
 *   - markdownPreview.js → raw Markdown source
 *   - textPreview.js     → plain text
 *
 * All previews are full-width and themed (no card, no shadow).
 * ============================================================================
 */

import { buildDocumentPreview } from './documentPreview.js'
import { buildMarkdownPreview } from './markdownPreview.js'
import { buildTextPreview } from './textPreview.js'

export const SUPPORTED_PREVIEW_FORMATS = [
  'html',
  'pdf',
  'docs',
  'markdown',
  'text',
  'markdown-bundle'
]

/**
 * Builds a preview HTML document for the requested format.
 *
 * @param {string} format One of SUPPORTED_PREVIEW_FORMATS
 * @param {string} title Document title
 * @param {string} content Markdown source
 * @param {unknown} [theme] Resolved app theme tokens ({ 'bg-app': '#…', … })
 * @returns {Promise<{ html: string, format: string, truncated: boolean }>}
 */
export async function buildPreview(format, title, content, theme) {
  if (!SUPPORTED_PREVIEW_FORMATS.includes(format)) {
    throw new Error(`Unsupported preview format: ${format}`)
  }

  let html
  switch (format) {
    case 'html':
    case 'pdf':
    case 'docs':
      html = await buildDocumentPreview(format, title, content, theme)
      break
    case 'markdown':
    case 'markdown-bundle':
      html = buildMarkdownPreview(title, content, theme)
      break
    case 'text':
      html = await buildTextPreview(title, content, theme)
      break
  }

  // Guard against pathological payloads to keep the IPC bridge responsive.
  const MAX = 2_000_000
  const truncated = html.length > MAX
  return { html: truncated ? html.slice(0, MAX) : html, format, truncated }
}
