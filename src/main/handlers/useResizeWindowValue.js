import SettingsManager from '../settings'

export function useResizeWindowValue(win) {
  if (!win) return

  let boundsTimeout = null

  const saveBounds = () => {
    if (win && !win.isMaximized() && !win.isMinimized()) {
      const bounds = win.getBounds()
      SettingsManager.set('windowBounds', bounds).catch(console.error)
    }
  }

  win.on('resized', () => {
    if (boundsTimeout) clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(saveBounds, 500)
  })

  win.on('moved', () => {
    if (boundsTimeout) clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(saveBounds, 500)
  })

  win.on('close', () => {
    if (boundsTimeout) clearTimeout(boundsTimeout)
    if (win && !win.isMaximized() && !win.isMinimized()) {
      const bounds = win.getBounds()
      SettingsManager.set('windowBounds', bounds).catch(console.error)
    }
  })
}

export default useResizeWindowValue
