import electron from 'electron'
const { app, shell, BrowserWindow, ipcMain, dialog, protocol, net, clipboard, nativeImage, screen, session } = electron.default || electron
import { join } from 'path'
import path from 'path'
import fs from 'fs/promises'
import WorkspaceManager from './workspace/workspaceManager'
import SettingsManager from './settings'
import AppUpdater from './AppUpdater'
import WorkspaceIndexer from './workspace/workspaceIndexer'
import WorkspaceSearch from './workspace/workspaceSearch'
import BrainIndexer from './workspace/brainIndexer'
import iconAsset from '../../resources/icon.png?asset'
import { handleExportDocs } from '../export/exportDocs'
import { handleExportPDF } from '../export/exportPDF'
import { handleExportMarkdown } from '../export/exportMarkdown'
import { handleExportText } from '../export/exportText'
import { handleExportHTML } from '../export/exportHTML'
import { handleExportCleanHTML, handleExportMarkdownBundle } from '../export/exportBundle'
import { setupGoogleAuth } from './auth/googleAuth'
import { setupGmailIpc } from './email/gmailService'
import { backupToDrive, backupFileToDrive, cancelBackup } from './backup/googleDriveBackup'
import { registerOpenNoteHandler } from './handlers/useOpenNote'
import { useResizeWindow } from './handlers/useResizeWindow'
import { useWindowOpacity } from './handlers/useWindowOpacity'
import { useGlobalShortcut, pauseGlobalShortcut, resumeGlobalShortcut } from './shortcuts/useGlobalShortcut'
import { useTrayIcon, isAppQuitting, setAppQuitting } from './handlers/useTrayIcon'
import { updateAutoLauncher } from './handlers/useAutoLauncher'
import { registerOllamaChatStream } from './lumina/ollamaChatStream'

// Force rebuild timestamp: 6

// E2E test isolation: give each launched app its own userData dir so rapid
// relaunches never contend on the same SQLite DB / cache (prevents Windows
// fast-fail crashes 0xC0000409 under Playwright).
if (process.env.LUMINA_TEST_USERDATA) {
  app.setPath('userData', process.env.LUMINA_TEST_USERDATA)
}

let mainWindow
let hasIndexed = false

async function autoRepairIndexedDB() {
  try {
    const partitionsDir = join(app.getPath('userData'), 'Partitions', 'main', 'IndexedDB')
    const devDbDir = join(partitionsDir, 'http_localhost_5173.indexeddb.leveldb')
    const currentFile = join(devDbDir, 'CURRENT')
    const currentContent = await fs.readFile(currentFile, 'utf8').catch(() => null)
    if (currentContent) {
      const manifestName = currentContent.trim().replace(/^[\r\n]+|[\r\n]+$/g, '')
      const manifestPath = join(devDbDir, manifestName)
      const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false)
      if (!manifestExists) {
        console.warn('[IndexedDB] Corrupted LevelDB manifest detected, auto-healing cache:', devDbDir)
        await fs.rm(devDbDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  } catch (_) {}
}

async function createWindow() {
  const iconPath = iconAsset
  const appIcon = electron.nativeImage.createFromPath(iconPath)

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const isMaximized = (await SettingsManager.get('isMaximized').catch(() => true)) ?? true
  const savedBounds = await SettingsManager.get('windowBounds').catch(() => null)
  const windowBounds = savedBounds || { width: 1000, height: 700 }

  const initialWidth = isMaximized ? screenWidth : windowBounds.width
  const initialHeight = isMaximized ? screenHeight : windowBounds.height
  const initialX = isMaximized ? undefined : windowBounds.x
  const initialY = isMaximized ? undefined : windowBounds.y

  let allowDevTools = !app.isPackaged || (await SettingsManager.get('enableDevTools')) === true

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: initialX,
    y: initialY,
    minWidth: 500,
    minHeight: 500,
    icon: appIcon,
    show: false,
    frame: false,
    thickFrame: true,
    backgroundColor: '#121218',
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
      devTools: true,
      cache: true,
      partition: 'persist:main',
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
      // Required for Chromium's built-in PDF viewer to render PDFs in iframes
      plugins: true
    }
  })

  // Window creation: only maximize when visible to prevent Chromium viewport desync
  const showWindowSafely = async () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return
    const launchOnStartup = await SettingsManager.get('launchOnStartup').catch(() => false)
    const openAsHidden = process.argv.includes('--hidden')
    if (!(launchOnStartup && openAsHidden)) {
      mainWindow.show()
      if (isMaximized) {
        mainWindow.maximize()
      }
      // Force Chromium compositor to layout to full viewport dimensions
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.invalidate()
          mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("resize"));').catch(() => {})
        }
      }, 50)
    }
  }


  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isDevToolsShortcut =
      (input.control && input.shift && input.key.toLowerCase() === 'i') ||
      input.key === 'F12'
    if (isDevToolsShortcut) {
      if (allowDevTools) {
        if (input.type === 'keyDown') {
          mainWindow.webContents.toggleDevTools()
        }
        event.preventDefault()
      } else {
        event.preventDefault()
      }
    }
  })

  mainWindow.on('ready-to-show', async () => {
    await showWindowSafely()

    new AppUpdater(mainWindow)

    SettingsManager.onChange((settings) => {
      allowDevTools = !app.isPackaged || settings.enableDevTools === true
      if (!allowDevTools && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      }
      useGlobalShortcut(mainWindow, settings)
      updateAutoLauncher(settings.launchOnStartup)
    })

    SettingsManager.get().then((settings) => {
      allowDevTools = !app.isPackaged || settings.enableDevTools === true
      useGlobalShortcut(mainWindow, settings)
      updateAutoLauncher(settings.launchOnStartup)
    })
  })

  setTimeout(() => {
    showWindowSafely()
  }, 1500)

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
      setAppQuitting(true)
      app.quit()
    }
  })

  useTrayIcon(mainWindow, app, appIcon)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {}
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    const isLocalDev = devUrl && navigationUrl.startsWith(devUrl)
    const isLocalFile = navigationUrl.startsWith('file://')
    if (!isLocalDev && !isLocalFile) {
      event.preventDefault()
      try {
        const url = new URL(navigationUrl)
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          shell.openExternal(navigationUrl)
        }
      } catch {}
    }
  })

  useResizeWindow(mainWindow)
  useWindowOpacity(mainWindow)

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    let retryCount = 0
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // Never trigger full-window reloads for subframes/iframes that fail to load
      if (!isMainFrame) return
      if (retryCount < 5 && !mainWindow.isDestroyed()) {
        retryCount++
        setTimeout(() => {
          if (!mainWindow.isDestroyed() && process.env['ELECTRON_RENDERER_URL']) {
            mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']).catch(() => {})
          }
        }, 500)
      }
    })
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
    app.setAppUserModelId(app.isPackaged ? 'io.lumina.app' : process.execPath)
  }

  // Allow renderer process to communicate directly with local Ollama (:11434) without CORS issues
  if (session && session.defaultSession && session.defaultSession.webRequest) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.url && details.url.includes(':11434')) {
        const responseHeaders = { ...details.responseHeaders }
        responseHeaders['access-control-allow-origin'] = ['*']
        responseHeaders['access-control-allow-methods'] = ['GET, POST, OPTIONS, PUT, DELETE']
        responseHeaders['access-control-allow-headers'] = ['*']
        callback({ responseHeaders })
        return
      }
      callback({ responseHeaders: details.responseHeaders })
    })
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
        relativePath = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''))
      } else {
        // Fallback for old markdown format just in case
        let fallbackUrl = request.url.replace('asset://', '').replace('asset:///', '')
        relativePath = decodeURIComponent(fallbackUrl.replace(/^\/+/, ''))
      }

      if (!WorkspaceManager.workspacePath || !relativePath)
        return new Response('Workspace not open', { status: 404 })

      const workspaceRoot = path.resolve(WorkspaceManager.workspacePath)
      const finalPath = path.resolve(workspaceRoot, relativePath)

      // Strict containment check: prevent path traversal attacks outside workspace
      if (!finalPath.startsWith(workspaceRoot + path.sep) && finalPath !== workspaceRoot) {
        console.warn('[Protocol] Blocked path traversal attempt:', relativePath)
        return new Response('Access Denied: Path Traversal Forbidden', { status: 403 })
      }

      // Read file directly from disk to avoid Windows URI parsing bugs with net.fetch
      const data = await fs.readFile(finalPath)

      const ext = path.extname(finalPath).toLowerCase()
      let mimeType = 'image/png'
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
      else if (ext === '.gif') mimeType = 'image/gif'
      else if (ext === '.webp') mimeType = 'image/webp'
      else if (ext === '.svg') mimeType = 'image/svg+xml'
      else if (ext === '.pdf') mimeType = 'application/pdf'

      const arrayBuffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      return new Response(arrayBuffer, {
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

  // Ollama Model Detection (IPC avoids browser CORS and IPv6/IPv4 mismatch)
  ipcMain.handle('ollama:getModels', async (_, rawUrl) => {
    try {
      const ollamaFetch = typeof net?.fetch === 'function' ? net.fetch.bind(net) : fetch
      let baseUrl = 'http://127.0.0.1:11434'
      try {
        const parsed = new URL(rawUrl || 'http://127.0.0.1:11434')
        const port = parsed.port || '11434'
        const proto = parsed.protocol || 'http:'
        const host = parsed.hostname || '127.0.0.1'
        baseUrl = `${proto}//${host}:${port}`
      } catch {}

      const parsedUrl = new URL(baseUrl)
      const port = parsedUrl.port || '11434'
      const proto = parsedUrl.protocol || 'http:'

      const endpoints = [
        `${baseUrl}/api/tags`,
        `${proto}//127.0.0.1:${port}/api/tags`,
        `${proto}//localhost:${port}/api/tags`
      ]
      const uniqueEndpoints = [...new Set(endpoints)]

      for (const endpoint of uniqueEndpoints) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 2500)
          const res = await ollamaFetch(endpoint, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          if (res.ok) {
            const data = await res.json()
            const models = Array.isArray(data?.models) ? data.models : []
            const names = models
              .map((m) => (typeof m === 'string' ? m : m.name || m.model))
              .filter(Boolean)
            return { ok: true, models: names }
          }
        } catch (_) {}
      }
      return { ok: false, error: 'Ollama is offline or unreachable', models: [] }
    } catch (err) {
      return { ok: false, error: err?.message || 'Failed to query Ollama', models: [] }
    }
  })

  // Direct IPC Ollama Chat (Zero-CORS, reliable localhost/127.0.0.1 fallback)
  ipcMain.handle('ollama:chat', async (_, payload) => {
    try {
      const ollamaFetch = typeof net?.fetch === 'function' ? net.fetch.bind(net) : fetch
      const { url: rawUrl, model, messages, tools, options } = payload || {}
      let baseUrl = 'http://127.0.0.1:11434'
      try {
        const parsed = new URL(rawUrl || 'http://127.0.0.1:11434')
        const port = parsed.port || '11434'
        const proto = parsed.protocol || 'http:'
        const host = parsed.hostname || '127.0.0.1'
        baseUrl = `${proto}//${host}:${port}`
      } catch {}

      const parsedUrl = new URL(baseUrl)
      const port = parsedUrl.port || '11434'
      const proto = parsedUrl.protocol || 'http:'

      const endpoints = [
        `${baseUrl}/api/chat`,
        `${proto}//127.0.0.1:${port}/api/chat`,
        `${proto}//localhost:${port}/api/chat`
      ]
      const uniqueEndpoints = [...new Set(endpoints)]

      let lastConnectionError = ''
      for (const endpoint of uniqueEndpoints) {
        try {
          const res = await ollamaFetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              model: model || 'llama3',
              messages: messages || [],
              tools: Array.isArray(tools) && tools.length ? tools : undefined,
              stream: false,
              options: options || {}
            })
          })
          if (res.ok) {
            const data = await res.json()
            return {
              ok: true,
              content: data?.message?.content || '',
              message: data?.message || { role: 'assistant', content: '' }
            }
          }
          const responseText = (await res.text().catch(() => '')).slice(0, 1200)
          if (res.status === 404 && /model/i.test(responseText)) {
            return {
              ok: false,
              error: `Model "${model}" was not found in Ollama. Pull it in terminal with "ollama pull ${model}" or select an installed model in Settings.`
            }
          }
          return {
            ok: false,
            error: `Ollama returned HTTP ${res.status}${responseText ? `: ${responseText}` : ''}`
          }
        } catch (error) {
          lastConnectionError = error?.message || String(error)
        }
      }
      return {
        ok: false,
        error: `Unable to connect to Ollama at ${baseUrl}. ${lastConnectionError || 'Check that Ollama is running and the server URL is correct.'}`
      }
    } catch (err) {
      return { ok: false, error: err?.message || 'Failed to communicate with Ollama' }
    }
  })

  // Keep NDJSON transport handlers in the Ollama module, separate from app setup.
  registerOllamaChatStream(ipcMain, net)
  ipcMain.handle('backup:start', (event, mode) =>
    backupToDrive(WorkspaceManager.workspacePath, mode, event.sender)
  )
  ipcMain.handle('backup:file', (event, fileInput) =>
    backupFileToDrive(fileInput, WorkspaceManager.workspacePath, event.sender)
  )
  ipcMain.handle('backup:cancel', () => cancelBackup())


  ipcMain.handle('clipboard:writeImage', async (_, dataUrl) => {
    try {
      const img = nativeImage.createFromDataURL(dataUrl)
      clipboard.writeImage(img)
      return true
    } catch (err) {
      console.error('[Main] Failed to write image to clipboard:', err)
      throw err
    }
  })
  ipcMain.handle('clipboard:readImageBuffer', async () => {
    try {
      const img = clipboard.readImage()
      if (img && !img.isEmpty()) {
        return img.toPNG()
      }
      return null
    } catch (err) {
      console.error('[Main] Failed to read image from clipboard:', err)
      return null
    }
  })
  ipcMain.handle('app:getVersion', () => app.getVersion()) // show the version
  ipcMain.handle('app:isPackaged', () => app.isPackaged)


  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)
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

  // Global shortcut pause/resume handlers for recording keyboard shortcuts
  ipcMain.handle('shortcuts:pause-global', () => {
    pauseGlobalShortcut()
    return true
  })
  ipcMain.handle('shortcuts:resume-global', () => {
    resumeGlobalShortcut()
    return true
  })


  // Export handlers
  ipcMain.handle('window:export-html', async (_, payload) => handleExportCleanHTML(mainWindow, payload))
  ipcMain.handle('window:export-docs', async (_, payload) => handleExportDocs(mainWindow, payload))
  ipcMain.handle('window:export-pdf', async (_, payload) => handleExportPDF(mainWindow, payload))
  ipcMain.handle('window:export-markdown', async (_, payload) =>
    handleExportMarkdown(mainWindow, payload)
  )
  ipcMain.handle('window:export-markdown-bundle', async (_, payload) =>
    handleExportMarkdownBundle(mainWindow, payload)
  )
  ipcMain.handle('window:export-text', async (_, payload) => handleExportText(mainWindow, payload))

  // Setup Google Auth & Gmail
  setupGoogleAuth(() => mainWindow)
  setupGmailIpc()

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

  // Workspace IPC Handlers (dual registered for backwards compatibility)
  const registerWorkspaceHandle = (channelSuffix, handler) => {
    ipcMain.handle(`workspace:${channelSuffix}`, handler)
    ipcMain.handle(`vault:${channelSuffix}`, handler)
  }

  registerWorkspaceHandle('getSnippets', () => WorkspaceManager.getSnippets())
  registerWorkspaceHandle('readSnippet', async (_, id) => WorkspaceManager.readSnippet(id))
  registerWorkspaceHandle('readNotePreview', async (_, id) => WorkspaceManager.readNotePreview(id))
  registerWorkspaceHandle('saveSnippet', async (_, snippet) => {
    const updatedSnippet = await WorkspaceManager.saveSnippet(snippet)
    if (WorkspaceManager.workspacePath && updatedSnippet?.fileName) {
      const filePath = path.join(
        WorkspaceManager.workspacePath,
        updatedSnippet.folderId || '',
        updatedSnippet.fileName
      )
      WorkspaceIndexer.indexFile(filePath, true)
        .then(() => WorkspaceSearch.reload())
        .catch((err) => {
          console.error('[Main] Auto-index failed:', err)
        })
    }
    return updatedSnippet
  })
  registerWorkspaceHandle('saveImage', (_, { buffer, name }) => WorkspaceManager.saveImage(buffer, name))
  registerWorkspaceHandle('saveImageFromPath', async (_, { filePath, name }) => {
    try {
      if (!filePath) return null
      let cleanPath = String(filePath).trim().replace(/^["']|["']$/g, '')
      cleanPath = cleanPath.split('?')[0].split('#')[0]

      if (/^file:\/\//i.test(cleanPath)) {
        cleanPath = cleanPath.replace(/^file:\/\/(localhost\/)?/i, '')
        try {
          cleanPath = decodeURIComponent(cleanPath)
        } catch (_) {}
      }

      if (/^[/\\][a-zA-Z]:/.test(cleanPath)) {
        cleanPath = cleanPath.slice(1)
      }

      cleanPath = path.normalize(cleanPath)

      try {
        await fs.access(cleanPath)
      } catch {
        return null
      }
      const buffer = await fs.readFile(cleanPath)
      let fileName = name || path.basename(cleanPath) || `Pasted image ${Date.now()}.png`
      const ext = path.extname(fileName).toLowerCase()
      if (!ext || ext === '.tmp') {
        let detectedExt = '.png'
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) detectedExt = '.jpg'
        else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) detectedExt = '.gif'
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) detectedExt = '.webp'
        fileName = `${path.basename(fileName, ext)}${detectedExt}`
      }
      return await WorkspaceManager.saveImage(buffer, fileName)
    } catch (err) {
      console.error('[Main] saveImageFromPath error:', err)
      return null
    }
  })
  registerWorkspaceHandle('saveWorkspaceImage', (_, { buffer, targetFolder, name }) =>
    WorkspaceManager.saveWorkspaceImage(buffer, targetFolder, name)
  )
  registerWorkspaceHandle('saveVaultImage', (_, { buffer, targetFolder, name }) =>
    WorkspaceManager.saveWorkspaceImage(buffer, targetFolder, name)
  )
  registerWorkspaceHandle('readAsset', (_, relPath) => WorkspaceManager.readAsset(relPath))
  registerWorkspaceHandle('deleteAsset', (_, relPath) => WorkspaceManager.deleteAsset(relPath))
  registerWorkspaceHandle('deleteSnippet', async (_, id) => {
    try {
      const deletedPath = await WorkspaceManager.deleteSnippet(id)
      if (deletedPath && typeof deletedPath === 'string') {
        // Run index cleanup in background without blocking the IPC return
        WorkspaceIndexer.deleteChunksForFile(deletedPath)
          .then(() => WorkspaceSearch.reload())
          .catch((err) => console.error('[Main] Search index cleanup error:', err))
      }
      return true
    } catch (err) {
      throw err
    }
  })
  registerWorkspaceHandle('deleteChunks', async (_, target) => {
    try {
      const deletePromise = Array.isArray(target)
        ? WorkspaceIndexer.deleteChunksForFiles(target)
        : WorkspaceIndexer.deleteChunksForFile(target)

      deletePromise
        .then(() => WorkspaceSearch.reload())
        .catch((err) => console.error('[Main] Failed to reload search after deleteChunks:', err))

      return true
    } catch (err) {
      console.error('[Main] Failed to delete chunks:', err)
      return false
    }
  })
  registerWorkspaceHandle('cleanOrphans', async () => await WorkspaceManager.cleanOrphanedAssets())

  registerWorkspaceHandle('createFolder', async (_, path) => await WorkspaceManager.createFolder(path))
  registerWorkspaceHandle(
    'renameFolder',
    async (_, oldPath, newPath) => await WorkspaceManager.renameFolder(oldPath, newPath)
  )
  registerWorkspaceHandle('moveFile', async (_, oldRelPath, newRelPath) => {
    const result = await WorkspaceManager.moveFile(oldRelPath, newRelPath)
    if (WorkspaceManager.workspacePath) {
      const oldFullPath = path.join(WorkspaceManager.workspacePath, oldRelPath)
      const newFullPath = path.join(WorkspaceManager.workspacePath, newRelPath)
      await WorkspaceIndexer.deleteChunksForFile(oldFullPath)
      if (newFullPath.endsWith('.md')) {
        await WorkspaceIndexer.indexFile(newFullPath, true)
      }
      await WorkspaceSearch.reload()
    }
    return result
  })
  registerWorkspaceHandle('deleteFolder', async (_, folderPath) => {
    const result = await WorkspaceManager.deleteFolder(folderPath)
    if (result?.deletedFilePaths && Array.isArray(result.deletedFilePaths)) {
      await WorkspaceIndexer.removeFiles(result.deletedFilePaths)
      await WorkspaceSearch.reload()
    }
    return result
  })
  registerWorkspaceHandle('bulkDelete', async (_, { folderIds, snippetIds }) => {
    const result = await WorkspaceManager.bulkDelete({ folderIds, snippetIds })
    if (result?.deletedFilePaths && Array.isArray(result.deletedFilePaths)) {
      await WorkspaceIndexer.removeFiles(result.deletedFilePaths)
      await WorkspaceSearch.reload()
    }
    return result
  })
  registerWorkspaceHandle('importExternalPaths', async (_, { sourcePaths, targetFolderId }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('index:progress', {
        stage: 'scanning',
        progress: 0,
        total: sourcePaths?.length || 0,
        found: sourcePaths?.length || 0
      })
    }
    const result = await WorkspaceManager.importExternalPaths(sourcePaths, targetFolderId)
    if (WorkspaceManager.workspacePath) {
      WorkspaceIndexer.indexWorkspace(WorkspaceManager.workspacePath, {
        onProgress: (prog) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('index:progress', prog)
          }
        }
      })
        .then(() => WorkspaceSearch.reload())
        .catch((err) => {
          console.error('[Main] Indexing imported files failed:', err)
        })
    }
    return result
  })

  // System
  registerWorkspaceHandle('open-folder', async (_, relativePath) => {
    if (WorkspaceManager.workspacePath) {
      if (relativePath) {
        const { join } = require('path')
        shell.showItemInFolder(join(WorkspaceManager.workspacePath, relativePath))
      } else {
        await shell.openPath(WorkspaceManager.workspacePath)
      }
    }
  })

  registerWorkspaceHandle('select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (canceled) return null
    const newPath = filePaths[0]

    // Update app_config.json so the workspace persists across app restarts
    SettingsManager.appConfig.setLastWorkspacePath(newPath)
    await SettingsManager.appConfig.save()

    await SettingsManager.init(newPath)
    await WorkspaceManager.init(newPath)

    // Index new workspace in background
    WorkspaceIndexer.indexWorkspace(newPath, {
      force: false,
      onProgress: (stats) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('index:progress', stats)
        }
      }
    })
      .then(() => {
        return WorkspaceSearch.reload()
      })
      .catch((err) => {
        console.error('[Main] Workspace indexing failed:', err)
      })
    return newPath
  })

  // Workspace Indexing IPC Handlers
  registerWorkspaceHandle('index', async (_, workspacePath, options = {}) => {
    try {
      const targetPath = workspacePath || WorkspaceManager.workspacePath
      if (!targetPath || typeof targetPath !== 'string') {
        throw new Error('Workspace path must be a string. Please select a workspace folder first.')
      }

      const result = await WorkspaceIndexer.indexWorkspace(targetPath, {
        ...options,
        onProgress: (stats) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('index:progress', stats)
          }
          if (options.onProgress) options.onProgress(stats)
        }
      })
      await WorkspaceSearch.reload()
      return result
    } catch (err) {
      console.error('[Main] Index request failed:', err)
      throw err
    }
  })

  registerWorkspaceHandle('rebuild-index', async (_, workspacePath) => {
    try {
      const targetPath = workspacePath || WorkspaceManager.workspacePath
      const result = await WorkspaceIndexer.rebuildIndex(targetPath, {
        onProgress: (stats) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('index:progress', stats)
          }
        }
      })
      await WorkspaceSearch.reload()
      return result
    } catch (err) {
      console.error('[Main] Rebuild index failed:', err)
      throw err
    }
  })

  registerWorkspaceHandle('index-stats', async () => {
    try {
      return await WorkspaceIndexer.getStats()
    } catch (err) {
      console.error('[Main] Get index stats failed:', err)
      return { error: err.message }
    }
  })

  // Workspace Search IPC Handlers
  registerWorkspaceHandle('search', async (_, query, options = {}) => {
    try {
      if (!hasIndexed && WorkspaceManager.workspacePath) {
        hasIndexed = true
        WorkspaceIndexer.indexWorkspace(WorkspaceManager.workspacePath, {
          force: false,
          onProgress: (stats) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('index:progress', stats)
            }
          }
        })
          .then(() => WorkspaceSearch.reload())
          .catch((err) => console.error('[Main] Lazy indexing failed:', err))
      }

      return await WorkspaceSearch.search(query, options)
    } catch (err) {
      console.error('[Main] Search failed:', err)
      return []
    }
  })

  registerWorkspaceHandle('search-stats', () => {
    try {
      return WorkspaceSearch.getStats()
    } catch (err) {
      return { error: err.message }
    }
  })

  registerWorkspaceHandle('find-similar', async (_, chunkId, limit = 10) => {
    try {
      return await WorkspaceSearch.findSimilar(chunkId, limit)
    } catch (err) {
      console.error('[Main] Find similar failed:', err)
      return []
    }
  })

  // Brain Knowledge Base Search & Index IPC (silent, isolated)
  ipcMain.handle('brain:search', async (_, query, options) => {
    try {
      return await BrainIndexer.search(query, options)
    } catch (err) {
      console.warn('[Main] brain:search notice:', err)
      return []
    }
  })

  ipcMain.handle('brain:stats', async () => {
    try {
      return BrainIndexer.getStats()
    } catch (_) {
      return { totalFiles: 0, totalChunks: 0, lastIndexTime: null, isLoaded: false }
    }
  })

  ipcMain.handle('brain:reindex', async () => {
    try {
      return await BrainIndexer.indexBrain(true)
    } catch (err) {
      console.warn('[Main] brain:reindex notice:', err)
      return { indexed: false, totalFiles: 0, totalChunks: 0 }
    }
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })

  const memoryFilePath = join(app.getPath('userData'), 'memory.json')

  ipcMain.handle('memory:load', async () => {
    try {
      const data = await fs.readFile(memoryFilePath, 'utf8')
      return JSON.parse(data)
    } catch (_) {
      const defaultMemory = {
        user: { name: null, role: null, bio: null },
        preferences: [],
        facts: []
      }
      try {
        await fs.mkdir(path.dirname(memoryFilePath), { recursive: true })
        await fs.writeFile(memoryFilePath, JSON.stringify(defaultMemory, null, 2), 'utf8')
      } catch (err) {
        console.error('[Main] Failed to create default memory.json:', err)
      }
      return defaultMemory
    }
  })

  ipcMain.handle('memory:save', async (_, memory) => {
    try {
      await fs.mkdir(path.dirname(memoryFilePath), { recursive: true })
      await fs.writeFile(memoryFilePath, JSON.stringify(memory, null, 2), 'utf8')
      return true
    } catch (err) {
      console.error('[Main] Failed to save memory.json:', err)
      return false
    }
  })

  ipcMain.handle('system:isCapsLockOn', () => {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process')
        const out = execSync('powershell.exe -NoProfile -NonInteractive -Command [Console]::CapsLock', {
          windowsHide: true,
          timeout: 1000
        })
        return out.toString().trim().toLowerCase() === 'true'
      }
      if (typeof electron.keyboard?.isModifierKeyActive === 'function') {
        return electron.keyboard.isModifierKeyActive('capsLock')
      }
      return false
    } catch {
      return false
    }
  })

  registerOpenNoteHandler()

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

    let savedWorkspacePath = null

    // ── E2E test mode ──────────────────────────────────────────────────────────
    // When launched by Playwright, LUMINA_TEST_WORKSPACE / LUMINA_TEST_VAULT points to a fresh temp dir.
    // Skip reading app_config.json so the app starts with a clean empty workspace
    // and shows the welcome page, exactly as a brand-new user would see it.
    if (process.env.LUMINA_TEST_WORKSPACE || process.env.LUMINA_TEST_VAULT) {
      savedWorkspacePath = process.env.LUMINA_TEST_WORKSPACE || process.env.LUMINA_TEST_VAULT
    } else {
      try {
        await SettingsManager.appConfig.load()
        savedWorkspacePath = SettingsManager.appConfig.getLastWorkspacePath()
      } catch (e) {
        // Fallback migration: read from old settings.json
        try {
          const oldSettings = await fs.readFile(join(userDataPath, 'settings.json'), 'utf8')
          const oldCfg = JSON.parse(oldSettings)
          savedWorkspacePath = oldCfg.lastWorkspacePath || oldCfg.workspacePath || oldCfg.vaultPath
        } catch (err) {}
      }
    }
    // ───────────────────────────────────────────────────────────────────────────

    const oldDefaultPath = join(app.getPath('documents'), 'Lumina Vault')
    const newDefaultPath = join(app.getPath('documents'), 'lumina')

    if (!savedWorkspacePath || savedWorkspacePath === oldDefaultPath) {
      savedWorkspacePath = newDefaultPath
      SettingsManager.appConfig.setLastWorkspacePath(savedWorkspacePath)
      await SettingsManager.appConfig.save()
    }

    // Initialize SettingsManager inside the workspace
    await SettingsManager.init(savedWorkspacePath)

    // Initialize workspace indexer and search
    await WorkspaceIndexer.init(userDataPath)
    await WorkspaceSearch.init(userDataPath)

    // Initialize Brain knowledge indexer (silent, isolated)
    await BrainIndexer.init(userDataPath).catch((err) =>
      console.warn('[Main] BrainIndexer init warning:', err)
    )

    const workspaceInitPromise = WorkspaceManager.init(savedWorkspacePath, app.getPath('documents'))

    const startupWorkspacePath = savedWorkspacePath

    // Ensure IndexedDB LevelDB caches are healthy before creating window
    await autoRepairIndexedDB()

    await createWindow()

    mainWindow.webContents.once('did-finish-load', () => {
      WorkspaceIndexer.warmWorker().catch((err) => console.error('[Main] Worker pre-warm failed:', err))

      // Background indexing of Lumina Brain knowledge base (silent, non-blocking)
      setTimeout(() => {
        BrainIndexer.indexBrain()
          .then((res) => {
            if (res?.indexed) {
              console.info(
                `[Main] ✓ Brain Knowledge Base indexed: ${res.totalFiles} files, ${res.totalChunks} sections`
              )
            }
          })
          .catch((err) => console.warn('[Main] Brain indexing notice:', err))
      }, 1500)

      if (startupWorkspacePath && typeof startupWorkspacePath === 'string') {
        hasIndexed = true

        setTimeout(() => {
          workspaceInitPromise
            .then(() => WorkspaceIndexer.indexWorkspace(startupWorkspacePath, {
            force: false,
            onProgress: (stats) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('index:progress', stats)
              }
            }
          }))
            .then(() => {
              return WorkspaceSearch.reload()
            })
            .catch((err) => {
              console.error('[Main] Startup workspace indexing failed:', err)
            })
        }, 1200)
      }
    })
  } catch (err) {
    console.error('[Main] Initialization error:', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', async () => {
  try {
    await SettingsManager.flush()
  } catch (_) {}
})

app.on('window-all-closed', async () => {
  try {
    await SettingsManager.flush()
  } catch (_) {}
  const settings = SettingsManager.getAll()
  const launchOnStartup = settings?.launchOnStartup === true
  if (process.platform !== 'darwin' && (!launchOnStartup || isAppQuitting())) {
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
