import { invoke } from '@tauri-apps/api/core'

export interface DriveBackupProgress {
  type: 'backup'
  stage: 'scanning' | 'uploading' | 'completed' | 'cancelled' | 'error'
  progress: number
  current?: number
  total?: number
  file?: string
  error?: string
}

export type EmitBackupProgressFn = (event: DriveBackupProgress) => void

export interface DriveBackupResult {
  success: boolean
  cancelled?: boolean
  error?: string
  mode?: 'zip' | 'folder'
  updated?: boolean
  fileName?: string
  relativePath?: string
  fileId?: string
  webViewLink?: string
  luminaFolderLink?: string
  folderId?: string
  totalFiles?: number
}

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'
const BACKUP_ZIP_NAME = 'lumina-backup.zip'
const MULTIPART_THRESHOLD_BYTES = 4 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  mdx: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8',
  canvas: 'application/json; charset=utf-8',
  zip: 'application/zip'
}

let activeAbortController: AbortController | null = null
let currentBackupPromise: Promise<any> | null = null

function toUint8Array(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  }
  if (Array.isArray(raw)) return new Uint8Array(raw)
  return new Uint8Array(0)
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type })
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

function escapeDriveQuery(str: string): string {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function isCancellationError(err: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return true
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; message?: string }
  const msg = (e.message || '').toLowerCase()
  return e.name === 'AbortError' || msg.includes('aborted') || msg.includes('cancelled')
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const res = (await invoke(
    'get_google_access_token',
    forceRefresh ? { forceRefresh: true } : {}
  )) as any
  if (!res || res.error || !res.accessToken) {
    throw new Error(res?.error || 'Not logged in to Google Drive. Please log in from Settings.')
  }
  return String(res.accessToken)
}

async function driveFetch(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal | null
): Promise<Response> {
  if (signal?.aborted) {
    throw new Error('Backup cancelled')
  }

  let token = await getAccessToken(false)
  const effectiveSignal = signal || options.signal || undefined

  const makeHeaders = (bearer: string): Headers => {
    const h = new Headers(options.headers || {})
    h.set('Authorization', `Bearer ${bearer}`)
    return h
  }

  let response = await fetch(url, {
    ...options,
    signal: effectiveSignal,
    headers: makeHeaders(token)
  })

  if (response.status === 401) {
    if (effectiveSignal?.aborted) {
      throw new Error('Backup cancelled')
    }
    token = await getAccessToken(true)
    response = await fetch(url, {
      ...options,
      signal: effectiveSignal,
      headers: makeHeaders(token)
    })
  }

  return response
}

async function getOrCreateLuminaFolder(
  signal?: AbortSignal | null
): Promise<{ id: string; webViewLink?: string }> {
  if (signal?.aborted) throw new Error('Backup cancelled')

  const query = encodeURIComponent(
    "name='lumina' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  )
  const res = await driveFetch(
    `${DRIVE_FILES_API}?q=${query}&fields=files(id,name,webViewLink)&spaces=drive`,
    {},
    signal
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Failed to query root 'lumina' folder: ${res.status} - ${errText}`)
  }

  const data = await res.json()
  if (Array.isArray(data.files) && data.files.length > 0) {
    return { id: data.files[0].id, webViewLink: data.files[0].webViewLink }
  }

  if (signal?.aborted) throw new Error('Backup cancelled')

  const createRes = await driveFetch(
    `${DRIVE_FILES_API}?fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'lumina',
        mimeType: 'application/vnd.google-apps.folder'
      })
    },
    signal
  )

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => createRes.statusText)
    throw new Error(`Failed to create 'lumina' folder on Drive: ${createRes.status} - ${errText}`)
  }

  const createData = await createRes.json()
  return { id: createData.id, webViewLink: createData.webViewLink }
}

async function ensureDriveFolderPath(
  relativeDir: string,
  rootFolderId: string,
  folderCache: Map<string, string>,
  signal?: AbortSignal | null
): Promise<string> {
  const normalized = relativeDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized === '.') {
    return rootFolderId
  }

  const segments = normalized.split('/')
  let currentParentId = rootFolderId
  let accumulatedPath = ''

  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (signal?.aborted) throw new Error('Backup cancelled')

    accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment

    const cachedId = folderCache.get(accumulatedPath)
    if (cachedId) {
      currentParentId = cachedId
      continue
    }

    const query = encodeURIComponent(
      `name='${escapeDriveQuery(segment)}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`
    )
    const searchRes = await driveFetch(
      `${DRIVE_FILES_API}?q=${query}&fields=files(id,name)&spaces=drive`,
      {},
      signal
    )

    let folderId: string | null = null
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      if (Array.isArray(searchData.files) && searchData.files.length > 0) {
        folderId = searchData.files[0].id
      }
    }

    if (!folderId) {
      if (signal?.aborted) throw new Error('Backup cancelled')

      const createRes = await driveFetch(
        `${DRIVE_FILES_API}?fields=id,name`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: segment,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [currentParentId]
          })
        },
        signal
      )

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => createRes.statusText)
        throw new Error(
          `Failed to create subfolder '${segment}' on Drive: ${createRes.status} - ${errText}`
        )
      }

      const createData = await createRes.json()
      folderId = createData.id
    }

    if (folderId) {
      folderCache.set(accumulatedPath, folderId)
      currentParentId = folderId
    }
  }

  return currentParentId
}

async function findFileInDriveFolder(
  fileName: string,
  parentFolderId: string,
  signal?: AbortSignal | null
): Promise<{ id: string; name: string; webViewLink?: string } | null> {
  if (signal?.aborted) throw new Error('Backup cancelled')

  const query = encodeURIComponent(
    `name='${escapeDriveQuery(fileName)}' and '${parentFolderId}' in parents and trashed=false`
  )
  const res = await driveFetch(
    `${DRIVE_FILES_API}?q=${query}&fields=files(id,name,webViewLink)&spaces=drive`,
    {},
    signal
  )

  if (!res.ok) return null
  const data = await res.json()
  if (Array.isArray(data.files) && data.files.length > 0) {
    return data.files[0]
  }
  return null
}

async function findExistingZipBackup(signal?: AbortSignal | null): Promise<string | null> {
  if (signal?.aborted) throw new Error('Backup cancelled')

  const query = encodeURIComponent(
    `name='${escapeDriveQuery(BACKUP_ZIP_NAME)}' and trashed=false`
  )
  const res = await driveFetch(
    `${DRIVE_FILES_API}?q=${query}&fields=files(id,name)&spaces=drive`,
    {},
    signal
  )

  if (!res.ok) return null
  const data = await res.json()
  if (Array.isArray(data.files) && data.files.length > 0) {
    return data.files[0].id
  }
  return null
}

async function uploadOrUpdateDriveBytes(
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string,
  parentFolderId: string | null,
  existingFileId: string | null,
  signal?: AbortSignal | null
): Promise<{ fileId: string; updated: boolean; webViewLink?: string }> {
  if (signal?.aborted) throw new Error('Backup cancelled')

  const metaBody: Record<string, unknown> = { name: fileName }
  if (!existingFileId && parentFolderId) {
    metaBody.parents = [parentFolderId]
  }
  if (!existingFileId && !parentFolderId && mimeType === 'application/zip') {
    metaBody.mimeType = mimeType
  }

  const method = existingFileId ? 'PATCH' : 'POST'

  // Fast single-request multipart upload for payloads <= 4 MB (avoids CORS Location header issues)
  if (fileBytes.byteLength <= MULTIPART_THRESHOLD_BYTES) {
    const url = existingFileId
      ? `${DRIVE_UPLOAD_API}/${existingFileId}?uploadType=multipart&fields=id,name,webViewLink`
      : `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,webViewLink`

    const boundary = `lumina_drive_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const encoder = new TextEncoder()
    const preamble = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metaBody)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    )
    const closing = encoder.encode(`\r\n--${boundary}--`)
    const multipartBody = new Blob([preamble, bytesToBlob(fileBytes, mimeType), closing], {
      type: `multipart/related; boundary=${boundary}`
    })

    const res = await driveFetch(
      url,
      {
        method,
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      },
      signal
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`Upload failed for '${fileName}': ${res.status} - ${errText}`)
    }

    const result = await res.json()
    return {
      fileId: result.id,
      updated: Boolean(existingFileId),
      webViewLink: result.webViewLink
    }
  }

  // Resumable upload for large files / ZIP archives (> 4 MB)
  const initUrl = existingFileId
    ? `${DRIVE_UPLOAD_API}/${existingFileId}?uploadType=resumable&fields=id,name,webViewLink`
    : `${DRIVE_UPLOAD_API}?uploadType=resumable&fields=id,name,webViewLink`

  const initRes = await driveFetch(
    initUrl,
    {
      method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(fileBytes.byteLength)
      },
      body: JSON.stringify(metaBody)
    },
    signal
  )

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => initRes.statusText)
    throw new Error(
      `Failed to initiate file upload for '${fileName}': ${initRes.status} - ${errText}`
    )
  }

  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) {
    throw new Error(`No upload location returned by Google Drive API for '${fileName}'`)
  }

  if (signal?.aborted) throw new Error('Backup cancelled')

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    signal: signal || undefined,
    headers: {
      'Content-Type': mimeType
    },
    body: bytesToBlob(fileBytes, mimeType)
  })

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => putRes.statusText)
    throw new Error(`Upload failed for '${fileName}': ${putRes.status} - ${errText}`)
  }

  const result = await putRes.json()
  return {
    fileId: result.id,
    updated: Boolean(existingFileId),
    webViewLink: result.webViewLink
  }
}

function splitDirAndBase(relativePath: string): { dirName: string; baseName: string } {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const idx = normalized.lastIndexOf('/')
  if (idx === -1) {
    return { dirName: '', baseName: normalized }
  }
  return {
    dirName: normalized.slice(0, idx),
    baseName: normalized.slice(idx + 1)
  }
}

function resolveRelativePath(fileInput: any): string {
  if (typeof fileInput === 'string') {
    return fileInput.replace(/\\/g, '/').replace(/^\/+/, '')
  }
  if (!fileInput || typeof fileInput !== 'object') {
    throw new Error('Invalid file input for Google Drive backup')
  }
  if (typeof fileInput.relativePath === 'string' && fileInput.relativePath.trim()) {
    return fileInput.relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  }
  const folder = typeof fileInput.folderId === 'string' ? fileInput.folderId.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : ''
  const rawName =
    typeof fileInput.fileName === 'string' && fileInput.fileName.trim()
      ? fileInput.fileName.trim()
      : `${String(fileInput.title || 'Untitled').trim().replace(/[<>:"/\\|?*]/g, '') || 'Untitled'}.md`
  if (folder) {
    return `${folder}/${rawName}`
  }
  if (typeof fileInput.id === 'string' && fileInput.id.trim() && (fileInput.id.includes('.') || fileInput.id.includes('/'))) {
    return fileInput.id.replace(/\\/g, '/').replace(/^\/+/, '')
  }
  return rawName
}

function resolveTargetFileName(fileInput: any, diskFileName: string): string {
  let fileName = diskFileName
  if (fileInput && typeof fileInput === 'object' && fileInput.title) {
    const cleanTitle = String(fileInput.title).trim().replace(/[<>:"/\\|?*]/g, '')
    if (cleanTitle) {
      const dotIdx = diskFileName.lastIndexOf('.')
      const ext = dotIdx !== -1 ? diskFileName.slice(dotIdx) : '.md'
      const stem = dotIdx !== -1 ? diskFileName.slice(0, dotIdx) : diskFileName
      if (
        stem.toLowerCase() === 'new note' ||
        stem.toLowerCase() === 'untitled' ||
        stem.toLowerCase() !== cleanTitle.toLowerCase()
      ) {
        fileName = cleanTitle.toLowerCase().endsWith(ext.toLowerCase())
          ? cleanTitle
          : `${cleanTitle}${ext}`
      }
    }
  }
  return fileName
}

async function readWorkspaceBytesForNote(
  fileInput: any,
  relativePath: string,
  dirName: string,
  targetFileName: string
): Promise<Uint8Array> {
  const candidates = [relativePath]
  const titledCandidate = dirName ? `${dirName}/${targetFileName}` : targetFileName
  if (!candidates.includes(titledCandidate)) {
    candidates.push(titledCandidate)
  }

  for (const rel of candidates) {
    try {
      const raw = await invoke<unknown>('read_asset_bytes', { relativePath: rel })
      const bytes = toUint8Array(raw)
      if (bytes.byteLength > 0 || (fileInput?.code ?? '') === '') {
        return bytes
      }
    } catch {
      /* Try next candidate or note code fallback */
    }
  }

  if (fileInput && typeof fileInput === 'object' && typeof fileInput.code === 'string') {
    return new TextEncoder().encode(fileInput.code)
  }

  throw new Error(`File not found in workspace: ${relativePath}`)
}

async function runExclusiveBackup(
  task: (signal: AbortSignal) => Promise<DriveBackupResult>
): Promise<DriveBackupResult> {
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
    if (currentBackupPromise) {
      try {
        await currentBackupPromise
      } catch {
        /* ignore settled error from superseded run */
      }
    }
  }

  const controller = new AbortController()
  activeAbortController = controller
  const { signal } = controller

  let promise: Promise<DriveBackupResult> | null = null
  promise = (async () => {
    try {
      return await task(signal)
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null
      }
      if (currentBackupPromise === promise) {
        currentBackupPromise = null
      }
    }
  })()

  currentBackupPromise = promise
  return promise
}

export async function cancelGoogleDriveBackup(): Promise<boolean> {
  let cancelled = false
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
    cancelled = true
  }
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    await invoke('cancel_backup').catch(() => {})
  }
  return cancelled
}

/**
 * Single Push: uploads/updates one note or file directly inside Google Drive's `lumina` folder hierarchy.
 */
export async function backupFileToDrive(
  fileInput: any,
  emitProgress?: EmitBackupProgressFn
): Promise<DriveBackupResult> {
  return runExclusiveBackup(async (signal) => {
    try {
      if (signal.aborted) throw new Error('Backup cancelled')

      await getAccessToken(false)
      const relativePath = resolveRelativePath(fileInput)
      const { dirName, baseName: diskFileName } = splitDirAndBase(relativePath)
      const fileName = resolveTargetFileName(fileInput, diskFileName)
      const fileBytes = await readWorkspaceBytesForNote(fileInput, relativePath, dirName, fileName)

      emitProgress?.({
        type: 'backup',
        stage: 'uploading',
        progress: 10,
        file: relativePath
      })

      const luminaFolder = await getOrCreateLuminaFolder(signal)
      const targetFolderId = await ensureDriveFolderPath(
        dirName,
        luminaFolder.id,
        new Map(),
        signal
      )

      emitProgress?.({
        type: 'backup',
        stage: 'uploading',
        progress: 45,
        file: relativePath
      })

      const existingFile = await findFileInDriveFolder(fileName, targetFolderId, signal)
      let existingFileId = existingFile ? existingFile.id : null

      if (!existingFileId && diskFileName !== fileName) {
        const oldDriveFile = await findFileInDriveFolder(diskFileName, targetFolderId, signal)
        if (oldDriveFile) {
          existingFileId = oldDriveFile.id
        }
      }

      const uploadResult = await uploadOrUpdateDriveBytes(
        fileBytes,
        fileName,
        getMimeType(fileName),
        targetFolderId,
        existingFileId,
        signal
      )

      emitProgress?.({
        type: 'backup',
        stage: 'completed',
        progress: 100,
        file: relativePath
      })

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
    } catch (err: any) {
      if (isCancellationError(err, signal)) {
        emitProgress?.({ type: 'backup', stage: 'cancelled', progress: 0 })
        return { success: false, cancelled: true }
      }
      const message = err?.message || 'Push failed'
      emitProgress?.({ type: 'backup', stage: 'error', progress: 0, error: message })
      return { success: false, error: message }
    }
  })
}

/**
 * Workspace Backup:
 * - `'folder'`: Bulk non-zip push of every workspace file directly under Google Drive's `'lumina'` folder.
 * - `'zip'`: Packages the workspace in Rust memory (`build_workspace_zip_bytes`) and uploads/updates `'lumina-backup.zip'` on Google Drive.
 */
export async function backupWorkspaceToDrive(
  mode: 'zip' | 'folder' = 'zip',
  emitProgress?: EmitBackupProgressFn
): Promise<DriveBackupResult> {
  return runExclusiveBackup(async (signal) => {
    try {
      if (signal.aborted) throw new Error('Backup cancelled')

      await getAccessToken(false)
      emitProgress?.({ type: 'backup', stage: 'scanning', progress: 5 })

      if (mode === 'folder') {
        const files = await invoke<string[]>('list_workspace_files')
        const totalFiles = Array.isArray(files) ? files.length : 0

        if (totalFiles === 0) {
          emitProgress?.({ type: 'backup', stage: 'completed', progress: 100 })
          return { success: true, mode: 'folder', totalFiles: 0 }
        }

        const luminaFolder = await getOrCreateLuminaFolder(signal)
        const folderCache = new Map<string, string>()

        let processed = 0
        for (const relPath of files) {
          if (signal.aborted) throw new Error('Backup cancelled')

          const { dirName, baseName: fileName } = splitDirAndBase(relPath)
          const targetFolderId = await ensureDriveFolderPath(
            dirName,
            luminaFolder.id,
            folderCache,
            signal
          )
          const existingFile = await findFileInDriveFolder(fileName, targetFolderId, signal)
          const existingFileId = existingFile ? existingFile.id : null
          const rawBytes = await invoke<unknown>('read_asset_bytes', { relativePath: relPath })
          const fileBytes = toUint8Array(rawBytes)

          await uploadOrUpdateDriveBytes(
            fileBytes,
            fileName,
            getMimeType(fileName),
            targetFolderId,
            existingFileId,
            signal
          )

          processed++
          const progressPercent = Math.min(99, Math.round(10 + (processed / totalFiles) * 85))
          emitProgress?.({
            type: 'backup',
            stage: 'uploading',
            progress: progressPercent,
            current: processed,
            total: totalFiles,
            file: relPath
          })
        }

        emitProgress?.({ type: 'backup', stage: 'completed', progress: 100 })
        return {
          success: true,
          mode: 'folder',
          totalFiles,
          luminaFolderLink: luminaFolder.webViewLink
        }
      }

      // ZIP mode
      const rawZip = await invoke<unknown>('build_workspace_zip_bytes')
      const zipBytes = toUint8Array(rawZip)
      if (signal.aborted) throw new Error('Backup cancelled')

      emitProgress?.({ type: 'backup', stage: 'uploading', progress: 40 })
      const existingFileId = await findExistingZipBackup(signal)
      if (signal.aborted) throw new Error('Backup cancelled')

      emitProgress?.({ type: 'backup', stage: 'uploading', progress: 55 })
      const uploadResult = await uploadOrUpdateDriveBytes(
        zipBytes,
        BACKUP_ZIP_NAME,
        'application/zip',
        null,
        existingFileId,
        signal
      )

      emitProgress?.({ type: 'backup', stage: 'completed', progress: 100 })
      return {
        success: true,
        mode: 'zip',
        updated: Boolean(existingFileId),
        fileId: uploadResult.fileId,
        webViewLink: uploadResult.webViewLink
      }
    } catch (err: any) {
      if (isCancellationError(err, signal)) {
        emitProgress?.({ type: 'backup', stage: 'cancelled', progress: 0 })
        return { success: false, cancelled: true }
      }
      const message = err?.message || 'Backup failed'
      emitProgress?.({ type: 'backup', stage: 'error', progress: 0, error: message })
      return { success: false, error: message }
    }
  })
}
