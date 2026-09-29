import { ipcMain } from 'electron'
import SettingsManager from '../settings'
import { validateIpc, z } from './ipcValidation'

/**
 * ============================================================================
 * Settings IPC Handlers
 * ============================================================================
 * 
 * Manages communication between the renderer UI (SettingStore) and the main
 * process SettingsManager:
 * - `db:getSetting` / `db:saveSetting`: Read/write individual setting keys.
 * - `db:saveSettings`: Bulk updates for settings.
 * - `db:getTheme` / `db:saveTheme`: Dedicated theme read/write channels.
 * 
 * Machine/session settings (API keys, active tabs, folders) are routed to
 * `%APPDATA%/lumina/app_config.json`, while vault UI styles are persisted
 * to `<Vault>/.lumina/settings.json`.
 */

const stringKeySchema = z.string().min(1)
const objectSchema = z.record(z.string(), z.any())

export function registerSettingsHandlers(): void {
  // Retrieve a specific setting by key, or all settings if no key is provided
  ipcMain.handle('db:getSetting', (_, key) => {
    if (key !== undefined && key !== null) {
      const validKey = validateIpc(stringKeySchema, key)
      return SettingsManager.get(validKey as any)
    }
    return SettingsManager.get()
  })

  // Persist a single setting value
  ipcMain.handle('db:saveSetting', (_, key, value) => {
    const validKey = validateIpc(stringKeySchema, key)
    return SettingsManager.set(validKey as any, value)
  })

  // Persist a batch of setting key-value pairs
  ipcMain.handle('db:saveSettings', (_, settings) => {
    const validSettings = validateIpc(objectSchema, settings)
    return SettingsManager.setMultiple(validSettings)
  })

  // Retrieve current active visual theme
  ipcMain.handle('db:getTheme', () => SettingsManager.get('theme'))

  // Update visual theme
  ipcMain.handle('db:saveTheme', (_, theme) => {
    const validTheme = validateIpc(stringKeySchema, theme)
    return SettingsManager.set('theme', validTheme)
  })
}
