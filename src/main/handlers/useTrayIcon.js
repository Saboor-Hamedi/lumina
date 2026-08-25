import { Tray, Menu } from 'electron'

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

  // Prevent app from quitting when window is closed via "X" button
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      return false
    }
  })
}

export function isAppQuitting() {
  return isQuitting
}
export function setAppQuitting(value) {
  isQuitting = value
}
