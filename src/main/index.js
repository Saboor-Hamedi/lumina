import electron from 'electron'
const { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } = electron.default || electron
import { join } from 'path'
import fs from 'fs/promises'
import VaultManager from './VaultManager'
import SettingsManager from './SettingsManager'
import AppUpdater from './AppUpdater'
import Database from 'better-sqlite3'

// Force rebuild timestamp: 5

let mainWindow

async function migrateFromSQLite() {
  const dbPath = join(app.getPath('userData'), 'snippets.db')
  try {
    await fs.access(dbPath)
    const db = new Database(dbPath)
    const snippets = db.prepare('SELECT * FROM snippets').all()

    for (const snippet of snippets) {
      await VaultManager.saveSnippet({
        id: snippet.id,
        title: snippet.title,
        code: snippet.code,
        language: snippet.language,
        tags: snippet.tags,
        timestamp: snippet.timestamp
      })
    }

    await fs.rename(dbPath, dbPath + '.bak')
    console.log('Migration complete.')
  } catch (err) {}
}

async function createWindow() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(app.getAppPath(), 'resources', 'icon.ico')

  const translucency = await SettingsManager.get('translucency')

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    show: false,
    frame: false,
    transparent: translucency,
    backgroundColor: translucency ? '#00000000' : undefined,
    backgroundMaterial: translucency ? 'acrylic' : undefined,
    resizable: true,
    maximizable: true,
    minimizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: false,
      devTools: !app.isPackaged // Explicitly disable access via API if packaged
    }
  })

  // Disable DevTools Shortcuts in Production
  if (app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
        event.preventDefault()
      }
    })
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Start update check after a short delay
    setTimeout(() => {
      new AppUpdater(mainWindow)
    }, 5000)
  })

  // Robust Crash Handling (Renderer)
  mainWindow.webContents.on('render-process-gone', async (event, details) => {
    console.error('Renderer Process Gone:', details.reason)
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Renderer Crashed',
      message: 'The application renderer process has crashed.',
      detail: `Reason: ${details.reason}\nWould you like to reload the window?`,
      buttons: ['Reload', 'Close App'],
      defaultId: 0
    })

    if (result.response === 0) {
      mainWindow.reload()
    } else {
      app.quit()
    }
  })

  // Handle updates
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {}
    return { action: 'deny' }
  })

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Global Exception Handling (Main Process)
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  dialog.showErrorBox(
    'Critical Error',
    `A critical error occurred:\n${error.message}\nThe app may need to restart.`
  )
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('io.lumina.app')
  }

  protocol.handle('asset', (request) => {
    const url = request.url.replace('asset://', '')
    const relativePath = decodeURIComponent(url)
    if (!VaultManager.vaultPath) return new Response('Vault not open', { status: 404 })
    try {
      const finalPath = join(VaultManager.vaultPath, relativePath)
      return net.fetch('file:///' + finalPath)
    } catch (error) {
      return new Response('Not Found', { status: 404 })
    }
  })

  ipcMain.handle('db:getSetting', (_, key) => SettingsManager.get(key))
  ipcMain.handle('db:saveSetting', (_, key, value) => SettingsManager.set(key, value))
  ipcMain.handle('db:getTheme', () => SettingsManager.get('theme'))
  ipcMain.handle('db:saveTheme', (_, theme) => SettingsManager.set('theme', theme))
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:set-translucency', (_, enabled) => {
    if (!mainWindow) return
    if (process.platform === 'win32') mainWindow.setBackgroundMaterial(enabled ? 'acrylic' : 'none')
  })

  ipcMain.handle('vault:getSnippets', () => VaultManager.getSnippets())
  ipcMain.handle('vault:saveSnippet', (_, snippet) => VaultManager.saveSnippet(snippet))
  ipcMain.handle('vault:saveImage', (_, { buffer, name }) => VaultManager.saveImage(buffer, name))
  ipcMain.handle('vault:deleteSnippet', (_, id) => VaultManager.deleteSnippet(id))
  ipcMain.handle('vault:open-folder', () => {
    if (VaultManager.vaultPath) shell.openPath(VaultManager.vaultPath)
  })

  ipcMain.handle('vault:select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (canceled) return null
    const newPath = filePaths[0]
    await VaultManager.init(newPath)
    await SettingsManager.set('vaultPath', newPath)
    return newPath
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('confirm-delete', async (event, message) => {
    const res = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 1,
      cancelId: 0,
      title: 'Confirm Delete',
      message: message || 'Delete this item?',
      noLink: true
    })
    return res.response === 1
  })

  try {
    const userDataPath = app.getPath('userData')
    await SettingsManager.init(userDataPath)
    const savedVaultPath = await SettingsManager.get('vaultPath')
    await VaultManager.init(savedVaultPath, app.getPath('documents'))
    await migrateFromSQLite()
  } catch (err) {}

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
