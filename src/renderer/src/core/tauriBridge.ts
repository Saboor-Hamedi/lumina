/**
 * Lumina Native Tauri 2.0 API Bridge
 *
 * Exposes `window.api` backed by native Rust Tauri invocations and
 * Tauri 2.0 window/event primitives.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import {
  listEmails,
  getEmailDetails,
  sendEmail,
  modifyEmailLabels,
  trashEmail,
  getUnreadEmailCount,
  listEmailLabels,
  pickEmailAttachments,
  showEmailNotification
} from './gmailClient'
let exportEnginePromise: Promise<typeof import('../features/export/exportEngine')> | null = null
const loadExportEngine = () => (exportEnginePromise ??= import('../features/export/exportEngine'))

let googleDriveClientPromise: Promise<typeof import('./googleDriveClient')> | null = null
const loadGoogleDriveClient = () => (googleDriveClientPromise ??= import('./googleDriveClient'))

const batchProgressSubscribers = new Set<(p: any) => void>()
let batchProgressBridgeBound = false

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

let resizeFreezeTimer: ReturnType<typeof setTimeout> | null = null

export function markWindowResizing(): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.add('is-window-resizing')
  if (resizeFreezeTimer) clearTimeout(resizeFreezeTimer)
  resizeFreezeTimer = setTimeout(() => {
    document.documentElement.classList.remove('is-window-resizing')
    resizeFreezeTimer = null
  }, 260)
}

export async function setWindowBackgroundColor(color: string): Promise<void> {
  if (!isTauriRuntime || !/^#[0-9a-f]{6}$/i.test(color)) return
  await getCurrentWindow().setBackgroundColor(color).catch(() => {})
  await getCurrentWebview().setBackgroundColor(color).catch(() => {})
}

export function normalizeBinaryAsset(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  }
  if (Array.isArray(raw)) return new Uint8Array(raw)
  return new Uint8Array(0)
}

export async function invokeNative(cmd: string, args: Record<string, any> = {}): Promise<any> {
  if (isTauriRuntime) {
    return invoke(cmd, args)
  }
  return null
}

export async function minimizeWindow(): Promise<void> {
  if (isTauriRuntime) {
    await getCurrentWindow().minimize()
  } else {
    ;(window as any).api?.minimize?.()
  }
}

export async function toggleMaximizeWindow(): Promise<void> {
  markWindowResizing()
  if (isTauriRuntime) {
    await getCurrentWindow().toggleMaximize()
  } else {
    ;(window as any).api?.toggleMaximize?.()
  }
}

export async function closeWindow(): Promise<void> {
  if (isTauriRuntime) {
    await getCurrentWindow().close()
  } else {
    ;(window as any).api?.closeWindow?.()
  }
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length, 3)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

export function initTauriBridge(): void {
  if (typeof window === 'undefined') return
  // If window.api is already injected (e.g., unit test mocks), preserve it
  if ((window as any).api && !isTauriRuntime) return

  const settingsListeners = new Set<(s: any) => void>()
  const workspaceListeners = new Set<() => void>()
  const indexProgressListeners = new Set<(data: any) => void>()
  const updateListeners = new Set<(payload: { status: string; data?: any }) => void>()
  let latestReleaseInfo: { version: string; releaseNotes: string; releaseDate: string; url: string } | null = null

  const notifyWorkspaceUpdated = () => {
    workspaceListeners.forEach((cb) => {
      try {
        cb()
      } catch {}
    })
  }

  const emitBackupProgress = (data: any) => {
    indexProgressListeners.forEach((cb) => {
      try {
        cb(data)
      } catch {}
    })
  }

  const notifyUpdateStatus = (status: string, data?: any) => {
    updateListeners.forEach((cb) => {
      try {
        cb({ status, data })
      } catch {}
    })
  }

  if (isTauriRuntime) {
    listen('workspace:updated', () => {
      notifyWorkspaceUpdated()
    }).catch(() => {})

    listen<any>('backup:progress', (event) => {
      indexProgressListeners.forEach((cb) => {
        try {
          cb(event.payload)
        } catch {}
      })
    }).catch(() => {})
  }

  const getAppVersion = async (): Promise<string> => {
    if (isTauriRuntime) {
      try {
        const mod = await import('@tauri-apps/api/app')
        const ver = await mod.getVersion()
        if (ver) return ver
      } catch {}
    }
    return '1.1.2'
  }

  const tauriApi = {
    getPathForFile: (file: any) => file?.path || file?.name || '',

    // Workspace & Notes
    getSnippets: () => invoke('get_snippets'),
    getNotes: () => invoke('get_snippets'),
    readSnippet: (id: string) => invoke('read_snippet', { id }),
    readNotePreview: (id: string) => invoke('read_snippet', { id }),
    saveSnippet: async (snippet: any) => {
      const res = await invoke('save_snippet', { snippet })
      return res
    },
    saveNote: async (note: any) => {
      const res = await invoke('save_snippet', { snippet: note })
      return res
    },
    deleteSnippet: async (id: string) => {
      const res = await invoke('delete_snippet', { id })
      notifyWorkspaceUpdated()
      return res
    },
    deleteNote: async (id: string) => {
      const res = await invoke('delete_snippet', { id })
      notifyWorkspaceUpdated()
      return res
    },
    deleteAsset: (relativePath: string) => invoke('delete_snippet', { id: relativePath }),
    readAsset: async (relativePath: string) => {
      const raw = await invoke<unknown>('read_asset_bytes', { relativePath })
      return normalizeBinaryAsset(raw)
    },
    readClipboardImageBuffer: async (): Promise<Uint8Array | null> => {
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return null
        const items = await navigator.clipboard.read()
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            return new Uint8Array(await blob.arrayBuffer())
          }
        }
      } catch {
        /* Clipboard unavailable or does not contain an image */
      }
      return null
    },
    writeImageToClipboard: async (dataUrl: string): Promise<boolean> => {
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
          return false
        }
        const response = await fetch(dataUrl)
        const blob = await response.blob()
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
        return true
      } catch {
        return false
      }
    },
    saveImage: (buffer: Uint8Array | number[], name?: string) =>
      invoke('save_workspace_image', {
        bytes: Array.from(buffer || []),
        targetFolder: '',
        name: name || null
      }),
    saveImageFromPath: (filePath: string, filename?: string) =>
      invoke<string | null>('save_image_from_path', {
        filePath,
        filename: filename || null
      }),
    saveWorkspaceImage: (buffer: Uint8Array | number[], targetFolder?: string, name?: string) =>
      invoke('save_workspace_image', {
        bytes: Array.from(buffer || []),
        targetFolder: targetFolder || '',
        name: name || null
      }),
    saveVaultImage: (buffer: Uint8Array | number[], targetFolder?: string, name?: string) =>
      invoke('save_workspace_image', {
        bytes: Array.from(buffer || []),
        targetFolder: targetFolder || '',
        name: name || null
      }),
    cleanOrphans: () => invoke<{ deleted: number }>('clean_orphans'),

    openWorkspaceFolder: (relativePath = '') => invoke('open_path_in_os', { path: relativePath }),
    openVaultFolder: (relativePath = '') => invoke('open_path_in_os', { path: relativePath }),
    openPath: (filePath: string) => invoke('open_path_in_os', { path: filePath }),
    openExternal: (url: string) => invoke('open_path_in_os', { path: url }),
    showItemInFolder: (filePath: string) => invoke('reveal_path_in_os', { path: filePath }),
    selectWorkspace: async () => {
      const res = await invoke('select_workspace')
      if (res) notifyWorkspaceUpdated()
      return res
    },
    selectVault: async () => {
      const res = await invoke('select_workspace')
      if (res) notifyWorkspaceUpdated()
      return res
    },

    createFolder: (path: string) => invoke('create_folder', { path }),
    renameFolder: (oldPath: string, newPath: string) =>
      invoke('rename_folder', { oldPath, newPath }),
    moveFile: (oldRelPath: string, newRelPath: string) =>
      invoke('move_file', { oldRelPath, newRelPath }),
    moveFiles: (moves: any[]) => invoke('move_files', { moves }),
    deleteFolder: (path: string) => invoke('delete_folder', { path }),
    bulkDelete: ({ folderIds, snippetIds }: { folderIds?: string[]; snippetIds?: string[] }) =>
      invoke('bulk_delete', { folderIds, snippetIds }),
    deleteChunks: async () => true,
    importExternalPaths: (paths: string[], targetFolder = '') =>
      invoke('import_external_paths', { paths, targetFolder: targetFolder || '' }),

    onWorkspaceUpdated: (cb: () => void) => {
      workspaceListeners.add(cb)
      return () => workspaceListeners.delete(cb)
    },
    onVaultUpdated: (cb: () => void) => {
      workspaceListeners.add(cb)
      return () => workspaceListeners.delete(cb)
    },

    // Settings & Theme
    getSetting: (key?: string) => invoke('get_setting', { key: key ?? null }),
    saveSetting: async (key: string, value: any) => {
      const res = await invoke('save_setting', { key, value })
      settingsListeners.forEach((cb) => cb({ [key]: value }))
      return res
    },
    saveSettings: async (newSettings: Record<string, any>) => {
      const res = await invoke('save_settings', { newSettings })
      settingsListeners.forEach((cb) => cb(newSettings))
      return res
    },
    getTheme: () => invoke('get_setting', { key: 'theme' }),
    saveTheme: (theme: string) => invoke('save_setting', { key: 'theme', value: theme }),
    onSettingsChanged: (cb: (s: any) => void) => {
      settingsListeners.add(cb)
      return () => settingsListeners.delete(cb)
    },

    // Memory
    loadMemory: () => invoke('load_memory'),
    saveMemory: (memory: any) => invoke('save_memory', { memory }),
    getUserMemory: () => invoke('load_memory'),
    saveUserMemory: (memory: any) => invoke('save_memory', { memory }),

    // Document Export Pipeline (lazy-loaded on first export / preview open)
    exportPreview: async (payload: any) => (await loadExportEngine()).exportPreview(payload),
    exportHTML: async (payload: any) => (await loadExportEngine()).exportHTML(payload),
    exportPDF: async (payload: any) => (await loadExportEngine()).exportPDF(payload),
    exportDocs: async (payload: any) => (await loadExportEngine()).exportDocs(payload),
    exportMarkdown: async (payload: any) => (await loadExportEngine()).exportMarkdown(payload),
    exportMarkdownBundle: async (payload: any) => (await loadExportEngine()).exportMarkdownBundle(payload),
    exportZip: async (payload: any) => (await loadExportEngine()).exportZip(payload),
    exportText: async (payload: any) => (await loadExportEngine()).exportText(payload),
    exportBatch: async (payload: any) => (await loadExportEngine()).exportBatch(payload),
    exportCombined: async (payload: any) => (await loadExportEngine()).exportCombined(payload),
    onBatchExportProgress: (callback: (p: any) => void) => {
      batchProgressSubscribers.add(callback)
      void loadExportEngine().then((mod) => {
        if (!batchProgressBridgeBound) {
          batchProgressBridgeBound = true
          mod.onBatchExportProgress((progress) => {
            batchProgressSubscribers.forEach((fn) => {
              try {
                fn(progress)
              } catch {}
            })
          })
        }
      })
      return () => {
        batchProgressSubscribers.delete(callback)
      }
    },

    // Direct Google Drive Push Pipeline (Single, Bulk Folder, and ZIP Backup)
    backupWorkspace: async (mode: 'zip' | 'folder' = 'zip') =>
      (await loadGoogleDriveClient()).backupWorkspaceToDrive(mode, emitBackupProgress),
    backupFile: async (note: any) =>
      (await loadGoogleDriveClient()).backupFileToDrive(note, emitBackupProgress),
    cancelBackup: async () =>
      (await loadGoogleDriveClient()).cancelGoogleDriveBackup(),

    // Dialogs
    confirmDelete: async (msg: string) => window.confirm(msg || 'Are you sure?'),
    confirmWorkspaceChange: async () => true,
    openFile: () => invoke('open_file_dialog'),

    // Window Controls
    minimize: () => minimizeWindow(),
    toggleMaximize: () => toggleMaximizeWindow(),
    isMaximized: async () => (isTauriRuntime ? getCurrentWindow().isMaximized() : false),
    setWindowBackgroundColor: (color: string) => setWindowBackgroundColor(color),
    onMaximizedChange: (cb: (isMax: boolean) => void) => {
      if (!isTauriRuntime) return () => {}
      let unlisten: (() => void) | null = null
      let rafId = 0
      let lastMax: boolean | null = null
      getCurrentWindow()
        .onResized(() => {
          markWindowResizing()
          if (rafId) cancelAnimationFrame(rafId)
          rafId = requestAnimationFrame(async () => {
            rafId = 0
            try {
              const max = await getCurrentWindow().isMaximized()
              if (typeof document !== 'undefined') {
                document.documentElement.setAttribute('data-window-maximized', String(max))
              }
              if (max !== lastMax) {
                lastMax = max
                cb(max)
              }
            } catch {}
          })
        })
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
      return () => {
        if (rafId) cancelAnimationFrame(rafId)
        if (unlisten) unlisten()
      }
    },
    openDevTools: async () => {},
    closeWindow: () => closeWindow(),
    quitApp: () => closeWindow(),
    setWindowOpacity: async () => true,
    getWindowOpacity: async () => 1.0,
    moveWindow: async (deltaX: number, deltaY: number) => {
      if (!isTauriRuntime) return
      const win = getCurrentWindow()
      const pos = await win.outerPosition()
      await win.setPosition(new PhysicalPosition(pos.x + deltaX, pos.y + deltaY))
    },
    getWindowPosition: async () => {
      if (!isTauriRuntime) return { x: 0, y: 0 }
      const pos = await getCurrentWindow().outerPosition()
      return { x: pos.x, y: pos.y }
    },
    setWindowPosition: async (x: number, y: number) => {
      if (!isTauriRuntime) return
      await getCurrentWindow().setPosition(new PhysicalPosition(Math.round(x), Math.round(y)))
    },
    onToggleCommandPalette: () => () => {},
    getVersion: () => getAppVersion(),
    isPackaged: async () => !import.meta.env.DEV,
    onAppError: () => () => {},

    // Lightweight GitHub Releases Update Check
    checkForUpdates: async () => {
      notifyUpdateStatus('checking')
      try {
        const currentVer = await getAppVersion()
        const signal = typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function'
          ? (AbortSignal as any).timeout(3500)
          : undefined
        const res = await fetch('https://api.github.com/repos/Saboor-Hamedi/lumina/releases/latest', {
          headers: { Accept: 'application/vnd.github+json' },
          signal
        })
        if (!res.ok) {
          notifyUpdateStatus('not-available', { version: currentVer })
          return { updateAvailable: false }
        }
        const release = await res.json()
        const tag = String(release?.tag_name || '').trim()
        const remoteVer = tag.replace(/^v/i, '')
        if (remoteVer && compareSemver(remoteVer, currentVer) > 0) {
          latestReleaseInfo = {
            version: remoteVer,
            releaseNotes: String(release?.body || ''),
            releaseDate: String(release?.published_at || ''),
            url: String(release?.html_url || 'https://github.com/Saboor-Hamedi/lumina/releases')
          }
          notifyUpdateStatus('available', latestReleaseInfo)
          return { updateAvailable: true, ...latestReleaseInfo }
        }
        notifyUpdateStatus('not-available', { version: currentVer })
        return { updateAvailable: false }
      } catch {
        notifyUpdateStatus('not-available')
        return { updateAvailable: false }
      }
    },
    downloadUpdate: async () => {
      const targetUrl = latestReleaseInfo?.url || 'https://github.com/Saboor-Hamedi/lumina/releases'
      try {
        await invoke('open_path_in_os', { path: targetUrl })
      } catch {
        if (typeof window !== 'undefined') window.open(targetUrl, '_blank', 'noopener,noreferrer')
      }
      if (latestReleaseInfo) {
        notifyUpdateStatus('available', latestReleaseInfo)
      } else {
        notifyUpdateStatus('not-available')
      }
    },
    cancelUpdate: async () => {},
    quitAndInstall: async () => {
      const targetUrl = latestReleaseInfo?.url || 'https://github.com/Saboor-Hamedi/lumina/releases'
      await invoke('open_path_in_os', { path: targetUrl })
    },
    onUpdateStatus: (cb: (payload: { status: string; data?: any }) => void) => {
      updateListeners.add(cb)
      return () => updateListeners.delete(cb)
    },

    // Indexing & Search (Native Rust Rayon Engine)
    indexWorkspace: async () => ({ indexed: true }),
    indexVault: async () => ({ indexed: true }),
    rebuildIndex: async () => ({ indexed: true }),
    getIndexStats: async () => ({ totalChunks: 0, indexedFiles: 0 }),
    onIndexProgress: (cb: (data: any) => void) => {
      indexProgressListeners.add(cb)
      return () => indexProgressListeners.delete(cb)
    },
    searchWorkspace: (query: string, options?: any) =>
      invoke('search_workspace', { query: query || '', limit: options?.limit ?? 40 }),
    searchVault: (query: string, options?: any) =>
      invoke('search_workspace', { query: query || '', limit: options?.limit ?? 40 }),
    searchNotes: (items: any[], query: string, limit = 40) =>
      invoke('search_notes', { items, query, limit }),
    buildGraphData: (notes: any[]) => invoke('build_graph_data', { notes }),
    getSearchStats: async () => ({ totalDocuments: 0 }),
    findSimilar: async () => [],
    searchBrain: async () => [],
    getBrainStats: async () => ({ totalDocuments: 0 }),
    reindexBrain: async () => true,
    logError: async () => {},

    // Terminal Engine (ConPTY via Tauri)
    terminalGetAvailableShells: () => invoke('terminal_get_shells'),
    terminalSpawn: (payload: any) => invoke('terminal_spawn', { payload }),
    terminalAttach: async () => ({ exists: false }),
    terminalWrite: ({ sessionId, data }: { sessionId: string; data: string }) =>
      invoke('pty_write_tauri', { sessionId, data }),
    terminalResize: ({ sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) =>
      invoke('pty_resize_tauri', { sessionId, cols, rows }),
    terminalKill: (sessionId: string) => invoke('pty_kill_tauri', { sessionId }),
    onTerminalData: (sessionId: string, callback: (data: string) => void) => {
      if (!isTauriRuntime) return () => {}
      let unlisten: (() => void) | null = null
      listen<string>(`terminal:data:${sessionId}`, (event) => {
        callback(event.payload)
      })
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
      return () => {
        if (unlisten) unlisten()
      }
    },
    onTerminalExit: (sessionId: string, callback: (code: number) => void) => {
      if (!isTauriRuntime) return () => {}
      let unlisten: (() => void) | null = null
      listen<number>(`terminal:exit:${sessionId}`, (event) => {
        callback(event.payload)
      })
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
      return () => {
        if (unlisten) unlisten()
      }
    },

    pauseGlobalShortcuts: async () => {},
    resumeGlobalShortcuts: async () => {},
    isCapsLockOn: async () => false,

    // Google OAuth & Gmail
    loginWithGoogle: (clientId: string) => invoke('login_with_google', { clientId }),
    getGoogleUser: () => invoke('get_google_user'),
    logoutFromGoogle: () => invoke('logout_from_google'),
    listEmails,
    getEmailDetails,
    sendEmail,
    modifyEmailLabels,
    trashEmail,
    getUnreadEmailCount,
    listEmailLabels,
    pickEmailAttachments,
    showEmailNotification
  }

  ;(window as any).api = tauriApi
}

export const isTauri = isTauriRuntime
export default invokeNative
