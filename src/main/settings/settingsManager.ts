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
  cursorStyle: string
  smoothScrolling: boolean
  lastSnippetId?: string | null
  lastNoteId?: string | null
  openTabs?: string[]
  pinnedTabIds?: string[]
  workspacePath?: string | null
  translucency: boolean
  inlineMetadata: boolean
  sidebar: { width: number; isLeftOpen: boolean }
  rightSidebar: { width: number; isRightOpen: boolean }
  pinnedFolders?: string[]
  folderOrder?: string[]
  expandedFolders?: string[]
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
  cursorStyle: 'smooth',
  smoothScrolling: true,
  translucency: false,
  inlineMetadata: true,
  sidebar: { width: 260, isLeftOpen: true },
  rightSidebar: { width: 300, isRightOpen: false },
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

export function formatSettingsJson(settings: Record<string, any>): string {
  const sections: { title: string; keys: string[] }[] = [
    {
      title: 'EDITOR',
      keys: [
        'fontFamily',
        'fontSize',
        'lineHeight',
        'showLineNumbers',
        'cursorStyle',
        'smoothScrolling',
        'autoSave',
        'inlineMetadata'
      ]
    },
    {
      title: 'APPEARANCE',
      keys: ['theme', 'translucency', 'windowOpacity', 'modernUi']
    },
    {
      title: 'SIDEBARS',
      keys: ['sidebar', 'rightSidebar', 'graphSidebarOpen']
    },
    {
      title: 'AI',
      keys: [
        'activeProvider',
        'activeModel',
        'activeAIMode',
        'aiChatDisplayMode',
        'deepSeekModel',
        'ollamaUrl',
        'ollamaModel'
      ]
    },
    {
      title: 'GRAPH',
      keys: [
        'graphTheme',
        'graphNodeSize',
        'graphHideTags',
        'graphHideGhosts',
        'graphHideOrphans',
        'graphCenterForce',
        'graphRepelForce',
        'graphLinkForce',
        'graph3DMode',
        'graphAnimate'
      ]
    },
    {
      title: 'EMAIL',
      keys: [
        'emailModalWidth',
        'emailModalHeight',
        'emailSidebarWidth',
        'emailListWidth',
        'emailSidebarOpen',
        'emailDetailOpen'
      ]
    },
    {
      title: 'WINDOW',
      keys: [
        'windowBounds',
        'isMaximized',
        'settingsModalMaximized',
        'launchOnStartup',
        'globalShortcut'
      ]
    },
    {
      title: 'CURSOR',
      keys: ['cursor']
    },
    {
      title: 'ADVANCED',
      keys: ['enableDevTools']
    }
  ]

  const lines: string[] = ['{']
  const allFormattedKeys = new Set<string>()
  const allEntries: { sectionTitle?: string; key: string; valueString: string }[] = []

  for (const sec of sections) {
    let firstInSec = true
    for (const key of sec.keys) {
      if (key in settings && settings[key] !== undefined) {
        allFormattedKeys.add(key)
        allEntries.push({
          sectionTitle: firstInSec ? sec.title : undefined,
          key,
          valueString: JSON.stringify(settings[key], null, 2)
        })
        firstInSec = false
      }
    }
  }

  let extraFirst = true
  for (const [k, v] of Object.entries(settings)) {
    if (!allFormattedKeys.has(k) && v !== undefined) {
      allEntries.push({
        sectionTitle: extraFirst ? 'OTHER' : undefined,
        key: k,
        valueString: JSON.stringify(v, null, 2)
      })
      extraFirst = false
    }
  }

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i]
    const isLast = i === allEntries.length - 1
    if (entry.sectionTitle) {
      lines.push('  // ============================================================')
      lines.push(`  // ${entry.sectionTitle}`)
      lines.push('  // ============================================================')
    }

    const valLines = entry.valueString.split('\n')
    if (valLines.length === 1) {
      lines.push(`  "${entry.key}": ${entry.valueString}${isLast ? '' : ','}`)
    } else {
      const indentedVal = valLines.map((l, idx) => (idx === 0 ? l : '  ' + l)).join('\n')
      lines.push(`  "${entry.key}": ${indentedVal}${isLast ? '' : ','}`)
    }

    const nextHasTitle = i + 1 < allEntries.length && allEntries[i + 1].sectionTitle
    if (nextHasTitle) {
      lines.push('')
    }
  }

  lines.push('}')
  return lines.join('\n') + '\n'
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

  async init(workspacePath?: string | null): Promise<void> {
    try {
      this.appConfig.getAppConfigPath()
    } catch {}

    await this.appConfig.load()

    if (!workspacePath && this.workspacePath) {
      workspacePath = this.workspacePath
    }
    if (!workspacePath) {
      workspacePath = this.appConfig.getLastWorkspacePath()
    }
    if (!workspacePath) {
      const parsed = await this.appConfig.readRaw()
      workspacePath =
        parsed?.lastWorkspacePath ||
        parsed?.lastWorkspaceOpened ||
        parsed?.lastworkspacePath ||
        parsed?.lastVaultOpened ||
        parsed?.workspacePath ||
        null
    }
    if (!workspacePath) {
      workspacePath = path.join(
        process.env.USERPROFILE || process.env.HOME || '.',
        'Documents',
        'lumina'
      )
    }
    this.workspacePath = workspacePath
    this.appConfig.setLastWorkspacePath(workspacePath)
    const luminaDir = path.join(workspacePath, '.lumina')
    this.settingsPath = path.join(luminaDir, 'settings.json')

    try {
      await fs.mkdir(luminaDir, { recursive: true })
    } catch {}

    let workspaceSettings: Partial<Settings> = {}
    try {
      await fs.access(this.settingsPath)
      const data = await fs.readFile(this.settingsPath, 'utf8')
      const stripped = data.replace(/"(?:\\.|[^"\\])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => (g ? '' : m))
      workspaceSettings = JSON.parse(stripped)
    } catch {
      workspaceSettings = {}
    }

    let needsWorkspaceCleanup = false
    let needsAppConfigSave = false

    // Clean up any machine-specific or legacy path keys mistakenly written into vault's settings.json
    if ('workspacePath' in workspaceSettings) {
      delete (workspaceSettings as any).workspacePath
      needsWorkspaceCleanup = true
    }
    if ('vaultPath' in workspaceSettings) {
      delete (workspaceSettings as any).vaultPath
      needsWorkspaceCleanup = true
    }

    // Migrate folder states from vault's settings.json to app_config.json workspace
    if (Array.isArray((workspaceSettings as any).pinnedFolders) && (workspaceSettings as any).pinnedFolders.length > 0) {
      if (!this.appConfig.workspace.pinnedFolders || this.appConfig.workspace.pinnedFolders.length === 0) {
        this.appConfig.workspace.pinnedFolders = (workspaceSettings as any).pinnedFolders
        needsAppConfigSave = true
      }
      delete (workspaceSettings as any).pinnedFolders
      needsWorkspaceCleanup = true
    }
    if (Array.isArray((workspaceSettings as any).folderOrder) && (workspaceSettings as any).folderOrder.length > 0) {
      if (!this.appConfig.workspace.folderOrder || this.appConfig.workspace.folderOrder.length === 0) {
        this.appConfig.workspace.folderOrder = (workspaceSettings as any).folderOrder
        needsAppConfigSave = true
      }
      delete (workspaceSettings as any).folderOrder
      needsWorkspaceCleanup = true
    }
    if (Array.isArray((workspaceSettings as any).expandedFolders) && (workspaceSettings as any).expandedFolders.length > 0) {
      if (!this.appConfig.workspace.expandedFolders || this.appConfig.workspace.expandedFolders.length === 0) {
        this.appConfig.workspace.expandedFolders = (workspaceSettings as any).expandedFolders
        needsAppConfigSave = true
      }
      delete (workspaceSettings as any).expandedFolders
      needsWorkspaceCleanup = true
    }

    // Migrate tab and note session states from vault's settings.json to app_config.json workspace
    if (Array.isArray((workspaceSettings as any).openTabs) && (workspaceSettings as any).openTabs.length > 0) {
      if (!this.appConfig.workspace.openTabs || this.appConfig.workspace.openTabs.length === 0) {
        this.appConfig.workspace.openTabs = (workspaceSettings as any).openTabs
        needsAppConfigSave = true
      }
      delete (workspaceSettings as any).openTabs
      needsWorkspaceCleanup = true
    }
    if (Array.isArray((workspaceSettings as any).pinnedTabIds) && (workspaceSettings as any).pinnedTabIds.length > 0) {
      if (!this.appConfig.workspace.pinnedTabIds || this.appConfig.workspace.pinnedTabIds.length === 0) {
        this.appConfig.workspace.pinnedTabIds = (workspaceSettings as any).pinnedTabIds
        needsAppConfigSave = true
      }
      delete (workspaceSettings as any).pinnedTabIds
      needsWorkspaceCleanup = true
    }
    if ((workspaceSettings as any).lastNoteId) {
      if (!this.appConfig.workspace.lastNoteId) {
        this.appConfig.workspace.lastNoteId = (workspaceSettings as any).lastNoteId
        this.appConfig.workspace.lastSnippetId = (workspaceSettings as any).lastNoteId
        needsAppConfigSave = true
      }
      delete (workspaceSettings as any).lastNoteId
      needsWorkspaceCleanup = true
    }
    if ((workspaceSettings as any).lastSnippetId) {
      if (!this.appConfig.workspace.lastSnippetId) {
        this.appConfig.workspace.lastSnippetId = (workspaceSettings as any).lastSnippetId
        if (!this.appConfig.workspace.lastNoteId) {
          this.appConfig.workspace.lastNoteId = (workspaceSettings as any).lastSnippetId
        }
        needsAppConfigSave = true
      }
      delete (workspaceSettings as any).lastSnippetId
      needsWorkspaceCleanup = true
    }

    // Ensure stale empty keys and obsolete settings are also cleaned out
    for (const key of ['openTabs', 'pinnedTabIds', 'lastNoteId', 'lastSnippetId', 'vimMode'] as const) {
      if (key in workspaceSettings) {
        delete (workspaceSettings as any)[key]
        needsWorkspaceCleanup = true
      }
    }

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
    this.lastWrittenData = formatSettingsJson(this.getWorkspaceSettingsToSave())

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
    delete current.workspacePath
    delete current.vaultPath
    delete current.lastWorkspaceOpened
    delete current.pinnedFolders
    delete current.folderOrder
    delete current.expandedFolders
    delete current.openTabs
    delete current.pinnedTabIds
    delete current.lastNoteId
    delete current.lastSnippetId
    delete current.vimMode
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

    if (this.appConfig.isWorkspaceKey(key as string)) {
      this.appConfig.setWorkspaceValue(key as any, value)
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
        if (this.appConfig.isWorkspaceKey(k)) {
          this.appConfig.setWorkspaceValue(k as any, v)
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
      (k) =>
        !this.appConfig.isGlobalKey(k) &&
        !this.appConfig.isWorkspaceKey(k) &&
        k !== 'shortcuts' &&
        k !== 'workspacePath' &&
        k !== 'vaultPath'
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
      const data = formatSettingsJson(settingsToSave)

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
      workspacePath: this.workspacePath,
      pinnedFolders: this.appConfig.workspace.pinnedFolders || [],
      folderOrder: this.appConfig.workspace.folderOrder || [],
      expandedFolders: this.appConfig.workspace.expandedFolders || [],
      openTabs: this.appConfig.workspace.openTabs || [],
      pinnedTabIds: this.appConfig.workspace.pinnedTabIds || [],
      lastNoteId: this.appConfig.workspace.lastNoteId,
      lastSnippetId: this.appConfig.workspace.lastSnippetId,
      ...this.appConfig.globalApiKeys,
      shortcuts: this.appConfig.shortcuts || {}
    } as Settings
  }
}

export default new SettingsManager()