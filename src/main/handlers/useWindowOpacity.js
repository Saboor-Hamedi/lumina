import { ipcMain } from 'electron'
import SettingsManager from '../SettingsManager'

export function useWindowOpacity(mainWindow) {
  SettingsManager.get('windowOpacity')
    .then((saved) => {
      if (typeof saved === 'number' && saved >= 0.92 && saved <= 1.0) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setOpacity(saved)
        }
      }
    })
    .catch(() => {})

  let saveTimeout = null
  ipcMain.removeHandler('window:set-opacity')
  ipcMain.handle('window:set-opacity', async (_, opacity) => {
    try {
      const num = Number(opacity)
      const val = Math.max(0.92, Math.min(1.0, isNaN(num) ? 1.0 : num))
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setOpacity(val)
      }
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        SettingsManager.set('windowOpacity', val).catch(() => {})
      }, 200)
      return val
    } catch (e) {
      return 1.0
    }
  })

  ipcMain.removeHandler('window:get-opacity')
  ipcMain.handle('window:get-opacity', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow.getOpacity()
      }
    } catch (e) {}
    return 1.0
  })
}
