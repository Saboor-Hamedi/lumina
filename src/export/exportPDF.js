import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import VaultManager from '../main/VaultManager.js'

export const handleExportPDF = async (mainWindow, payload) => {
  try {
    const { title, content, language } = payload || {}
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

    // Now do the heavy work (markdown conversion and PDF generation)
    // Import marked dynamically
    const { Marked } = await import('marked')
    const { markedHighlight } = await import('marked-highlight')
    const hljs = (await import('highlight.js')).default

    const marked = new Marked(
      markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
          if (lang === 'mermaid') return code
          const language = hljs.getLanguage(lang) ? lang : 'plaintext'
          return hljs.highlight(code, { language }).value
        }
      })
    )

    marked.use({
      renderer: {
        code(token) {
          if (token.lang === 'mermaid') {
            const escaped = token.text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
            return `<div class="mermaid">${escaped}</div>`
          }
          return false
        }
      }
    })

    // Convert local images to base64 data URIs so they render in the isolated BrowserWindow
    let processedContent = content || ''
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const matches = [...processedContent.matchAll(imgRegex)]
    
    for (const match of matches) {
      const fullMatch = match[0]
      const alt = match[1]
      const url = match[2]
      
      if (!url.startsWith('http') && !url.startsWith('data:')) {
        try {
          let cleanUrl = url.startsWith('/') ? url.slice(1) : url
          // Strip optional <> that markdown uses for URLs with spaces
          if (cleanUrl.startsWith('<') && cleanUrl.endsWith('>')) {
            cleanUrl = cleanUrl.slice(1, -1)
          }
          cleanUrl = decodeURIComponent(cleanUrl)
          
          const buffer = await VaultManager.readAsset(cleanUrl)
          
          let mimeType = 'image/png'
          const lowerUrl = cleanUrl.toLowerCase()
          if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) mimeType = 'image/jpeg'
          else if (lowerUrl.endsWith('.gif')) mimeType = 'image/gif'
          else if (lowerUrl.endsWith('.svg')) mimeType = 'image/svg+xml'
          else if (lowerUrl.endsWith('.webp')) mimeType = 'image/webp'
          
          const base64 = buffer.toString('base64')
          const dataUri = `data:${mimeType};base64,${base64}`
          
          processedContent = processedContent.replace(fullMatch, `![${alt}](${dataUri})`)
        } catch (e) {
          console.error('[Export] Failed to convert image to base64:', url, e)
        }
      }
    }

    // Convert wikilinks to HTML before parsing
    processedContent = processedContent.replace(/\[\[(.*?)\]\]/g, '<a href="#">$1</a>')
    const htmlContent = await marked.parse(processedContent)

    // Create HTML for PDF
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title || 'Untitled'}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css">
  <style>
    @page {
      margin: 2.0cm 2.5cm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.5;
      color: #1a1a1a;
      background: #ffffff;
      padding: 0;
      margin: 0;
      font-size: 11pt;
      text-align: left;
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
      margin-bottom: 1em; 
      font-size: 18pt; 
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8pt;
      color: #1e293b;
    }
    h2 { 
      margin-top: 1.5em; 
      font-size: 18pt; 
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4pt;
    }
    h3 { font-size: 14pt; margin-top: 1.2em; color: #334155; }
    h4 { font-size: 12pt; margin-top: 1.2em; color: #475569; }
    p { margin-bottom: 1.2em; color: #334155; }
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
      padding: 12px 16px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      box-sizing: border-box;
      border-radius: 8px;
      margin: 2em 0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
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
  </style>
</head>
<body>
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
      } finally {
        document.body.classList.add('mermaid-done');
      }
    }
    window.addEventListener('load', renderMermaid);
  </script>
</body>
</html>`

    // Create a hidden browser window to print from
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // Load the HTML
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    // Wait for mermaid to finish rendering and fonts to apply
    await printWin.webContents.executeJavaScript(`
      new Promise((resolve) => {
        if (document.body.classList.contains('mermaid-done')) {
          setTimeout(resolve, 500);
        } else {
          const observer = new MutationObserver(() => {
            if (document.body.classList.contains('mermaid-done')) {
              observer.disconnect();
              setTimeout(resolve, 500); // extra wait for fonts/styles
            }
          });
          observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
          setTimeout(resolve, 3000); // 3 seconds timeout fallback
        }
      })
    `)

    // Generate PDF relying on @page CSS for margins
    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    })

    // Close the window
    printWin.close()

    // Save PDF to the chosen path
    await fs.writeFile(filePath, pdfData)
    return { success: true, filePath }
  } catch (error) {
    console.error('[Main] Export PDF failed:', error)
    throw error
  }
}
