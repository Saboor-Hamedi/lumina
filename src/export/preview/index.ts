/**
 * ============================================================================
 * Export Preview (`preview/index.ts`)
 * ============================================================================
 * Dispatch layer for export previews. Each format lives in its own module so
 * changes stay isolated and robust:
 *   - documentPreview.ts → PDF / Word / HTML (rendered markdown, full-width)
 *   - markdownPreview.ts → raw Markdown source
 *   - textPreview.ts     → plain text
 *
 * All previews are full-width and themed (no card, no shadow).
 * ============================================================================
 */

import { buildDocumentPreview } from './documentPreview'
import { buildMarkdownPreview } from './markdownPreview'
import { buildTextPreview } from './textPreview'

export const SUPPORTED_PREVIEW_FORMATS = [
  'html',
  'pdf',
  'docs',
  'markdown',
  'text',
  'markdown-bundle'
] as const

export type SupportedPreviewFormat = (typeof SUPPORTED_PREVIEW_FORMATS)[number]

export interface BuildPreviewResult {
  html: string
  format: string
  truncated: boolean
}

/**
 * Builds a preview HTML document for the requested format.
 *
 * @param format One of SUPPORTED_PREVIEW_FORMATS
 * @param title Document title
 * @param content Markdown source
 * @param theme Resolved app theme tokens ({ 'bg-app': '#…', … })
 * @returns Full HTML document and metadata
 */
export async function buildPreview(
  format: string,
  title?: string,
  content?: string,
  theme?: unknown,
  opts: { toc?: boolean } = {}
): Promise<BuildPreviewResult> {
  if (!SUPPORTED_PREVIEW_FORMATS.includes(format as SupportedPreviewFormat)) {
    throw new Error(`Unsupported preview format: ${format}`)
  }

  let html = ''
  switch (format) {
    case 'html':
    case 'pdf':
    case 'docs':
      html = await buildDocumentPreview(format, title, content, theme, opts)
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

export * from './themeTokens'
export * from './documentPreview'
export * from './markdownPreview'
export * from './textPreview'
