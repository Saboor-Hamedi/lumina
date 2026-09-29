import fs from 'fs'
import path from 'path'
import { ZipArchive } from 'archiver'
import { app } from 'electron'
import { getDriveUser, driveFetch, escapeDriveQuery } from './driveAuthHelper'

const BACKUP_FILE_NAME = 'lumina-backup.zip'

/**
 * Creates a zip archive of the given directory.
 */
function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } })
    const stream = fs.createWriteStream(outPath)

    stream.on('close', () => resolve())
    archive.on('error', (err) => reject(err))

    archive.pipe(stream)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

/**
 * Searches Google Drive for an existing zip backup file.
 */
async function findExistingZipBackup(user) {
  const query = encodeURIComponent(
    `name='${escapeDriveQuery(BACKUP_FILE_NAME)}' and trashed=false`
  )
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    {},
    user
  )

  if (!response.ok) {
    console.warn('[ZipBackup] Could not search Drive for existing backup:', response.status)
    return null
  }

  const data = await response.json()
  if (data.files && data.files.length > 0) {
    return data.files[0].id
  }
  return null
}

/**
 * Uploads or updates the zip backup file on Google Drive.
 */
async function uploadZipToGoogleDrive(filePath, user, existingFileId = null, signal = null) {
  if (signal?.aborted) throw new Error('Backup cancelled')

  const fileStats = fs.statSync(filePath)

  let initUrl
  let initMethod

  if (existingFileId) {
    initUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable`
    initMethod = 'PATCH'
  } else {
    initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'
    initMethod = 'POST'
  }

  const initResponse = await driveFetch(
    initUrl,
    {
      method: initMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'application/zip',
        'X-Upload-Content-Length': fileStats.size.toString()
      },
      body: JSON.stringify({
        name: BACKUP_FILE_NAME,
        mimeType: 'application/zip'
      })
    },
    user,
    signal
  )

  if (!initResponse.ok) {
    const errorText = await initResponse.text()
    throw new Error(
      `Failed to initiate zip upload: ${initResponse.status} ${initResponse.statusText} - ${errorText}`
    )
  }

  const uploadUrl = initResponse.headers.get('location')
  if (!uploadUrl) {
    throw new Error('No upload location returned by Google Drive API')
  }

  if (signal?.aborted) throw new Error('Backup cancelled')

  const fileData = fs.readFileSync(filePath)
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    signal,
    headers: {
      'Content-Length': fileStats.size.toString(),
      'Content-Type': 'application/zip'
    },
    body: fileData
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(
      `Zip upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`
    )
  }
}

/**
 * Executes a full workspace zip backup to Google Drive.
 */
export async function backupWorkspaceZip(workspacePath, sender, signal = null) {
  let backupFilePath = null
  try {
    if (signal?.aborted) throw new Error('Backup cancelled')

    const user = await getDriveUser()

    if (!fs.existsSync(workspacePath)) {
      throw new Error('Workspace directory does not exist')
    }

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'scanning', progress: 5 })
    }

    backupFilePath = path.join(app.getPath('temp'), BACKUP_FILE_NAME)

    if (signal?.aborted) throw new Error('Backup cancelled')

    // 1. Zip the workspace
    await zipDirectory(workspacePath, backupFilePath)

    if (signal?.aborted) throw new Error('Backup cancelled')

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'uploading', progress: 40 })
    }

    // 2. Check for existing zip backup on Drive
    const existingFileId = await findExistingZipBackup(user)

    if (signal?.aborted) throw new Error('Backup cancelled')

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'uploading', progress: 55 })
    }

    // 3. Upload or update
    await uploadZipToGoogleDrive(backupFilePath, user, existingFileId, signal)

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }

    return { success: true, mode: 'zip', updated: !!existingFileId }
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('cancelled')) {
      console.info('[ZipBackup] Backup cancelled by user')
      if (sender) {
        sender.send('index:progress', { type: 'backup', stage: 'cancelled', progress: 0 })
      }
      return { success: false, cancelled: true }
    }

    console.error('[ZipBackup] Error:', err)
    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }
    return { error: err.message }
  } finally {
    if (backupFilePath && fs.existsSync(backupFilePath)) {
      try {
        fs.unlinkSync(backupFilePath)
      } catch (cleanupErr) {
        console.warn('[ZipBackup] Failed to remove temp zip file:', cleanupErr.message)
      }
    }
  }
}
