import fs from 'fs/promises'
import path from 'path'
import { app, safeStorage } from 'electron'

const GLOBAL_API_KEYS = ['deepSeekKey', 'openaiKey', 'anthropicKey', 'huggingFaceKey', 'groqKey', 'groqApiKey', 'googleUser']

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
    this.shortcuts = {}
    this.defaultSettings = {
      shortcuts: {},
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
      workspacePath: null,
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
      pinnedFolders: [],
      folderOrder: [],
      expandedFolders: [],
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

  getAppConfigPath() {
    if (!this.appConfigPath) {
      try {
        this.appConfigPath = path.join(app.getPath('userData'), 'app_config.json')
      } catch (_) {
        this.appConfigPath = null
      }
    }
    return this.appConfigPath
  }

  async loadAppConfig() {
    const configPath = this.getAppConfigPath()
    if (!configPath) return
    try {
      const data = await fs.readFile(configPath, 'utf8')
      const cfg = JSON.parse(data)
      const apiKeys = cfg?.apiKeys || {}
      for (const [k, v] of Object.entries(apiKeys)) {
        if (GLOBAL_API_KEYS.includes(k)) {
          this.globalApiKeys[k] = decryptKey(v)
        }
      }
      const shortcuts = cfg?.shortcuts || {}
      this.shortcuts = typeof shortcuts === 'object' && shortcuts !== null ? shortcuts : {}
    } catch (_) {
      this.globalApiKeys = {}
      this.shortcuts = {}
    }
  }

  async saveAppConfig() {
    const configPath = this.getAppConfigPath()
    if (!configPath) return
    try {
      let existing = {}
      try {
        const data = await fs.readFile(configPath, 'utf8')
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
        apiKeys: encryptedApiKeys,
        shortcuts: this.shortcuts || {}
      }

      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(merged, null, 2), 'utf8')
    } catch (err) {
      console.error('[SettingsManager] Failed to save app_config.json:', err)
    }
  }

  async init(workspacePath) {
    try {
      this.appConfigPath = path.join(app.getPath('userData'), 'app_config.json')
    } catch (_) {
      this.appConfigPath = null
    }

    await this.loadAppConfig()

    if (!workspacePath && this.workspacePath) {
      workspacePath = this.workspacePath
    }
    if (!workspacePath && this.appConfigPath) {
      try {
        const raw = await fs.readFile(this.appConfigPath, 'utf8')
        const parsed = JSON.parse(raw)
        if (parsed?.lastWorkspaceOpened || parsed?.lastVaultOpened) {
          workspacePath = parsed.lastWorkspaceOpened || parsed.lastVaultOpened
        }
      } catch (_) {}
    }
    if (!workspacePath) {
      workspacePath = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'lumina')
    }
    this.workspacePath = workspacePath
    const luminaDir = path.join(workspacePath, '.lumina')
    this.settingsPath = path.join(luminaDir, 'settings.json')

    try {
      await fs.mkdir(luminaDir, { recursive: true })
    } catch (err) {}

    let workspaceSettings = {}
    try {
      await fs.access(this.settingsPath)
      const data = await fs.readFile(this.settingsPath, 'utf8')
      workspaceSettings = JSON.parse(data)
    } catch (err) {
      workspaceSettings = {}
    }

    let needsWorkspaceCleanup = false
    let needsAppConfigSave = false

    for (const key of GLOBAL_API_KEYS) {
      if (workspaceSettings[key] && !this.globalApiKeys[key]) {
        this.globalApiKeys[key] = workspaceSettings[key]
        needsAppConfigSave = true
      }
      if (key in workspaceSettings) {
        delete workspaceSettings[key]
        needsWorkspaceCleanup = true
      }
    }

    if (needsAppConfigSave) {
      await this.saveAppConfig()
    }

    this.cache = { ...this.defaultSettings, ...workspaceSettings, ...this.globalApiKeys, shortcuts: this.shortcuts }
    this.lastWrittenData = JSON.stringify(this.getworkspaceSettingsToSave(), null, 2)

    if (needsWorkspaceCleanup) {
      await this.save()
    }
  }

  getworkspaceSettingsToSave() {
    const current = { ...this.defaultSettings, ...(this.cache || {}) }
    for (const key of GLOBAL_API_KEYS) {
      delete current[key]
    }
    delete current.shortcuts
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
        await this.init(this.workspacePath)
      } catch (_) {
        this.cache = { ...this.defaultSettings, ...this.globalApiKeys, shortcuts: this.shortcuts }
      }
    }
    const current = this.getAll()
    return key ? current[key] : current
  }

  async set(key, value) {
    if (!this.cache) {
      try {
        await this.init(this.workspacePath)
      } catch (_) {
        this.cache = { ...this.defaultSettings, ...this.globalApiKeys, shortcuts: this.shortcuts }
      }
    }

    if (this.cache && JSON.stringify(this.cache[key]) === JSON.stringify(value)) {
      return true
    }

    if (this.cache) {
      this.cache[key] = value
    }

    if (key === 'shortcuts') {
      this.shortcuts = value || {}
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
        await this.init(this.workspacePath)
      } catch (_) {
        this.cache = { ...this.defaultSettings, ...this.globalApiKeys, shortcuts: this.shortcuts }
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
        if (k === 'shortcuts') {
          this.shortcuts = v || {}
          globalKeyChanged = true
        }
      }
    }

    if (!changed) return true
    this.cache = current

    if (globalKeyChanged) {
      await this.saveAppConfig()
    }

    const hasworkspaceSettingsChanged = Object.keys(settings).some(
      (k) => !GLOBAL_API_KEYS.includes(k) && k !== 'shortcuts'
    )

    if (hasworkspaceSettingsChanged) {
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

  async flush() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    const resolvers = this.pendingResolvers || []
    this.pendingResolvers = []
    try {
      await this.save()
      resolvers.forEach(({ resolve: res }) => res(true))
    } catch (err) {
      resolvers.forEach(({ reject: rej }) => rej(err))
    }
  }

  async save() {
    if (!this.settingsPath) return
    try {
      this.isWriting = true
      const settingsToSave = this.getworkspaceSettingsToSave()
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
    return { ...(this.cache || this.defaultSettings), ...this.globalApiKeys, shortcuts: this.shortcuts || {} }
  }
}

export default new SettingsManager()
