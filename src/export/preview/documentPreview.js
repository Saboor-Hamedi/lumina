/**
 * ============================================================================
 * Rendered Document Preview (`preview/documentPreview.js`)
 * ============================================================================
 * Full-width, themed preview for the rich formats (PDF, Word, HTML). It reuses
 * the exact markdown pipeline as the exporters (images embedded, wikilinks,
 * table of contents, Mermaid) but styles the surface for the app, with no card
 * and no page shadow.
 * ============================================================================
 */

import { renderMarkdown, escapeHtml } from '../exportUtils.js'
import { themeVarsCss, basePreviewCss, wrapPreviewDocument, isLightTheme } from './themeTokens.js'

const DOCUMENT_CSS = `
    .doc { width: 100%; max-width: 840px; margin: 0 auto; }
    h1, h2, h3, h4, h5, h6 {
      color: var(--text-main);
      font-weight: 700;
      line-height: 1.3;
      margin: 1.6em 0 0.6em;
    }
    h1 { font-size: 1.9em; margin-top: 0; padding-bottom: 0.3em; border-bottom: 1px solid var(--border-card); }
    h2 { font-size: 1.45em; padding-bottom: 0.25em; border-bottom: 1px solid var(--border-dim); }
    h3 { font-size: 1.2em; }
    h4 { font-size: 1.05em; color: var(--text-muted); }
    p { margin: 0 0 1em; color: var(--text-main); }
    ul, ol { margin: 0 0 1em; padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    hr { border: none; height: 1px; background: var(--border-card); margin: 1.8em 0; }
    code {
      font-family: var(--font-mono);
      font-size: 0.88em;
      background: var(--bg-card);
      color: var(--text-accent);
      border: 1px solid var(--border-card);
      border-radius: 4px;
      padding: 2px 6px;
    }
    pre {
      background: var(--bg-panel);
      border: 1px solid var(--border-card);
      border-radius: 8px;
      padding: 16px 18px;
      overflow-x: auto;
      margin: 1.2em 0;
    }
    pre code { background: transparent; border: none; padding: 0; color: var(--text-main); }
    blockquote {
      border-left: 3px solid var(--text-accent);
      background: var(--bg-panel);
      border-radius: 0 6px 6px 0;
      padding: 10px 16px;
      margin: 1.2em 0;
      color: var(--text-muted);
    }
    table { width: 100%; border-collapse: collapse; margin: 1.2em 0; font-size: 0.92em; }
    th, td { border: 1px solid var(--border-card); padding: 8px 12px; text-align: left; }
    th { background: var(--bg-panel); color: var(--text-main); font-weight: 600; }
    tr:nth-child(even) { background: color-mix(in srgb, var(--bg-panel) 60%, transparent); }
    img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--border-card); margin: 0.6em 0; }
    .wikilink { color: var(--text-accent); font-weight: 500; }
    .doc-header { margin-bottom: 1.6em; padding-bottom: 0.9em; border-bottom: 2px solid var(--text-accent); }
    .doc-title { font-size: 1.9em; font-weight: 800; color: var(--text-main); margin: 0; }
    .doc-meta { margin-top: 0.35em; font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
    .toc {
      background: var(--bg-panel);
      border: 1px solid var(--border-card);
      border-radius: 8px;
      padding: 14px 18px;
      margin: 0 0 1.6em;
    }
    .toc-title { font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); margin: 0 0 0.6em; border: none; padding: 0; }
    .toc-list { list-style: none; padding-left: 0; margin: 0; }
    .toc-list li { margin: 0.2em 0; }
    .toc-l2 { padding-left: 1.1em; }
    .toc-l3 { padding-left: 2.2em; }
    .toc-list a { color: var(--text-muted); }
    .toc-list a:hover { color: var(--text-accent); }
`

/**
 * Builds a full-width themed preview for the given rich format.
 *
 * @param {string} format 'pdf' | 'docs' | 'html'
 * @param {string} title
 * @param {string} content Markdown source
 * @param {unknown} theme
 * @returns {Promise<string>} Full HTML document
 */
export async function buildDocumentPreview(format, title, content, theme) {
  const { html, tocHtml } = await renderMarkdown(content, {
    wikilinkMode: 'span',
    mermaid: true,
    toc: true
  })

  const safeTitle = title || 'Untitled'
  const label = format === 'docs' ? 'Word' : format === 'html' ? 'HTML' : 'PDF'

  const body = `  <article class="doc">
    <header class="doc-header">
      <h1 class="doc-title">${escapeHtml(safeTitle)}</h1>
      <div class="doc-meta">${escapeHtml(label)} preview · Exported from Lumina</div>
    </header>
    ${tocHtml}
    ${html}
  </article>`

  const mermaidTheme = isLightTheme(theme) ? 'default' : 'dark'
  const mermaidScript = `
  <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
  <script>
    try {
      mermaid.initialize({ startOnLoad: false, theme: '${mermaidTheme}', securityLevel: 'strict' });
      if (document.querySelectorAll('.mermaid').length > 0) {
        mermaid.run({ querySelector: '.mermaid' }).catch(function () {});
      }
    } catch (e) {}
  </script>`

  return wrapPreviewDocument(
    `${themeVarsCss(theme)}\n${basePreviewCss()}\n${DOCUMENT_CSS}`,
    body,
    safeTitle,
    mermaidScript
  )
}
