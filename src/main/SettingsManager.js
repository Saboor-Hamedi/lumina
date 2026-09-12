import fs from 'fs/promises'
import path from 'path'
import { app, safeStorage } from 'electron'

const GLOBAL_API_KEYS = ['deepSeekKey', 'openaiKey', 'anthropicKey', 'huggingFaceKey', 'groqKey', 'groqApiKey']

function isSafeStorageReady() {
  try {
    return app.isReady() && safeStorage.isEncryptionAvailable()
  } catch (_) {
    return false
  }
}

function encryptKey(value) {
  if (!value || typeof value !== 'string') return value
  try {
    if (isSafeStorageReady()) {
      const encrypted = safeStorage.encryptString(value)
      return `enc:${encrypted.toString('base64')}`
    }
  } catch (err) {
    console.warn('[SettingsManager] safeStorage encryption failed:', err)
  }
  return value
}

function decryptKey(value) {
  if (!value || typeof value !== 'string') return value
  if (value.startsWith('enc:')) {
    try {
      if (isSafeStorageReady()) {
        const buffer = Buffer.from(value.slice(4), 'base64')
        return safeStorage.decryptString(buffer)
      }
    } catch (err) {
      console.warn('[SettingsManager] safeStorage decryption failed:', err)
    }
  }
  return value
}

class SettingsManager {
  constructor() {
    this.settingsPath = null
    this.appConfigPath = null
    this.globalApiKeys = {}
    this.defaultSettings = {
      theme: 'default',
      fontSize: 16,
      fontFamily: 'Inter',
      lineHeight: 1.6,
      showLineNumbers: false,
      autoSave: true,
      vimMode: false,
      cursorStyle: 'smooth',
      smoothScrolling: true,
      lastSnippetId: null,
      vaultPath: null,
      translucency: false,
      inlineMetadata: true,
      sidebar: {
        width: 260,
        isLeftOpen: true
      },
      rightSidebar: {
        width: 300,
        isRightOpen: false
      },
      enableDevTools: true,
      launchOnStartup: false,
      globalShortcut: 'Ctrl+Space',
      windowOpacity: 1.0,
      deepSeekKey: null,
      deepSeekModel: 'deepseek-chat',
      huggingFaceKey: null,
      activeProvider: 'deepseek',
      activeModel: null,
      activeAIMode: 'Plan',
      aiChatDisplayMode: 'sidebar',
      openaiKey: null,
      anthropicKey: null,
      groqKey: null,
      ollamaUrl: 'http://localhost:11434/api/chat',
      graphTheme: 'default',
      graphNodeSize: 1.5,
      graphHideTags: false,
      graphHideGhosts: false,
      graphHideOrphans: false,
      graphCenterForce: 0.05,
      graphRepelForce: 0.3,
      graphLinkForce: 0.05,
      graph3DMode: false,
      graphAnimate: false,
      windowBounds: { width: 900, height: 700, x: null, y: null },
      emailModalWidth: 840,
      emailModalHeight: 510,
      emailSidebarWidth: 195,
      emailListWidth: 300,
      emailSidebarOpen: true,
      emailDetailOpen: true
    }
    this.cache = null
    this.onChangeCallbacks = []
    this.notifyRenderer = null
    this.isWriting = false
    this.lastWrittenData = null
    this.saveTimeout = null
  }

  async loadAppConfig() {
    if (!this.appConfigPath) return
    try {
      const data = await fs.readFile(this.appConfigPath, 'utf8')
      const cfg = JSON.parse(data)
      const apiKeys = cfg?.apiKeys || {}
      for (const [k, v] of Object.entries(apiKeys)) {
        if (GLOBAL_API_KEYS.includes(k)) {
          this.globalApiKeys[k] = decryptKey(v)
        }
      }
    } catch (_) {
      this.globalApiKeys = {}
    }
  }

  async saveAppConfig() {
    if (!this.appConfigPath) return
    try {
      let existing = {}
      try {
        const data = await fs.readFile(this.appConfigPath, 'utf8')
        existing = JSON.parse(data)
      } catch (_) {}

      const encryptedApiKeys = { ...(existing.apiKeys || {}) }
      for (const key of GLOBAL_API_KEYS) {
        if (this.globalApiKeys[key] !== undefined) {
          encryptedApiKeys[key] = this.globalApiKeys[key] ? encryptKey(this.globalApiKeys[key]) : null
        }
      }

      const merged = {
        ...existing,
        apiKeys: encryptedApiKeys
      }

      await fs.mkdir(path.dirname(this.appConfigPath), { recursive: true })
      await fs.writeFile(this.appConfigPath, JSON.stringify(merged, null, 2), 'utf8')
    } catch (err) {
      console.error('[SettingsManager] Failed to save app_config.json:', err)
    }
  }

  async init(vaultPath) {
    if (!vaultPath && this.vaultPath) {
      vaultPath = this.vaultPath
    }
    if (!vaultPath) {
      vaultPath = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'lumina')
    }
    this.vaultPath = vaultPath
    const luminaDir = path.join(vaultPath, '.lumina')
    this.settingsPath = path.join(luminaDir, 'settings.json')

    try {
      this.appConfigPath = path.join(app.getPath('userData'), 'app_config.json')
    } catch (_) {
      this.appConfigPath = null
    }

    await this.loadAppConfig()

    try {
      await fs.mkdir(luminaDir, { recursive: true })
    } catch (err) {}

    let vaultSettings = {}
    try {
      await fs.access(this.settingsPath)
      const data = await fs.readFile(this.settingsPath, 'utf8')
      vaultSettings = JSON.parse(data)
    } catch (err) {
      vaultSettings = {}
    }

    let needsVaultCleanup = false
    let needsAppConfigSave = false

    for (const key of GLOBAL_API_KEYS) {
      if (vaultSettings[key] && !this.globalApiKeys[key]) {
        this.globalApiKeys[key] = vaultSettings[key]
        needsAppConfigSave = true
      }
      if (key in vaultSettings) {
        delete vaultSettings[key]
        needsVaultCleanup = true
      }
    }

    if (needsAppConfigSave) {
      await this.saveAppConfig()
    }

    this.cache = { ...this.defaultSettings, ...vaultSettings, ...this.globalApiKeys }
    this.lastWrittenData = JSON.stringify(this.getVaultSettingsToSave(), null, 2)

    if (needsVaultCleanup) {
      await this.save()
    }
  }

  getVaultSettingsToSave() {
    const current = { ...this.defaultSettings, ...(this.cache || {}) }
    for (const key of GLOBAL_API_KEYS) {
      delete current[key]
    }
    return current
  }

  onChange(callback) {
    this.onChangeCallbacks.push(callback)
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter((cb) => cb !== callback)
    }
  }

  async get(key) {
    if (!this.cache) {
      try {
        await this.init(this.vaultPath)
      } catch (_) {
        this.cache = { ...this.defaultSettings, ...this.globalApiKeys }
      }
    }
    const current = this.getAll()
    return key ? current[key] : current
  }

  async set(key, value) {
    if (!this.cache) {
      try {
        await this.init(this.vaultPath)
      } catch (_) {
        this.cache = { ...this.defaultSettings, ...this.globalApiKeys }
      }
    }

    if (this.cache && JSON.stringify(this.cache[key]) === JSON.stringify(value)) {
      return true
    }

    if (this.cache) {
      this.cache[key] = value
    }

    if (GLOBAL_API_KEYS.includes(key)) {
      this.globalApiKeys[key] = value
      await this.saveAppConfig()
      const fullSettings = this.getAll()
      this.onChangeCallbacks.forEach((cb) => {
        try {
          cb(fullSettings)
        } catch (err) {
          console.error('[SettingsManager] Error in onChange callback:', err)
        }
      })
      return true
    }

    return this.queueSave()
  }

  async setMultiple(settings) {
    if (!this.cache) {
      try {
        await this.init(this.vaultPath)
      } catch (_) {
        this.cache = { ...this.defaultSettings, ...this.globalApiKeys }
      }
    }

    let changed = false
    let globalKeyChanged = false
    const current = this.cache || this.defaultSettings
    for (const [k, v] of Object.entries(settings)) {
      if (JSON.stringify(current[k]) !== JSON.stringify(v)) {
        current[k] = v
        changed = true
        if (GLOBAL_API_KEYS.includes(k)) {
          this.globalApiKeys[k] = v
          globalKeyChanged = true
        }
      }
    }

    if (!changed) return true
    this.cache = current

    if (globalKeyChanged) {
      await this.saveAppConfig()
    }

    const hasVaultSettingsChanged = Object.keys(settings).some(
      (k) => !GLOBAL_API_KEYS.includes(k)
    )

    if (hasVaultSettingsChanged) {
      return this.queueSave()
    }

    const fullSettings = this.getAll()
    this.onChangeCallbacks.forEach((cb) => {
      try {
        cb(fullSettings)
      } catch (err) {
        console.error('[SettingsManager] Error in onChange callback:', err)
      }
    })
    return true
  }

  async queueSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    return new Promise((resolve, reject) => {
      this.pendingResolvers = this.pendingResolvers || []
      this.pendingResolvers.push({ resolve, reject })

      this.saveTimeout = setTimeout(async () => {
        this.saveTimeout = null
        const resolvers = this.pendingResolvers
        this.pendingResolvers = []
        try {
          await this.save()
          resolvers.forEach(({ resolve: res }) => res(true))
        } catch (err) {
          resolvers.forEach(({ reject: rej }) => rej(err))
        }
      }, 50)
    })
  }

  async save() {
    if (!this.settingsPath) return
    try {
      this.isWriting = true
      const settingsToSave = this.getVaultSettingsToSave()
      const data = JSON.stringify(settingsToSave, null, 2)

      if (data === this.lastWrittenData) {
        return
      }

      this.lastWrittenData = data
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true })
      await fs.writeFile(this.settingsPath, data, 'utf8')

      const fullSettings = this.getAll()
      this.onChangeCallbacks.forEach((cb) => {
        try {
          cb(fullSettings)
        } catch (err) {
          console.error('[SettingsManager] Error in onChange callback:', err)
        }
      })
    } catch (err) {
      console.error('[SettingsManager] Failed to save settings:', err)
    } finally {
      this.isWriting = false
    }
  }

  getAll() {
    return { ...(this.cache || this.defaultSettings), ...this.globalApiKeys }
  }
}

export default new SettingsManager()
