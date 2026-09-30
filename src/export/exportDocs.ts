import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { renderMarkdown } from './exportUtils'
import { withRenderedHtml } from './renderWindow'
import { stripMermaidScripts } from './mermaidRuntime'

export interface ExportDocsPayload {
  title?: string
  content?: string
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
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title || 'Untitled'}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.5;
      color: #1a1a1a;
      background: #ffffff;
      padding: 0;
      margin: 0;
      font-size: 11pt;
      text-align: justify;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      font-family: 'Times New Roman', serif;
      margin-top: 1.8em;
      margin-bottom: 0.6em;
      font-weight: 700;
      line-height: 1.25;
      text-align: left;
    }
    h1 {
      margin-top: 2pt;
      margin-bottom: 2pt;
      font-size: 16pt;
      color: #1e293b;
    }
    h2 {
      margin-top: 1.5em;
      font-size: 14pt;
    }
    h3 { font-size: 13pt; margin-top: 1.2em; color: #334155; }
    h4 { font-size: 12pt; margin-top: 1.2em; color: #475569; }
    p { margin-bottom: 1.2em; color: #334155; text-align: justify; text-justify: inter-word; }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 10pt;
      background-color: #f1f5f9;
      color: #e11d48;
      padding: 2px 4px;
      border-radius: 4px;
    }
    pre {
      background: #f8fafc;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 1.5em 0;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: #334155;
    }
    blockquote {
      border-left: 4px solid #6366f1;
      background-color: #f8fafc;
      padding: 12px 16px;
      margin: 1.5em 0;
      color: #475569;
      font-style: italic;
      border-radius: 0 6px 6px 0;
    }
    table {
      border-collapse: collapse;
      margin: 2em 0;
      width: 100%;
      font-size: 11pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: normal;
      color: #0f172a;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
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
      margin: 1.2em 0;
      padding-left: 2em;
      color: #334155;
    }
    li {
      margin: 0.4em 0;
    }
    hr {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 2em 0;
    }
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
      margin-top: 2em;
    }
  </style>
</head>
<body>
  ${tocHtml}
  ${htmlBody}

  <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'default' });

    async function renderMermaid() {
      try {
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
          const rect = svgEl.getBoundingClientRect();
          const canvas = document.createElement('canvas');
          canvas.width = rect.width * 2;
          canvas.height = rect.height * 2;
          canvas.style.width = rect.width + 'px';
          canvas.style.height = rect.height + 'px';
          const ctx = canvas.getContext('2d');
          ctx.scale(2, 2);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, rect.width, rect.height);

          const svgData = new XMLSerializer().serializeToString(svgEl);
          const img = new Image();
          const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);

          await new Promise((resolve) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              const pngUrl = canvas.toDataURL('image/png');
              const newImg = document.createElement('img');
              newImg.src = pngUrl;
              newImg.style.width = rect.width + 'px';

              const parent = svgEl.closest('.mermaid');
              if (parent) {
                parent.innerHTML = '';
                parent.appendChild(newImg);
              }
              resolve();
            };
            img.onerror = resolve;
            img.src = url;
          });
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
export async function generateDocsHTML(title?: string, content?: string): Promise<string> {
  const { html, tocHtml } = await renderMarkdown(content || '', {
    wikilinkMode: 'link',
    mermaid: true,
    toc: true
  })
  return buildDocsDocument(title, html, tocHtml)
}

export const handleExportDocs = async (
  mainWindow: BrowserWindow | null,
  payload: ExportDocsPayload
): Promise<ExportDocsResult> => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    // Show save dialog FIRST for immediate user feedback
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow as any, {
      title: 'Export as Word Document',
      defaultPath: `${title || 'Untitled'}.doc`,
      filters: [{ name: 'Word Document', extensions: ['doc'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const html = await generateDocsHTML(title, content)

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
