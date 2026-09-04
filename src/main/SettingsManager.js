import fs from 'fs/promises'
import path from 'path'

class SettingsManager {
  constructor() {
    this.settingsPath = null
    this.defaultSettings = {
      theme: 'default',
      fontSize: 16,
      fontFamily: 'Inter',
      lineHeight: 1.6,
      showLineNumbers: false,
      autoSave: true,
      vimMode: false,
      cursorStyle: 'smooth', // 'block', 'line', 'smooth'
      smoothScrolling: true,
      lastSnippetId: null, // Persist last open note
      vaultPath: null, // Persist custom vault location
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
      // AI Settings
      deepSeekKey: null,
      deepSeekModel: 'deepseek-chat',
      huggingFaceKey: null,
      activeProvider: 'deepseek',
      activeModel: null,
      activeAIMode: 'Plan',
      aiChatDisplayMode: 'sidebar',
      openaiKey: null,
      anthropicKey: null,
      ollamaUrl: 'http://localhost:11434/api/chat',
      // Graph Settings
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
      // Window bounds
      windowBounds: { width: 900, height: 700, x: null, y: null }
    }
    this.cache = null
    this.onChangeCallbacks = []
    this.notifyRenderer = null // Set by main process
    this.isWriting = false
    this.lastWrittenData = null
    this.saveTimeout = null
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
      await fs.mkdir(luminaDir, { recursive: true })
    } catch (err) {}

    try {
      await fs.access(this.settingsPath)
      const data = await fs.readFile(this.settingsPath, 'utf8')
      this.cache = { ...this.defaultSettings, ...JSON.parse(data) }
      this.lastWrittenData = JSON.stringify(this.cache, null, 2)
    } catch (err) {
      this.cache = { ...this.defaultSettings }
      await this.save()
    }
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
        this.cache = { ...this.defaultSettings }
      }
    }
    const current = this.cache || this.defaultSettings
    return key ? current[key] : current
  }

  async set(key, value) {
    if (!this.cache) {
      try {
        await this.init(this.vaultPath)
      } catch (_) {
        this.cache = { ...this.defaultSettings }
      }
    }

    if (this.cache && JSON.stringify(this.cache[key]) === JSON.stringify(value)) {
      return
    }

    if (this.cache) {
      this.cache[key] = value
    }

    return this.queueSave()
  }

  async setMultiple(settings) {
    if (!this.cache) {
      try {
        await this.init(this.vaultPath)
      } catch (_) {
        this.cache = { ...this.defaultSettings }
      }
    }

    let changed = false
    const current = this.cache || this.defaultSettings
    for (const [k, v] of Object.entries(settings)) {
      if (JSON.stringify(current[k]) !== JSON.stringify(v)) {
        current[k] = v
        changed = true
      }
    }

    if (!changed) return
    this.cache = current
    return this.queueSave()
  }

  async queueSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    return new Promise((resolve) => {
      this.saveTimeout = setTimeout(async () => {
        this.saveTimeout = null
        await this.save()
        resolve()
      }, 50)
    })
  }

  async save() {
    if (!this.settingsPath) return
    try {
      this.isWriting = true
      const settingsToSave = { ...this.defaultSettings, ...this.cache }
      const data = JSON.stringify(settingsToSave, null, 2)

      if (data === this.lastWrittenData) {
        return
      }

      this.lastWrittenData = data
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true })
      await fs.writeFile(this.settingsPath, data, 'utf8')
      this.cache = settingsToSave

      this.onChangeCallbacks.forEach((cb) => {
        try {
          cb(this.cache)
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
    return this.cache || this.defaultSettings
  }
}

export default new SettingsManager()
