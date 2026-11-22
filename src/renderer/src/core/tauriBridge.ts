/**
 * Lumina Native Tauri 2.0 API Bridge
 *
 * Exposes `window.api` backed by native Rust Tauri invocations and
 * Tauri 2.0 window/event primitives.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window'
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

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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

export function initTauriBridge(): void {
  if (typeof window === 'undefined') return
  // If window.api is already injected (e.g., unit test mocks), preserve it
  if ((window as any).api && !isTauriRuntime) return

  const settingsListeners = new Set<(s: any) => void>()
  const workspaceListeners = new Set<() => void>()

  const notifyWorkspaceUpdated = () => {
    workspaceListeners.forEach((cb) => {
      try {
        cb()
      } catch {}
    })
  }

  const tauriApi = {
    getPathForFile: (file: any) => file?.path || file?.name || '',

    // Workspace & Notes
    getSnippets: () => invoke('get_snippets'),
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
    deleteAsset: (relativePath: string) => invoke('delete_snippet', { id: relativePath }),
    readAsset: async (relativePath: string) => {
      const bytes = await invoke<number[]>('read_asset_bytes', { relativePath })
      return new Uint8Array(bytes)
    },
    saveImage: (buffer: Uint8Array | number[], name?: string) =>
      invoke('save_workspace_image', {
        bytes: Array.from(buffer || []),
        targetFolder: '',
        name: name || null
      }),
    saveImageFromPath: async () => null,
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
    cleanOrphans: async () => ({ deleted: 0 }),

    openWorkspaceFolder: (relativePath = '') => invoke('open_path_in_os', { path: relativePath }),
    openVaultFolder: (relativePath = '') => invoke('open_path_in_os', { path: relativePath }),
    openPath: (filePath: string) => invoke('open_path_in_os', { path: filePath }),
    openExternal: (url: string) => invoke('open_path_in_os', { path: url }),
    showItemInFolder: (filePath: string) => invoke('open_path_in_os', { path: filePath }),
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
    importExternalPaths: async () => ({ imported: 0 }),

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

    // Dialogs
    confirmDelete: async (msg: string) => window.confirm(msg || 'Are you sure?'),
    confirmWorkspaceChange: async () => true,
    openFile: async () => null,

    // Window Controls
    minimize: () => minimizeWindow(),
    toggleMaximize: () => toggleMaximizeWindow(),
    isMaximized: async () => (isTauriRuntime ? getCurrentWindow().isMaximized() : false),
    onMaximizedChange: (cb: (isMax: boolean) => void) => {
      if (!isTauriRuntime) return () => {}
      let unlisten: (() => void) | null = null
      getCurrentWindow()
        .onResized(async () => {
          const max = await getCurrentWindow().isMaximized()
          cb(max)
        })
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
      return () => {
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
    getVersion: async () => '1.1.2',
    isPackaged: async () => !import.meta.env.DEV,
    onAppError: () => () => {},

    // Auto-Updater stubs
    checkForUpdates: async () => ({ updateAvailable: false }),
    downloadUpdate: async () => {},
    cancelUpdate: async () => {},
    quitAndInstall: async () => {},
    onUpdateStatus: () => () => {},

    // Indexing & Search (Native Rust Rayon Engine)
    indexWorkspace: async () => ({ indexed: true }),
    indexVault: async () => ({ indexed: true }),
    rebuildIndex: async () => ({ indexed: true }),
    getIndexStats: async () => ({ totalChunks: 0, indexedFiles: 0 }),
    onIndexProgress: () => () => {},
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
