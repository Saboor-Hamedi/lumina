import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { renderMarkdown, escapeHtml } from './exportUtils.js'

/**
 * Wraps a rendered markdown body in a print-optimised, A4 PDF document with a
 * table of contents and Mermaid rendering support.
 *
 * Exported separately so the export preview dialog can reuse the exact same
 * markup without duplicating styles.
 *
 * @param {string} title
 * @param {string} htmlBody Rendered HTML body (with TOC anchors injected)
 * @param {string} tocHtml Table of contents markup (may be empty)
 * @returns {string} Full HTML document
 */
export function buildPDFDocument(title, htmlBody, tocHtml = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title || 'Untitled'}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css">
  <style>
    @page {
      size: A4;
      margin: 20mm 20mm;
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
    .doc-header {
      margin-bottom: 24pt;
      padding-bottom: 14pt;
      border-bottom: 2px solid #6366f1;
    }
    .doc-title {
      font-size: 24pt;
      font-weight: 800;
      line-height: 1.2;
      color: #0f172a;
      letter-spacing: -0.01em;
      margin: 0;
      padding: 0;
      border: none;
    }
    .doc-meta {
      margin-top: 6pt;
      font-size: 9pt;
      color: #94a3b8;
      letter-spacing: 0.04em;
      text-transform: uppercase;
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
      padding-bottom: 6pt;
      border-bottom: 1.5px solid #e2e8f0;
      color: #0f172a;
    }
    h2 {
      font-size: 15pt;
      margin-top: 18pt;
      margin-bottom: 8pt;
      padding-bottom: 4pt;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    h3 { font-size: 12.5pt; margin-top: 14pt; margin-bottom: 6pt; color: #334155; }
    h4 { font-size: 11pt; margin-top: 12pt; margin-bottom: 4pt; color: #475569; }
    p {
      margin-bottom: 10pt;
      color: #334155;
      text-align: left;
    }
    code {
      font-family: 'Consolas', 'Fira Code', 'Courier New', monospace;
      font-size: 9.5pt;
      background-color: #f1f5f9;
      color: #e11d48;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background: #f8fafc;
      padding: 14px 18px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 12pt 0;
      page-break-inside: avoid;
      break-inside: avoid;
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
      margin: 14pt 0;
      width: 100%;
      font-size: 10pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 12px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
      font-size: 9.5pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 10pt 0;
      page-break-inside: avoid;
      break-inside: avoid;
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
  </style>
</head>
<body>
  <article class="page">
    <header class="doc-header">
      <h1 class="doc-title">${escapeHtml(title || 'Untitled')}</h1>
      <div class="doc-meta">Exported from Lumina</div>
    </header>
    ${tocHtml}
    ${htmlBody}
  </article>

  <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'default' });

    async function renderMermaid() {
      try {
        const elements = document.querySelectorAll('.mermaid');
        if (elements.length > 0) {
          mermaid.init(undefined, elements);
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
 *
 * @param {string} title
 * @param {string} content Markdown source
 * @returns {Promise<string>} Full HTML document
 */
export async function generatePDFHTML(title, content) {
  const { html, tocHtml } = await renderMarkdown(content, {
    wikilinkMode: 'link',
    mermaid: true,
    toc: true
  })
  return buildPDFDocument(title, html, tocHtml)
}

/**
 * Waits for Mermaid diagrams inside a BrowserWindow to finish rendering.
 * Resolves via a MutationObserver watching for the `mermaid-done` body class,
 * with a hard timeout so a stuck render can never hang the export.
 *
 * @param {BrowserWindow} win
 * @param {number} [timeoutMs=3000]
 */
async function waitForMermaid(win, timeoutMs = 3000) {
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      if (document.body.classList.contains('mermaid-done')) {
        setTimeout(resolve, 500);
      } else {
        const observer = new MutationObserver(() => {
          if (document.body.classList.contains('mermaid-done')) {
            observer.disconnect();
            setTimeout(resolve, 500);
          }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        setTimeout(resolve, ${timeoutMs});
      }
    })
  `)
}

export const handleExportPDF = async (mainWindow, payload) => {
  let printWin = null
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    // Show save dialog FIRST for immediate user feedback
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save PDF',
      defaultPath: `${title || 'Untitled'}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const html = await generatePDFHTML(title, content)

    // Create a hidden browser window to print from
    printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await waitForMermaid(printWin)

    // Generate PDF relying on @page CSS for margins
    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    })

    await fs.writeFile(filePath, pdfData)
    return { success: true, filePath }
  } catch (error) {
    console.error('[Main] Export PDF failed:', error)
    throw error
  } finally {
    if (printWin && printWin.isDestroyed?.() !== true) {
      printWin.close()
    }
  }
}
