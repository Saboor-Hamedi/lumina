import SettingsManager from '../SettingsManager'

export function useResizeWindowValue(mainWindow) {
  let boundsTimeout

  const saveBounds = () => {
    if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds()
      SettingsManager.set('windowBounds', bounds).catch(console.error)
    }
  }

  mainWindow.on('resized', () => {
    clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(saveBounds, 500)
  })

  mainWindow.on('moved', () => {
    clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(saveBounds, 500)
  })

  mainWindow.on('close', () => {
    clearTimeout(boundsTimeout)
    if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds()
      SettingsManager.set('windowBounds', bounds).catch(console.error)
    }
  })
}
