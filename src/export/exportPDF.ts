import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { renderMarkdown, escapeHtml } from './exportUtils'
import { withRenderedHtml } from './renderWindow'

export interface ExportPDFPayload {
  title?: string
  content?: string
}

export interface ExportPDFResult {
  success: boolean
  filePath?: string
  canceled?: boolean
}

/**
 * Wraps a rendered markdown body in a print-optimised, A4 PDF document with a
 * table of contents and Mermaid rendering support.
 *
 * Exported separately so the export preview dialog can reuse the exact same
 * markup without duplicating styles.
 */
export function buildPDFDocument(title?: string, htmlBody: string = '', tocHtml: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Untitled')}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css">
  <style>
    @page {
      size: A4;
      margin: 25mm 22mm 28mm 22mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: #0b0d12;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.65;
      color: #1e293b;
      font-size: 10.5pt;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      padding: 40px 48px;
      min-height: 100vh;
    }
    /* Premium scrollbars (iframe preview) */
    html { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.18) transparent; }
    ::-webkit-scrollbar { width: 11px; height: 11px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      border: 3px solid transparent;
      background-clip: padding-box;
    }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); background-clip: padding-box; }
    ::-webkit-scrollbar-corner { background: transparent; }
    /* Screen (preview) — a flat, crisp paper page on a dark desk */
    .page {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
      padding: 64px 76px;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: none;
    }
    @media print {
      html, body { background: #ffffff; }
      body { padding: 0; }
      .page {
        max-width: none;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 0;
        box-shadow: none;
      }
    }
    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      font-weight: 700;
      line-height: 1.3;
      page-break-after: avoid;
      break-after: avoid;
    }
    h1 {
      font-size: 20pt;
      margin-top: 0;
      margin-bottom: 12pt;
      color: #0f172a;
    }
    h2 {
      font-size: 15pt;
      margin-top: 18pt;
      margin-bottom: 8pt;
      color: #1e293b;
    }
    h3 { font-size: 12.5pt; margin-top: 14pt; margin-bottom: 6pt; color: #334155; }
    h4 { font-size: 11pt; margin-top: 12pt; margin-bottom: 4pt; color: #475569; }
    p {
      margin-bottom: 11pt;
      color: #334155;
      text-align: justify;
      text-justify: inter-word;
      hyphens: auto;
      orphans: 3;
      widows: 3;
    }
    code {
      font-family: 'Consolas', 'Fira Code', 'Courier New', monospace;
      font-size: 9.5pt;
      background-color: #eef2f7;
      color: #b91c4a;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      word-break: break-word;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12pt 14pt;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      margin: 12pt 0;
      break-inside: auto;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    /* Prevent the syntax-highlight theme from painting a second, nested block */
    pre code,
    pre code.hljs,
    code.hljs,
    .hljs {
      background: transparent !important;
      padding: 0;
      border: none;
    }
    pre code {
      background: transparent;
      padding: 0;
      border: none;
      color: #1e293b;
      font-size: 9pt;
      line-height: 1.5;
    }
    blockquote {
      border-left: 3.5px solid #6366f1;
      background-color: #f8fafc;
      padding: 10px 16px;
      margin: 12pt 0;
      color: #475569;
      font-style: italic;
      border-radius: 0 6px 6px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table {
      border-collapse: collapse;
      margin: 16pt 0;
      width: 100%;
      max-width: 100%;
      table-layout: auto;
      font-size: 9.5pt;
      word-break: break-word;
      break-inside: auto;
      border-top: 1.5pt solid #334155;
      border-bottom: 1.5pt solid #334155;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      border: none;
      padding: 8pt 12pt;
      text-align: left;
      word-break: break-word;
      overflow-wrap: anywhere;
      vertical-align: top;
      line-height: 1.5;
    }
    th {
      background: transparent;
      font-weight: 600;
      color: #0f172a;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1pt solid #94a3b8;
    }
    tbody tr {
      border-bottom: 0.5pt solid #e2e8f0;
    }
    tbody tr:last-child {
      border-bottom: none;
    }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    img {
      display: block;
      max-width: 100%;
      max-height: 9.5cm;
      width: auto;
      height: auto;
      margin: 12pt auto;
      border-radius: 6px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .mermaid {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 14pt 0;
      page-break-inside: avoid;
      break-inside: avoid;
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
      font-size: 10pt;
      line-height: 1.4;
      color: #b91c4a;
      background: #fff5f5;
      border: 1px solid #fecaca;
      border-radius: 6px;
      text-align: center;
    }
    /* Normalise figure sizing so every diagram/image prints at a consistent scale */
    figure {
      margin: 12pt auto;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    figure img,
    figure svg {
      max-width: 100%;
      max-height: 9.5cm;
      height: auto;
      margin: 0 auto;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul, ol {
      margin: 10pt 0;
      padding-left: 22pt;
      color: #334155;
    }
    li {
      margin: 3pt 0;
    }
    hr {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 18pt 0;
    }
    .toc {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14pt 18pt;
      margin: 0 0 18pt 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .toc-title {
      font-size: 14pt;
      margin-top: 0;
      margin-bottom: 8pt;
      padding-bottom: 0;
      border-bottom: none;
      color: #0f172a;
    }
    .toc-list {
      list-style: none;
      padding-left: 0;
      margin: 0;
    }
    .toc-list li {
      margin: 2pt 0;
    }
    .toc-l2 { padding-left: 12pt; }
    .toc-l3 { padding-left: 24pt; }
    .toc-list a {
      color: #475569;
      text-decoration: none;
    }
    .toc-list a:hover {
      color: #2563eb;
      text-decoration: underline;
    }
    /* Combined export: multiple notes merged into one document */
    .note-title {
      font-size: 17pt;
      color: #0f172a;
      margin: 0 0 10pt;
    }
    .note-error { color: #94a3b8; font-style: italic; }
    .combined-toc {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12pt 18pt;
      margin: 0 0 18pt 0;
    }
    .combined-toc-title {
      font-size: 13pt;
      margin: 0 0 6pt;
      padding: 0;
      border: none;
      color: #0f172a;
    }
    .combined-toc ol { margin: 0; padding-left: 18pt; }
    .combined-toc a { color: #2563eb; text-decoration: none; }
    .note[data-page-break='true'] {
      break-before: page;
      page-break-before: always;
    }
    @media screen {
      .note[data-page-break='true'] {
        margin-top: 36pt;
        padding-top: 24pt;
        border-top: 1px dashed #cbd5e1;
      }
    }
  </style>
</head>
<body>
  <article class="page">
    ${tocHtml}
    ${htmlBody}
  </article>

  <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      themeVariables: { fontSize: '13px' },
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true }
    });

    // Clamp every diagram to a consistent, print-friendly size. We size from the
    // SVG viewBox so oversized graphs shrink proportionally and never dominate
    // the page (max ~14.8cm wide, ~9.5cm tall), while small ones are left alone.
    function clampSvgSize(svgEl) {
      try {
        var vb = svgEl.viewBox && svgEl.viewBox.baseVal;
        var w0 = vb && vb.width ? vb.width : 0;
        var h0 = vb && vb.height ? vb.height : 0;
        if (!w0 || !h0) {
          // Some diagram types omit a viewBox — derive one from the geometry.
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

    async function renderMermaid() {
      try {
        var elements = Array.prototype.slice.call(document.querySelectorAll('.mermaid'));
        if (elements.length > 0) {
          await mermaid.run({ nodes: elements, suppressErrors: true });
        }

        const svgs = document.querySelectorAll('.mermaid svg');
        svgs.forEach(svgEl => {
           const shapes = svgEl.querySelectorAll('.node rect, .node circle, .node ellipse, .node polygon, .node path, .mindmap-node rect, .mindmap-node circle, .mindmap-node ellipse, .mindmap-node polygon, .mindmap-node path, .cluster rect, rect.actor, .actor, rect.note, .note, rect.task, .task, rect.labelBox, .labelBox, .pieTitleText, .pieSector, .rect, .labelBkg, .label-container, .activation0, .activation1, .activation2, rect');
           shapes.forEach(shape => {
               shape.style.setProperty('fill', 'transparent', 'important');
               shape.style.setProperty('stroke', '#000000', 'important');
               shape.style.setProperty('stroke-width', '1px', 'important');
             });
           const texts = svgEl.querySelectorAll('.node .label text, .mindmap-node text, .label text, .edgeLabel text, .cluster-label text, text.actor, .actor text, text.noteText, .noteText, text.messageText, .messageText, text.loopText, .loopText, text.taskText, text.labelText, .labelText, .legend text, text, tspan, p, span, div');
           texts.forEach(text => {
               text.style.setProperty('color', '#000000', 'important');
               text.style.setProperty('fill', '#000000', 'important');
               text.style.setProperty('stroke', 'none', 'important');
             });
           const edges = svgEl.querySelectorAll('.edgePath path, .mindmap-edges path, path.link, path.edge, .flowchart-link, path.messageLine0, path.messageLine1, path.loopLine, path.taskLine, .messageLine0, .messageLine1, .edgeLine, .transition');
           edges.forEach(edge => {
               edge.style.setProperty('stroke', '#000000', 'important');
               edge.style.setProperty('stroke-width', '1px', 'important');
               edge.style.setProperty('fill', 'none', 'important');
             });
             const markers = svgEl.querySelectorAll('marker path, marker polygon, marker circle');
             markers.forEach(marker => {
               marker.style.setProperty('fill', '#000000', 'important');
               marker.style.setProperty('stroke', '#000000', 'important');
             });
             clampSvgSize(svgEl);
        });

        // Any diagram that failed to produce an SVG (bad syntax) is swapped for
        // a small, tidy notice instead of Mermaid's oversized error text.
        document.querySelectorAll('.mermaid').forEach(function (el) {
          if (el.querySelector('svg')) return;
          var text = el.textContent || '';
          if (text && /error|syntax|parse/i.test(text)) {
            el.innerHTML =
              '<div class="mermaid-error">Diagram could not be rendered (syntax error)</div>';
          }
        });
      } catch (err) {
        console.error(err);
      } finally {
        document.body.classList.add('mermaid-done');
      }
    }
    window.addEventListener('load', renderMermaid);
  </script>
</body>
</html>`
}

/**
 * Renders markdown to a full print-ready PDF HTML document (no file I/O).
 * Shared by the exporter and the preview dialog.
 */
export async function generatePDFHTML(title?: string, content?: string): Promise<string> {
  const { html, tocHtml } = await renderMarkdown(content || '', {
    wikilinkMode: 'link',
    mermaid: true,
    toc: true
  })
  return buildPDFDocument(title, html, tocHtml)
}

/**
 * Shared Chromium print options for A4 PDF export.
 * Adds consistent margins and a subtle page-number footer so exported
 * documents are print-ready without further editing.
 */
export const PDF_PRINT_OPTIONS = {
  printBackground: true,
  pageSize: 'A4' as const,
  displayHeaderFooter: true,
  headerTemplate:
    '<div style="width:100%;box-sizing:border-box;font-size:9.5px;color:#94a3b8;padding:10mm 22mm 0 22mm;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;"></div>',
  footerTemplate:
    '<div style="width:100%;box-sizing:border-box;font-size:10.5px;color:#94a3b8;text-align:right;padding:0 22mm 12mm 22mm;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;"><span class="pageNumber"></span></div>',
  margins: { top: 0.98, bottom: 1.15, left: 0.866, right: 0.866 }
}

export const handleExportPDF = async (
  mainWindow: BrowserWindow | null,
  payload: ExportPDFPayload
): Promise<ExportPDFResult> => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    // Show save dialog FIRST for immediate user feedback
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow as any, {
      title: 'Save PDF',
      defaultPath: `${title || 'Untitled'}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const html = await generatePDFHTML(title, content)

    // Render (with Mermaid inlined) in a hidden window, then print to PDF.
    const pdfData = await withRenderedHtml(html, (win) =>
      win.webContents.printToPDF(PDF_PRINT_OPTIONS)
    )

    await fs.writeFile(filePath, pdfData)
    return { success: true, filePath }
  } catch (error) {
    console.error('[Main] Export PDF failed:', error)
    throw error
  }
}
