import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import VaultManager from '../main/VaultManager.js'

export const handleExportDocs = async (mainWindow, payload) => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

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

    // Convert local images to base64 data URIs so they render correctly in Word
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

    // Wrap in MS-Word compatible HTML (matching PDF styling)
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title || 'Untitled'}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.6;
      color: #222222;
      background: #ffffff;
      padding: 0;
      margin: 0;
      font-size: 12pt;
      text-align: justify;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.2;
      font-size: 14pt;
      text-align: left;
    }
    h1 { margin-bottom: 1em; font-size: 18pt; }
    h2 { margin-top: 1.5em; font-size: 16pt; }
    h3 { font-size: 14pt; margin-top: 1.2em; }
    p { margin-bottom: 1.2em; color: #333333; }
    code {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      color: #333;
    }
    pre {
      background: #f8f9fa;
      padding: 12px 16px;
      border: 1px solid #eaecef;
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 1.5em 0;
    }
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding-left: 1em;
      margin: 1.5em 0;
      color: #6a737d;
      font-style: italic;
    }
    table {
      border-collapse: collapse;
      margin: 2em 0;
      width: 100%;
      font-size: 11pt;
    }
    th, td {
      border: 1px solid #eaecef;
      padding: 10px 14px;
      text-align: left;
    }
    th {
      font-weight: 600;
      color: #222;
      background-color: #f8f9fa;
    }
    img {
      max-width: 100%;
      height: auto;
      margin: 1.5em 0;
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

    // Show save dialog FIRST for immediate user feedback
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as Word Document',
      defaultPath: `${title || 'Untitled'}.doc`,
      filters: [{ name: 'Word Document', extensions: ['doc'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    // Create a hidden browser window to execute scripts
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    // Wait for mermaid to finish rendering and converting to PNG
    const renderedHtml = await printWin.webContents.executeJavaScript(`
      new Promise((resolve) => {
        if (document.body.classList.contains('mermaid-done')) {
          setTimeout(() => resolve(document.documentElement.outerHTML), 500);
        } else {
          const observer = new MutationObserver(() => {
            if (document.body.classList.contains('mermaid-done')) {
              observer.disconnect();
              setTimeout(() => resolve(document.documentElement.outerHTML), 500);
            }
          });
          observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
          setTimeout(() => resolve(document.documentElement.outerHTML), 5000); // 5 seconds timeout fallback
        }
      })
    `)

    // Close window
    printWin.close()

    // Strip out the script tags so MS word doesn't complain about them
    const cleanHtml = renderedHtml.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    )

    await fs.writeFile(filePath, cleanHtml, 'utf-8')
    return { success: true, filePath }
  } catch (error) {
    console.error('[Main] Export Docs failed:', error)
    throw error
  }
}
