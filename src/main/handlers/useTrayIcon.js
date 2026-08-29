import { Tray, Menu } from 'electron'
import SettingsManager from '../SettingsManager'

let tray = null
let isQuitting = false

export function useTrayIcon(mainWindow, app, appIcon) {
  if (!tray) {
    tray = new Tray(appIcon)
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Lumina',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])

    tray.setToolTip('Lumina')
    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.focus()
        } else {
          mainWindow.show()
        }
      }
    })
  }

  // Handle app before-quit to ensure quitting is not blocked
  app.on('before-quit', () => {
    isQuitting = true
  })

  // Prevent app from quitting when window is closed via "X" button ONLY IF launchOnStartup is true
  mainWindow.on('close', (event) => {
    if (isQuitting) return

    const settings = SettingsManager.getAll()
    const launchOnStartup = settings?.launchOnStartup === true

    if (launchOnStartup) {
      event.preventDefault()
      mainWindow.hide()
      return false
    }

    // When launchOnStartup is disabled, quit the app on close
    isQuitting = true
    app.quit()
  })
}

export function isAppQuitting() {
  return isQuitting
}
export function setAppQuitting(value) {
  isQuitting = value
}
