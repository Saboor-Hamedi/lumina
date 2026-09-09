import { backupWorkspaceZip } from './luminaZipBackup'
import { backupWorkspaceNonZip, backupSingleFile } from './luminaNonZipBackup'

let activeBackupAbortController = null

/**
 * Aborts any currently active backup or single file push.
 *
 * @returns {boolean} Whether an active backup was found and cancelled
 */
export function cancelBackup() {
  if (activeBackupAbortController) {
    console.info('[GoogleDrive] Cancelling in-progress backup...')
    activeBackupAbortController.abort()
    activeBackupAbortController = null
    return true
  }
  return false
}

/**
 * Main workspace backup entry point.
 * Supports dual modes:
 * - 'zip': Compresses workspace into 'lumina-backup.zip' on Google Drive root.
 * - 'folder': Direct non-zip sync into 'lumina' folder on Google Drive root.
 *
 * @param {string} vaultPath - Local path to the workspace
 * @param {'zip' | 'folder'} [mode='zip'] - Backup mode
 * @param {Electron.WebContents} [sender=null] - Sender for progress events
 */
export async function backupToDrive(vaultPath, mode = 'zip', sender = null) {
  // Cancel previous if still running
  cancelBackup()

  activeBackupAbortController = new AbortController()
  const signal = activeBackupAbortController.signal

  try {
    if (mode === 'folder') {
      return await backupWorkspaceNonZip(vaultPath, sender, signal)
    }
    return await backupWorkspaceZip(vaultPath, sender, signal)
  } finally {
    if (activeBackupAbortController?.signal === signal) {
      activeBackupAbortController = null
    }
  }
}

/**
 * Backs up or pushes an individual note or file directly to Google Drive.
 * Always places it inside the root 'lumina' folder (creating intermediate subfolders if needed).
 * Does NOT push other sibling notes.
 *
 * @param {string | object} fileInput - Absolute path, relative path, or snippet object
 * @param {string} vaultPath - Local path to the workspace
 * @param {Electron.WebContents} [sender=null] - Sender for progress events
 */
export async function backupFileToDrive(fileInput, vaultPath, sender = null) {
  cancelBackup()

  activeBackupAbortController = new AbortController()
  const signal = activeBackupAbortController.signal

  try {
    return await backupSingleFile(fileInput, vaultPath, sender, signal)
  } finally {
    if (activeBackupAbortController?.signal === signal) {
      activeBackupAbortController = null
    }
  }
}

