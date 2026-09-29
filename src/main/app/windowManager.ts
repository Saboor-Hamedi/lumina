/**
 * ============================================================================
 * Lumina Window Manager
 * ============================================================================
 * 
 * Manages the creation, configuration, and event orchestration of Lumina's
 * primary BrowserWindow instance:
 * 
 * 1. Geometry & Bounds Restoration:
 *    - Loads persisted window geometry and maximized state from SettingsManager.
 *    - Applies responsive bounds based on the user's primary display work area.
 * 
 * 2. Shell & Viewport Safety:
 *    - Frameless window with custom title bar support (`frame: false`).
 *    - Defers maximization until visible to prevent Chromium compositor desyncs.
 *    - Dispatches a synthetic window resize event into the DOM once shown.
 * 
 * 3. Security & Navigation Containment:
 *    - Prevents arbitrary web navigation within the window (`will-navigate`).
 *    - Opens external HTTP/HTTPS links in the default OS browser (`setWindowOpenHandler`).
 *    - Enforces context isolation and local file sandboxing.
 * 
 * 4. Integrations & Lifecycle Hooks:
 *    - Attaches AppUpdater, System Tray icon, and global hotkeys.
 *    - Reacts dynamically to Settings changes (DevTools toggle, startup state).
 *    - Gracefully handles renderer crashes with interactive recovery prompts.
 */

import electron, { app, shell, BrowserWindow, screen, dialog } from 'electron'
import { join } from 'path'
import SettingsManager from '../settings'
// @ts-ignore
import AppUpdater from '../AppUpdater'
// @ts-ignore
import iconAsset from '../../../resources/icon.png?asset'
// @ts-ignore
import { useResizeWindow } from '../handlers/useResizeWindow'
// @ts-ignore
import { useWindowOpacity } from '../handlers/useWindowOpacity'
import { useGlobalShortcut } from '../shortcuts/useGlobalShortcut'
// @ts-ignore
import { useTrayIcon, setAppQuitting } from '../handlers/useTrayIcon'
// @ts-ignore
import { updateAutoLauncher } from '../handlers/useAutoLauncher'

let mainWindow: BrowserWindow | null = null

/**
 * Returns the currently active main BrowserWindow instance, or null if not yet created.
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * Creates and initializes the primary Lumina desktop window.
 */
export async function createMainWindow(): Promise<BrowserWindow> {
  const iconPath = iconAsset
  const appIcon = electron.nativeImage.createFromPath(iconPath)

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const isMaximized = (await SettingsManager.get('isMaximized').catch(() => true)) ?? true
  const savedBounds = await SettingsManager.get('windowBounds').catch(() => null) as any
  const windowBounds = savedBounds || { width: 1000, height: 700 }

  const initialWidth = isMaximized ? screenWidth : windowBounds.width
  const initialHeight = isMaximized ? screenHeight : windowBounds.height
  const initialX = isMaximized ? undefined : windowBounds?.x
  const initialY = isMaximized ? undefined : windowBounds?.y

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
    } as any
  })

  // Window creation: only maximize when visible to prevent Chromium viewport desync
  const showWindowSafely = async (): Promise<void> => {
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

  // Intercept DevTools keyboard accelerators (Ctrl+Shift+I / F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isDevToolsShortcut =
      (input.control && input.shift && input.key.toLowerCase() === 'i') ||
      input.key === 'F12'
    if (isDevToolsShortcut) {
      if (allowDevTools) {
        if (input.type === 'keyDown') {
          mainWindow?.webContents.toggleDevTools()
        }
        event.preventDefault()
      } else {
        event.preventDefault()
      }
    }
  })

  // When window is rendered and ready to display
  mainWindow.on('ready-to-show', async () => {
    await showWindowSafely()

    if (mainWindow) {
      new AppUpdater(mainWindow)
    }

    // Reactively update system integrations when settings change
    SettingsManager.onChange((settings: any) => {
      allowDevTools = !app.isPackaged || settings.enableDevTools === true
      if (!allowDevTools && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      }
      if (mainWindow) {
        useGlobalShortcut(mainWindow, settings)
      }
      updateAutoLauncher(settings.launchOnStartup)
    })

    // Initial setup from persisted settings
    SettingsManager.get().then((settings: any) => {
      allowDevTools = !app.isPackaged || settings.enableDevTools === true
      if (mainWindow) {
        useGlobalShortcut(mainWindow, settings)
      }
      updateAutoLauncher(settings.launchOnStartup)
    })
  })

  // Fallback safety timeout if ready-to-show is delayed
  setTimeout(() => {
    showWindowSafely()
  }, 1500)

  // Interactive recovery dialog if renderer crashes unexpectedly
  mainWindow.webContents.on('render-process-gone', async (_event, details) => {
    console.error('[WindowManager] Renderer Process Gone:', details.reason)
    if (!mainWindow) return
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

  // Attach tray icon
  useTrayIcon(mainWindow, app, appIcon)

  // External link routing: open standard links in user's OS browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {}
    return { action: 'deny' }
  })

  // Prevent internal navigation away from the application bundle
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

  // Window frame behaviors
  useResizeWindow(mainWindow)
  useWindowOpacity(mainWindow)

  // Load URL in development or static index.html in production
  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    let retryCount = 0
    mainWindow.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, _validatedURL, isMainFrame) => {
      // Never trigger full-window reloads for subframes/iframes that fail to load
      if (!isMainFrame) return
      if (retryCount < 5 && mainWindow && !mainWindow.isDestroyed()) {
        retryCount++
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed() && process.env['ELECTRON_RENDERER_URL']) {
            mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']).catch(() => {})
          }
        }, 500)
      }
    })
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
