import electron from 'electron'
const { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } = electron.default || electron
import { join } from 'path'
import path from 'path'
import fs from 'fs/promises'
import VaultManager from './VaultManager'
import SettingsManager from './SettingsManager'
import AppUpdater from './AppUpdater'
import VaultIndexer from './VaultIndexer'
import VaultSearch from './VaultSearch'
import Database from 'better-sqlite3'
import iconAsset from '../../resources/icon.ico?asset'
import { handleExportDocs } from '../export/exportDocs'
import { handleExportPDF } from '../export/exportPDF'
import { handleExportMarkdown } from '../export/exportMarkdown'
import { handleExportText } from '../export/exportText'
import { handleExportHTML } from '../export/exportHTML'
import { setupGoogleAuth } from './auth/googleAuth'
import { backupToDrive } from './backup/googleDriveBackup'

// Force rebuild timestamp: 5

let mainWindow
let hasIndexed = false

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
    console.info('Migration complete.')
  } catch (err) {}
}

async function createWindow() {
  const iconPath = iconAsset
  const appIcon = electron.nativeImage.createFromPath(iconPath)

  const translucency = await SettingsManager.get('translucency')
  const windowBounds = (await SettingsManager.get('windowBounds')) || { width: 1000, height: 700 }

  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: 500,
    minHeight: 500,
    icon: appIcon,
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
      webSecurity: app.isPackaged,
      sandbox: false,
      devTools: !app.isPackaged,
      cache: true,
      partition: 'persist:main',
      allowRunningInsecureContent: false
    }
  })

  // Clear HTTP cache to fix "No file for..." errors
  try {
    const ses = mainWindow.webContents.session
    await ses.clearCache()
    console.log('[Main] Cache cleared successfully')
  } catch (err) {
    console.error('[Main] Failed to clear cache:', err)
  }

  // Disable DevTools Shortcuts in Production
  if (app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        (input.control && input.shift && input.key.toLowerCase() === 'i') ||
        input.key === 'F12'
      ) {
        event.preventDefault()
      }
    })
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    setTimeout(() => {
      new AppUpdater(mainWindow)
    }, 5000)

    SettingsManager.notifyRenderer = (settings) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('settings:changed', settings)
        }
      })
    }
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

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds()
      SettingsManager.set('windowBounds', bounds).catch(console.error)
    }
  })

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Global Exception Handling (Main Process) - Enhanced for production resilience
// Note: Enhanced handlers with recovery mechanisms are at the bottom of the file

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

// Suppress harmless Electron/Chromium cache and quota errors (must be before app.whenReady)
if (!app.isPackaged) {
  // Set cache path to avoid permission issues
  const cachePath = join(app.getPath('userData'), 'cache')
  app.commandLine.appendSwitch('disk-cache-dir', cachePath)
  app.commandLine.appendSwitch('disk-cache-size', '52428800') // 50MB
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('io.lumina.app.v2')
  }

  // Suppress console errors for harmless cache/quota warnings (dev only)
  if (!app.isPackaged) {
    const originalConsoleError = console.error
    console.error = (...args) => {
      const message = args.join(' ')
      // Filter out harmless cache/quota errors
      if (
        message.includes('disk_cache') ||
        message.includes('quota_database') ||
        message.includes('Unable to move the cache') ||
        message.includes('Unable to create cache') ||
        message.includes('Could not open the quota database')
      ) {
        return // Suppress these errors
      }
      originalConsoleError.apply(console, args)
    }
  }

  protocol.handle('asset', async (request) => {
    try {
      const parsedUrl = new URL(request.url)
      let relativePath = ''

      if (parsedUrl.hostname === 'local') {
        // Standard robust URL format: asset://local/.lumina/assets/image.png
        relativePath = decodeURIComponent(parsedUrl.pathname.slice(1))
      } else {
        // Fallback for old markdown format just in case
        let fallbackUrl = request.url.replace('asset://', '').replace('asset:///', '')
        if (fallbackUrl.startsWith('/')) fallbackUrl = fallbackUrl.slice(1)
        relativePath = decodeURIComponent(fallbackUrl)
      }

      if (!VaultManager.vaultPath || !relativePath)
        return new Response('Vault not open', { status: 404 })

      const finalPath = join(VaultManager.vaultPath, relativePath)

      // Read file directly from disk to avoid Windows URI parsing bugs with net.fetch
      const data = await fs.readFile(finalPath)

      const ext = path.extname(finalPath).toLowerCase()
      let mimeType = 'image/png'
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
      else if (ext === '.gif') mimeType = 'image/gif'
      else if (ext === '.webp') mimeType = 'image/webp'
      else if (ext === '.svg') mimeType = 'image/svg+xml'

      return new Response(data, {
        headers: { 'Content-Type': mimeType }
      })
    } catch (error) {
      console.error('[Protocol] Asset fetch error:', error)
      return new Response('Not Found', { status: 404 })
    }
  })

  ipcMain.handle('db:getSetting', (_, key) => SettingsManager.get(key))
  ipcMain.handle('db:saveSetting', (_, key, value) => SettingsManager.set(key, value))
  ipcMain.handle('db:saveSettings', (_, settings) => SettingsManager.setMultiple(settings))
  ipcMain.handle('db:getTheme', () => SettingsManager.get('theme'))
  ipcMain.handle('db:saveTheme', (_, theme) => SettingsManager.set('theme', theme))
  ipcMain.handle('backup:start', () => backupToDrive(VaultManager.vaultPath))

  ipcMain.handle('vault:readAsset', async (_, relativePath) => {
    return VaultManager.readAsset(relativePath)
  })
  ipcMain.handle('app:getVersion', () => app.getVersion()) // show the version

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:open-devtools', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.openDevTools({ mode: 'detach' })
    } catch (e) {
      console.error('Failed to open DevTools:', e)
    }
  })
  ipcMain.handle('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:set-translucency', (_, enabled) => {
    if (!mainWindow) return
    if (process.platform === 'win32') mainWindow.setBackgroundMaterial(enabled ? 'acrylic' : 'none')
  })

  // Export handlers
  ipcMain.handle('window:export-html', async (_, payload) => handleExportHTML(mainWindow, payload))
  ipcMain.handle('window:export-docs', async (_, payload) => handleExportDocs(mainWindow, payload))
  ipcMain.handle('window:export-pdf', async (_, payload) => handleExportPDF(mainWindow, payload))
  ipcMain.handle('window:export-markdown', async (_, payload) =>
    handleExportMarkdown(mainWindow, payload)
  )
  ipcMain.handle('window:export-text', async (_, payload) => handleExportText(mainWindow, payload))

  // Setup Google Auth
  setupGoogleAuth()

  // Receive renderer logs and append to a file in userData
  ipcMain.on('renderer:log', async (_, payload) => {
    try {
      const logDir = app.getPath('userData')
      const logFile = join(logDir, 'renderer.log')
      const line = `[${new Date(payload.time || Date.now()).toISOString()}] ${payload.type || 'log'}: ${payload.message || ''}\n${payload.error || ''}\n\n`
      await fs.appendFile(logFile, line, 'utf8')
    } catch (err) {
      console.error('Failed to write renderer log:', err)
    }
  })

  // Error Boundary logging
  ipcMain.handle('error:log', async (_, errorData) => {
    try {
      const logDir = app.getPath('userData')
      const logFile = join(logDir, 'error-boundary.log')
      const timestamp = new Date(errorData.timestamp || Date.now()).toISOString()
      const line = `[${timestamp}] ErrorBoundary Error:\nMessage: ${errorData.message || 'Unknown'}\nStack: ${errorData.stack || 'N/A'}\nComponent Stack: ${errorData.componentStack || 'N/A'}\n\n`
      await fs.appendFile(logFile, line, 'utf8')
      console.error('[ErrorBoundary]', errorData)
    } catch (err) {
      console.error('Failed to write error log:', err)
    }
  })

  ipcMain.handle('vault:getSnippets', () => VaultManager.getSnippets())
  ipcMain.handle('vault:saveSnippet', async (_, snippet) => {
    const updatedSnippet = await VaultManager.saveSnippet(snippet)
    // Auto-index updated file in background
    if (VaultManager.vaultPath && updatedSnippet?.fileName) {
      const filePath = path.join(
        VaultManager.vaultPath,
        updatedSnippet.folderId || '',
        updatedSnippet.fileName
      )
      VaultIndexer.indexFile(filePath, true).catch((err) => {
        console.error('[Main] Auto-index failed:', err)
      })
    }
    // Return the updated snippet with cleaned title
    return updatedSnippet
  })
  ipcMain.handle('vault:saveImage', (_, { buffer, name }) => VaultManager.saveImage(buffer, name))
  ipcMain.handle('vault:deleteSnippet', async (_, id) => {
    try {
      const deletedPath = await VaultManager.deleteSnippet(id)
      if (deletedPath && typeof deletedPath === 'string') {
        VaultIndexer.removeFile(deletedPath).catch((err) => {
          console.error('[Main] Failed to remove deleted file from index:', err)
        })
      }
      return true
    } catch (err) {
      throw err
    }
  })
  ipcMain.handle('vault:cleanOrphans', async () => await VaultManager.cleanOrphanedAssets())

  // Folder IPC
  ipcMain.handle('vault:createFolder', async (_, path) => await VaultManager.createFolder(path))
  ipcMain.handle(
    'vault:renameFolder',
    async (_, oldPath, newPath) => await VaultManager.renameFolder(oldPath, newPath)
  )
  ipcMain.handle('vault:deleteFolder', async (_, path) => await VaultManager.deleteFolder(path))

  // System
  ipcMain.handle('vault:open-folder', async () => {
    if (VaultManager.vaultPath) {
      await shell.openPath(VaultManager.vaultPath)
    }
  })

  ipcMain.handle('vault:select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (canceled) return null
    const newPath = filePaths[0]

    // Save to global config
    const userDataPath = app.getPath('userData')
    await fs.writeFile(
      join(userDataPath, 'app_config.json'),
      JSON.stringify({ lastVaultOpened: newPath }, null, 2)
    )

    await SettingsManager.init(newPath)
    await VaultManager.init(newPath)
    await SettingsManager.set('vaultPath', newPath)

    // Index new vault in background
    VaultIndexer.indexVault(newPath, {
      force: false,
      onProgress: (stats) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('index:progress', stats)
        }
      }
    })
      .then(() => {
        console.info('[Main] New vault indexing complete, reloading search index...')
        return VaultSearch.reload()
      })
      .catch((err) => {
        console.error('[Main] Vault indexing failed:', err)
      })
    return newPath
  })

  // Vault Indexing IPC Handlers
  ipcMain.handle('vault:index', async (_, vaultPath, options = {}) => {
    try {
      // Use provided vaultPath or fallback to VaultManager's vaultPath
      const targetPath = vaultPath || VaultManager.vaultPath

      // Validate path before indexing
      if (!targetPath || typeof targetPath !== 'string') {
        throw new Error('Vault path must be a string. Please select a vault folder first.')
      }

      const result = await VaultIndexer.indexVault(targetPath, {
        ...options,
        onProgress: (stats) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('index:progress', stats)
          }
          if (options.onProgress) options.onProgress(stats)
        }
      })
      // Reload search index after indexing completes
      await VaultSearch.reload()
      return result
    } catch (err) {
      console.error('[Main] Index request failed:', err)
      throw err
    }
  })

  ipcMain.handle('vault:rebuild-index', async (_, vaultPath) => {
    try {
      const targetPath = vaultPath || VaultManager.vaultPath
      const result = await VaultIndexer.rebuildIndex(targetPath, {
        onProgress: (stats) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('index:progress', stats)
          }
        }
      })
      // Reload search index after rebuild
      await VaultSearch.reload()
      return result
    } catch (err) {
      console.error('[Main] Rebuild index failed:', err)
      throw err
    }
  })

  ipcMain.handle('vault:index-stats', async () => {
    try {
      return await VaultIndexer.getStats()
    } catch (err) {
      console.error('[Main] Get index stats failed:', err)
      return { error: err.message }
    }
  })

  // Vault Search IPC Handlers
  ipcMain.handle('vault:search', async (_, query, options = {}) => {
    try {
      // Trigger indexing lazily on first search
      if (!hasIndexed && VaultManager.vaultPath) {
        hasIndexed = true
        VaultIndexer.indexVault(VaultManager.vaultPath, {
          force: false,
          onProgress: (stats) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('index:progress', stats)
            }
          }
        })
          .then(() => VaultSearch.reload())
          .catch((err) => console.error('[Main] Lazy indexing failed:', err))
      }

      return await VaultSearch.search(query, options)
    } catch (err) {
      console.error('[Main] Search failed:', err)
      return []
    }
  })

  ipcMain.handle('vault:search-stats', () => {
    try {
      return VaultSearch.getStats()
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('vault:find-similar', async (_, chunkId, limit = 10) => {
    try {
      return await VaultSearch.findSimilar(chunkId, limit)
    } catch (err) {
      console.error('[Main] Find similar failed:', err)
      return []
    }
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
    const appConfigPath = join(userDataPath, 'app_config.json')

    let savedVaultPath = null

    // ── E2E test mode ──────────────────────────────────────────────────────────
    // When launched by Playwright, LUMINA_TEST_VAULT points to a fresh temp dir.
    // Skip reading app_config.json so the app starts with a clean empty vault
    // and shows the welcome page, exactly as a brand-new user would see it.
    if (process.env.LUMINA_TEST_VAULT) {
      savedVaultPath = process.env.LUMINA_TEST_VAULT
      console.info('[Main] E2E test mode — using temp vault:', savedVaultPath)
    } else {
      try {
        const configData = await fs.readFile(appConfigPath, 'utf8')
        savedVaultPath = JSON.parse(configData).lastVaultOpened
      } catch (e) {
        // Fallback migration: read from old settings.json
        try {
          const oldSettings = await fs.readFile(join(userDataPath, 'settings.json'), 'utf8')
          savedVaultPath = JSON.parse(oldSettings).vaultPath
        } catch (err) {}
      }
    }
    // ───────────────────────────────────────────────────────────────────────────

    const oldDefaultPath = join(app.getPath('documents'), 'Lumina Vault')
    const newDefaultPath = join(app.getPath('documents'), 'lumina')

    if (!savedVaultPath || savedVaultPath === oldDefaultPath) {
      savedVaultPath = newDefaultPath
      await fs.writeFile(
        appConfigPath,
        JSON.stringify({ lastVaultOpened: savedVaultPath }, null, 2)
      )
    }

    // Initialize SettingsManager inside the vault
    await SettingsManager.init(savedVaultPath)
    await SettingsManager.set('vaultPath', savedVaultPath)

    // Initialize vault indexer and search
    await VaultIndexer.init(userDataPath)
    await VaultSearch.init(userDataPath)

    await VaultManager.init(savedVaultPath, app.getPath('documents'))
    await migrateFromSQLite()

    // Defer indexing until the renderer is initialized so progress events are received reliably.
    const startupVaultPath = savedVaultPath

    await createWindow()

    mainWindow.webContents.once('did-finish-load', () => {
      VaultIndexer.warmWorker().catch((err) => console.error('[Main] Worker pre-warm failed:', err))

      if (startupVaultPath && typeof startupVaultPath === 'string') {
        hasIndexed = true

        setTimeout(() => {
          console.info('[Main] Starting background indexing after renderer ready...')
          VaultIndexer.indexVault(startupVaultPath, {
            force: false,
            onProgress: (stats) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('index:progress', stats)
              }
            }
          })
            .then(() => {
              console.info('[Main] Background indexing complete, reloading search index...')
              return VaultSearch.reload()
            })
            .catch((err) => {
              console.error('[Main] Background indexing failed:', err)
            })
        }, 250)
      }
    })
  } catch (err) {
    console.error('[Main] Initialization error:', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * Enhanced Global Error Handlers
 *
 * These handlers ensure the app never fully crashes in production.
 * Errors are logged and recovery is attempted instead of crashing.
 *
 * Production behavior:
 * - Logs errors to file for debugging
 * - Notifies renderer process
 * - Attempts graceful recovery
 *
 * Development behavior:
 * - Shows error dialogs for immediate feedback
 * - More verbose logging
 */
process.on('uncaughtException', (error) => {
  const errorId = `main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  console.error(`[Main] Uncaught Exception [${errorId}]:`, error)

  // Log to file for debugging (non-blocking)
  const logDir = app.getPath('userData')
  const logFile = join(logDir, 'crash.log')
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] [${errorId}] Uncaught Exception: ${error.message}\nStack: ${error.stack}\n\n`

  fs.appendFile(logFile, logEntry, 'utf8').catch((logError) => {
    console.error('[Main] Failed to write error log:', logError)
  })

  // In production, try to recover instead of showing error dialog
  if (process.env.NODE_ENV === 'production') {
    // Notify renderer and attempt recovery
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('app:error', {
          type: 'uncaughtException',
          message: error.message,
          errorId
        })
      } catch (e) {
        console.error('[Main] Failed to notify renderer:', e)
      }
    }
  } else {
    // In development, show error dialog for debugging
    try {
      dialog.showErrorBox(
        'Critical Error',
        `A critical error occurred:\n${error.message}\n\nError ID: ${errorId}\nThe app will attempt to continue.`
      )
    } catch (e) {
      console.error('[Main] Failed to show error dialog:', e)
    }
  }
})

process.on('unhandledRejection', (reason, promise) => {
  const errorId = `rejection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  console.error(`[Main] Unhandled Rejection [${errorId}]:`, reason)

  const logDir = app.getPath('userData')
  const logFile = join(logDir, 'crash.log')
  const timestamp = new Date().toISOString()
  const errorMessage = reason instanceof Error ? reason.message : String(reason)
  const errorStack = reason instanceof Error ? reason.stack : 'N/A'
  const logEntry = `[${timestamp}] [${errorId}] Unhandled Rejection: ${errorMessage}\nStack: ${errorStack}\n\n`

  fs.appendFile(logFile, logEntry, 'utf8').catch((logError) => {
    console.error('[Main] Failed to write rejection log:', logError)
  })

  // Don't crash - log and continue
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('app:error', {
        type: 'unhandledRejection',
        message: errorMessage,
        errorId
      })
    } catch (e) {
      console.error('[Main] Failed to notify renderer of rejection:', e)
    }
  }
})

/**
 * Handle renderer process crashes gracefully
 * Attempts to reload the renderer process automatically
 */
app.on('render-process-gone', (event, webContents, details) => {
  const errorId = `renderer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  console.error(`[Main] Renderer process gone [${errorId}]:`, details)

  const logDir = app.getPath('userData')
  const logFile = join(logDir, 'crash.log')
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] [${errorId}] Renderer Process Gone\nReason: ${details.reason}\nExit Code: ${details.exitCode}\n\n`

  fs.appendFile(logFile, logEntry, 'utf8').catch((logError) => {
    console.error('[Main] Failed to write renderer crash log:', logError)
  })

  // Try to reload the window if it's not destroyed
  // Use a delay to ensure the process has fully terminated
  if (webContents && !webContents.isDestroyed()) {
    setTimeout(() => {
      try {
        if (webContents && !webContents.isDestroyed()) {
          console.info('[Main] Attempting to reload renderer process...')
          webContents.reload()
        }
      } catch (e) {
        console.error('[Main] Failed to reload renderer:', e)
      }
    }, 1000)
  }
})
