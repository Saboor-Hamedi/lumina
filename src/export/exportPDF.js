import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'

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

    // Convert wikilinks to HTML before parsing
    const processedContent = (content || '').replace(/\[\[(.*?)\]\]/g, '<a href="#">$1</a>')
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
      line-height: 1.6;
      color: #222222;
      background: #ffffff;
      padding: 0;
      margin: 0;
      font-size: 12px;
      text-align: justify;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.2;
      font-size: 14px;
      text-align: left;
    }
    h1 { margin-bottom: 1em; }
    h2 { margin-top: 1.5em; }
    h3 { font-size: 1.3em; margin-top: 1.2em; }
    p { margin-bottom: 1.2em; color: #333333; }
    code {
      background: transparent;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
      color: #333;
    }
    pre {
      background: #f8f9fa;
      padding: 12px 16px;
      border: none;
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      margin: 1.5em 0;
    }
    pre code {
      background: none;
      padding: 0;
      color: #222;
      border: none;
    }
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding-left: 1em;
      margin: 1.5em 0;
      color: #6a737d;
      font-style: italic;
    }
    ul, ol {
      margin: 1.2em 0;
      padding-left: 2em;
      color: #333333;
    }
    li {
      margin: 0.4em 0;
    }
    table {
      border-collapse: collapse;
      margin: 2em 0;
      width: 100%;
      font-size: 12px;
      font-weight: normal;
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
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 1.5em 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    hr {
      border: none;
      border-top: 1px solid #eaecef;
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
