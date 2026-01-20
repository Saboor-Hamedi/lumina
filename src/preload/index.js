import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// High-performance Robust API Bridge
const api = {
  // Vault Ops
  getSnippets: () => electronAPI.ipcRenderer.invoke('vault:getSnippets'),
  saveSnippet: (snippet) => electronAPI.ipcRenderer.invoke('vault:saveSnippet', snippet),
  saveImage: (buffer, name) => electronAPI.ipcRenderer.invoke('vault:saveImage', { buffer, name }),
  deleteSnippet: (id) => electronAPI.ipcRenderer.invoke('vault:deleteSnippet', id),
  openVaultFolder: () => electronAPI.ipcRenderer.invoke('vault:open-folder'),
  selectVault: () => electronAPI.ipcRenderer.invoke('vault:select-folder'),

  // Settings & Theme
  getSetting: (key) => electronAPI.ipcRenderer.invoke('db:getSetting', key),
  saveSetting: (key, value) => electronAPI.ipcRenderer.invoke('db:saveSetting', key, value),
  getTheme: () => electronAPI.ipcRenderer.invoke('db:getTheme'),
  saveTheme: (theme) => electronAPI.ipcRenderer.invoke('db:saveTheme', theme),
  onSettingsChanged: (callback) => {
    const listener = (_, settings) => callback(settings)
    electronAPI.ipcRenderer.on('settings:changed', listener)
    return () => electronAPI.ipcRenderer.removeListener('settings:changed', listener)
  },

  // Dialogs
  confirmDelete: (msg) => electronAPI.ipcRenderer.invoke('confirm-delete', msg),

  // Window controls
  minimize: () => electronAPI.ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => electronAPI.ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => electronAPI.ipcRenderer.invoke('window:close'),
  setTranslucency: (enabled) => electronAPI.ipcRenderer.invoke('window:set-translucency', enabled),
  getVersion: () => electronAPI.ipcRenderer.invoke('app:getVersion'),
  // Auto-Updater
  checkForUpdates: () => electronAPI.ipcRenderer.invoke('update:check'),
  downloadUpdate: () => electronAPI.ipcRenderer.invoke('update:download'),
  quitAndInstall: () => electronAPI.ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb) => {
    const listener = (_, status) => cb(status)
    electronAPI.ipcRenderer.on('update:status', listener)
    return () => electronAPI.ipcRenderer.removeListener('update:status', listener)
  },

  // Export
  exportPDF: (payload) => electronAPI.ipcRenderer.invoke('window:export-pdf', payload),
  exportHTML: (payload) => electronAPI.ipcRenderer.invoke('window:export-html', payload),
  exportMarkdown: (payload) => electronAPI.ipcRenderer.invoke('window:export-markdown', payload),

  // Vault Indexing
  indexVault: (vaultPath, options) => electronAPI.ipcRenderer.invoke('vault:index', vaultPath, options),
  rebuildIndex: (vaultPath) => electronAPI.ipcRenderer.invoke('vault:rebuild-index', vaultPath),
  getIndexStats: () => electronAPI.ipcRenderer.invoke('vault:index-stats'),

  // Vault Search
  searchVault: (query, options) => electronAPI.ipcRenderer.invoke('vault:search', query, options),
  getSearchStats: () => electronAPI.ipcRenderer.invoke('vault:search-stats'),
  findSimilar: (chunkId, limit) => electronAPI.ipcRenderer.invoke('vault:find-similar', chunkId, limit),

  // Error Logging
  logError: (errorData) => electronAPI.ipcRenderer.invoke('error:log', errorData)
}

// Expose APIs
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    // Forward uncaught errors/unhandled rejections to main process and open DevTools on first error
    try {
      let devtoolsOpened = false
      window.addEventListener('error', (evt) => {
        try {
          const payload = {
            type: 'error',
            message: evt.message,
            filename: evt.filename,
            lineno: evt.lineno,
            colno: evt.colno,
            error: (evt.error && evt.error.stack) ? evt.error.stack : undefined,
            time: Date.now()
          }
          electronAPI.ipcRenderer.send('renderer:log', payload)
          if (!devtoolsOpened) {
            devtoolsOpened = true
            electronAPI.ipcRenderer.invoke('window:open-devtools')
          }
        } catch (e) {
          // ignore
        }
      })

      window.addEventListener('unhandledrejection', (evt) => {
        try {
          const reason = evt.reason
          const payload = {
            type: 'unhandledrejection',
            message: reason && reason.message ? reason.message : String(reason),
            error: reason && reason.stack ? reason.stack : undefined,
            time: Date.now()
          }
          electronAPI.ipcRenderer.send('renderer:log', payload)
          if (!devtoolsOpened) {
            devtoolsOpened = true
            electronAPI.ipcRenderer.invoke('window:open-devtools')
          }
        } catch (e) {
          // ignore
        }
      })
    } catch (e) {
      // ignore
    }
  } catch (error) {
    console.error('Preload Bridge Error:', error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
