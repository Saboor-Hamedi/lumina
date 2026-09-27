import { contextBridge, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file)
      }
      return file?.path || ''
    } catch (e) {
      return file?.path || ''
    }
  },

  getSnippets: () => electronAPI.ipcRenderer.invoke('workspace:getSnippets'),
  readSnippet: (id) => electronAPI.ipcRenderer.invoke('workspace:readSnippet', id),
  readNotePreview: (id) => electronAPI.ipcRenderer.invoke('workspace:readNotePreview', id),
  saveSnippet: (snippet) => electronAPI.ipcRenderer.invoke('workspace:saveSnippet', snippet),
  saveImage: (buffer, name) => electronAPI.ipcRenderer.invoke('workspace:saveImage', { buffer, name }),
  saveImageFromPath: (filePath, name) =>
    electronAPI.ipcRenderer.invoke('workspace:saveImageFromPath', { filePath, name }),
  saveWorkspaceImage: (buffer, targetFolder, name) =>
    electronAPI.ipcRenderer.invoke('workspace:saveWorkspaceImage', { buffer, targetFolder, name }),
  saveVaultImage: (buffer, targetFolder, name) =>
    electronAPI.ipcRenderer.invoke('workspace:saveWorkspaceImage', { buffer, targetFolder, name }),
  deleteAsset: (relativePath) => electronAPI.ipcRenderer.invoke('workspace:deleteAsset', relativePath),
  deleteSnippet: (id) => electronAPI.ipcRenderer.invoke('workspace:deleteSnippet', id),
  readAsset: (relativePath) => electronAPI.ipcRenderer.invoke('workspace:readAsset', relativePath),
  writeImageToClipboard: (dataUrl) =>
    electronAPI.ipcRenderer.invoke('clipboard:writeImage', dataUrl),
  readClipboardImageBuffer: () =>
    electronAPI.ipcRenderer.invoke('clipboard:readImageBuffer'),
  cleanOrphans: () => electronAPI.ipcRenderer.invoke('workspace:cleanOrphans'),
  openWorkspaceFolder: (relativePath) =>
    electronAPI.ipcRenderer.invoke('workspace:open-folder', relativePath),
  openVaultFolder: (relativePath) =>
    electronAPI.ipcRenderer.invoke('workspace:open-folder', relativePath),
  selectWorkspace: () => electronAPI.ipcRenderer.invoke('workspace:select-folder'),
  selectVault: () => electronAPI.ipcRenderer.invoke('workspace:select-folder'),

  createFolder: (path) => electronAPI.ipcRenderer.invoke('workspace:createFolder', path),
  renameFolder: (oldPath, newPath) =>
    electronAPI.ipcRenderer.invoke('workspace:renameFolder', oldPath, newPath),
  moveFile: (oldRelPath, newRelPath) =>
    electronAPI.ipcRenderer.invoke('workspace:moveFile', oldRelPath, newRelPath),
  deleteFolder: (path) => electronAPI.ipcRenderer.invoke('workspace:deleteFolder', path),
  bulkDelete: ({ folderIds, snippetIds }) =>
    electronAPI.ipcRenderer.invoke('workspace:bulkDelete', { folderIds, snippetIds }),
  deleteChunks: (target) => electronAPI.ipcRenderer.invoke('workspace:deleteChunks', target),
  importExternalPaths: (sourcePaths, targetFolderId) =>
    electronAPI.ipcRenderer.invoke('workspace:importExternalPaths', { sourcePaths, targetFolderId }),

  onWorkspaceUpdated: (cb) => {
    const listener = () => cb()
    electronAPI.ipcRenderer.on('workspace:updated', listener)
    electronAPI.ipcRenderer.on('vault:updated', listener)
    return () => {
      electronAPI.ipcRenderer.removeListener('workspace:updated', listener)
      electronAPI.ipcRenderer.removeListener('vault:updated', listener)
    }
  },
  onVaultUpdated: (cb) => {
    const listener = () => cb()
    electronAPI.ipcRenderer.on('workspace:updated', listener)
    electronAPI.ipcRenderer.on('vault:updated', listener)
    return () => {
      electronAPI.ipcRenderer.removeListener('workspace:updated', listener)
      electronAPI.ipcRenderer.removeListener('vault:updated', listener)
    }
  },

  // Settings & Theme
  getSetting: (key) => electronAPI.ipcRenderer.invoke('db:getSetting', key),
  saveSetting: (key, value) =>
    electronAPI.ipcRenderer.invoke('db:saveSetting', key, value).catch(() => null),
  saveSettings: (settings) =>
    electronAPI.ipcRenderer.invoke('db:saveSettings', settings).catch(() => null),
  getTheme: () => electronAPI.ipcRenderer.invoke('db:getTheme'),
  saveTheme: (theme) => electronAPI.ipcRenderer.invoke('db:saveTheme', theme),
  onSettingsChanged: (callback) => {
    const listener = (_, settings) => callback(settings)
    electronAPI.ipcRenderer.on('settings:changed', listener)
    return () => electronAPI.ipcRenderer.removeListener('settings:changed', listener)
  },

  loadMemory: () => electronAPI.ipcRenderer.invoke('memory:load'),
  saveMemory: (memory) => electronAPI.ipcRenderer.invoke('memory:save', memory),
  getUserMemory: () => electronAPI.ipcRenderer.invoke('memory:load'),
  saveUserMemory: (memory) => electronAPI.ipcRenderer.invoke('memory:save', memory),

  // Dialogs
  confirmDelete: (msg) => electronAPI.ipcRenderer.invoke('confirm-delete', msg),
  openFile: () => electronAPI.ipcRenderer.invoke('dialog:openFile'),

  // Window controls
  minimize: () => electronAPI.ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => electronAPI.ipcRenderer.invoke('window:toggle-maximize'),
  isMaximized: () => electronAPI.ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (cb) => {
    const listener = (_, isMax) => cb(isMax)
    electronAPI.ipcRenderer.on('window:maximized-change', listener)
    return () => electronAPI.ipcRenderer.removeListener('window:maximized-change', listener)
  },
  closeWindow: () => electronAPI.ipcRenderer.invoke('window:close'),
  setWindowOpacity: (opacity) => electronAPI.ipcRenderer.invoke('window:set-opacity', opacity),
  getWindowOpacity: () => electronAPI.ipcRenderer.invoke('window:get-opacity'),
  onToggleCommandPalette: (cb) => {
    const listener = () => cb()
    electronAPI.ipcRenderer.on('window:toggle-command-palette', listener)
    return () => electronAPI.ipcRenderer.removeListener('window:toggle-command-palette', listener)
  },
  getVersion: () => electronAPI.ipcRenderer.invoke('app:getVersion'),
  isPackaged: () => electronAPI.ipcRenderer.invoke('app:isPackaged'),
  // Auto-Updater
  checkForUpdates: () => electronAPI.ipcRenderer.invoke('update:check'),
  downloadUpdate: () => electronAPI.ipcRenderer.invoke('update:download'),
  cancelUpdate: () => electronAPI.ipcRenderer.invoke('update:cancel'),
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
  exportMarkdownBundle: (payload) =>
    electronAPI.ipcRenderer.invoke('window:export-markdown-bundle', payload),
  exportText: (payload) => electronAPI.ipcRenderer.invoke('window:export-text', payload),
  exportDocs: (payload) => electronAPI.ipcRenderer.invoke('window:export-docs', payload),

  // Workspace Indexing
  indexWorkspace: (workspacePath, options) =>
    electronAPI.ipcRenderer.invoke('workspace:index', workspacePath, options),
  indexVault: (workspacePath, options) =>
    electronAPI.ipcRenderer.invoke('workspace:index', workspacePath, options),
  rebuildIndex: (workspacePath) => electronAPI.ipcRenderer.invoke('workspace:rebuild-index', workspacePath),
  getIndexStats: () => electronAPI.ipcRenderer.invoke('workspace:index-stats'),
  onIndexProgress: (cb) => {
    const listener = (_, stats) => cb(stats)
    electronAPI.ipcRenderer.on('index:progress', listener)
    return () => electronAPI.ipcRenderer.removeListener('index:progress', listener)
  },

  // Workspace Search
  searchWorkspace: (query, options) => electronAPI.ipcRenderer.invoke('workspace:search', query, options),
  searchVault: (query, options) => electronAPI.ipcRenderer.invoke('workspace:search', query, options),
  getSearchStats: () => electronAPI.ipcRenderer.invoke('workspace:search-stats'),
  findSimilar: (chunkId, limit) =>
    electronAPI.ipcRenderer.invoke('workspace:find-similar', chunkId, limit),

  // Brain Knowledge Base Search & Stats (silent, isolated)
  searchBrain: (query, options) => electronAPI.ipcRenderer.invoke('brain:search', query, options),
  getBrainStats: () => electronAPI.ipcRenderer.invoke('brain:stats'),
  reindexBrain: () => electronAPI.ipcRenderer.invoke('brain:reindex'),

  // Error Logging
  logError: (errorData) => electronAPI.ipcRenderer.invoke('error:log', errorData),

  // Image Generation (bypasses CSP by using main process)
  generateImage: (endpoint, headers, body) =>
    electronAPI.ipcRenderer.invoke('ai:generateImage', { endpoint, headers, body }),

  // Google Auth & Backup
  loginWithGoogle: (clientId) => electronAPI.ipcRenderer.invoke('auth:loginWithGoogle', clientId),
  backupWorkspace: (mode = 'zip') => electronAPI.ipcRenderer.invoke('backup:start', mode),
  backupFile: (fileInput) => electronAPI.ipcRenderer.invoke('backup:file', fileInput),
  cancelBackup: () => electronAPI.ipcRenderer.invoke('backup:cancel'),
  getGoogleUser: () => electronAPI.ipcRenderer.invoke('auth:getGoogleUser'),
  logoutFromGoogle: () => electronAPI.ipcRenderer.invoke('auth:logoutFromGoogle'),
  loadMemory: () => electronAPI.ipcRenderer.invoke('memory:load'),
  saveMemory: (memory) => electronAPI.ipcRenderer.invoke('memory:save', memory),

  // Gmail & Email Client
  listEmails: (params) => electronAPI.ipcRenderer.invoke('email:listMessages', params),
  getEmailDetails: (params) => electronAPI.ipcRenderer.invoke('email:getMessageDetails', params),
  sendEmail: (params) => electronAPI.ipcRenderer.invoke('email:sendMessage', params),
  modifyEmailLabels: (params) => electronAPI.ipcRenderer.invoke('email:modifyLabels', params),
  trashEmail: (params) => electronAPI.ipcRenderer.invoke('email:trashMessage', params),
  getUnreadEmailCount: () => electronAPI.ipcRenderer.invoke('email:getUnreadCount'),
  showEmailNotification: (params) => electronAPI.ipcRenderer.invoke('email:showNotification', params),
  pickEmailAttachments: () => electronAPI.ipcRenderer.invoke('email:pickAttachments'),
  listEmailLabels: () => electronAPI.ipcRenderer.invoke('email:listLabels'),
  pauseGlobalShortcuts: () => electronAPI.ipcRenderer.invoke('shortcuts:pause-global'),
  resumeGlobalShortcuts: () => electronAPI.ipcRenderer.invoke('shortcuts:resume-global'),
  isCapsLockOn: () => electronAPI.ipcRenderer.invoke('system:isCapsLockOn')
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
          if (
            evt.message &&
            (evt.message.includes('ResizeObserver loop completed') ||
              evt.message.includes('ResizeObserver loop limit exceeded'))
          ) {
            return
          }
          const payload = {
            type: 'error',
            message: evt.message,
            filename: evt.filename,
            lineno: evt.lineno,
            colno: evt.colno,
            error: evt.error && evt.error.stack ? evt.error.stack : undefined,
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
