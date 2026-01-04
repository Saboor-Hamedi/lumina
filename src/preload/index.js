import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// High-performance Robust API Bridge
const api = {
  // Vault Ops
  getSnippets: () => electronAPI.ipcRenderer.invoke('vault:getSnippets'),
  saveSnippet: (snippet) => electronAPI.ipcRenderer.invoke('vault:saveSnippet', snippet),
  deleteSnippet: (id) => electronAPI.ipcRenderer.invoke('vault:deleteSnippet', id),
  openVaultFolder: () => electronAPI.ipcRenderer.invoke('vault:open-folder'),
  selectVault: () => electronAPI.ipcRenderer.invoke('vault:select-folder'),
  
  // Settings & Theme
  getSetting: (key) => electronAPI.ipcRenderer.invoke('db:getSetting', key),
  saveSetting: (key, value) => electronAPI.ipcRenderer.invoke('db:saveSetting', key, value),
  getTheme: () => electronAPI.ipcRenderer.invoke('db:getTheme'),
  saveTheme: (theme) => electronAPI.ipcRenderer.invoke('db:saveTheme', theme),
  
  // Dialogs
  confirmDelete: (msg) => electronAPI.ipcRenderer.invoke('confirm-delete', msg),
  
  // Window controls
  minimize: () => electronAPI.ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => electronAPI.ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => electronAPI.ipcRenderer.invoke('window:close'),
  setTranslucency: (enabled) => electronAPI.ipcRenderer.invoke('window:set-translucency', enabled)
}

// Expose APIs
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Preload Bridge Error:', error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
}
