import { dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'

export interface ExportMarkdownPayload {
  title?: string
  content?: string
}

export interface ExportResult {
  success: boolean
  filePath?: string
  canceled?: boolean
}

export const handleExportMarkdown = async (
  mainWindow: BrowserWindow | null,
  payload: ExportMarkdownPayload
): Promise<ExportResult> => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow as any, {
      title: 'Export as Markdown',
      defaultPath: `${title || 'Untitled'}.md`,
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!canceled && filePath) {
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true, filePath }
    }

    return { success: false, canceled: true }
  } catch (error) {
    console.error('[Main] Export Markdown failed:', error)
    throw error
  }
}
