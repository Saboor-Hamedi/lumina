import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import { net, app } from 'electron'
import SettingsManager from '../SettingsManager'

/**
 * Creates a zip archive of the given directory.
 * @param {string} sourceDir - The folder to zip.
 * @param {string} outPath - The output zip file path.
 * @returns {Promise<void>}
 */
function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const stream = fs.createWriteStream(outPath)

    stream.on('close', () => resolve())
    archive.on('error', (err) => reject(err))

    archive.pipe(stream)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

/**
 * Uploads a file to Google Drive.
 * @param {string} filePath - Local path to the file to upload.
 * @param {string} accessToken - Google OAuth access token.
 * @returns {Promise<void>}
 */
async function uploadToGoogleDrive(filePath, accessToken) {
  const fileName = path.basename(filePath)
  const fileStats = fs.statSync(filePath)
  
  // 1. Initiate resumable upload session
  const initResponse = await net.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'application/zip',
      'X-Upload-Content-Length': fileStats.size.toString()
    },
    body: JSON.stringify({
      name: fileName,
      mimeType: 'application/zip',
      // parents: [folderId] // Optional: if we want to place it in a specific folder
    })
  })

  if (!initResponse.ok) {
    throw new Error(`Failed to initiate upload: ${initResponse.statusText}`)
  }

  const uploadUrl = initResponse.headers.get('location')
  if (!uploadUrl) {
    throw new Error('No upload location returned by Google Drive API')
  }

  // 2. Upload the file data
  const fileData = fs.readFileSync(filePath)
  const uploadResponse = await net.fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': fileStats.size.toString(),
      'Content-Type': 'application/zip'
    },
    body: fileData
  })

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file data: ${uploadResponse.statusText}`)
  }
}

/**
 * Main backup function exposed to IPC.
 * @param {string} vaultPath - Path to the current workspace/vault.
 */
export async function backupToDrive(vaultPath) {
  try {
    const user = await SettingsManager.get('googleUser')
    if (!user || !user.token) {
      throw new Error('Not logged in to Google Drive')
    }

    if (!fs.existsSync(vaultPath)) {
      throw new Error('Vault path does not exist')
    }

    const backupFileName = `Lumina_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
    const backupFilePath = path.join(app.getPath('temp'), backupFileName)

    // 1. Zip the workspace
    await zipDirectory(vaultPath, backupFilePath)

    // 2. Upload to Google Drive
    await uploadToGoogleDrive(backupFilePath, user.token)

    // 3. Cleanup temp file
    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath)
    }

    return { success: true }
  } catch (err) {
    console.error('Backup error:', err)
    return { error: err.message }
  }
}
