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
      // AI Settings
      deepSeekKey: null,
      deepSeekModel: 'deepseek-chat',
      huggingFaceKey: null
    }
    this.cache = null
    this.watcher = null
    this.onChangeCallbacks = []
    this.notifyRenderer = null // Set by main process
    this.isWriting = false // Flag to prevent reloading when we write
  }

  async init(userDataPath) {
    if (!this.settingsPath) this.settingsPath = path.join(userDataPath, 'settings.json')
    try {
      await fs.access(this.settingsPath)
      const data = await fs.readFile(this.settingsPath, 'utf8')
      this.cache = { ...this.defaultSettings, ...JSON.parse(data) }
    } catch (err) {
      // File doesn't exist or is corrupt, create default
      this.cache = { ...this.defaultSettings }
      await this.save()
    }

    // Watch for external changes to settings.json
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

    this.watcher.on('change', async () => {
      // Skip if we're the ones writing (avoid infinite loop)
      if (this.isWriting) {
        return
      }
      
      console.info('[SettingsManager] settings.json changed externally, reloading...')
      try {
        const data = await fs.readFile(this.settingsPath, 'utf8')
        const loadedSettings = JSON.parse(data)
        // Merge: defaults first, then loaded settings (preserves all keys from file)
        this.cache = { ...this.defaultSettings, ...loadedSettings }
        
        // Notify renderer via callback (set by main process)
        if (this.notifyRenderer) {
          this.notifyRenderer(this.cache)
        }

        // Call registered callbacks
        this.onChangeCallbacks.forEach(cb => {
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
      this.onChangeCallbacks = this.onChangeCallbacks.filter(cb => cb !== callback)
    }
  }

  async get(key) {
    if (!this.cache) await this.init()
    return key ? this.cache[key] : this.cache
  }

  async set(key, value) {
    if (!this.cache) await this.init()
    this.cache[key] = value
    await this.save()
    return true
  }

  async save() {
    try {
      this.isWriting = true
      // Merge with defaults to ensure all default keys are present, but preserve user values
      // This prevents losing keys that aren't in defaultSettings
      const settingsToSave = { ...this.defaultSettings, ...this.cache }
      await fs.writeFile(this.settingsPath, JSON.stringify(settingsToSave, null, 2))
      // Update cache to match what we saved
      this.cache = settingsToSave
      // Small delay to ensure file system has written
      await new Promise(resolve => setTimeout(resolve, 50))
      this.isWriting = false
    } catch (err) {
      console.error('Failed to save settings:', err)
      this.isWriting = false
    }
  }

  getAll() {
    return this.cache || this.defaultSettings
  }
}

export default new SettingsManager()
