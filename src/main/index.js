import electron from 'electron'
const { app, shell, BrowserWindow, ipcMain, dialog } = electron.default || electron
import { join } from 'path'
import fs from 'fs/promises'
import VaultManager from './VaultManager'
import SettingsManager from './SettingsManager'
import Database from 'better-sqlite3' // Still needed for migration

// Force rebuild timestamp: 1

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
    
    // Rename old DB to avoid repeat migration
    await fs.rename(dbPath, dbPath + '.bak')
    console.log('Migration complete.')
  } catch (err) {
    // No DB to migrate or already done
  }
}

async function createWindow() {
  const iconPath = process.platform === 'win32'
    ? join(__dirname, '..', 'resources', 'icon.ico')
    : join(__dirname, '../renderer/public/icon.png')

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
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

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
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- IPC Handlers (Registered Immediately) ---

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('io.lumina.app')
  }

  console.log('Registering IPC Handlers...')
  
  // Settings & Theme Handlers
  ipcMain.handle('db:getSetting', (_, key) => SettingsManager.get(key))
  ipcMain.handle('db:saveSetting', (_, key, value) => SettingsManager.set(key, value))
  ipcMain.handle('db:getTheme', () => SettingsManager.get('theme'))
  ipcMain.handle('db:saveTheme', (_, theme) => SettingsManager.set('theme', theme))

  // Window Controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:set-translucency', (_, enabled) => {
    if (!mainWindow) return
    // Windows Acrylic/Mica can sometimes be toggled, but transparency usually requires restart
    // For now, we apply the material if possible.
    if (process.platform === 'win32') {
       mainWindow.setBackgroundMaterial(enabled ? 'acrylic' : 'none')
    }
  })

  // Vault Handlers
  ipcMain.handle('vault:getSnippets', () => VaultManager.getSnippets())
  ipcMain.handle('vault:saveSnippet', (_, snippet) => VaultManager.saveSnippet(snippet))
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

  // File Dialogs
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

  console.log('IPC Handlers Registered.')

  // --- Initialization ---
  console.log('Initializing Services...')
  try {
    const userDataPath = app.getPath('userData')
    await SettingsManager.init(userDataPath)
    
    // Load persisted vault path or use default
    const savedVaultPath = await SettingsManager.get('vaultPath')
    await VaultManager.init(savedVaultPath, app.getPath('documents'))
    
    await migrateFromSQLite()
    console.log('Services Initialized.')
  } catch (err) {
    console.error('Service Init Error:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
