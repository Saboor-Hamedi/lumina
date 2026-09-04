import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'

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
    this.watcher = null
    this.onChangeCallbacks = []
    this.notifyRenderer = null // Set by main process
    this.isWriting = false // Flag to prevent reloading when we write
    this.lastWrittenData = null // Stores the exact string we just wrote to avoid echoing our own changes
    this.ignoreWatchEventsUntil = 0 // Timestamp to ignore watcher events after writing
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
    } catch (err) {
      this.cache = { ...this.defaultSettings }
      await this.save()
    }

    this.startWatching()
  }

  startWatching() {
    if (this.watcher) {
      this.watcher.close()
    }

    this.watcher = chokidar.watch(this.settingsPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    })

    this.watcher.on('unlink', async () => {
      if (this.isWriting || Date.now() < this.ignoreWatchEventsUntil) return
      try {
        this.cache = { ...this.defaultSettings }
        await this.save()
      } catch (_) {}
    })

    this.watcher.on('change', async () => {
      if (this.isWriting || Date.now() < this.ignoreWatchEventsUntil) {
        return
      }

      try {
        const data = await fs.readFile(this.settingsPath, 'utf8')

        if (data === this.lastWrittenData) {
          return
        }

        const loadedSettings = JSON.parse(data)
        const newCache = { ...this.defaultSettings, ...loadedSettings }

        const oldJson = JSON.stringify(this.cache)
        const newJson = JSON.stringify(newCache)
        if (oldJson === newJson) {
          this.lastWrittenData = data
          return
        }

        console.info('[SettingsManager] settings.json changed externally, reloading...')
        this.cache = newCache
        this.lastWrittenData = data

        if (this.notifyRenderer) {
          this.notifyRenderer(this.cache)
        }

        this.onChangeCallbacks.forEach((cb) => {
          try {
            cb(this.cache)
          } catch (err) {
            console.error('[SettingsManager] Error in onChange callback:', err)
          }
        })
      } catch (err) {
        console.error('[SettingsManager] Failed to reload settings:', err)
      }
    })

    this.watcher.on('error', (err) => {
      console.error('[SettingsManager] File watcher error:', err)
    })
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
    this.cache = { ...(this.cache || this.defaultSettings), ...settings }
    return this.queueSave()
  }

  async queueSave() {
    if (this.isWriting) {
      if (this.pendingSave) return this.pendingSave
      this.pendingSave = (async () => {
        while (this.isWriting) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        await this.save()
        this.pendingSave = null
      })()
      return this.pendingSave
    }
    return this.save()
  }

  async save() {
    try {
      this.isWriting = true
      const settingsToSave = { ...this.defaultSettings, ...this.cache }
      const data = JSON.stringify(settingsToSave, null, 2)

      if (data === this.lastWrittenData) {
        this.isWriting = false
        return
      }

      this.lastWrittenData = data
      this.ignoreWatchEventsUntil = Date.now() + 2500

      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true })
      await fs.writeFile(this.settingsPath, data, 'utf8')

      this.cache = settingsToSave

      await new Promise((resolve) => setTimeout(resolve, 30))
      this.isWriting = false
    } catch (err) {
      console.error('[SettingsManager] Failed to save settings:', err)
      this.isWriting = false
    }
  }

  getAll() {
    return this.cache || this.defaultSettings
  }
}

export default new SettingsManager()
