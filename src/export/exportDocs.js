import { dialog } from 'electron'
import fs from 'fs/promises'
import HTMLtoDOCX from 'html-to-docx'

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

    // Wrap in minimal HTML for the converter
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title || 'Untitled'}</title>
</head>
<body>
  <h1>${title || 'Untitled'}</h1>
  ${htmlContent}
</body>
</html>`

    const fileBuffer = await HTMLtoDOCX(html, null, {
      title: title || 'Untitled',
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch margins (1440 twips)
      font: 'Times New Roman'
    })

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as Word Document',
      defaultPath: `${title || 'Untitled'}.docx`,
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    })

    if (!canceled && filePath) {
      await fs.writeFile(filePath, fileBuffer)
      return { success: true, filePath }
    }

    return { success: false, canceled: true }
  } catch (error) {
    console.error('[Main] Export Docs failed:', error)
    throw error
  }
}
