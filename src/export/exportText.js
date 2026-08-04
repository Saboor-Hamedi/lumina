import { dialog } from 'electron'
import fs from 'fs/promises'

export const handleExportText = async (mainWindow, payload) => {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    // Optional: strip basic markdown formatting here if desired, 
    // or just save the raw text. We'll save the raw text.
    const textContent = content 

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
