import { dialog } from 'electron'
import fs from 'fs/promises'

export const handleExportText = async (mainWindow, payload) => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    // Use marked to strip formatting
    const { Marked } = await import('marked')
    const textRenderer = {
      heading(text, level) { return text + '\n\n' },
      paragraph(text) { return text + '\n\n' },
      list(body, ordered, start) { return body + '\n' },
      listitem(text, task, checked) { return (task ? (checked ? '[x] ' : '[ ] ') : '- ') + text + '\n' },
      codespan(text) { return text },
      strong(text) { return text },
      em(text) { return text },
      del(text) { return text },
      link(href, title, text) { return text + (href ? ` (${href})` : '') },
      image(href, title, text) { return `[Image: ${text}]` },
      code(code, lang) { return code + '\n\n' },
      blockquote(quote) { return quote + '\n' },
      br() { return '\n' },
      hr() { return '---\n\n' },
      html(html) { return '' },
      table(header, body) { return header + body + '\n' },
      tablerow(content) { return content + '\n' },
      tablecell(content, flags) { return content + ' \t' }
    }
    
    const marked = new Marked({ renderer: textRenderer })
    let textContent = await marked.parse(content)
    
    // Decode HTML entities that marked might leave inside text nodes
    textContent = textContent
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as Text File',
      defaultPath: `${title || 'Untitled'}.txt`,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!canceled && filePath) {
      await fs.writeFile(filePath, textContent, 'utf-8')
      return { success: true, filePath }
    }

    return { success: false, canceled: true }
  } catch (error) {
    console.error('[Main] Export Text failed:', error)
    throw error
  }
}
