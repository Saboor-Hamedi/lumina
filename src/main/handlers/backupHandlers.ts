import { ipcMain } from 'electron'
// @ts-ignore
import { backupToDrive, backupFileToDrive, cancelBackup } from '../backup/googleDriveBackup'
import WorkspaceManager from '../workspace/workspaceManager'
import { validateIpc, z } from './ipcValidation'

/**
 * ============================================================================
 * Cloud Backup IPC Handlers
 * ============================================================================
 * 
 * Manages Google Drive backups for the current note workspace:
 * - `backup:start`: Full workspace backup (ZIP archive or raw folder structure).
 * - `backup:file`: Single note/file backup directly to Google Drive.
 * - `backup:cancel`: Cancels an ongoing backup operation gracefully.
 */

const modeSchema = z.string().optional()

export function registerBackupHandlers(): void {
  // Start full workspace backup to Google Drive
  ipcMain.handle('backup:start', (event, mode) => {
    const validMode = validateIpc(modeSchema, mode)
    return backupToDrive(WorkspaceManager.workspacePath, validMode, event.sender)
  })

  // Backup a single file/note to Google Drive
  ipcMain.handle('backup:file', (event, fileInput) => {
    return backupFileToDrive(fileInput, WorkspaceManager.workspacePath, event.sender)
  })

  // Cancel any active background backup operation
  ipcMain.handle('backup:cancel', () => cancelBackup())
}
