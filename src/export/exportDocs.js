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
          const language = hljs.getLanguage(lang) ? lang : 'plaintext'
          return hljs.highlight(code, { language }).value
        }
      })
    )

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
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1.5em 0;
    }
    pre code {
      background: transparent;
      padding: 0;
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
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f8f8f8;
    }
  </style>
</head>
<body>
  <h1>${title || 'Untitled'}</h1>
  ${htmlContent}
</body>
</html>`

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as HTML/Docs',
      defaultPath: `${title || 'Untitled'}.html`,
      filters: [{ name: 'HTML Files', extensions: ['html'] }]
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
