import fs from 'fs'
import path from 'path'
import { ZipArchive } from 'archiver'
import { app } from 'electron'
import SettingsManager from '../SettingsManager'
import { net } from 'electron'

// Fixed backup filename — always the same file on Drive so it gets updated, never duplicated
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
 * Search Google Drive for an existing backup file by name.
 * Returns the file ID if found, or null.
 */
async function findExistingBackup(accessToken) {
  const query = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and trashed=false`)
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('401_UNAUTHORIZED')
    }
    console.warn('Could not search Drive for existing backup:', response.status)
    return null
  }

  const data = await response.json()
  if (data.files && data.files.length > 0) {
    return data.files[0].id // Return the first match
  }
  return null
}

/**
 * Upload a file to Google Drive.
 * - If existingFileId is provided: PATCH (update in place)
 * - Otherwise: POST (create new)
 */
async function uploadToGoogleDrive(filePath, accessToken, existingFileId = null) {
  const fileStats = fs.statSync(filePath)

  let initUrl
  let initMethod

  if (existingFileId) {
    // Update existing file — use PATCH with the file's ID
    initUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable`
    initMethod = 'PATCH'
  } else {
    // Create new file
    initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'
    initMethod = 'POST'
  }

  // Initiate resumable upload session
  const initResponse = await fetch(initUrl, {
    method: initMethod,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'application/zip',
      'X-Upload-Content-Length': fileStats.size.toString()
    },
    body: JSON.stringify({
      name: BACKUP_FILE_NAME,
      mimeType: 'application/zip'
    })
  })

  if (!initResponse.ok) {
    const errorText = await initResponse.text()
    throw new Error(
      `Failed to initiate upload: ${initResponse.status} ${initResponse.statusText} - ${errorText}`
    )
  }

  const uploadUrl = initResponse.headers.get('location')
  if (!uploadUrl) {
    throw new Error('No upload location returned by Google Drive API')
  }

  // Upload the file data
  const fileData = fs.readFileSync(filePath)
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': fileStats.size.toString(),
      'Content-Type': 'application/zip'
    },
    body: fileData
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(
      `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`
    )
  }
}

async function refreshAccessToken(user) {
  if (!user.refreshToken || !user.clientId) {
    throw new Error('Missing refresh token or client ID. Please logout and log back in.')
  }

  const response = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: user.clientId,
      client_secret: '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',
      refresh_token: user.refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  })

  if (!response.ok) {
    throw new Error('Failed to refresh access token. Please logout and log back in.')
  }

  const data = await response.json()
  user.token = data.access_token
  await SettingsManager.set('googleUser', user)
  return user.token
}

/**
 * Main backup function exposed to IPC.
 */
export async function backupToDrive(vaultPath, sender) {
  try {
    const user = await SettingsManager.get('googleUser')
    if (!user || !user.token) {
      throw new Error('Not logged in to Google Drive')
    }

    if (!fs.existsSync(vaultPath)) {
      throw new Error('Vault path does not exist')
    }

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'scanning', progress: 5 })
    }

    const backupFilePath = path.join(app.getPath('temp'), BACKUP_FILE_NAME)

    // 1. Zip the workspace
    await zipDirectory(vaultPath, backupFilePath)

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'uploading', progress: 40 })
    }

    // 2. Check if a backup already exists on Drive
    let existingFileId = null
    try {
      existingFileId = await findExistingBackup(user.token)
    } catch (err) {
      if (err.message === '401_UNAUTHORIZED') {
        console.info('Access token expired, attempting to refresh...')
        user.token = await refreshAccessToken(user)
        existingFileId = await findExistingBackup(user.token)
      } else {
        throw err
      }
    }

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'uploading', progress: 55 })
    }

    // 3. Upload — update if exists, create if not
    await uploadToGoogleDrive(backupFilePath, user.token, existingFileId)

    // 4. Cleanup temp file
    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath)
    }

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }

    return { success: true, updated: !!existingFileId }
  } catch (err) {
    console.error('Backup error:', err)
    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }
    return { error: err.message }
  }
}
