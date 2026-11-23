import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import {
  backupFileToDrive,
  backupWorkspaceToDrive,
  cancelGoogleDriveBackup
} from '../../../../src/renderer/src/core/googleDriveClient'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

const mockInvoke = vi.mocked(invoke)

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  })
}

describe('googleDriveClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Single Push uploads/updates a single note directly into nested Drive folders without any save dialog', async () => {
    const progressEvents: any[] = []
    const noteBytes = new TextEncoder().encode('# Spec\nContent').buffer

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_google_access_token') {
        return { accessToken: 'tok-single' }
      }
      if (cmd === 'read_asset_bytes') {
        return noteBytes
      }
      throw new Error(`Unexpected command: ${cmd}`)
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method || 'GET').toUpperCase()

      // 1. Root 'lumina' folder lookup -> return existing
      if (url.includes("name%3D'lumina'") && method === 'GET') {
        return jsonResponse({ files: [{ id: 'lumina-root', name: 'lumina', webViewLink: 'https://drive/lumina' }] })
      }
      // 2. Subfolder 'Projects' lookup -> create it
      if (url.includes("name%3D'Projects'") && method === 'GET') {
        return jsonResponse({ files: [] })
      }
      if (url.startsWith('https://www.googleapis.com/drive/v3/files') && method === 'POST') {
        const body = JSON.parse(String(init?.body || '{}'))
        return jsonResponse({ id: `folder-${body.name}`, name: body.name })
      }
      // 3. Subfolder 'Specs' lookup -> already exists
      if (url.includes("name%3D'Specs'") && method === 'GET') {
        return jsonResponse({ files: [{ id: 'folder-Specs', name: 'Specs' }] })
      }
      // 4. Check existing file 'Architecture.md' -> not found
      if (url.includes("name%3D'Architecture.md'") && method === 'GET') {
        return jsonResponse({ files: [] })
      }
      // 5. Fallback disk file 'Untitled.md' -> found old file to update/rename in place!
      if (url.includes("name%3D'Untitled.md'") && method === 'GET') {
        return jsonResponse({ files: [{ id: 'existing-file-1', name: 'Untitled.md' }] })
      }
      // 6. Multipart PATCH upload
      if (url.includes('/upload/drive/v3/files/existing-file-1?uploadType=multipart') && method === 'PATCH') {
        return jsonResponse({ id: 'existing-file-1', name: 'Architecture.md', webViewLink: 'https://drive/file-1' })
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await backupFileToDrive(
      {
        relativePath: 'Projects/Specs/Untitled.md',
        title: 'Architecture'
      },
      (e) => progressEvents.push(e)
    )

    expect(result).toMatchObject({
      success: true,
      fileName: 'Architecture.md',
      relativePath: 'Projects/Specs/Untitled.md',
      fileId: 'existing-file-1',
      updated: true,
      folderId: 'folder-Specs'
    })
    expect(mockInvoke).not.toHaveBeenCalledWith('export_pick_save_path', expect.anything())
    expect(progressEvents.some((e) => e.stage === 'uploading')).toBe(true)
    expect(progressEvents[progressEvents.length - 1]).toMatchObject({
      stage: 'completed',
      progress: 100
    })
  })

  it('Bulk Workspace Push uploads all files under Drive lumina folder and reuses folder cache', async () => {
    const progressEvents: any[] = []
    let folderQueriesForNotes = 0

    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'get_google_access_token') return { accessToken: 'tok-bulk' }
      if (cmd === 'list_workspace_files') return ['notes/a.md', 'notes/b.md']
      if (cmd === 'read_asset_bytes') {
        return new TextEncoder().encode(`content:${args?.relativePath}`).buffer
      }
      throw new Error(`Unexpected command: ${cmd}`)
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method || 'GET').toUpperCase()

      if (url.includes("name%3D'lumina'") && method === 'GET') {
        return jsonResponse({ files: [{ id: 'root-lumina', name: 'lumina', webViewLink: 'https://drive/lumina' }] })
      }
      if (url.includes("name%3D'notes'") && method === 'GET') {
        folderQueriesForNotes++
        return jsonResponse({ files: [{ id: 'folder-notes', name: 'notes' }] })
      }
      if (url.includes("name%3D'a.md'") || url.includes("name%3D'b.md'")) {
        return jsonResponse({ files: [] })
      }
      if (url.includes('/upload/drive/v3/files?uploadType=multipart') && method === 'POST') {
        return jsonResponse({ id: `uploaded-${Math.random()}`, webViewLink: 'https://drive/f' })
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await backupWorkspaceToDrive('folder', (e) => progressEvents.push(e))

    expect(result).toMatchObject({
      success: true,
      mode: 'folder',
      totalFiles: 2,
      luminaFolderLink: 'https://drive/lumina'
    })
    expect(folderQueriesForNotes).toBe(1)
    expect(progressEvents[0]).toMatchObject({ stage: 'scanning', progress: 5 })
    expect(progressEvents[progressEvents.length - 1]).toMatchObject({
      stage: 'completed',
      progress: 100
    })
  })

  it('ZIP Push builds ZIP bytes in Rust memory and updates existing lumina-backup.zip on Drive', async () => {
    const progressEvents: any[] = []
    const zipBytes = new Uint8Array([80, 75, 3, 4, 10, 20]).buffer

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_google_access_token') return { accessToken: 'tok-zip' }
      if (cmd === 'build_workspace_zip_bytes') return zipBytes
      throw new Error(`Unexpected command: ${cmd}`)
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method || 'GET').toUpperCase()

      if (url.includes("name%3D'lumina-backup.zip'") && method === 'GET') {
        return jsonResponse({ files: [{ id: 'zip-file-99', name: 'lumina-backup.zip' }] })
      }
      if (url.includes('/upload/drive/v3/files/zip-file-99?uploadType=multipart') && method === 'PATCH') {
        return jsonResponse({ id: 'zip-file-99', name: 'lumina-backup.zip', webViewLink: 'https://drive/zip' })
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await backupWorkspaceToDrive('zip', (e) => progressEvents.push(e))

    expect(result).toMatchObject({
      success: true,
      mode: 'zip',
      updated: true,
      fileId: 'zip-file-99'
    })
    expect(mockInvoke).toHaveBeenCalledWith('build_workspace_zip_bytes')
    expect(progressEvents[0]).toMatchObject({ stage: 'scanning', progress: 5 })
    expect(progressEvents.some((e) => e.stage === 'uploading' && e.progress === 40)).toBe(true)
    expect(progressEvents[progressEvents.length - 1]).toMatchObject({
      stage: 'completed',
      progress: 100
    })
  })

  it('refreshes OAuth token on 401 and retries, handles cancellation, and emits error stage when unauthenticated', async () => {
    // 1. Unauthenticated -> error stage, never completed
    const errEvents: any[] = []
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_google_access_token') return { error: 'Not logged in to Google' }
      return null
    })
    const errRes = await backupFileToDrive({ relativePath: 'a.md', code: 'x' }, (e) =>
      errEvents.push(e)
    )
    expect(errRes).toEqual({ success: false, error: 'Not logged in to Google' })
    expect(errEvents[errEvents.length - 1]).toMatchObject({ stage: 'error', progress: 0 })

    // 2. 401 -> forceRefresh retry
    let rootQueryCount = 0
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'get_google_access_token') {
        return { accessToken: args?.forceRefresh ? 'fresh-token' : 'stale-token' }
      }
      if (cmd === 'read_asset_bytes') return new TextEncoder().encode('hello').buffer
      return null
    })
    const retryFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      if (url.includes("name%3D'lumina'") && rootQueryCount === 0) {
        rootQueryCount++
        expect(headers.get('Authorization')).toBe('Bearer stale-token')
        return new Response('Unauthorized', { status: 401 })
      }
      if (url.includes("name%3D'lumina'")) {
        expect(headers.get('Authorization')).toBe('Bearer fresh-token')
        return jsonResponse({ files: [{ id: 'root-lumina', name: 'lumina' }] })
      }
      if (url.includes("name%3D'a.md'")) return jsonResponse({ files: [] })
      return jsonResponse({ id: 'file-ok' })
    })
    vi.stubGlobal('fetch', retryFetch)

    const retryRes = await backupFileToDrive({ relativePath: 'a.md', title: 'a' })
    expect(retryRes.success).toBe(true)
    expect(mockInvoke).toHaveBeenCalledWith('get_google_access_token', { forceRefresh: true })

    // 3. Cancellation via cancelGoogleDriveBackup
    const cancelEvents: any[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The user aborted a request.')
            err.name = 'AbortError'
            reject(err)
          })
        })
      })
    )
    const pendingPush = backupFileToDrive({ relativePath: 'a.md', title: 'a' }, (e) =>
      cancelEvents.push(e)
    )
    await new Promise((r) => setTimeout(r, 10))
    const didCancel = await cancelGoogleDriveBackup()
    const cancelRes = await pendingPush

    expect(didCancel).toBe(true)
    expect(cancelRes).toEqual({ success: false, cancelled: true })
    expect(cancelEvents[cancelEvents.length - 1]).toMatchObject({ stage: 'cancelled', progress: 0 })
  })
})
