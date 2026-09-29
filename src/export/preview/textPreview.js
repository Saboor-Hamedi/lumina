/**
 * ============================================================================
 * Plain Text Preview (`preview/textPreview.js`)
 * ============================================================================
 * Full-width, themed plain-text view. No card, no shadow.
 * ============================================================================
 */

import { renderMarkdown, escapeHtml } from '../exportUtils.js'
import { themeVarsCss, basePreviewCss, wrapPreviewDocument } from './themeTokens.js'

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
 * @param {string} html
 * @returns {string}
 */
function htmlToPlainText(html) {
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
 * @param {string} title
 * @param {string} content Markdown source
 * @param {unknown} theme
 * @returns {Promise<string>} Full HTML document
 */
export async function buildTextPreview(title, content, theme) {
  const safeTitle = title || 'Untitled'
  const { html } = await renderMarkdown(content, { toc: false })
  const plain = htmlToPlainText(html)
  const body = `  <pre class="txt">${escapeHtml(plain)}</pre>`
  return wrapPreviewDocument(
    `${themeVarsCss(theme)}\n${basePreviewCss()}\n${TEXT_CSS}`,
    body,
    safeTitle
  )
}
