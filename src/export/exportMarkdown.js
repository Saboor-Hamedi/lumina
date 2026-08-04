import { dialog } from 'electron'
import fs from 'fs/promises'

export const handleExportMarkdown = async (mainWindow, payload) => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
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
