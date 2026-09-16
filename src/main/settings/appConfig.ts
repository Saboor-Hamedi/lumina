import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { GLOBAL_API_KEYS, GlobalApiKey, decryptKey, encryptKey } from './crypto'

export interface Shortcuts {
  [action: string]: string
}

export class AppConfigManager {
  private appConfigPath: string | null = null
  public globalApiKeys: Record<string, any> = {}
  public shortcuts: Shortcuts = {}

  getAppConfigPath(): string | null {
    if (!this.appConfigPath) {
      try {
        this.appConfigPath = path.join(app.getPath('userData'), 'app_config.json')
      } catch {
        this.appConfigPath = null
      }
    }
    return this.appConfigPath
  }

  async load(): Promise<void> {
    const configPath = this.getAppConfigPath()
    if (!configPath) return
    try {
      const data = await fs.readFile(configPath, 'utf8')
      const cfg = JSON.parse(data)
      const apiKeys = cfg?.apiKeys || {}
      for (const [k, v] of Object.entries(apiKeys)) {
        if ((GLOBAL_API_KEYS as readonly string[]).includes(k)) {
          this.globalApiKeys[k] = decryptKey(v)
        }
      }
      const shortcuts = cfg?.shortcuts || {}
      this.shortcuts = typeof shortcuts === 'object' && shortcuts !== null ? shortcuts : {}
    } catch {
      this.globalApiKeys = {}
      this.shortcuts = {}
    }
  }

  async save(): Promise<void> {
    const configPath = this.getAppConfigPath()
    if (!configPath) return
    try {
      let existing: any = {}
      try {
        const data = await fs.readFile(configPath, 'utf8')
        existing = JSON.parse(data)
      } catch {}

      const encryptedApiKeys = { ...(existing.apiKeys || {}) }
      for (const key of GLOBAL_API_KEYS) {
        if (this.globalApiKeys[key] !== undefined) {
          encryptedApiKeys[key] = this.globalApiKeys[key]
            ? encryptKey(this.globalApiKeys[key])
            : null
        }
      }

      const merged = {
        ...existing,
        apiKeys: encryptedApiKeys,
        shortcuts: this.shortcuts || {}
      }

      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(merged, null, 2), 'utf8')
    } catch (err) {
      console.error('[SettingsManager] Failed to save app_config.json:', err)
    }
  }

  getLastWorkspacePath(): string | null {
    return null // populate via readAppConfigRaw if needed
  }

  async readRaw(): Promise<any> {
    const configPath = this.getAppConfigPath()
    if (!configPath) return null
    try {
      const raw = await fs.readFile(configPath, 'utf8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  isGlobalKey(key: string): key is GlobalApiKey {
    return (GLOBAL_API_KEYS as readonly string[]).includes(key)
  }

  setGlobalKey(key: string, value: any): void {
    this.globalApiKeys[key] = value
  }
}