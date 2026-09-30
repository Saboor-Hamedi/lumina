import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'

export interface ExportTextPayload {
  title?: string
  content?: string
}

export interface ExportResult {
  success: boolean
  filePath?: string
  canceled?: boolean
}

export const handleExportText = async (
  mainWindow: BrowserWindow | null,
  payload: ExportTextPayload
): Promise<ExportResult> => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    // Use marked to convert to HTML, then strip tags for robust plain text
    const { Marked } = await import('marked')
    const marked = new Marked()

    // First, convert wikilinks to standard links so they can be stripped gracefully
    const processedContent = (content || '').replace(/\[\[(.*?)\]\]/g, '$1')

    const html = (await marked.parse(processedContent)) as string

    // Convert block elements to newlines
    let textContent = html.replace(/<br\s*\/?>/gi, '\n')
    textContent = textContent.replace(/<\/p>|<\/h[1-6]>|<\/div>|<\/li>|<\/blockquote>/gi, '\n\n')
    textContent = textContent.replace(/<li>/gi, '- ')

    // Strip all remaining HTML tags
    textContent = textContent.replace(/<[^>]*>?/gm, '')

    // Decode HTML entities
    textContent = textContent
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')

    // Clean up multiple newlines
    textContent = textContent.replace(/\n\s*\n\s*\n/g, '\n\n').trim()

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow as any, {
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
