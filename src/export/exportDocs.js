import { dialog } from 'electron'
import fs from 'fs/promises'

export const handleExportDocs = async (mainWindow, payload) => {
  try {
    const { title, content, language } = payload || {}
    if (!content) throw new Error('No content provided')

    // Import marked dynamically (ESM)
    const { Marked } = await import('marked')
    const { markedHighlight } = await import('marked-highlight')
    const hljs = (await import('highlight.js')).default

    const marked = new Marked(
      markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
          if (lang === 'mermaid') return code;
          const language = hljs.getLanguage(lang) ? lang : 'plaintext'
          return hljs.highlight(code, { language }).value
        }
      })
    )

    marked.use({
      renderer: {
        code(token) {
          if (token.lang === 'mermaid') {
            const escaped = token.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            return `<div class="mermaid">${escaped}</div>`
          }
          return false
        }
      }
    })

    // Convert wikilinks to HTML before parsing
    const processedContent = (content || '').replace(/\[\[(.*?)\]\]/g, '<a href="#">$1</a>')
    const htmlContent = await marked.parse(processedContent)

    // Create standalone HTML with embedded CSS
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Untitled'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.2;
    }
    h1 { font-size: 2em; border-bottom: 2px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 1em; }
    code {
      background: transparent;
      padding: 2px 6px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
      color: #333;
    }
    pre {
      background: #f8f9fa;
      padding: 12px 16px;
      border: none;
      border-radius: 4px;
      overflow-x: auto;
      margin: 1.5em 0;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: #222;
      border: none;
    }
    blockquote {
      border-left: 4px solid #0066cc;
      padding-left: 15px;
      margin: 1.5em 0;
      color: #555;
      font-style: italic;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1.5em 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.5em 0;
      font-size: 14px;
    }
    th, td {
      border: none;
      border-bottom: 1px solid #eee;
      padding: 10px 14px;
      text-align: left;
    }
    th {
      background: transparent;
      font-weight: 600;
      color: #222;
      border: none;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background: transparent;
    }
  </style>
</head>
<body>
  <h1>${title || 'Untitled'}</h1>
  ${htmlContent}
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
      }
    }
    window.addEventListener('load', renderMermaid);
  </script>
</body>
</html>`

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as Docs',
      defaultPath: `${title || 'Untitled'}.doc`,
      filters: [{ name: 'Word Document', extensions: ['doc', 'docx'] }]
    })

    if (!canceled && filePath) {
      await fs.writeFile(filePath, html, 'utf-8')
      return { success: true, filePath }
    }

    return { success: false, canceled: true }
  } catch (error) {
    console.error('[Main] Export Docs failed:', error)
    throw error
  }
}
