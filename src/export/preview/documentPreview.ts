/**
 * ============================================================================
 * Rendered Document Preview (`preview/documentPreview.ts`)
 * ============================================================================
 * Full-width, themed preview for the rich formats (PDF, Word, HTML). It reuses
 * the exact markdown pipeline as the exporters (images embedded, wikilinks,
 * table of contents, Mermaid) but styles the surface for the app, with no card
 * and no page shadow.
 * ============================================================================
 */

import { renderMarkdown } from '../exportUtils'
import { themeVarsCss, basePreviewCss, wrapPreviewDocument, isLightTheme } from './themeTokens'

const DOCUMENT_CSS = `
    .doc { width: 100%; max-width: 840px; margin: 0 auto; font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; }
    h1, h2, h3, h4, h5, h6 {
      color: var(--text-main);
      font-weight: 700;
      line-height: 1.3;
      margin: 12pt 0 6pt;
    }
    h1 { font-size: 14pt; margin-top: 0; }
    h2 { font-size: 12pt; padding-bottom: 2pt; border-bottom: none; }
    h3, h4 { font-size: 12pt; }
    h4 { color: var(--text-muted); }
    p { margin: 6pt 0; color: var(--text-main); text-align: justify; text-justify: inter-word; hyphens: auto; }
    ul, ol { margin: 0 0 1em; padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    hr { border: none; height: 1px; background: var(--border-card); margin: 1.8em 0; }
    code {
      font-family: var(--font-mono);
      font-size: 0.88em;
      background: transparent;
      color: var(--text-accent);
      border: 0;
      padding: 0;
    }
    article.doc code:not(pre code) {
      background: transparent !important;
      background-color: transparent !important;
      color: var(--text-accent) !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      padding: 0 !important;
    }
    pre {
      background: var(--bg-panel);
      border: 1px solid var(--border-card);
      border-radius: 8px;
      padding: 16px 18px;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      margin: 1.2em 0;
    }
    pre code,
    pre code.hljs,
    code.hljs,
    .hljs {
      background: transparent !important;
      border: none;
      padding: 0;
      color: var(--text-main);
    }
    blockquote {
      border: none !important;
      border-left: none !important;
      background: transparent;
      padding: 0 0 0 12pt;
      margin: 6pt 0;
      color: var(--text-muted);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt auto;
      font-size: 10pt;
      table-layout: fixed;
      word-break: break-word;
      border: 1px solid var(--border-subtle);
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td {
      border: 1px solid var(--border-card);
      padding: 1pt 3pt;
      text-align: left;
      word-break: break-word;
      overflow-wrap: anywhere;
      vertical-align: top;
      line-height: 1.1;
    }
    th p, td p { margin: 0 !important; line-height: 1.1; }
    th {
      background: var(--bg-panel);
      color: var(--text-main);
      font-weight: 700;
      font-size: 10pt;
    }
    tbody tr {
      border-bottom: 1px solid color-mix(in srgb, var(--border-dim) 50%, transparent);
    }
    tbody tr:last-child {
      border-bottom: none;
    }
    tbody tr:nth-child(even) {
      background: color-mix(in srgb, var(--bg-panel) 40%, transparent);
    }
    img {
      display: block;
      max-width: 100%;
      max-height: 9.5cm;
      width: auto;
      height: auto;
      margin: 0.8em auto;
      border-radius: 8px;
      border: 1px solid var(--border-card);
    }
    .mermaid {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 1em 0;
    }
    .mermaid svg {
      max-width: 100% !important;
      max-height: 9.5cm !important;
      width: auto !important;
      height: auto !important;
    }
    .mermaid-error {
      display: block;
      max-width: 100%;
      margin: 0 auto;
      padding: 8px 10px;
      font-size: 0.85em;
      line-height: 1.4;
      color: #b91c4a;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 6px;
      text-align: center;
    }
    .wikilink { color: var(--text-accent); font-weight: 500; }
    .toc {
      background: transparent;
      border: 0;
      border-radius: 0;
      padding: 0;
      margin: 0 0 1.6em;
    }
    .toc-title { font-size: 14pt; font-weight: 700; color: var(--text-main); margin: 0 0 6pt; border: none; border-bottom: 1px solid var(--border-card); padding: 0 0 4pt; }
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
 * @param format 'pdf' | 'docs' | 'html'
 * @param title Document title
 * @param content Markdown source
 * @param theme Resolved app theme tokens
 * @returns Full HTML document
 */
export async function buildDocumentPreview(
  _format: string,
  title?: string,
  content?: string,
  theme?: unknown,
  opts: { toc?: boolean } = {}
): Promise<string> {
  const showToc = opts.toc ?? true
  const { html, tocHtml } = await renderMarkdown(content || '', {
    wikilinkMode: 'span',
    mermaid: true,
    toc: showToc
  })

  const safeTitle = title || 'Untitled'

  const body = `  <article class="doc">
    ${showToc ? tocHtml : ''}
    ${html}
  </article>`

  const hasMermaid = html.includes('class="mermaid"')
  const mermaidTheme = isLightTheme(theme) ? 'default' : 'dark'
  const mermaidScript = hasMermaid
    ? `
  <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
  <script>
    function start() {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: '${mermaidTheme}',
        securityLevel: 'strict',
        themeVariables: { fontSize: '13px' },
        flowchart: { useMaxWidth: true, htmlLabels: true },
        sequence: { useMaxWidth: true },
        gantt: { useMaxWidth: true }
      });
      function clampSvgSize(svgEl) {
        try {
          var vb = svgEl.viewBox && svgEl.viewBox.baseVal;
          var w0 = vb && vb.width ? vb.width : 0;
          var h0 = vb && vb.height ? vb.height : 0;
          if (!w0 || !h0) {
            var bb = svgEl.getBBox();
            if (!bb || !bb.width || !bb.height) return;
            w0 = bb.width;
            h0 = bb.height;
            svgEl.setAttribute('viewBox', bb.x + ' ' + bb.y + ' ' + bb.width + ' ' + bb.height);
          }
          var MAX_W = 560, MAX_H = 360;
          var scale = Math.min(MAX_W / w0, MAX_H / h0, 1);
          svgEl.removeAttribute('style');
          svgEl.setAttribute('width', Math.round(w0 * scale));
          svgEl.setAttribute('height', Math.round(h0 * scale));
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
        } catch (e) {}
      }
      function finish() {
        document.querySelectorAll('.mermaid svg').forEach(clampSvgSize);
        // Swap any failed diagram for a small notice (not Mermaid's huge error).
        document.querySelectorAll('.mermaid').forEach(function (el) {
          if (el.querySelector('svg')) return;
          var text = el.textContent || '';
          if (text && /error|syntax|parse/i.test(text)) {
            el.innerHTML = '<div class="mermaid-error">Diagram could not be rendered (syntax error)</div>';
          }
        });
        document.body.classList.add('mermaid-done');
      }
      // Only render diagrams that aren't already inlined as SVG (the main
      // process may have pre-rendered them). Already-rendered ones are just
      // clamped by finish().
      var pending = Array.prototype.slice
        .call(document.querySelectorAll('.mermaid'))
        .filter(function (el) {
          return !el.querySelector('svg');
        });
      if (pending.length > 0) {
        mermaid
          .run({ nodes: pending, suppressErrors: true })
          .then(finish)
          .catch(function () {
            finish();
          });
      } else {
        finish();
      }
    } catch (e) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  </script>`
    : ''

  const highlightCss = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/${isLightTheme(theme) ? 'github' : 'github-dark'}.min.css">`

  return wrapPreviewDocument(
    `${themeVarsCss(theme)}\n${basePreviewCss()}\n${DOCUMENT_CSS}`,
    body,
    safeTitle,
    `${highlightCss}\n${mermaidScript}`
  )
}
