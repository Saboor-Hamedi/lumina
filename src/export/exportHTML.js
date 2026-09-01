import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

export const handleExportHTML = async (mainWindow, payload) => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    const marked = new Marked(
      markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext'
          return hljs.highlight(code, { language }).value
        }
      })
    )

    const processedContent = (content || '').replace(/\[\[(.*?)\]\]/g, '<a href="#">$1</a>')
    const htmlContent = await marked.parse(processedContent)

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

    return html
  } catch (error) {
    console.error('[Main] Export HTML failed:', error)
    throw error
  }
}
