import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { renderMarkdown, escapeHtml, safeFileName } from './exportUtils'
import { withRenderedHtml } from './renderWindow'

import { ImageOptimizationOptions } from './imageOptimizer'

export interface ExportPDFPayload {
  title?: string
  content?: string
  toc?: boolean
  optimizeImages?: boolean
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
export function buildPDFDocument(
  title?: string,
  htmlBody: string = '',
  tocHtml: string = ''
): string {
  const hasMermaid = htmlBody.includes('class="mermaid"')
  const mermaidScript = hasMermaid
    ? `
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
  </script>`
    : ''

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
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.5;
      color: #1e293b;
      font-size: 12pt;
      text-align: justify;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      padding: 40px 48px;
      min-height: 100vh;
    }
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
    /* Screen (preview) — a crisp, arranged A4 paper sheet on dark desk */
    .page {
      width: 100%;
      max-width: 760px;
      min-height: 1060px;
      margin: 20px auto 36px auto;
      background: #ffffff;
      padding: 56px 64px 64px 64px;
      border-radius: 3px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    @media print {
      html, body { background: #ffffff; }
      body { padding: 0; }
      .page {
        width: auto;
        max-width: none;
        min-height: auto;
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
      line-height: 1.25;
      page-break-after: avoid;
      break-after: avoid;
    }
    h1 {
      font-size: 14pt;
      margin-top: 0;
      margin-bottom: 6pt;
      color: #1e293b;
    }
    h2 {
      font-size: 12pt;
      margin-top: 12pt;
      margin-bottom: 6pt;
      padding-bottom: 2pt;
      border-bottom: none;
      color: #1e293b;
    }
    h3 { font-size: 12pt; margin: 12pt 0 6pt; color: #334155; }
    h4 { font-size: 12pt; margin: 12pt 0 6pt; color: #475569; }
    p {
      margin: 6pt 0;
      color: #334155;
      text-align: justify;
      text-justify: inter-word;
      hyphens: auto;
      orphans: 3;
      widows: 3;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 10pt;
      background: transparent;
      color: #e11d48;
      border: 0;
      padding: 0;
      word-break: break-word;
    }
    code:not(pre code) {
      background: transparent !important;
      background-color: transparent !important;
      color: #e11d48 !important;
      border: 0 !important;
      box-shadow: none !important;
      padding: 0 !important;
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
      border: none !important;
      border-left: none !important;
      background: transparent;
      padding: 0 0 0 12pt;
      margin: 6pt 0;
      color: #475569;
      font-style: italic;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table {
      border-collapse: collapse;
      margin: 12pt auto;
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
      font-size: 10pt;
      word-break: break-word;
      break-inside: auto;
      border: 1px solid #94a3b8;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 1pt 3pt;
      text-align: left;
      word-break: break-word;
      overflow-wrap: anywhere;
      vertical-align: top;
      line-height: 1.1;
    }
    th p, td p { margin: 0 !important; line-height: 1.1; }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
      font-size: 10pt;
    }
    tbody tr {
      border-bottom: 1px solid #cbd5e1;
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
      margin: 6pt auto;
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
      margin: 6pt 0;
      padding-left: 22pt;
      color: #334155;
    }
    li {
      margin: 3pt 0;
    }
    hr {
      border: 0;
      height: 0;
      background: transparent;
      margin: 6pt 0;
    }
    .toc {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px 18px;
      margin: 0 0 18px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .toc-title {
      font-size: 14pt;
      margin-top: 0;
      margin-bottom: 8pt;
      padding-bottom: 0;
      border: none;
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
    .note-title {
      font-size: 16pt;
      color: #0f172a;
      margin: 0 0 10pt;
    }
    .note-error { color: #94a3b8; font-style: italic; }
    .combined-toc {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 18px;
      margin: 0 0 18px 0;
      page-break-inside: avoid;
      break-inside: avoid;
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
        margin-top: 0;
        padding-top: 0;
        border-top: none;
      }
    }
  </style>
</head>
<body>
  <article class="page">
    ${tocHtml}
    ${htmlBody}
  </article>
  ${mermaidScript}
</body>
</html>`
}

/**
 * Renders markdown to a full print-ready PDF HTML document (no file I/O).
 * Shared by the exporter and the preview dialog.
 */
export async function generatePDFHTML(
  title?: string,
  content?: string,
  opts: { toc?: boolean; imageOptimization?: ImageOptimizationOptions } = {}
): Promise<string> {
  const showToc = opts.toc ?? true
  const { html, tocHtml } = await renderMarkdown(content || '', {
    wikilinkMode: 'link',
    mermaid: true,
    toc: showToc,
    imageOptimization: opts.imageOptimization ?? { enabled: true }
  })
  return buildPDFDocument(title, html, showToc ? tocHtml : '')
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
    const { title, content, toc, optimizeImages } = payload || {}
    if (!content) throw new Error('No content provided')

    // Show save dialog FIRST for immediate user feedback
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow as any, {
      title: 'Save PDF',
      defaultPath: `${safeFileName(title)}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const html = await generatePDFHTML(title, content, {
      toc,
      imageOptimization: optimizeImages !== false ? { enabled: true } : { enabled: false }
    })

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
