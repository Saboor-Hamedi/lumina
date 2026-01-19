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

  // Export handlers
  ipcMain.handle('window:export-html', async (_, payload) => {
    try {
      const { title, content, language } = payload || {}
      if (!content) throw new Error('No content provided')

      // Import marked dynamically (ESM)
      const { marked } = await import('marked')

      // Convert markdown to HTML
      const htmlContent = await marked.parse(content || '')

      // Create standalone HTML with embedded CSS
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Untitled'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.2;
    }
    h1 { font-size: 2em; border-bottom: 2px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 1em; }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding-left: 1em;
      margin: 1em 0;
      color: #6a737d;
    }
    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }
    li {
      margin: 0.5em 0;
    }
    table {
      border-collapse: collapse;
      margin: 1em 0;
      width: 100%;
    }
    th, td {
      border: 1px solid #dfe2e5;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #f4f4f4;
      font-weight: 600;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1em 0;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    hr {
      border: none;
      border-top: 1px solid #eaecef;
      margin: 2em 0;
    }
  </style>
</head>
<body>
  <h1>${title || 'Untitled'}</h1>
  ${htmlContent}
</body>
</html>`

      return html
    } catch (error) {
      console.error('[Main] Export HTML failed:', error)
      throw error
    }
  })

  ipcMain.handle('window:export-pdf', async (_, payload) => {
    try {
      const { title, content, language } = payload || {}
      if (!content) throw new Error('No content provided')

      // Show save dialog FIRST for immediate user feedback
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save PDF',
        defaultPath: `${title || 'Untitled'}.pdf`,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      // Now do the heavy work (markdown conversion and PDF generation)
      // Import marked dynamically
      const { marked } = await import('marked')

      // Convert markdown to HTML
      const htmlContent = await marked.parse(content || '')

      // Create HTML for PDF
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title || 'Untitled'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.2;
    }
    h1 { font-size: 2em; border-bottom: 2px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 1em; }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding-left: 1em;
      margin: 1em 0;
      color: #6a737d;
    }
    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }
    li {
      margin: 0.5em 0;
    }
    table {
      border-collapse: collapse;
      margin: 1em 0;
      width: 100%;
    }
    th, td {
      border: 1px solid #dfe2e5;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #f4f4f4;
      font-weight: 600;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1em 0;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    hr {
      border: none;
      border-top: 1px solid #eaecef;
      margin: 2em 0;
    }
  </style>
</head>
<body>
  <h1>${title || 'Untitled'}</h1>
  ${htmlContent}
</body>
</html>`

      // Create hidden window for PDF generation
      const printWin = new BrowserWindow({
        show: false,
        width: 800,
        height: 1100,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      // Load HTML content
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
      await printWin.loadURL(dataUrl)

      // Wait for content to load (reduced timeout for faster response)
      await new Promise(resolve => {
        printWin.webContents.once('did-finish-load', resolve)
        // Reduced timeout from 2000ms to 1000ms
        setTimeout(resolve, 1000)
      })

      // Generate PDF
      const pdfData = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: {
          top: 1,
          bottom: 1,
          left: 1,
          right: 1
        }
      })

      // Close the window
      printWin.close()

      // Save PDF to the chosen path
      await fs.writeFile(filePath, pdfData)
      return { success: true, filePath }
    } catch (error) {
      console.error('[Main] Export PDF failed:', error)
      throw error
    }
  })

  ipcMain.handle('window:export-markdown', async (_, payload) => {
    try {
      const { title, content } = payload || {}
      if (!content) throw new Error('No content provided')

      // Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export as Markdown',
        defaultPath: `${title || 'Untitled'}.md`,
        filters: [
          { name: 'Markdown Files', extensions: ['md', 'markdown'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!canceled && filePath) {
        await fs.writeFile(filePath, content, 'utf-8')
        return { success: true, filePath }
      }

      return { success: false, canceled: true }
    } catch (error) {
      console.error('[Main] Export Markdown failed:', error)
      throw error
    }
  })

  ipcMain.handle('vault:getSnippets', () => VaultManager.getSnippets())
  ipcMain.handle('vault:saveSnippet', async (_, snippet) => {
    const result = await VaultManager.saveSnippet(snippet)
    // Auto-index updated file in background
    if (VaultManager.vaultPath && snippet.fileName) {
      const filePath = path.join(VaultManager.vaultPath, snippet.fileName)
      VaultIndexer.indexFile(filePath, true).catch(err => {
        console.error('[Main] Auto-index failed:', err)
      })
    }
    return result
  })
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
    // Index new vault in background
    VaultIndexer.indexVault(newPath, { force: false })
      .then(() => {
        console.log('[Main] New vault indexing complete, reloading search index...')
        return VaultSearch.reload()
      })
      .catch(err => {
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

      const result = await VaultIndexer.indexVault(targetPath, options)
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
      const result = await VaultIndexer.rebuildIndex(vaultPath || VaultManager.vaultPath)
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
    await SettingsManager.init(userDataPath)

    // Initialize vault indexer and search
    await VaultIndexer.init(userDataPath)
    await VaultSearch.init(userDataPath)

    const savedVaultPath = await SettingsManager.get('vaultPath')
    await VaultManager.init(savedVaultPath, app.getPath('documents'))
    await migrateFromSQLite()

    // Auto-index vault in background (non-blocking)
    if (savedVaultPath && typeof savedVaultPath === 'string') {
      VaultIndexer.indexVault(savedVaultPath, { force: false })
        .then(() => {
          console.log('[Main] Background indexing complete, reloading search index...')
          return VaultSearch.reload()
        })
        .catch(err => {
          console.error('[Main] Background indexing failed:', err)
        })
    }
  } catch (err) {
    console.error('[Main] Initialization error:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
