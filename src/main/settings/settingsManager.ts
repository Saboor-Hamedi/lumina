import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { GLOBAL_API_KEYS } from './crypto'
import { AppConfigManager, Shortcuts } from './appConfig'

export interface Settings {
  shortcuts: Shortcuts
  theme: string
  fontSize: number
  fontFamily: string
  lineHeight: number
  showLineNumbers: boolean
  autoSave: boolean
  vimMode: boolean
  cursorStyle: string
  smoothScrolling: boolean
  lastSnippetId: string | null
  workspacePath: string | null
  translucency: boolean
  inlineMetadata: boolean
  sidebar: { width: number; isLeftOpen: boolean }
  rightSidebar: { width: number; isRightOpen: boolean }
  pinnedFolders: string[]
  folderOrder: string[]
  expandedFolders: string[]
  enableDevTools: boolean
  launchOnStartup: boolean
  globalShortcut: string
  windowOpacity: number
  deepSeekKey: string | null
  deepSeekModel: string
  huggingFaceKey: string | null
  activeProvider: string
  activeModel: string | null
  activeAIMode: string
  aiChatDisplayMode: string
  openaiKey: string | null
  anthropicKey: string | null
  groqKey: string | null
  ollamaUrl: string
  graphTheme: string
  graphNodeSize: number
  graphHideTags: boolean
  graphHideGhosts: boolean
  graphHideOrphans: boolean
  graphCenterForce: number
  graphRepelForce: number
  graphLinkForce: number
  graph3DMode: boolean
  graphAnimate: boolean
  windowBounds: { width: number; height: number; x: number | null; y: number | null }
  emailModalWidth: number
  emailModalHeight: number
  emailSidebarWidth: number
  emailListWidth: number
  emailSidebarOpen: boolean
  emailDetailOpen: boolean
  [key: string]: any
}

type ChangeCallback = (settings: Settings) => void

interface PendingResolver {
  resolve: (value: boolean) => void
  reject: (err: unknown) => void
}

export const DEFAULT_SETTINGS: Settings = {
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
  sidebar: { width: 260, isLeftOpen: true },
  rightSidebar: { width: 300, isRightOpen: false },
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

export class SettingsManager {
  public settingsPath: string | null = null
  public workspacePath: string | null = null
  public cache: Settings | null = null
  public onChangeCallbacks: ChangeCallback[] = []
  public isWriting = false
  public lastWrittenData: string | null = null
  public saveTimeout: NodeJS.Timeout | null = null
  public pendingResolvers: PendingResolver[] = []
  public appConfig = new AppConfigManager()

  get shortcuts(): Shortcuts {
    return this.appConfig.shortcuts
  }

  set shortcuts(value: Shortcuts) {
    this.appConfig.shortcuts = value || {}
  }

  async init(workspacePath?: string): Promise<void> {
    try {
      this.appConfig.getAppConfigPath()
    } catch {}

    await this.appConfig.load()

    if (!workspacePath && this.workspacePath) {
      workspacePath = this.workspacePath
    }
    if (!workspacePath) {
      const parsed = await this.appConfig.readRaw()
      if (parsed?.lastWorkspaceOpened || parsed?.lastVaultOpened) {
        workspacePath = parsed.lastWorkspaceOpened || parsed.lastVaultOpened
      }
    }
    if (!workspacePath) {
      workspacePath = path.join(
        process.env.USERPROFILE || process.env.HOME || '.',
        'Documents',
        'lumina'
      )
    }
    this.workspacePath = workspacePath
    const luminaDir = path.join(workspacePath, '.lumina')
    this.settingsPath = path.join(luminaDir, 'settings.json')

    try {
      await fs.mkdir(luminaDir, { recursive: true })
    } catch {}

    let workspaceSettings: Partial<Settings> = {}
    try {
      await fs.access(this.settingsPath)
      const data = await fs.readFile(this.settingsPath, 'utf8')
      workspaceSettings = JSON.parse(data)
    } catch {
      workspaceSettings = {}
    }

    let needsWorkspaceCleanup = false
    let needsAppConfigSave = false

    for (const key of GLOBAL_API_KEYS) {
      if ((workspaceSettings as any)[key] && !this.appConfig.globalApiKeys[key]) {
        this.appConfig.globalApiKeys[key] = (workspaceSettings as any)[key]
        needsAppConfigSave = true
      }
      if (key in workspaceSettings) {
        delete (workspaceSettings as any)[key]
        needsWorkspaceCleanup = true
      }
    }

    if (needsAppConfigSave) {
      await this.appConfig.save()
    }

    this.cache = {
      ...DEFAULT_SETTINGS,
      ...workspaceSettings,
      ...this.appConfig.globalApiKeys,
      shortcuts: this.appConfig.shortcuts
    } as Settings
    this.lastWrittenData = JSON.stringify(this.getWorkspaceSettingsToSave(), null, 2)

    if (needsWorkspaceCleanup) {
      await this.save()
    }
  }

  private getWorkspaceSettingsToSave(): Partial<Settings> {
    const current: any = { ...DEFAULT_SETTINGS, ...(this.cache || {}) }
    for (const key of GLOBAL_API_KEYS) {
      delete current[key]
    }
    delete current.shortcuts
    return current
  }

  onChange(callback: ChangeCallback): () => void {
    this.onChangeCallbacks.push(callback)
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter((cb) => cb !== callback)
    }
  }

  async get<K extends keyof Settings>(key?: K): Promise<Settings | Settings[K]> {
    if (!this.cache) {
      try {
        await this.init(this.workspacePath ?? undefined)
      } catch {
        this.cache = {
          ...DEFAULT_SETTINGS,
          ...this.appConfig.globalApiKeys,
          shortcuts: this.appConfig.shortcuts
        } as Settings
      }
    }
    const current = this.getAll()
    return key ? current[key] : current
  }

  async set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<boolean> {
    if (!this.cache) {
      try {
        await this.init(this.workspacePath ?? undefined)
      } catch {
        this.cache = {
          ...DEFAULT_SETTINGS,
          ...this.appConfig.globalApiKeys,
          shortcuts: this.appConfig.shortcuts
        } as Settings
      }
    }

    if (this.cache && JSON.stringify(this.cache[key]) === JSON.stringify(value)) {
      return true
    }

    if (this.cache) {
      this.cache[key] = value
    }

    if (key === 'shortcuts') {
      this.appConfig.shortcuts = (value as Shortcuts) || {}
      await this.appConfig.save()
      this.notifyChange()
      return true
    }

    if (this.appConfig.isGlobalKey(key as string)) {
      this.appConfig.setGlobalKey(key as string, value)
      await this.appConfig.save()
      this.notifyChange()
      return true
    }

    return this.queueSave()
  }

  async setMultiple(settings: Partial<Settings>): Promise<boolean> {
    if (!this.cache) {
      try {
        await this.init(this.workspacePath ?? undefined)
      } catch {
        this.cache = {
          ...DEFAULT_SETTINGS,
          ...this.appConfig.globalApiKeys,
          shortcuts: this.appConfig.shortcuts
        } as Settings
      }
    }

    let changed = false
    let globalKeyChanged = false
    const current = this.cache || DEFAULT_SETTINGS
    for (const [k, v] of Object.entries(settings)) {
      if (JSON.stringify((current as any)[k]) !== JSON.stringify(v)) {
        ;(current as any)[k] = v
        changed = true
        if (this.appConfig.isGlobalKey(k)) {
          this.appConfig.setGlobalKey(k, v)
          globalKeyChanged = true
        }
        if (k === 'shortcuts') {
          this.appConfig.shortcuts = (v as Shortcuts) || {}
          globalKeyChanged = true
        }
      }
    }

    if (!changed) return true
    this.cache = current

    if (globalKeyChanged) {
      await this.appConfig.save()
    }

    const hasWorkspaceSettingsChanged = Object.keys(settings).some(
      (k) => !this.appConfig.isGlobalKey(k) && k !== 'shortcuts'
    )

    if (hasWorkspaceSettingsChanged) {
      return this.queueSave()
    }

    this.notifyChange()
    return true
  }

  private notifyChange(): void {
    const fullSettings = this.getAll()
    this.onChangeCallbacks.forEach((cb) => {
      try {
        cb(fullSettings)
      } catch (err) {
        console.error('[SettingsManager] Error in onChange callback:', err)
      }
    })
  }

  private queueSave(): Promise<boolean> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    return new Promise((resolve, reject) => {
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

  async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    const resolvers = this.pendingResolvers
    this.pendingResolvers = []
    try {
      await this.save()
      resolvers.forEach(({ resolve: res }) => res(true))
    } catch (err) {
      resolvers.forEach(({ reject: rej }) => rej(err))
    }
  }

  async save(): Promise<void> {
    if (!this.settingsPath) return
    try {
      this.isWriting = true
      const settingsToSave = this.getWorkspaceSettingsToSave()
      const data = JSON.stringify(settingsToSave, null, 2)

      if (data === this.lastWrittenData) {
        return
      }

      this.lastWrittenData = data
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true })
      await fs.writeFile(this.settingsPath, data, 'utf8')

      this.notifyChange()
    } catch (err) {
      console.error('[SettingsManager] Failed to save settings:', err)
    } finally {
      this.isWriting = false
    }
  }

  getAll(): Settings {
    return {
      ...(this.cache || DEFAULT_SETTINGS),
      ...this.appConfig.globalApiKeys,
      shortcuts: this.appConfig.shortcuts || {}
    } as Settings
  }
}

export default new SettingsManager()