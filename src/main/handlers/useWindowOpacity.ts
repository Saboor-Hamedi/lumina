import { ipcMain, BrowserWindow } from 'electron'
import SettingsManager from '../settings'

/**
 * Window Opacity handler
 * Manages native window opacity scaled strictly from 0 to 1.
 * (Clamped to a safe minimum of 0.20 to prevent windows from becoming completely invisible)
 */
export function useWindowOpacity(mainWindow: BrowserWindow | null): void {
  SettingsManager.get('windowOpacity')
    .then((saved: unknown) => {
      if (typeof saved === 'number' && saved >= 0 && saved <= 1.0) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const effective = Math.max(0.2, saved)
          mainWindow.setOpacity(effective)
        }
      }
    })
    .catch(() => {})

  let saveTimeout: NodeJS.Timeout | null = null

  ipcMain.removeHandler('window:set-opacity')
  ipcMain.handle('window:set-opacity', async (_event, opacity: unknown) => {
    try {
      const num = typeof opacity === 'number' ? opacity : Number(opacity)
      const clamped = Math.max(0, Math.min(1.0, isNaN(num) ? 1.0 : num))
      // Native window opacity clamped to at least 0.2 so window remains interactable
      const effective = Math.max(0.2, clamped)

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setOpacity(effective)
      }

      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        SettingsManager.set('windowOpacity', clamped).catch(() => {})
      }, 200)

      return clamped
    } catch {
      return 1.0
    }
  })

  ipcMain.removeHandler('window:get-opacity')
  ipcMain.handle('window:get-opacity', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow.getOpacity()
      }
    } catch {}
    return 1.0
  })
}
