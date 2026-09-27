import { BrowserWindow } from 'electron'
import SettingsManager from '../settings'

/**
 * useResizeWindow (`useResizeWindow.ts`)
 *
 * Manages window dimension persistence, full-screen/maximize state synchronization,
 * and debounced storage updates across application restarts and OS window lifecycle events.
 *
 * Key Behaviors:
 * 1. Persists normal (unmaximized) window bounds so restoring from maximized state retains correct geometry.
 * 2. Persists maximized state (`isMaximized`) so Lumina launches full screen by default when expected.
 * 3. Debounces rapid resize/move events (500ms) to eliminate disk I/O thrashing during manual window dragging.
 * 4. Ensures clean shutdown by committing the final bounds on the window 'close' event.
 */
export function useResizeWindow(mainWindow: BrowserWindow | null): void {
  if (!mainWindow) return

  let boundsTimeout: NodeJS.Timeout | null = null

  /**
   * Persists non-maximized, non-minimized window dimensions and coordinates to Settings.
   */
  const saveBounds = (): void => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds()
      SettingsManager.set('windowBounds', bounds).catch(console.error)
    }
  }

  /**
   * Forces Chromium compositor to repaint and dispatch a DOM resize event
   * to eliminate any black voids or detached viewport lag.
   */
  const forceContentResize = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    try {
      mainWindow.webContents.invalidate()
      mainWindow.webContents
        .executeJavaScript('window.dispatchEvent(new Event("resize"));')
        .catch(() => {})
    } catch (_) {}
  }

  // Handle window resizing (debounced) - using standard Electron 'resize' event
  mainWindow.on('resize', () => {
    if (boundsTimeout) clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(saveBounds, 500)
  })

  // Handle maximize event: record maximized state and notify renderer
  mainWindow.on('maximize', () => {
    SettingsManager.set('isMaximized', true).catch(console.error)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximized-change', true)
    }
    setTimeout(forceContentResize, 50)
    setTimeout(forceContentResize, 150)
  })

  // Handle unmaximize event: record unmaximized state only if not minimizing
  mainWindow.on('unmaximize', () => {
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      // Windows fires 'unmaximize' right before 'minimize' on a maximized window; ignore if minimizing
      if (mainWindow.isMinimized()) return
      if (mainWindow.isMaximized()) return

      SettingsManager.set('isMaximized', false).catch(console.error)
      saveBounds()
      mainWindow.webContents.send('window:maximized-change', false)
      forceContentResize()
    }, 150)
  })

  // Handle restore event: synchronizes state when restoring from minimized state
  mainWindow.on('restore', () => {
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      const isMax = mainWindow.isMaximized()
      if (isMax) {
        SettingsManager.set('isMaximized', true).catch(console.error)
      }
      mainWindow.webContents.send('window:maximized-change', isMax)
      forceContentResize()
    }, 100)
  })

  // Handle window moving (debounced) - using standard Electron 'move' event
  mainWindow.on('move', () => {
    if (boundsTimeout) clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(saveBounds, 500)
  })

  // Final commit on window close
  mainWindow.on('close', () => {
    if (boundsTimeout) clearTimeout(boundsTimeout)
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds()
      SettingsManager.set('windowBounds', bounds).catch(console.error)
    }
  })
}

export default useResizeWindow
