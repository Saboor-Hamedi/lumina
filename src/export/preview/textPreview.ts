/**
 * ============================================================================
 * Plain Text Preview (`preview/textPreview.ts`)
 * ============================================================================
 * Full-width, themed plain-text view. No card, no shadow.
 * ============================================================================
 */

import { renderMarkdown, escapeHtml } from '../exportUtils'
import { themeVarsCss, basePreviewCss, wrapPreviewDocument } from './themeTokens'

const TEXT_CSS = `
    .txt {
      width: 100%;
      font-family: var(--font-sans);
      font-size: 13.5px;
      line-height: 1.8;
      color: var(--text-main);
      white-space: pre-wrap;
      word-wrap: break-word;
    }
`

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
 * Builds a plain text preview HTML document.
 */
export async function buildTextPreview(
  title?: string,
  content?: string,
  theme?: unknown
): Promise<string> {
  const safeTitle = title || 'Untitled'
  const { html } = await renderMarkdown(content || '', { toc: false })
  const plain = htmlToPlainText(html)
  const body = `  <pre class="txt">${escapeHtml(plain)}</pre>`
  return wrapPreviewDocument(
    `${themeVarsCss(theme)}\n${basePreviewCss()}\n${TEXT_CSS}`,
    body,
    safeTitle
  )
}
