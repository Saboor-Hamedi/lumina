import fs from 'fs'
import path from 'path'
import { ZipArchive } from 'archiver'
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
 * Uploads a file to Google Drive.
 * @param {string} filePath - Local path to the file to upload.
 * @param {string} accessToken - Google OAuth access token.
 * @returns {Promise<void>}
 */
async function uploadToGoogleDrive(filePath, accessToken) {
  const fileName = path.basename(filePath)
  const fileStats = fs.statSync(filePath)
  
  // 1. Initiate resumable upload session
  const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
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
    const errorText = await initResponse.text()
    throw new Error(`Failed to initiate upload: ${initResponse.status} ${initResponse.statusText} - ${errorText}`)
  }

  const uploadUrl = initResponse.headers.get('location')
  if (!uploadUrl) {
    throw new Error('No upload location returned by Google Drive API')
  }

  // 2. Upload the file data
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
    throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`)
  }
}

/**
 * Main backup function exposed to IPC.
 * @param {string} vaultPath - Path to the current workspace/vault.
 * @param {Electron.WebContents} sender - The web contents to send progress to.
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
      sender.send('index:progress', { type: 'backup', stage: 'scanning', progress: 0 })
    }

    const backupFileName = `Lumina_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
    const backupFilePath = path.join(app.getPath('temp'), backupFileName)

    // 1. Zip the workspace
    await zipDirectory(vaultPath, backupFilePath)

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'uploading', progress: 50 })
    }

    // 2. Upload to Google Drive
    await uploadToGoogleDrive(backupFilePath, user.token)

    // 3. Cleanup temp file
    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath)
    }

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }

    return { success: true }
  } catch (err) {
    console.error('Backup error:', err)
    if (sender) {
      // Clear the progress if it fails
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }
    return { error: err.message }
  }
}
