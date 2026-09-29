import { ipcMain, dialog } from 'electron'
import { validateIpc, z } from './ipcValidation'

/**
 * ============================================================================
 * Dialog & Confirmation IPC Handlers
 * ============================================================================
 * 
 * Manages native OS dialogs triggered from the renderer:
 * - `dialog:openDirectory`: Native OS folder picker to choose a workspace path.
 * - `confirm-delete`: Standardized destructive action confirmation modal.
 */

const messageSchema = z.string().optional()

export function registerDialogHandlers(): void {
  // Show native folder selection dialog
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })

  // Show native delete confirmation prompt
  ipcMain.handle('confirm-delete', async (_, message) => {
    const validMessage = validateIpc(messageSchema, message)
    const res = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 1,
      cancelId: 0,
      title: 'Confirm Delete',
      message: validMessage || 'Delete this item?',
      noLink: true
    })
    return res.response === 1
  })
}
