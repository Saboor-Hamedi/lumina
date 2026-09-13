import { globalShortcut, BrowserWindow } from 'electron'

export interface SettingsLike {
  shortcuts?: Record<string, string>
  globalShortcut?: string
  [key: string]: any
}

let lastMainWindow: BrowserWindow | null | undefined = null
let lastSettings: SettingsLike | null | undefined = null

export function pauseGlobalShortcut(): void {
  try {
    globalShortcut.unregisterAll()
  } catch (err) {
    console.error('[useGlobalShortcut] Error pausing global shortcuts:', err)
  }
}

export function resumeGlobalShortcut(): void {
  if (lastMainWindow && !lastMainWindow.isDestroyed()) {
    useGlobalShortcut(lastMainWindow, lastSettings)
  }
}

export function useGlobalShortcut(mainWindow: BrowserWindow | null | undefined, settings?: SettingsLike | null): void {
  lastMainWindow = mainWindow
  lastSettings = settings

  // Clear any existing shortcuts first
  try {
    globalShortcut.unregisterAll()
  } catch (err) {
    console.error('[useGlobalShortcut] Error unregistering global shortcuts:', err)
  }

  // Get dynamic shortcut key: check settings.shortcuts['global:spotlight'] or settings.globalShortcut, fallback to 'Ctrl+Space'
  const rawShortcut =
    settings?.shortcuts?.['global:spotlight'] ||
    settings?.shortcuts?.['spotlight'] ||
    settings?.globalShortcut ||
    'Ctrl+Space'

  if (!rawShortcut || rawShortcut === 'disabled') {
    return
  }

  // Normalize shortcut string for Electron globalShortcut API:
  // e.g. "Ctrl + Space" -> "CommandOrControl+Space"
  const accelerator = rawShortcut
    .replace(/\s+/g, '')
    .split('+')
    .map((part) => {
      const p = part.toLowerCase()
      if (p === 'ctrl' || p === 'control') return 'CommandOrControl'
      if (p === 'cmd' || p === 'command') return 'CommandOrControl'
      if (p === 'win' || p === 'meta' || p === 'super') return 'Super'
      if (p === 'alt') return 'Alt'
      if (p === 'shift') return 'Shift'
      if (p === 'space') return 'Space'
      return part.length === 1 ? part.toUpperCase() : part
    })
    .join('+')

  try {
    const isRegistered = globalShortcut.register(accelerator, () => {
      if (!mainWindow || mainWindow.isDestroyed()) return

      if (!mainWindow.isVisible()) {
        mainWindow.show()
        mainWindow.focus()
      } else if (!mainWindow.isFocused()) {
        mainWindow.focus()
      }

      // Send IPC event to renderer to open the command palette
      mainWindow.webContents.send('window:toggle-command-palette')
    })

    if (!isRegistered) {
      console.warn(`[useGlobalShortcut] Failed to register accelerator: ${accelerator}`)
    }
  } catch (err) {
    console.error(`[useGlobalShortcut] Error registering accelerator ${accelerator}:`, err)
  }
}
