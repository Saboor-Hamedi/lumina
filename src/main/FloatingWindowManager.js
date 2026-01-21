import electron from 'electron'
const { BrowserWindow, app, screen } = electron.default || electron
import { join } from 'path'
import SettingsManager from './SettingsManager'

// Store reference to main window for notifications
let mainWindowRef = null

/**
 * FloatingWindowManager
 * Manages floating windows for sidebars (AI Chat, etc.)
 * Handles creation, destruction, and state synchronization between windows.
 */
class FloatingWindowManager {
  constructor() {
    this.floatingWindows = new Map() // Map of windowId -> BrowserWindow
    this.windowStates = new Map() // Map of windowId -> state data
  }

  /**
   * Create a floating window for AI Chat sidebar
   * @param {Object} options - Window options
   * @param {number} options.width - Window width
   * @param {number} options.height - Window height
   * @param {number} options.x - Window X position
   * @param {number} options.y - Window Y position
   * @returns {BrowserWindow} The created floating window
   */
  async createAIChatWindow(options = {}) {
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.ico')
      : join(app.getAppPath(), 'resources', 'icon.ico')
    
    // Get saved floating window position/size
    const savedState = await SettingsManager.get('aiChatFloatingState') || {}
    
    // Calculate position - center on screen if no position provided
    let windowX = options.x
    let windowY = options.y
    if (windowX === undefined) windowX = savedState.x
    if (windowY === undefined) windowY = savedState.y
    
    // If still no position, center on primary display
    if (windowX === undefined || windowY === undefined) {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
      const windowWidth = options.width || savedState.width || 400
      const windowHeight = options.height || savedState.height || 600
      windowX = windowX !== undefined ? windowX : Math.floor((screenWidth - windowWidth) / 2)
      windowY = windowY !== undefined ? windowY : Math.floor((screenHeight - windowHeight) / 2)
    }
    
    const floatingWindow = new BrowserWindow({
      width: options.width || savedState.width || 400,
      height: options.height || savedState.height || 600,
      x: windowX,
      y: windowY,
      minWidth: 300,
      minHeight: 400,
      icon: iconPath,
      show: false, // Don't show until ready
      frame: true, // Floating windows have frames for better UX
      transparent: false, // No transparency for floating windows
      resizable: true,
      maximizable: true,
      minimizable: true,
      alwaysOnTop: false, // Set to true if you want it always on top
      skipTaskbar: false, // Show in taskbar
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        sandbox: false,
        devTools: !app.isPackaged
      },
      title: 'AI Chat - Lumina'
    })

    // Save window state on move/resize
    floatingWindow.on('moved', () => {
      this.saveWindowState('aiChat', floatingWindow)
    })

    floatingWindow.on('resized', () => {
      this.saveWindowState('aiChat', floatingWindow)
    })

    // Clean up on close and notify main window
    floatingWindow.on('closed', () => {
      this.floatingWindows.delete('aiChat')
      this.windowStates.delete('aiChat')
      
      // Notify main window that sidebar should be shown again
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('sidebar:float-changed', { type: 'aiChat', floating: false })
      }
    })

    // Store window reference immediately
    this.floatingWindows.set('aiChat', floatingWindow)

    // Function to show and focus the window
    const showWindow = () => {
      if (!floatingWindow.isDestroyed()) {
        console.info('[FloatingWindowManager] Showing floating window')
        floatingWindow.show()
        floatingWindow.focus()
        // Briefly set always on top to bring it to front, then disable
        floatingWindow.setAlwaysOnTop(true)
        setTimeout(() => {
          if (!floatingWindow.isDestroyed()) {
            floatingWindow.setAlwaysOnTop(false)
          }
        }, 100)
      }
    }

    // Set up ready-to-show handler
    floatingWindow.once('ready-to-show', () => {
      console.info('[FloatingWindowManager] Window ready to show')
      showWindow()
    })

    // Load the floating window content
    const isDev = !app.isPackaged
    try {
      if (isDev && process.env['ELECTRON_RENDERER_URL']) {
        // Dev mode: load from Vite dev server
        const baseUrl = process.env['ELECTRON_RENDERER_URL']
        const separator = baseUrl.includes('?') ? '&' : '?'
        const urlWithParam = `${baseUrl}${separator}floating=aiChat`
        console.info('[FloatingWindowManager] Loading dev URL:', urlWithParam)
        await floatingWindow.loadURL(urlWithParam)
      } else {
        // Production mode: load from file
        const indexPath = join(__dirname, '../renderer/index.html')
        console.info('[FloatingWindowManager] Loading production file:', indexPath)
        await floatingWindow.loadFile(indexPath)
        // Inject query param after DOM is ready
        floatingWindow.webContents.once('did-finish-load', () => {
          floatingWindow.webContents.executeJavaScript(`
            if (!window.location.search.includes('floating=aiChat')) {
              const url = new URL(window.location.href)
              url.searchParams.set('floating', 'aiChat')
              window.history.replaceState({}, '', url.toString())
              window.dispatchEvent(new CustomEvent('floating-mode-changed', { detail: { floating: 'aiChat' } }))
            }
          `).catch((err) => {
            console.error('[FloatingWindowManager] Error injecting query param:', err)
          })
        })
      }

      // Show window immediately after load completes
      showWindow()
    } catch (error) {
      console.error('[FloatingWindowManager] Error loading content:', error)
      // Still try to show the window even if load failed
      showWindow()
      throw error
    }

    // Fallback: ensure window is shown after delay
    setTimeout(() => {
      if (!floatingWindow.isDestroyed() && !floatingWindow.isVisible()) {
        console.warn('[FloatingWindowManager] Window not visible, forcing show')
        showWindow()
      }
    }, 500)

    
    return floatingWindow
  }

  /**
   * Save window state (position, size) to settings
   * @param {string} windowId - Window identifier
   * @param {BrowserWindow} window - The window instance
   */
  async saveWindowState(windowId, window) {
    if (!window || window.isDestroyed()) return

    const [x, y] = window.getPosition()
    const [width, height] = window.getSize()

    const state = { x, y, width, height }
    this.windowStates.set(windowId, state)

    // Persist to settings
    if (windowId === 'aiChat') {
      await SettingsManager.set('aiChatFloatingState', state)
    }
  }

  /**
   * Close a floating window
   * @param {string} windowId - Window identifier
   */
  closeWindow(windowId) {
    const window = this.floatingWindows.get(windowId)
    if (window && !window.isDestroyed()) {
      window.close()
      // Note: cleanup happens in 'closed' event handler
    }
  }

  /**
   * Check if a floating window exists
   * @param {string} windowId - Window identifier
   * @returns {boolean}
   */
  hasWindow(windowId) {
    const window = this.floatingWindows.get(windowId)
    return window && !window.isDestroyed()
  }

  /**
   * Get a floating window
   * @param {string} windowId - Window identifier
   * @returns {BrowserWindow|null}
   */
  getWindow(windowId) {
    const window = this.floatingWindows.get(windowId)
    if (window && !window.isDestroyed()) {
      return window
    }
    return null
  }

  /**
   * Send message to a floating window
   * @param {string} windowId - Window identifier
   * @param {string} channel - IPC channel
   * @param {*} data - Data to send
   */
  sendToWindow(windowId, channel, data) {
    const window = this.getWindow(windowId)
    if (window) {
      window.webContents.send(channel, data)
    }
  }

  /**
   * Broadcast message to all floating windows
   * @param {string} channel - IPC channel
   * @param {*} data - Data to send
   */
  broadcast(channel, data) {
    this.floatingWindows.forEach((window, windowId) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(channel, data)
      }
    })
  }
}

// Export singleton instance
const floatingWindowManager = new FloatingWindowManager()

// Add setMainWindow method to the instance
floatingWindowManager.setMainWindow = (window) => {
  mainWindowRef = window
}

export default floatingWindowManager
