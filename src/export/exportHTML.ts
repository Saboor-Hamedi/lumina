import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import { BrowserWindow } from 'electron'
import { escapeHtml, convertWikilinks } from './exportUtils'

export interface ExportHTMLPayload {
  title?: string
  content?: string
}

export const handleExportHTML = async (
  _mainWindow: BrowserWindow | null,
  payload: ExportHTMLPayload
): Promise<string> => {
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

    const processedContent = convertWikilinks(content || '', 'link')
    const htmlContent = (await marked.parse(processedContent)) as string
    const safeTitle = escapeHtml(title || 'Untitled')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${htmlContent}
</body>
</html>`

    return html
  } catch (error) {
    console.error('[Main] Export HTML failed:', error)
    throw error
  }
}
