import { dialog } from 'electron'
import fs from 'fs/promises'

export const handleExportDocs = async (mainWindow, payload) => {
  try {
    const { title, content } = payload || {}
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

    // Wrap in MS-Word compatible HTML (very basic styling)
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title || 'Untitled'}</title>
  <style>
    body { font-family: 'Calibri', sans-serif; font-size: 11pt; color: #000000; }
    h1 { font-size: 16pt; font-weight: bold; color: #2F5496; margin-bottom: 12pt; }
    h2 { font-size: 14pt; font-weight: bold; color: #2F5496; margin-bottom: 10pt; margin-top: 18pt; }
    h3 { font-size: 12pt; font-weight: bold; color: #1F3763; margin-bottom: 8pt; margin-top: 14pt; }
    p { margin-bottom: 10pt; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14pt; border: 1px solid #000000; }
    th, td { border: 1px solid #000000; padding: 4pt 8pt; text-align: left; }
    th { background-color: #F2F2F2; font-weight: bold; }
    pre { background-color: #F2F2F2; padding: 10pt; border: 1px solid #D9D9D9; }
    code { font-family: 'Courier New', monospace; font-size: 10pt; }
    blockquote { margin-left: 20pt; border-left: 3px solid #D9D9D9; padding-left: 10pt; color: #595959; font-style: italic; }
  </style>
</head>
<body>
  <h1>${title || 'Untitled'}</h1>
  ${htmlContent}
</body>
</html>`

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as Word Document',
      defaultPath: `${title || 'Untitled'}.doc`,
      filters: [{ name: 'Word Document', extensions: ['doc'] }]
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
