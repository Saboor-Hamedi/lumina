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
          const language = hljs.getLanguage(lang) ? lang : 'plaintext'
          return hljs.highlight(code, { language }).value
        }
      })
    )

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
      background: #f5f7f9;
      padding: 3px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.85em;
      color: #eb5757;
    }
    pre {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e9ecef;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      margin: 1.5em 0;
    }
    pre code {
      background: none;
      padding: 0;
      color: #24292e;
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
      border-bottom: 1px solid #e9ecef;
      padding: 12px 16px;
      text-align: left;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #495057;
      border-top: 1px solid #e9ecef;
    }
    tr:nth-child(even) {
      background: #fafbfc;
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

    // Wait a brief moment for fonts/styles to apply (especially highlight.js)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Generate PDF with custom margins (converted from cm to inches: 1cm = 0.3937in)
    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      margins: {
        marginType: 'custom',
        top: 2.0 * 0.3937,    // 2.0 cm
        bottom: 2.0 * 0.3937, // 2.0 cm
        left: 2.5 * 0.3937,   // 2.5 cm
        right: 2.5 * 0.3937   // 2.5 cm
      },
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
