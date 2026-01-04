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
      autoSave: true,
      vimMode: false,
      cursorStyle: 'smooth', // 'block', 'line', 'smooth'
      smoothScrolling: true,
      lastSnippetId: null, // Persist last open note
      vaultPath: null, // Persist custom vault location
      translucency: false,
      inlineMetadata: true
    }
    this.cache = null
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
      await fs.writeFile(this.settingsPath, JSON.stringify(this.cache, null, 2))
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  getAll() {
     return this.cache || this.defaultSettings
  }
}

export default new SettingsManager()
