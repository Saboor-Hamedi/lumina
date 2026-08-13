import electron from 'electron'
const { dialog, ipcMain } = electron.default || electron
import fs from 'fs/promises'
import path from 'path'

export function registerOpenNoteHandler() {
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    })
    
    if (canceled || filePaths.length === 0) return null
    
    const content = await fs.readFile(filePaths[0], 'utf-8')
    const name = path.basename(filePaths[0])
    
    return { path: filePaths[0], content, name }
  })
}
