/**
 * ============================================================================
 * Markdown Source Preview (`preview/markdownPreview.js`)
 * ============================================================================
 * Full-width, themed view of the raw markdown source. No card, no shadow.
 * ============================================================================
 */

import { escapeHtml } from '../exportUtils.js'
import { themeVarsCss, basePreviewCss, wrapPreviewDocument } from './themeTokens.js'

const MARKDOWN_CSS = `
    .md {
      width: 100%;
      font-family: var(--font-mono);
      font-size: 13px;
      line-height: 1.75;
      color: var(--text-main);
      white-space: pre-wrap;
      word-wrap: break-word;
      tab-size: 2;
    }
`

/**
 * @param {string} title
 * @param {string} content
 * @param {unknown} theme
 * @returns {string} Full HTML document
 */
export function buildMarkdownPreview(title, content, theme) {
  const safeTitle = title || 'Untitled'
  const body = `  <pre class="md">${escapeHtml(content || '')}</pre>`
  return wrapPreviewDocument(
    `${themeVarsCss(theme)}\n${basePreviewCss()}\n${MARKDOWN_CSS}`,
    body,
    safeTitle
  )
}
