import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'

/**
 * Robust App Updater (Engineering Std #12)
 * Handles auto-update lifecycle with progressive status reporting.
 */
class AppUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow
    
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    
    this.setupListeners()
  }

  setupListeners() {
    autoUpdater.on('checking-for-update', () => {
      this.sendStatusToWindow('checking')
    })

    autoUpdater.on('update-available', (info) => {
      this.sendStatusToWindow('available', info)
    })

    autoUpdater.on('update-not-available', (info) => {
      this.sendStatusToWindow('not-available', info)
    })

    autoUpdater.on('error', (err) => {
      this.sendStatusToWindow('error', err == null ? 'unknown' : (err.stack || err).toString())
    })

    autoUpdater.on('download-progress', (progressObj) => {
      this.sendStatusToWindow('downloading', progressObj)
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.sendStatusToWindow('ready', info)
    })

    // Bridge IPC commands - Remove existing handlers first to avoid "Attempted to register a second handler" error
    ipcMain.removeHandler('update:check')
    ipcMain.handle('update:check', () => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('Check for updates failed:', err)
        this.sendStatusToWindow('error', 'Check failed')
      })
    })

    ipcMain.removeHandler('update:download')
    ipcMain.handle('update:download', () => {
      autoUpdater.downloadUpdate()
    })

    ipcMain.removeHandler('update:install')
    ipcMain.handle('update:install', () => {
      autoUpdater.quitAndInstall()
    })
  }

  sendStatusToWindow(status, data = null) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:status', { status, data })
    }
  }
}

export default AppUpdater
