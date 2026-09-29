import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { GLOBAL_API_KEYS, GlobalApiKey, decryptKey, encryptKey } from './crypto'

export interface Shortcuts {
  [action: string]: string
}

export type WorkspaceKey =
  | 'pinnedFolders'
  | 'folderOrder'
  | 'expandedFolders'
  | 'openTabs'
  | 'pinnedTabIds'
  | 'lastNoteId'
  | 'lastSnippetId'

export interface WorkspaceConfig {
  lastWorkspaceOpened: string | null
  path: string | null
  vaultPath: string | null
  pinnedFolders: string[]
  folderOrder: string[]
  expandedFolders: string[]
  openTabs: string[]
  pinnedTabIds: string[]
  lastNoteId: string | null
  lastSnippetId: string | null
}

export class AppConfigManager {
  private appConfigPath: string | null = null
  public globalApiKeys: Record<string, any> = {}
  public shortcuts: Shortcuts = {}
  public lastWorkspacePath: string | null = null
  public workspace: WorkspaceConfig = {
    lastWorkspaceOpened: null,
    path: null,
    vaultPath: null,
    pinnedFolders: [],
    folderOrder: [],
    expandedFolders: [],
    openTabs: [],
    pinnedTabIds: [],
    lastNoteId: null,
    lastSnippetId: null
  }

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

      const ws = cfg?.workspace || {}
      const resolvedPath =
        ws.path ||
        ws.lastWorkspaceOpened ||
        ws.vaultPath ||
        cfg?.lastWorkspaceOpened ||
        cfg?.lastWorkspacePath ||
        cfg?.lastworkspacePath ||
        cfg?.lastVaultOpened ||
        cfg?.workspacePath ||
        null

      this.lastWorkspacePath = resolvedPath

      this.workspace = {
        lastWorkspaceOpened: resolvedPath,
        path: resolvedPath,
        vaultPath: resolvedPath,
        pinnedFolders: Array.isArray(ws.pinnedFolders)
          ? ws.pinnedFolders
          : Array.isArray(cfg?.pinnedFolders)
          ? cfg.pinnedFolders
          : [],
        folderOrder: Array.isArray(ws.folderOrder)
          ? ws.folderOrder
          : Array.isArray(cfg?.folderOrder)
          ? cfg.folderOrder
          : [],
        expandedFolders: Array.isArray(ws.expandedFolders)
          ? ws.expandedFolders
          : Array.isArray(cfg?.expandedFolders)
          ? cfg.expandedFolders
          : [],
        openTabs: Array.isArray(ws.openTabs)
          ? ws.openTabs
          : Array.isArray(cfg?.openTabs)
          ? cfg.openTabs
          : [],
        pinnedTabIds: Array.isArray(ws.pinnedTabIds)
          ? ws.pinnedTabIds
          : Array.isArray(cfg?.pinnedTabIds)
          ? cfg.pinnedTabIds
          : [],
        lastNoteId: ws.lastNoteId ?? cfg?.lastNoteId ?? null,
        lastSnippetId: ws.lastSnippetId ?? cfg?.lastSnippetId ?? null
      }
    } catch {
      this.globalApiKeys = {}
      this.shortcuts = {}
      this.lastWorkspacePath = null
      this.workspace = {
        lastWorkspaceOpened: null,
        path: null,
        vaultPath: null,
        pinnedFolders: [],
        folderOrder: [],
        expandedFolders: [],
        openTabs: [],
        pinnedTabIds: [],
        lastNoteId: null,
        lastSnippetId: null
      }
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

      this.workspace.path = this.lastWorkspacePath
      this.workspace.lastWorkspaceOpened = this.lastWorkspacePath
      this.workspace.vaultPath = this.lastWorkspacePath

      delete existing.lastWorkspaceOpened
      delete existing.lastWorkspacePath
      delete existing.lastworkspacePath
      delete existing.lastVaultOpened
      delete existing.workspacePath

      const merged: any = {
        ...existing,
        workspace: {
          lastWorkspaceOpened: this.workspace.lastWorkspaceOpened,
          path: this.workspace.path,
          vaultPath: this.workspace.vaultPath,
          pinnedFolders: this.workspace.pinnedFolders || [],
          folderOrder: this.workspace.folderOrder || [],
          expandedFolders: this.workspace.expandedFolders || [],
          openTabs: this.workspace.openTabs || [],
          pinnedTabIds: this.workspace.pinnedTabIds || [],
          lastNoteId: this.workspace.lastNoteId ?? null,
          lastSnippetId: this.workspace.lastSnippetId ?? null
        },
        apiKeys: encryptedApiKeys,
        shortcuts: this.shortcuts || {}
      }

      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(merged, null, 2), 'utf8')
    } catch (err) {
      console.error('[SettingsManager] Failed to save app_config.json:', err)
    }
  }

  isWorkspaceKey(key: string): key is WorkspaceKey {
    return (
      key === 'pinnedFolders' ||
      key === 'folderOrder' ||
      key === 'expandedFolders' ||
      key === 'openTabs' ||
      key === 'pinnedTabIds' ||
      key === 'lastNoteId' ||
      key === 'lastSnippetId'
    )
  }

  setWorkspaceValue(key: WorkspaceKey, value: any): void {
    if (key === 'pinnedFolders') {
      this.workspace.pinnedFolders = Array.isArray(value) ? value : []
    } else if (key === 'folderOrder') {
      this.workspace.folderOrder = Array.isArray(value) ? value : []
    } else if (key === 'expandedFolders') {
      this.workspace.expandedFolders = Array.isArray(value) ? value : []
    } else if (key === 'openTabs') {
      this.workspace.openTabs = Array.isArray(value) ? value : []
    } else if (key === 'pinnedTabIds') {
      this.workspace.pinnedTabIds = Array.isArray(value) ? value : []
    } else if (key === 'lastNoteId') {
      this.workspace.lastNoteId = typeof value === 'string' ? value : null
      this.workspace.lastSnippetId = this.workspace.lastNoteId
    } else if (key === 'lastSnippetId') {
      this.workspace.lastSnippetId = typeof value === 'string' ? value : null
      if (value) this.workspace.lastNoteId = value
    }
  }

  getLastWorkspacePath(): string | null {
    return this.lastWorkspacePath || this.workspace.path || this.workspace.lastWorkspaceOpened
  }

  setLastWorkspacePath(pathVal: string | null): void {
    this.lastWorkspacePath = pathVal
    this.workspace.path = pathVal
    this.workspace.lastWorkspaceOpened = pathVal
    this.workspace.vaultPath = pathVal
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