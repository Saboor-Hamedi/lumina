import { app, ipcMain, clipboard, nativeImage, BrowserWindow, shell } from 'electron'
import electron from 'electron'
import { join } from 'path'
import fs from 'fs/promises'
import { pauseGlobalShortcut, resumeGlobalShortcut } from '../shortcuts/useGlobalShortcut'
import { validateIpc, z } from './ipcValidation'

/**
 * ============================================================================
 * System & Window IPC Handlers
 * ============================================================================
 *
 * Manages OS-level interactions, window control, clipboard, shortcuts, and logging:
 * - Window controls: minimize, maximize, toggle-maximize, close, open-devtools.
 * - Clipboard: writing data URLs as images, reading clipboard image buffers.
 * - Global Shortcuts: pause / resume during shortcut recording in Settings.
 * - Application metadata: app version, packaged state.
 * - Diagnostic logging: renderer console and React ErrorBoundary file logging.
 * - Keyboard state: Caps Lock indicator check.
 */

const dataUrlSchema = z.string().min(1)
const logPayloadSchema = z.record(z.string(), z.any())

export function registerSystemHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Write a base64 Data URL directly to OS clipboard as an image
  ipcMain.handle('clipboard:writeImage', async (_, dataUrl) => {
    try {
      const validUrl = validateIpc(dataUrlSchema, dataUrl)
      const img = nativeImage.createFromDataURL(validUrl)
      clipboard.writeImage(img)
      return true
    } catch (err) {
      console.error('[Main] Failed to write image to clipboard:', err)
      throw err
    }
  })

  // Read current image from OS clipboard as PNG buffer
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

  // Return application version from package.json
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // Check if running in packaged production build vs local dev
  ipcMain.handle('app:isPackaged', () => app.isPackaged)

  // Window control actions
  ipcMain.handle('window:minimize', () => getMainWindow()?.minimize())
  ipcMain.handle('window:is-maximized', () => getMainWindow()?.isMaximized() ?? false)

  ipcMain.handle('window:open-devtools', () => {
    try {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.openDevTools({ mode: 'detach' })
      }
    } catch (e) {
      console.error('Failed to open DevTools:', e)
    }
  })

  ipcMain.handle('window:toggle-maximize', () => {
    const win = getMainWindow()
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.handle('window:close', () => getMainWindow()?.close())

  // Temporarily pause global accelerator registration while user rebinds shortcuts in Settings
  ipcMain.handle('shortcuts:pause-global', () => {
    pauseGlobalShortcut()
    return true
  })

  // Re-enable global accelerators after shortcut recording completes
  ipcMain.handle('shortcuts:resume-global', () => {
    resumeGlobalShortcut()
    return true
  })

  // Append renderer logs to %APPDATA%/lumina/renderer.log
  ipcMain.on('renderer:log', async (_, payload) => {
    try {
      const valid = validateIpc(logPayloadSchema, payload || {})
      const logDir = app.getPath('userData')
      const logFile = join(logDir, 'renderer.log')
      const line = `[${new Date(valid.time || Date.now()).toISOString()}] ${valid.type || 'log'}: ${valid.message || ''}\n${valid.error || ''}\n\n`
      await fs.appendFile(logFile, line, 'utf8')
    } catch (err) {
      console.error('Failed to write renderer log:', err)
    }
  })

  // Append React Error Boundary errors to %APPDATA%/lumina/error-boundary.log
  ipcMain.handle('error:log', async (_, errorData) => {
    try {
      const valid = validateIpc(logPayloadSchema, errorData || {})
      const logDir = app.getPath('userData')
      const logFile = join(logDir, 'error-boundary.log')
      const timestamp = new Date(valid.timestamp || Date.now()).toISOString()
      const line = `[${timestamp}] ErrorBoundary Error:\nMessage: ${valid.message || 'Unknown'}\nStack: ${valid.stack || 'N/A'}\nComponent Stack: ${valid.componentStack || 'N/A'}\n\n`
      await fs.appendFile(logFile, line, 'utf8')
      console.error('[ErrorBoundary]', valid)
      return true
    } catch (err) {
      console.error('Failed to write error log:', err)
      return false
    }
  })

  // Check hardware Caps Lock state for password fields and editor indicators
  ipcMain.handle('system:isCapsLockOn', () => {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process')
        const out = execSync(
          'powershell.exe -NoProfile -NonInteractive -Command [Console]::CapsLock',
          {
            windowsHide: true,
            timeout: 1000
          }
        )
        return out.toString().trim().toLowerCase() === 'true'
      }
      if (typeof (electron as any).keyboard?.isModifierKeyActive === 'function') {
        return (electron as any).keyboard.isModifierKeyActive('capsLock')
      }
      return false
    } catch {
      return false
    }
  })

  // Open a file at an absolute path with the OS default application
  ipcMain.handle('shell:openPath', async (_, filePath) => {
    const valid = validateIpc(z.string().min(1), filePath)
    return shell.openPath(valid)
  })

  // Reveal a file/folder in the OS file manager (Explorer / Finder)
  ipcMain.handle('shell:showItemInFolder', (_, filePath) => {
    const valid = validateIpc(z.string().min(1), filePath)
    shell.showItemInFolder(valid)
    return true
  })
}
