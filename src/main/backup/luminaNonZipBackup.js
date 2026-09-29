import fs from 'fs'
import path from 'path'
import { getDriveUser, driveFetch, escapeDriveQuery } from './driveAuthHelper'

// MIME type lookup for common workspace files
const MIME_TYPES = {
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.mdx': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
  '.canvas': 'application/json; charset=utf-8'
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

/**
 * Finds or creates the root 'lumina' folder on Google Drive.
 * Under drive.file scope, queries without 'root in parents' are most reliable.
 *
 * @param {object} user - Authenticated Google user
 * @param {AbortSignal} [signal=null] - Optional abort signal
 * @returns {Promise<{ id: string, webViewLink?: string }>}
 */
export async function getOrCreateLuminaFolder(user, signal = null) {
  if (signal?.aborted) throw new Error('Backup cancelled')

  const query = encodeURIComponent(
    "name='lumina' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  )
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&spaces=drive`,
    {},
    user,
    signal
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to query root 'lumina' folder: ${res.status} - ${errText}`)
  }

  const data = await res.json()
  if (data.files && data.files.length > 0) {
    return { id: data.files[0].id, webViewLink: data.files[0].webViewLink }
  }

  if (signal?.aborted) throw new Error('Backup cancelled')

  // Create 'lumina' folder in Drive root
  const createRes = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'lumina',
        mimeType: 'application/vnd.google-apps.folder'
      })
    },
    user,
    signal
  )

  if (!createRes.ok) {
    const errText = await createRes.text()
    throw new Error(`Failed to create 'lumina' folder on Drive: ${createRes.status} - ${errText}`)
  }

  const createData = await createRes.json()
  return { id: createData.id, webViewLink: createData.webViewLink }
}

/**
 * Ensures that a nested folder path exists under a root Drive folder.
 * Caches resolved folder IDs to avoid duplicate network queries.
 *
 * E.g. 'folder1/folder2/.../folder10' creates each intermediate folder on Google Drive
 * under 'lumina' if it doesn't already exist, without needing other notes to be uploaded.
 *
 * @param {string} relativeDir - Relative directory path
 * @param {string} rootFolderId - ID of parent/root Drive folder
 * @param {object} user - Authenticated Google user
 * @param {Map<string, string>} [folderCache=new Map()]
 * @param {AbortSignal} [signal=null] - Optional abort signal
 * @returns {Promise<string>} Folder ID of the deepest folder
 */
export async function ensureDriveFolderPath(
  relativeDir,
  rootFolderId,
  user,
  folderCache = new Map(),
  signal = null
) {
  const normalized = relativeDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized === '.') {
    return rootFolderId
  }

  const segments = normalized.split('/')
  let currentParentId = rootFolderId
  let accumulatedPath = ''

  for (const segment of segments) {
    if (!segment) continue
    if (signal?.aborted) throw new Error('Backup cancelled')

    accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment

    if (folderCache.has(accumulatedPath)) {
      currentParentId = folderCache.get(accumulatedPath)
      continue
    }

    const query = encodeURIComponent(
      `name='${escapeDriveQuery(segment)}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`
    )
    const searchRes = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
      {},
      user,
      signal
    )

    let folderId = null
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id
      }
    }

    if (!folderId) {
      if (signal?.aborted) throw new Error('Backup cancelled')

      // Create subfolder under currentParentId
      const createRes = await driveFetch(
        'https://www.googleapis.com/drive/v3/files?fields=id,name',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: segment,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [currentParentId]
          })
        },
        user,
        signal
      )

      if (!createRes.ok) {
        const errText = await createRes.text()
        throw new Error(`Failed to create subfolder '${segment}' on Drive: ${createRes.status} - ${errText}`)
      }

      const createData = await createRes.json()
      folderId = createData.id
    }

    folderCache.set(accumulatedPath, folderId)
    currentParentId = folderId
  }

  return currentParentId
}

/**
 * Searches for a file by name within a specific parent folder on Drive.
 */
export async function findFileInDriveFolder(fileName, parentFolderId, user, signal = null) {
  if (signal?.aborted) throw new Error('Backup cancelled')

  const query = encodeURIComponent(
    `name='${escapeDriveQuery(fileName)}' and '${parentFolderId}' in parents and trashed=false`
  )
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&spaces=drive`,
    {},
    user,
    signal
  )

  if (!res.ok) {
    return null
  }

  const data = await res.json()
  if (data.files && data.files.length > 0) {
    return data.files[0]
  }
  return null
}

/**
 * Uploads a file to Google Drive via resumable upload.
 * If existingFileId is provided, updates the file in place via PATCH.
 */
export async function uploadOrUpdateFile(
  filePath,
  fileName,
  parentFolderId,
  user,
  existingFileId = null,
  signal = null
) {
  if (signal?.aborted) throw new Error('Backup cancelled')

  const stats = fs.statSync(filePath)
  const mimeType = getMimeType(filePath)

  let initUrl
  let initMethod

  if (existingFileId) {
    initUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable&fields=id,name,webViewLink`
    initMethod = 'PATCH'
  } else {
    initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink'
    initMethod = 'POST'
  }

  const metaBody = { name: fileName }
  if (!existingFileId) {
    metaBody.parents = [parentFolderId]
  }

  const initRes = await driveFetch(
    initUrl,
    {
      method: initMethod,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': stats.size.toString()
      },
      body: JSON.stringify(metaBody)
    },
    user,
    signal
  )

  if (!initRes.ok) {
    const errorText = await initRes.text()
    throw new Error(`Failed to initiate file upload for '${fileName}': ${initRes.status} - ${errorText}`)
  }

  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) {
    throw new Error(`No upload location returned for '${fileName}'`)
  }

  if (signal?.aborted) throw new Error('Backup cancelled')

  const fileData = fs.readFileSync(filePath)
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    signal,
    headers: {
      'Content-Length': stats.size.toString(),
      'Content-Type': mimeType
    },
    body: fileData
  })

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text()
    throw new Error(`Upload failed for '${fileName}': ${uploadRes.status} - ${errorText}`)
  }

  const result = await uploadRes.json()
  return {
    fileId: result.id,
    updated: !!existingFileId,
    webViewLink: result.webViewLink
  }
}

/**
 * Resolves the absolute path and relative path of a file input.
 */
function resolveFilePaths(fileInput, workspacePath) {
  let fullPath = null
  let relativePath = null

  if (typeof fileInput === 'string') {
    if (path.isAbsolute(fileInput)) {
      fullPath = fileInput
      relativePath = path.relative(workspacePath, fullPath)
    } else {
      relativePath = fileInput
      fullPath = path.resolve(workspacePath, relativePath)
    }
  } else if (fileInput && typeof fileInput === 'object') {
    if (fileInput.filePath && fs.existsSync(fileInput.filePath)) {
      fullPath = fileInput.filePath
      relativePath = path.relative(workspacePath, fullPath)
    } else if (fileInput.relativePath) {
      relativePath = fileInput.relativePath
      fullPath = path.resolve(workspacePath, relativePath)
    } else {
      const folder = (fileInput.folderId || '').replace(/\\/g, '/')
      const name = fileInput.fileName || `${fileInput.title || 'Untitled'}.md`
      relativePath = path.join(folder, name)
      fullPath = path.resolve(workspacePath, relativePath)
    }

    // Fallback: If fullPath doesn't exist on disk, check if file exists with the note title
    if ((!fullPath || !fs.existsSync(fullPath)) && fileInput.title) {
      const folder = (fileInput.folderId || '').replace(/\\/g, '/')
      const cleanTitle = String(fileInput.title).trim().replace(/[<>:"/\\|?*]/g, '')
      const candidatePath = path.resolve(workspacePath, path.join(folder, `${cleanTitle}.md`))
      if (fs.existsSync(candidatePath)) {
        fullPath = candidatePath
        relativePath = path.relative(workspacePath, fullPath)
      }
    }
  }

  if (!fullPath || !fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath || 'unknown'}`)
  }

  return { fullPath, relativePath: relativePath.replace(/\\/g, '/') }
}

/**
 * Backs up or pushes a single file directly into Google Drive's 'lumina' folder hierarchy.
 *
 * HOW GIT HANDLES THIS / HOW LUMINA HANDLES THIS:
 * - If the note is nested inside 10 folders (e.g. A/B/C/D/E/F/G/H/I/J/note.md),
 *   Lumina ensures only the folder tree (A -> B -> ... -> J) exists on Google Drive.
 * - Lumina does NOT push the other sibling notes in those folders!
 * - Only the selected note is pushed or updated into the target folder.
 *
 * @param {string | object} fileInput - Snippet object, absolute path, or relative path
 * @param {string} workspacePath - Workspace root path
 * @param {Electron.WebContents} [sender=null] - Sender for progress IPC
 * @param {AbortSignal} [signal=null] - Optional abort signal
 */
export async function backupSingleFile(fileInput, workspacePath, sender = null, signal = null) {
  try {
    if (signal?.aborted) throw new Error('Backup cancelled')

    const user = await getDriveUser()
    const { fullPath, relativePath } = resolveFilePaths(fileInput, workspacePath)

    if (sender) {
      sender.send('index:progress', {
        type: 'backup',
        stage: 'uploading',
        progress: 10,
        file: relativePath
      })
    }

    // 1. Get or create root 'lumina' folder
    const luminaFolder = await getOrCreateLuminaFolder(user, signal)
    const luminaFolderId = luminaFolder.id

    // 2. Ensure intermediate directories exist under 'lumina' (without uploading sibling files)
    const dirName = path.dirname(relativePath)
    let fileName = path.basename(relativePath)

    // Ensure the uploaded Drive file name honors the note's active/saved title
    if (fileInput && typeof fileInput === 'object' && fileInput.title) {
      const cleanTitle = String(fileInput.title).trim().replace(/[<>:"/\\|?*]/g, '')
      if (cleanTitle) {
        const ext = path.extname(fileName) || '.md'
        const baseName = path.basename(fileName, ext)
        // If current file base was a placeholder (e.g. 'New Note', 'Untitled') or differs from title:
        if (
          baseName.toLowerCase() === 'new note' ||
          baseName.toLowerCase() === 'untitled' ||
          baseName.toLowerCase() !== cleanTitle.toLowerCase()
        ) {
          fileName = cleanTitle.endsWith(ext) ? cleanTitle : `${cleanTitle}${ext}`
        }
      }
    }

    const targetFolderId = await ensureDriveFolderPath(dirName, luminaFolderId, user, new Map(), signal)

    if (sender) {
      sender.send('index:progress', {
        type: 'backup',
        stage: 'uploading',
        progress: 45,
        file: relativePath
      })
    }

    // 3. Check if file already exists in target folder under target fileName
    let existingFile = await findFileInDriveFolder(fileName, targetFolderId, user, signal)
    let existingFileId = existingFile ? existingFile.id : null

    // If not found with the target fileName, check if an old file exists with the disk fileName
    // (e.g. previously pushed to Google Drive as 'New Note.md') so we can update & rename it in place!
    const diskFileName = path.basename(relativePath)
    if (!existingFileId && diskFileName !== fileName) {
      const oldDriveFile = await findFileInDriveFolder(diskFileName, targetFolderId, user, signal)
      if (oldDriveFile) {
        existingFileId = oldDriveFile.id
      }
    }

    // 4. Upload new file or update/rename existing file in place
    const uploadResult = await uploadOrUpdateFile(
      fullPath,
      fileName,
      targetFolderId,
      user,
      existingFileId,
      signal
    )

    if (sender) {
      sender.send('index:progress', {
        type: 'backup',
        stage: 'completed',
        progress: 100,
        file: relativePath
      })
    }

    return {
      success: true,
      fileName,
      relativePath,
      fileId: uploadResult.fileId,
      updated: uploadResult.updated,
      webViewLink: uploadResult.webViewLink,
      luminaFolderLink: luminaFolder.webViewLink,
      folderId: targetFolderId
    }
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('cancelled')) {
      console.info('[NonZipBackup] Single file backup cancelled')
      if (sender) {
        sender.send('index:progress', { type: 'backup', stage: 'cancelled', progress: 0 })
      }
      return { success: false, cancelled: true }
    }

    console.error('[NonZipBackup] Single file backup error:', err)
    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }
    return { error: err.message }
  }
}

/**
 * Collects all non-ignored files within a directory recursively.
 */
function scanDirectoryFiles(dir, baseDir, fileList = []) {
  const IGNORED_NAMES = new Set(['.git', '.obsidian', 'node_modules', '.trash', '.DS_Store', 'Thumbs.db'])

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDirectoryFiles(fullPath, baseDir, fileList)
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/')
      fileList.push({ fullPath, relPath })
    }
  }
  return fileList
}

/**
 * Backs up the entire workspace as direct non-zip files under Google Drive's 'lumina' folder.
 * Supports clean cancellation via AbortSignal.
 *
 * @param {string} workspacePath - Workspace path
 * @param {Electron.WebContents} [sender=null] - Sender for progress IPC
 * @param {AbortSignal} [signal=null] - Optional abort signal
 */
export async function backupWorkspaceNonZip(workspacePath, sender = null, signal = null) {
  try {
    if (signal?.aborted) throw new Error('Backup cancelled')

    const user = await getDriveUser()

    if (!fs.existsSync(workspacePath)) {
      throw new Error('Workspace directory does not exist')
    }

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'scanning', progress: 5 })
    }

    const files = scanDirectoryFiles(workspacePath, workspacePath)
    const totalFiles = files.length

    if (totalFiles === 0) {
      if (sender) {
        sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
      }
      return { success: true, totalFiles: 0 }
    }

    if (signal?.aborted) throw new Error('Backup cancelled')

    // 1. Get or create root 'lumina' folder
    const luminaFolder = await getOrCreateLuminaFolder(user, signal)
    const luminaFolderId = luminaFolder.id
    const folderCache = new Map()

    let processed = 0
    for (const item of files) {
      if (signal?.aborted) {
        throw new Error('Backup cancelled')
      }

      const dirName = path.dirname(item.relPath)
      const fileName = path.basename(item.relPath)

      const targetFolderId = await ensureDriveFolderPath(
        dirName,
        luminaFolderId,
        user,
        folderCache,
        signal
      )
      const existingFile = await findFileInDriveFolder(fileName, targetFolderId, user, signal)
      const existingFileId = existingFile ? existingFile.id : null

      await uploadOrUpdateFile(item.fullPath, fileName, targetFolderId, user, existingFileId, signal)

      processed++
      const progressPercent = Math.min(99, Math.round(10 + (processed / totalFiles) * 85))

      if (sender) {
        sender.send('index:progress', {
          type: 'backup',
          stage: 'uploading',
          progress: progressPercent,
          current: processed,
          total: totalFiles,
          file: item.relPath
        })
      }
    }

    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }

    return {
      success: true,
      mode: 'folder',
      totalFiles,
      luminaFolderLink: luminaFolder.webViewLink
    }
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('cancelled')) {
      console.info('[NonZipBackup] Workspace backup cancelled by user')
      if (sender) {
        sender.send('index:progress', { type: 'backup', stage: 'cancelled', progress: 0 })
      }
      return { success: false, cancelled: true }
    }

    console.error('[NonZipBackup] Workspace backup error:', err)
    if (sender) {
      sender.send('index:progress', { type: 'backup', stage: 'completed', progress: 100 })
    }
    return { error: err.message }
  }
}
