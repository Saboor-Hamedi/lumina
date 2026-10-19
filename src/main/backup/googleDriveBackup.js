import { backupWorkspaceZip } from './luminaZipBackup'
import { backupWorkspaceNonZip, backupSingleFile } from './luminaNonZipBackup'

let activeBackupAbortController = null
let currentBackupPromise = null

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
 * @param {string} workspacePath - Local path to the workspace
 * @param {'zip' | 'folder'} [mode='zip'] - Backup mode
 * @param {Electron.WebContents} [sender=null] - Sender for progress events
 */
export async function backupToDrive(workspacePath, mode = 'zip', sender = null) {
  // Cancel previous and await its settlement if still running
  if (activeBackupAbortController) {
    cancelBackup()
    if (currentBackupPromise) {
      try {
        await currentBackupPromise
      } catch (_) {}
    }
  }

  activeBackupAbortController = new AbortController()
  const signal = activeBackupAbortController.signal

  const run = async () => {
    try {
      if (mode === 'folder') {
        return await backupWorkspaceNonZip(workspacePath, sender, signal)
      }
      return await backupWorkspaceZip(workspacePath, sender, signal)
    } finally {
      if (activeBackupAbortController?.signal === signal) {
        activeBackupAbortController = null
      }
      if (currentBackupPromise === promise) {
        currentBackupPromise = null
      }
    }
  }

  const promise = run()
  currentBackupPromise = promise
  return await promise
}

/**
 * Backs up or pushes an individual note or file directly to Google Drive.
 * Always places it inside the root 'lumina' folder (creating intermediate subfolders if needed).
 * Does NOT push other sibling notes.
 *
 * @param {string | object} fileInput - Absolute path, relative path, or snippet object
 * @param {string} workspacePath - Local path to the workspace
 * @param {Electron.WebContents} [sender=null] - Sender for progress events
 */
export async function backupFileToDrive(fileInput, workspacePath, sender = null) {
  if (activeBackupAbortController) {
    cancelBackup()
    if (currentBackupPromise) {
      try {
        await currentBackupPromise
      } catch (_) {}
    }
  }

  activeBackupAbortController = new AbortController()
  const signal = activeBackupAbortController.signal

  const run = async () => {
    try {
      return await backupSingleFile(fileInput, workspacePath, sender, signal)
    } finally {
      if (activeBackupAbortController?.signal === signal) {
        activeBackupAbortController = null
      }
      if (currentBackupPromise === promise) {
        currentBackupPromise = null
      }
    }
  }

  const promise = run()
  currentBackupPromise = promise
  return await promise
}

