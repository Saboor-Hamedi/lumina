import { globalShortcut } from 'electron'

export function useGlobalShortcut(mainWindow, settings) {
  // Clear any existing shortcuts first
  globalShortcut.unregisterAll()

  const shortcutKey = 'CommandOrControl+Space' // Hardcoded until shortcut recorder UI is built

  if (shortcutKey && shortcutKey !== 'disabled') {
    try {
      globalShortcut.register(shortcutKey, () => {
        if (!mainWindow) return

        if (!mainWindow.isVisible()) {
          mainWindow.show()
          mainWindow.focus()
        } else if (!mainWindow.isFocused()) {
          mainWindow.focus()
        }

        // Send IPC event to renderer to open the command palette
        mainWindow.webContents.send('window:toggle-command-palette')
      })
    } catch (err) {
      console.error('Failed to register global shortcut:', err)
    }
  }
}
