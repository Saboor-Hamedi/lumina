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
  let latestReleaseInfo: {
    version: string
    releaseNotes: string
    releaseDate: string
    url: string
    assetUrl?: string
    assetName?: string
    assetSize?: number
    assetSha256?: string | null
  } | null = null
  let downloadedInstallerPath: string | null = null

  const pickPlatformAsset = (
    assets: any[]
  ): { url: string; name: string; size: number; sha256?: string | null } | null => {
    if (!Array.isArray(assets) || assets.length === 0) return null
    const ua =
      typeof navigator !== 'undefined'
        ? (navigator.platform || navigator.userAgent || '').toLowerCase()
        : ''
    const findBy = (pred: (name: string) => boolean) =>
      assets.find((a) => typeof a?.name === 'string' && pred(a.name.toLowerCase()))

    let chosen: any = null
    if (ua.includes('win')) {
      chosen =
        findBy((n) => n.endsWith('-setup.exe') || n.endsWith('.exe')) ||
        findBy((n) => n.endsWith('.msi'))
    } else if (ua.includes('mac')) {
      chosen =
        findBy((n) => n.includes('universal') && n.endsWith('.dmg')) ||
        findBy((n) => n.endsWith('.dmg'))
    } else {
      chosen =
        findBy((n) => n.endsWith('.appimage')) ||
        findBy((n) => n.endsWith('.deb'))
    }

    const downloadUrl = chosen?.browserDownloadUrl || chosen?.browser_download_url
    if (!downloadUrl) return null
    return {
      url: String(downloadUrl),
      name: String(chosen.name),
      size: Number(chosen.size) || 0,
      sha256: chosen?.sha256 || null
    }
  }

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

  let lastIndexStats = { totalChunks: 0, indexedFiles: 0, lastIndexedAt: 0 }
  let downloadedInstallerVersion: string | null = null
  let activeDownloadPromise: Promise<void> | null = null

  const downloadReleaseAsset = async (openBrowserFallback = false): Promise<void> => {
    if (activeDownloadPromise) return activeDownloadPromise

    if (latestReleaseInfo?.assetUrl && latestReleaseInfo?.assetName) {
      if (downloadedInstallerPath && downloadedInstallerVersion === latestReleaseInfo.version) {
        notifyUpdateStatus('ready', latestReleaseInfo)
        return
      }

      activeDownloadPromise = (async () => {
        let unlisten: (() => void) | null = null
        try {
          notifyUpdateStatus('downloading', {
            percent: 0,
            transferred: 0,
            total: latestReleaseInfo.assetSize || 0
          })
          unlisten = await listen<any>('update-download-progress', (ev) => {
            notifyUpdateStatus('downloading', ev.payload || { percent: 0 })
          })
          const savedPath = await invoke<string>('download_app_update', {
            url: latestReleaseInfo.assetUrl,
            fileName: latestReleaseInfo.assetName,
            expectedSha256: latestReleaseInfo.assetSha256 || null
          })
          downloadedInstallerPath = savedPath
          downloadedInstallerVersion = latestReleaseInfo.version || null
          notifyUpdateStatus('ready', latestReleaseInfo)
        } catch (err: any) {
          const msg = String(err || '')
          if (msg.includes('cancelled')) {
            notifyUpdateStatus('available', latestReleaseInfo)
          } else if (openBrowserFallback) {
            const fallbackUrl =
              latestReleaseInfo?.assetUrl ||
              latestReleaseInfo?.url ||
              'https://github.com/Saboor-Hamedi/lumina/releases'
            try {
              await invoke('open_path_in_os', { path: fallbackUrl })
            } catch {
              if (typeof window !== 'undefined') {
                window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
              }
            }
            notifyUpdateStatus('available', latestReleaseInfo)
          } else {
            notifyUpdateStatus('error', msg || 'Download failed')
          }
        } finally {
          if (unlisten) unlisten()
          activeDownloadPromise = null
        }
      })()

      return activeDownloadPromise
    }

    if (openBrowserFallback) {
      const targetUrl =
        latestReleaseInfo?.assetUrl ||
        latestReleaseInfo?.url ||
        'https://github.com/Saboor-Hamedi/lumina/releases'
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
    }
  }

  const emitIndexProgress = (data: any) => {
    indexProgressListeners.forEach((cb) => {
      try {
        cb(data)
      } catch {}
    })
  }

  const runWorkspaceIndexing = async (
    workspacePath?: string | null,
    options: { force?: boolean; onProgress?: ((p: number) => void) | null } = {}
  ) => {
    emitIndexProgress({ stage: 'starting', indexed: 0, total: 0, progress: 0 })
    const validPath = workspacePath && typeof workspacePath === 'string' ? workspacePath : null
    const scan = await invoke<any>('scan_workspace', { vaultPath: validPath })
    const notes: any[] = Array.isArray(scan?.notes) ? scan.notes : []
    const total = notes.length || Number(scan?.total_scanned) || 0

    if (!options.force && lastIndexStats.lastIndexedAt > 0 && total === lastIndexStats.indexedFiles) {
      emitIndexProgress({ stage: 'up-to-date', indexed: total, total, progress: 100 })
      options.onProgress?.(100)
      return { success: true, indexed: true, totalFiles: total }
    }

    const mid = Math.max(0, Math.floor(total * 0.5))
    emitIndexProgress({ stage: 'indexing', indexed: mid, total, progress: 50 })
    options.onProgress?.(50)

    const totalChunks = notes.reduce((acc, n) => {
      const len = typeof n?.content === 'string' ? n.content.length : 0
      return acc + Math.max(1, Math.ceil(len / 1000))
    }, 0)

    lastIndexStats = {
      totalChunks,
      indexedFiles: total,
      lastIndexedAt: Date.now()
    }

    emitIndexProgress({ stage: 'completed', indexed: total, total, progress: 100 })
    options.onProgress?.(100)
    return { success: true, indexed: true, totalFiles: total }
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
        targetFolder: '.lumina/assets',
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
    getRecentWorkspaces: () => invoke('get_recent_workspaces'),
    switchWorkspace: async (path: string) => {
      const res = await invoke('switch_workspace', { path })
      if (res) notifyWorkspaceUpdated()
      return res
    },
    removeRecentWorkspace: (path: string) => invoke('remove_recent_workspace', { path }),

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
    setWindowOpacity: async (opacity: number) => {
      const num = typeof opacity === 'number' ? opacity : parseFloat(String(opacity))
      const normalized = isNaN(num) ? 1.0 : num > 1.0 ? Math.max(0.2, Math.min(1.0, num / 100)) : Math.max(0.2, Math.min(1.0, num))
      ;(window as any).__luminaWindowOpacity = normalized
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--app-opacity', String(normalized))
      }
      if (!isTauriRuntime) return true
      try {
        await invoke('set_window_opacity', { opacity: normalized })
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-native-opacity', 'true')
        }
        return true
      } catch {
        if (typeof document !== 'undefined') {
          document.documentElement.removeAttribute('data-native-opacity')
        }
        return false
      }
    },
    getWindowOpacity: async () => {
      return typeof (window as any).__luminaWindowOpacity === 'number'
        ? (window as any).__luminaWindowOpacity
        : 1.0
    },
    startWindowDrag: async () => {
      if (!isTauriRuntime) return
      await getCurrentWindow().startDragging()
    },
    moveWindow: (() => {
      let cachedPos: { x: number; y: number } | null = null
      let lastSyncAt = 0
      let pendingDeltaX = 0
      let pendingDeltaY = 0
      let inFlight = false

      const flushMove = async () => {
        if (inFlight || !isTauriRuntime) return
        inFlight = true
        try {
          const win = getCurrentWindow()
          const now = Date.now()
          if (!cachedPos || now - lastSyncAt > 400) {
            const p = await win.outerPosition()
            cachedPos = { x: p.x, y: p.y }
          }
          while (pendingDeltaX !== 0 || pendingDeltaY !== 0) {
            const dx = pendingDeltaX
            const dy = pendingDeltaY
            pendingDeltaX = 0
            pendingDeltaY = 0
            const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
            cachedPos.x = Math.round(cachedPos.x + dx * dpr)
            cachedPos.y = Math.round(cachedPos.y + dy * dpr)
            lastSyncAt = Date.now()
            await win.setPosition(new PhysicalPosition(cachedPos.x, cachedPos.y))
          }
        } catch {
          cachedPos = null
        } finally {
          inFlight = false
          if (pendingDeltaX !== 0 || pendingDeltaY !== 0) {
            void flushMove()
          }
        }
      }

      return async (deltaX: number, deltaY: number) => {
        if (!isTauriRuntime) return
        pendingDeltaX += deltaX
        pendingDeltaY += deltaY
        await flushMove()
      }
    })(),
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

    getGithubReleases: async (force = false) => {
      if (isTauriRuntime) {
        try {
          return await invoke<any>('get_github_releases', { force })
        } catch {}
      }
      const currentVer = await getAppVersion()
      const res = await fetch('https://api.github.com/repos/Saboor-Hamedi/lumina/releases?per_page=25', {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (!res.ok) return null
      const rawList = await res.json()
      if (!Array.isArray(rawList)) return null
      const releases = rawList
        .filter((r: any) => !r?.draft && r?.tag_name)
        .map((r: any, idx: number) => {
          const ver = String(r.tag_name || '').replace(/^v/i, '')
          return {
            id: Number(r.id) || idx + 1,
            tagName: String(r.tag_name),
            version: ver,
            name: String(r.name || `Lumina v${ver}`),
            body: String(r.body || ''),
            htmlUrl: String(r.html_url || 'https://github.com/Saboor-Hamedi/lumina/releases'),
            publishedAt: r.published_at || null,
            prerelease: Boolean(r.prerelease),
            isLatest: idx === 0,
            isInstalled: compareSemver(ver, currentVer) === 0,
            isNewerThanCurrent: compareSemver(ver, currentVer) > 0,
            assets: Array.isArray(r.assets)
              ? r.assets.map((a: any) => ({
                  name: String(a.name || ''),
                  browserDownloadUrl: String(a.browser_download_url || ''),
                  size: Number(a.size) || 0,
                  downloadCount: Number(a.download_count) || 0,
                  contentType: a.content_type || null,
                  sha256: typeof a.digest === 'string' ? a.digest.replace(/^sha256:/i, '') : null
                }))
              : []
          }
        })
      const latestVer = releases[0]?.version || currentVer
      return {
        currentVersion: currentVer,
        latestVersion: latestVer,
        updateAvailable: compareSemver(latestVer, currentVer) > 0,
        releases,
        fromCache: false,
        cachedAt: Math.floor(Date.now() / 1000),
        etag: null
      }
    },

    // Native Rust + ETag-Cached GitHub Releases Update Check
    checkForUpdates: async () => {
      notifyUpdateStatus('checking')
      try {
        const currentVer = await getAppVersion()
        let latestRelease: any = null

        // 1. Prefer Rust reqwest + ETag cache command (get_github_releases)
        if (isTauriRuntime) {
          try {
            const payload = await invoke<any>('get_github_releases', { force: false })
            if (payload && Array.isArray(payload.releases) && payload.releases.length > 0) {
              latestRelease =
                payload.releases.find((r: any) => r.isLatest) ||
                payload.releases.find((r: any) => !r.prerelease) ||
                payload.releases[0]
            }
          } catch {}
        }

        // 2. Fallback to direct GitHub API fetch if Rust command wasn't available
        if (!latestRelease) {
          const signal =
            typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function'
              ? (AbortSignal as any).timeout(8000)
              : undefined
          const res = await fetch('https://api.github.com/repos/Saboor-Hamedi/lumina/releases/latest', {
            headers: { Accept: 'application/vnd.github+json' },
            signal
          })
          if (res.ok) {
            latestRelease = await res.json()
          }
        }

        if (!latestRelease) {
          notifyUpdateStatus('not-available', { version: currentVer })
          return { updateAvailable: false }
        }

        const tag = String(latestRelease?.tagName || latestRelease?.tag_name || latestRelease?.version || '').trim()
        const remoteVer = tag.replace(/^v/i, '')
        if (remoteVer && compareSemver(remoteVer, currentVer) > 0) {
          const asset = pickPlatformAsset(latestRelease?.assets)
          latestReleaseInfo = {
            version: remoteVer,
            releaseNotes: String(latestRelease?.body || ''),
            releaseDate: String(latestRelease?.publishedAt || latestRelease?.published_at || ''),
            url: String(
              latestRelease?.htmlUrl ||
                latestRelease?.html_url ||
                'https://github.com/Saboor-Hamedi/lumina/releases'
            ),
            assetUrl: asset?.url,
            assetName: asset?.name,
            assetSize: asset?.size,
            assetSha256: asset?.sha256 || null
          }
          if (downloadedInstallerPath && downloadedInstallerVersion === remoteVer) {
            notifyUpdateStatus('ready', latestReleaseInfo)
          } else {
            notifyUpdateStatus('available', latestReleaseInfo)
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('lumina-update-detected', { detail: { version: remoteVer } })
            )
          }
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
      await downloadReleaseAsset(true)
    },
    cancelUpdate: async () => {
      await invoke('cancel_app_update').catch(() => {})
    },
    quitAndInstall: async () => {
      if (downloadedInstallerPath) {
        notifyUpdateStatus('installing', latestReleaseInfo)
        try {
          await invoke('install_app_update', { filePath: downloadedInstallerPath })
          notifyUpdateStatus('ready', latestReleaseInfo)
          return
        } catch (err: any) {
          notifyUpdateStatus('error', String(err || 'Failed to launch installer'))
          return
        }
      }
      const targetUrl =
        latestReleaseInfo?.assetUrl ||
        latestReleaseInfo?.url ||
        'https://github.com/Saboor-Hamedi/lumina/releases'
      await invoke('open_path_in_os', { path: targetUrl })
    },
    onUpdateStatus: (cb: (payload: { status: string; data?: any }) => void) => {
      updateListeners.add(cb)
      return () => updateListeners.delete(cb)
    },

    // Indexing & Search (Native Rust Rayon Engine)
    indexWorkspace: (workspacePath?: string | null, options?: { force?: boolean; onProgress?: ((p: number) => void) | null }) =>
      runWorkspaceIndexing(workspacePath, options),
    indexVault: (vaultPath?: string | null, options?: { force?: boolean; onProgress?: ((p: number) => void) | null }) =>
      runWorkspaceIndexing(vaultPath, options),
    rebuildIndex: (workspacePath?: string | null) =>
      runWorkspaceIndexing(workspacePath, { force: true }),
    getIndexStats: async () => {
      if (lastIndexStats.lastIndexedAt === 0 && isTauriRuntime) {
        try {
          const scan = await invoke<any>('scan_workspace', { vaultPath: null })
          const notes: any[] = Array.isArray(scan?.notes) ? scan.notes : []
          const total = notes.length || Number(scan?.total_scanned) || 0
          const totalChunks = notes.reduce((acc, n) => {
            const len = typeof n?.content === 'string' ? n.content.length : 0
            return acc + Math.max(1, Math.ceil(len / 1000))
          }, 0)
          lastIndexStats = { totalChunks, indexedFiles: total, lastIndexedAt: Date.now() }
        } catch {}
      }
      return { ...lastIndexStats }
    },
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
      let disposed = false
      let unlisten: (() => void) | null = null
      listen<string>(`terminal:data:${sessionId}`, (event) => {
        if (!disposed) callback(event.payload)
      })
        .then((fn) => {
          if (disposed) {
            fn()
          } else {
            unlisten = fn
          }
        })
        .catch(() => {})
      return () => {
        disposed = true
        if (unlisten) unlisten()
      }
    },
    onTerminalExit: (sessionId: string, callback: (code: number) => void) => {
      if (!isTauriRuntime) return () => {}
      let disposed = false
      let unlisten: (() => void) | null = null
      listen<number>(`terminal:exit:${sessionId}`, (event) => {
        if (!disposed) callback(event.payload)
      })
        .then((fn) => {
          if (disposed) {
            fn()
          } else {
            unlisten = fn
          }
        })
        .catch(() => {})
      return () => {
        disposed = true
        if (unlisten) unlisten()
      }
    },

    pauseGlobalShortcuts: async () => {},
    resumeGlobalShortcuts: async () => {},
    isCapsLockOn: async () => false,
    fetchLinkMetadata: (url: string) => invoke<any>('fetch_link_metadata', { url }),
    webSearch: (query: string, maxResults?: number) =>
      invoke<any>('web_search', { query, maxResults }),

    // Invisible SQLite FTS5 + Int8 Hybrid PDF Index
    pdfIndexFile: (relativePath: string) => invoke<any>('pdf_index_file', { relativePath }),
    pdfGetPendingChunks: (relativePath?: string | null, limit?: number) =>
      invoke<any>('pdf_get_pending_chunks', {
        relativePath: relativePath || null,
        limit: limit ?? 12
      }),
    pdfSaveEmbeddings: (entries: Array<{ chunkId: number; embedding: number[] }>) =>
      invoke<number>('pdf_save_embeddings', { entries }),
    pdfSearch: (
      query: string,
      options?: { queryEmbedding?: number[] | null; relativePath?: string | null; limit?: number }
    ) =>
      invoke<any>('pdf_search', {
        query,
        queryEmbedding: options?.queryEmbedding ?? null,
        relativePath: options?.relativePath ?? null,
        limit: options?.limit ?? 8
      }),
    pdfGetStatus: (relativePath: string) => invoke<any>('pdf_get_status', { relativePath }),
    pdfListDocuments: () => invoke<any>('pdf_list_documents'),
    pdfGetStats: () => invoke<any>('pdf_get_stats'),
    pdfRemoveDocument: (relativePath: string) =>
      invoke<boolean>('pdf_remove_document', { relativePath }),
    pdfPruneMissing: () => invoke<number>('pdf_prune_missing'),

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

  // Silently check and auto-download updates in the background shortly after desktop boot
  if (isTauriRuntime) {
    setTimeout(() => {
      void tauriApi.checkForUpdates()
    }, 3500)
  }
}

export const isTauri = isTauriRuntime
export default invokeNative
