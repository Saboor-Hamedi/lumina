import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { renderMarkdown, escapeHtml, safeFileName } from './exportUtils'
import { withRenderedHtml } from './renderWindow'
import { stripMermaidScripts } from './mermaidRuntime'

import { ImageOptimizationOptions } from './imageOptimizer'

export interface ExportDocsPayload {
  title?: string
  content?: string
  optimizeImages?: boolean
}

export interface ExportDocsResult {
  success: boolean
  filePath?: string
  canceled?: boolean
}

/**
 * Wraps a rendered markdown body in an MS-Word compatible HTML document with a
 * table of contents and Mermaid rendering (converted to inline PNG for Word).
 *
 * Exported separately so batch export and preview can reuse the same markup.
 */
export function buildDocsDocument(title?: string, htmlBody: string = '', tocHtml: string = ''): string {
  // Word maps semantic blockquotes to its built-in Quote style, which adds a
  // left rule even when the imported HTML CSS says there is no border.
  const docsBody = htmlBody
    .replace(/<blockquote\b[^>]*>/gi, '<div class="export-quote">')
    .replace(/<\/blockquote>/gi, '</div>')

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Untitled')}</title>
  <style>
    @page { size: A4; margin: 25mm 22mm 29mm 22mm; }
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.5;
      color: #1e293b;
      background: #ffffff;
      padding: 0;
      margin: 0;
      font-size: 12pt;
      text-align: justify;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      font-family: 'Times New Roman', serif;
      margin-top: 12pt;
      margin-bottom: 6pt;
      font-weight: 700;
      line-height: 1.25;
      text-align: left;
    }
    h1 {
      margin-top: 0;
      margin-bottom: 6pt;
      font-size: 14pt;
      color: #1e293b;
    }
    h2 {
      margin-top: 12pt;
      margin-bottom: 6pt;
      padding-bottom: 2pt;
      border-bottom: none;
      font-size: 12pt;
    }
    h3 { font-size: 12pt; margin: 12pt 0 6pt; color: #334155; }
    h4 { font-size: 12pt; margin: 12pt 0 6pt; color: #475569; }
    p { margin: 6pt 0; color: #334155; text-align: justify; text-justify: inter-word; }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 10pt;
      background: transparent;
      color: #e11d48;
      border: 0;
      padding: 0;
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
      padding: 12pt 14pt;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 12pt 0;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: #334155;
    }
    .export-quote {
      border: none !important;
      border-left: none !important;
      background: transparent;
      padding: 0 0 0 12pt;
      margin: 6pt 0;
      color: #475569;
      font-style: italic;
    }
    table {
      border-collapse: collapse;
      margin: 12pt auto;
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      font-size: 10pt;
      border: 1px solid #94a3b8;
      page-break-inside: auto;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 1pt 3pt;
      mso-padding-alt: 1pt 3pt 1pt 3pt;
      text-align: left;
      vertical-align: top;
      line-height: 1.1;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    th p, td p {
      margin: 0 !important;
      mso-margin-top-alt: 0pt;
      mso-margin-bottom-alt: 0pt;
      line-height: 1.1;
      mso-line-height-rule: exactly;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    tbody tr { border-bottom: 1px solid #cbd5e1; }
    tbody tr:last-child { border-bottom: none; }
    img { display: block; max-width: 100%; max-height: 9.5cm; height: auto; margin: 12pt auto; page-break-inside: avoid; }
    img {
      max-width: 100%;
      height: auto;
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
    .mermaid { width: 100%; text-align: center; margin: 6pt auto; page-break-inside: avoid; }
    .mermaid img { display: block !important; width: auto !important; max-width: 100% !important; height: auto !important; margin: 6pt auto !important; }
    .toc {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px 18px;
      margin: 0 0 18px 0;
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
    /* Combined export: multiple notes merged into one Word document */
    .note-title {
      font-size: 16pt;
      color: #0f172a;
      margin: 0 0 8pt;
    }
    .combined-toc {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 18px;
      margin: 0 0 18px 0;
    }
    .combined-toc-title {
      font-size: 13pt;
      margin: 0 0 6pt;
      padding: 0;
      border: none;
      color: #0f172a;
    }
    .combined-toc ol { margin: 0; padding-left: 18pt; }
    .note[data-page-break='true'] {
      page-break-before: always;
      break-before: page;
      margin-top: 0;
    }
  </style>
</head>
<body>
  ${tocHtml}
  ${docsBody}

  <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'default' });

    async function renderMermaid() {
      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        const elements = Array.prototype.slice.call(document.querySelectorAll('.mermaid'));
        if (elements.length > 0) {
          await mermaid.run({ nodes: elements, suppressErrors: true });
        }

        // Convert SVGs to Base64 PNGs for MS Word compatibility
        const svgs = document.querySelectorAll('.mermaid svg');
        for (let i = 0; i < svgs.length; i++) {
          const svgEl = svgs[i];

          // Apply black strokes/text for word doc
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

          // Rasterize to canvas
          const viewBox = svgEl.viewBox && svgEl.viewBox.baseVal;
          const rect = svgEl.getBoundingClientRect();
          const width = Math.ceil((viewBox && viewBox.width) || parseFloat(svgEl.getAttribute('width')) || rect.width || 600);
          const height = Math.ceil((viewBox && viewBox.height) || parseFloat(svgEl.getAttribute('height')) || rect.height || 400);
          const canvas = document.createElement('canvas');
          canvas.width = width * 2;
          canvas.height = height * 2;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.scale(2, 2);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);

          svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          if (!svgEl.getAttribute('width')) svgEl.setAttribute('width', String(width));
          if (!svgEl.getAttribute('height')) svgEl.setAttribute('height', String(height));
          const svgData = new XMLSerializer().serializeToString(svgEl);
          const img = new Image();
          const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
          try {
            img.src = url;
            if (img.decode) await img.decode();
            else await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            ctx.drawImage(img, 0, 0, width, height);
            const newImg = document.createElement('img');
            newImg.src = canvas.toDataURL('image/png');
            newImg.width = width;
            newImg.height = height;
            newImg.style.width = 'auto';
            newImg.style.maxWidth = '100%';
            newImg.style.height = 'auto';
            newImg.style.display = 'block';
            newImg.style.margin = '6pt auto';
            newImg.alt = 'Mermaid diagram';
            const parent = svgEl.closest('.mermaid');
            if (parent) {
              parent.innerHTML = '';
              parent.appendChild(newImg);
            }
          } catch (rasterError) {
            console.warn('Could not convert Mermaid SVG to PNG; keeping SVG fallback.', rasterError);
          }
        }
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
 * Renders markdown to a full Word-compatible HTML document (no file I/O).
 */
export async function generateDocsHTML(
  title?: string,
  content?: string,
  opts: { imageOptimization?: ImageOptimizationOptions } = {}
): Promise<string> {
  const { html, tocHtml } = await renderMarkdown(content || '', {
    wikilinkMode: 'link',
    mermaid: true,
    toc: true,
    imageOptimization: opts.imageOptimization ?? { enabled: true }
  })
  return buildDocsDocument(title, html, tocHtml)
}

export const handleExportDocs = async (
  mainWindow: BrowserWindow | null,
  payload: ExportDocsPayload
): Promise<ExportDocsResult> => {
  try {
    const { title, content, optimizeImages } = payload || {}
    if (!content) throw new Error('No content provided')

    // Show save dialog FIRST for immediate user feedback
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow as any, {
      title: 'Export as Word Document',
      defaultPath: `${safeFileName(title)}.doc`,
      filters: [{ name: 'Word Document', extensions: ['doc'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const html = await generateDocsHTML(title, content, {
      imageOptimization: optimizeImages !== false ? { enabled: true } : { enabled: false }
    })

    // Render (Mermaid inlined) and strip script tags for MS Word compatibility.
    const cleanHtml = await withRenderedHtml(html, async (win) => {
      const rendered = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
      return stripMermaidScripts(String(rendered || ''))
    })

    await fs.writeFile(filePath, cleanHtml, 'utf-8')
    return { success: true, filePath }
  } catch (error) {
    console.error('[Main] Export Docs failed:', error)
    throw error
  }
}
