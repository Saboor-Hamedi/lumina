/**
 * ============================================================================
 * Lumina Crash & Exception Reporter
 * ============================================================================
 * 
 * Provides centralized diagnostic logging and graceful fault recovery for the
 * Electron main process and renderer failures:
 * 
 * 1. Uncaught Exceptions (`process.on('uncaughtException')`):
 *    - Generates unique incident IDs for correlation.
 *    - Persists timestamped stack traces to `%APPDATA%/lumina/crash.log`.
 *    - In production: Dispatches `app:error` to the renderer UI without crashing.
 *    - In development: Displays an immediate native error dialog.
 * 
 * 2. Unhandled Promise Rejections (`process.on('unhandledRejection')`):
 *    - Logs diagnostic traces to `crash.log` and notifies the active window.
 * 
 * 3. Renderer Process Crashes (`app.on('render-process-gone')`):
 *    - Logs termination exit code and reason.
 *    - Automatically attempts to recover and reload the window after 1000ms.
 */

import { app, dialog, BrowserWindow, WebContents } from 'electron'
import { join } from 'path'
import fs from 'fs/promises'

/**
 * Appends a formatted diagnostic entry to the application crash log file.
 */
async function appendCrashLog(entry: string): Promise<void> {
  try {
    const logDir = app.getPath('userData')
    const logFile = join(logDir, 'crash.log')
    await fs.appendFile(logFile, entry, 'utf8')
  } catch (err) {
    console.error('[CrashReporter] Failed to write to crash log:', err)
  }
}

/**
 * Initializes global process-level exception and crash monitoring.
 * 
 * @param getMainWindow - Dynamic getter function returning the active BrowserWindow instance
 */
export function setupCrashReporting(getMainWindow: () => BrowserWindow | null): void {
  // Capture unhandled synchronous exceptions in the main process
  process.on('uncaughtException', async (error: Error) => {
    const errorId = `main-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    console.error(`[Main] Uncaught Exception [${errorId}]:`, error)

    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${errorId}] Uncaught Exception: ${error.message}\nStack: ${error.stack}\n\n`
    await appendCrashLog(logEntry)

    const mainWindow = getMainWindow()

    if (process.env.NODE_ENV === 'production') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('app:error', {
            type: 'uncaughtException',
            message: error.message,
            errorId
          })
        } catch (e) {
          console.error('[CrashReporter] Failed to notify renderer:', e)
        }
      }
    } else {
      try {
        dialog.showErrorBox(
          'Critical Error',
          `A critical error occurred:\n${error.message}\n\nError ID: ${errorId}\nThe app will attempt to continue.`
        )
      } catch (e) {
        console.error('[CrashReporter] Failed to show error dialog:', e)
      }
    }
  })

  // Capture unhandled promise rejections
  process.on('unhandledRejection', async (reason: unknown) => {
    const errorId = `rejection-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    console.error(`[Main] Unhandled Rejection [${errorId}]:`, reason)

    const timestamp = new Date().toISOString()
    const errorMessage = reason instanceof Error ? reason.message : String(reason)
    const errorStack = reason instanceof Error ? reason.stack : 'N/A'
    const logEntry = `[${timestamp}] [${errorId}] Unhandled Rejection: ${errorMessage}\nStack: ${errorStack}\n\n`
    await appendCrashLog(logEntry)

    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('app:error', {
          type: 'unhandledRejection',
          message: errorMessage,
          errorId
        })
      } catch (e) {
        console.error('[CrashReporter] Failed to notify renderer of rejection:', e)
      }
    }
  })

  // Gracefully handle renderer process crashes with automatic reload
  app.on('render-process-gone', (_event, webContents: WebContents, details) => {
    const errorId = `renderer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    console.error(`[Main] Renderer process gone [${errorId}]:`, details)

    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${errorId}] Renderer Process Gone\nReason: ${details.reason}\nExit Code: ${details.exitCode}\n\n`
    appendCrashLog(logEntry)

    if (webContents && !webContents.isDestroyed()) {
      setTimeout(() => {
        try {
          if (webContents && !webContents.isDestroyed()) {
            console.info('[CrashReporter] Attempting to reload renderer process...')
            webContents.reload()
          }
        } catch (e) {
          console.error('[CrashReporter] Failed to reload renderer:', e)
        }
      }, 1000)
    }
  })
}
