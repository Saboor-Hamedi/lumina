import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'
import { WorkspaceScanner, safeParseFrontmatter } from './workspaceScanner'
import { WorkspaceMediaManager } from './workspaceMediaManager'
import { WorkspaceOperations } from './workspaceOperations'

export { safeParseFrontmatter }

/**
 * WorkspaceManager Singleton
 *
 * Central orchestrator for local-first workspace operations in Lumina.
 *
 * Core Responsibilities:
 * 1. File Lifecycle & State: Manages in-memory maps of notes (`snippets`) and folders.
 * 2. Real-time File System Watcher: Monitors workspace directory via Chokidar with debounced
 *    incremental scans, ignoring editor temporary saves and build artifacts.
 * 3. Atomic File Operations: Delegates note creation, updates, renaming, moving, and deletions
 *    to `WorkspaceOperations` while maintaining thread-safe ignore windows for saving.
 * 4. IPC Broadcasts: Emits `workspace:updated` (and backwards-compatible `vault:updated`)
 *    events to all active BrowserWindow instances upon file modifications.
 * 5. Startup & Reload Optimization: Implements non-blocking concurrent scanning with in-flight
 *    promise coalescing so IPC `getSnippets` never returns partial or empty data.
 */
class WorkspaceManager {
  constructor() {
    /** @type {string|null} Absolute path to the active workspace on disk */
    this.workspacePath = null

    /** @type {Map<string, any>} In-memory map of snippetId -> Snippet object */
    this.snippets = new Map()

    /** @type {Set<string>} Set of known relative folder paths */
    this.folders = new Set()

    /** @type {import('chokidar').FSWatcher|null} Active Chokidar file system watcher */
    this.watcher = null

    /** @type {boolean} Indicates whether a disk scan is currently in progress */
    this.isScanning = false

    /** @type {Promise<{ snippets: Array<any>, folders: Array<string> }>|null} Active scan promise coalescing concurrent callers */
    this.scanPromise = null

    /** @type {NodeJS.Timeout|null} Debounce timer handle for file system change events */
    this.scanDebounceTimeout = null

    /** @type {Promise<string>|null} Active workspace initialization promise */
    this.initializationPromise = null

    /** @type {Map<string, number>} Lowercase normalized file paths ignored temporarily after programmatic writes */
    this.ignoredPaths = new Map()
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Backwards Compatibility Accessors (Legacy "Vault" terminology)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Deprecated alias for `workspacePath`.
   * @deprecated Use `workspacePath` instead.
   */
  get vaultPath() {
    return this.workspacePath
  }

  /**
   * Deprecated setter for `workspacePath`.
   * @deprecated Use `workspacePath` instead.
   */
  set vaultPath(val) {
    this.workspacePath = val
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lifecycle & Initialization
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Initializes the workspace manager with a target workspace directory.
   * Creates the folder if it does not exist, triggers the initial scan,
   * sets up the file watcher, and broadcasts readiness.
   *
   * @param {string} [customPath] - Explicit path requested by user or saved in app config.
   * @param {string} [fallbackDocumentsPath] - System Documents directory for default folder creation.
   * @returns {Promise<string>} The resolved absolute workspace path.
   */
  async init(customPath, fallbackDocumentsPath) {
    if (this.initializationPromise) return this.initializationPromise

    this.initializationPromise = this.initialize(customPath, fallbackDocumentsPath)
    try {
      return await this.initializationPromise
    } finally {
      this.initializationPromise = null
    }
  }

  async initialize(customPath, fallbackDocumentsPath) {
    let targetPath = customPath
    if (!targetPath && fallbackDocumentsPath) {
      targetPath = path.join(fallbackDocumentsPath, 'lumina')
    }
    if (!targetPath) {
      targetPath = path.join(
        process.env.HOME || process.env.USERPROFILE || '.',
        'Documents',
        'lumina'
      )
    }

    await fs.mkdir(targetPath, { recursive: true })
    this.setWorkspacePath(targetPath)

    // Load persisted metadata cache from disk so the scan can skip re-reading unchanged files
    await this.loadCache()

    // Execute initial scan and await completion
    await this.scanWorkspace()

    // Initialize file watcher after initial scan to prevent race conditions
    this.setupWatcher()

    // Notify any open renderer windows that the workspace is ready
    this.notifyWindows('workspace:updated')
    this.notifyWindows('vault:updated')

    return targetPath
  }

  /**
   * Loads the persistent workspace metadata cache from .lumina/cache.json.
   * Enables near-instant startup by populating existing snippets before scanning.
   */
  async loadCache() {
    if (!this.workspacePath) return
    try {
      const cacheFilePath = path.join(this.workspacePath, '.lumina', 'cache.json')
      const raw = await fs.readFile(cacheFilePath, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data?.snippets) && data.snippets.length > 0) {
        this.snippets = new Map(data.snippets.map((s) => [s.id, s]))
      }
      if (Array.isArray(data?.folders)) {
        this.folders = new Set(data.folders)
      }
    } catch (_) {
      // Cache file doesn't exist yet or is invalid; fallback to full scan
    }
  }

  /**
   * Persists current workspace snippets and folders metadata to .lumina/cache.json.
   */
  async saveCache() {
    if (!this.workspacePath || this.snippets.size === 0) return
    try {
      const luminaDir = path.join(this.workspacePath, '.lumina')
      await fs.mkdir(luminaDir, { recursive: true })
      const cacheFilePath = path.join(luminaDir, 'cache.json')
      const payload = {
        version: 1,
        timestamp: Date.now(),
        snippets: Array.from(this.snippets.values()),
        folders: Array.from(this.folders)
      }
      await fs.writeFile(cacheFilePath, JSON.stringify(payload), 'utf-8')
    } catch (err) {
      console.warn('[WorkspaceManager] Failed to persist workspace cache:', err)
    }
  }

  /**
   * Sets or switches the active workspace directory, resetting existing cache.
   *
   * @param {string} dir - Absolute path to the new workspace directory.
   */
  setWorkspacePath(dir) {
    this.workspacePath = dir
    this.snippets.clear()
    this.folders.clear()
    this.ignoredPaths.clear()
    this.scanPromise = null

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  /**
   * Deprecated alias for `setWorkspacePath`.
   * @deprecated Use `setWorkspacePath` instead.
   */
  setVaultPath(dir) {
    return this.setWorkspacePath(dir)
  }

  /**
   * Sanitizes a title string into a safe file name across all operating systems.
   * @param {string} title - User-entered note title.
   * @returns {string} Sanitized filename without extension.
   */
  sanitizeTitleForFilename(title) {
    return WorkspaceOperations.sanitizeTitleForFilename(title)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // File System Watcher & Notifications
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Sets up Chokidar file watcher to listen for external file system changes
   * (e.g. Git pulls, external edits, file manager drops).
   */
  setupWatcher() {
    if (!this.workspacePath) return
    if (this.watcher) {
      this.watcher.close()
    }

    this.watcher = chokidar.watch(this.workspacePath, {
      ignored: [
        /(^|[/\\])\../,
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/log/**'
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 99,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    })

    const triggerScan = () => {
      clearTimeout(this.scanDebounceTimeout)
      this.scanDebounceTimeout = setTimeout(async () => {
        await this.scanWorkspace()
        this.notifyWindows('workspace:updated')
        this.notifyWindows('vault:updated')
      }, 75)
    }

    const VALID_EXTS = new Set([
      '.md',
      '.markdown',
      '.txt',
      '.png',
      '.jpg',
      '.jpeg',
      '.webp',
      '.gif',
      '.svg',
      '.bmp',
      '.ico',
      '.avif'
    ])

    this.watcher.on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase()
      if (VALID_EXTS.has(ext)) triggerScan()
    })

    this.watcher.on('unlink', (filePath) => {
      const norm = path.resolve(filePath).toLowerCase()
      const expiry = this.ignoredPaths.get(norm)
      if (expiry) {
        if (Date.now() < expiry) return
        this.ignoredPaths.delete(norm)
      }
      triggerScan()
    })
    this.watcher.on('addDir', triggerScan)
    this.watcher.on('unlinkDir', triggerScan)

    this.watcher.on('change', (filePath) => {
      const norm = path.resolve(filePath).toLowerCase()
      const expiry = this.ignoredPaths.get(norm)
      if (expiry) {
        if (Date.now() < expiry) return
        this.ignoredPaths.delete(norm)
      }
      const ext = path.extname(filePath).toLowerCase()
      if (VALID_EXTS.has(ext)) triggerScan()
    })
  }

  /**
   * Sends an IPC message to all non-destroyed Electron BrowserWindows.
   *
   * @param {string} channel - IPC channel name.
   * @param {any} [data] - Optional payload.
   */
  notifyWindows(channel, data) {
    const wins = BrowserWindow.getAllWindows()
    wins.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Workspace Scanning
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Scans the workspace directory for markdown notes and media assets.
   * Utilizes in-flight promise coalescing to guarantee that concurrent callers
   * receive the same complete scan results without performing duplicate work.
   *
   * @returns {Promise<{ snippets: Array<any>, folders: Array<string> }>}
   */
  async scanWorkspace() {
    if (!this.workspacePath) {
      return { snippets: Array.from(this.snippets.values()), folders: Array.from(this.folders) }
    }

    // Coalesce concurrent calls into the existing active scan promise
    if (this.scanPromise) {
      return await this.scanPromise
    }

    this.isScanning = true
    this.scanPromise = (async () => {
      try {
        const { snippets, folders } = await WorkspaceScanner.scan(
          this.workspacePath,
          this.snippets
        )
        this.snippets = new Map(snippets.map((s) => [s.id, s]))
        this.folders = new Set(folders)
        this.saveCache().catch(() => {})
        return { snippets, folders }
      } catch (err) {
        console.error('[WorkspaceManager] ✗ Scan failed:', err)
        return {
          snippets: Array.from(this.snippets.values()),
          folders: Array.from(this.folders)
        }
      } finally {
        this.isScanning = false
        this.scanPromise = null
      }
    })()

    return await this.scanPromise
  }

  /**
   * Deprecated alias for `scanWorkspace`.
   * @deprecated Use `scanWorkspace` instead.
   */
  async scanVault() {
    return await this.scanWorkspace()
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Snippet Operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Persists a note (snippet) to disk and updates in-memory cache.
   * Temporarily ignores watcher events for this file to avoid self-triggering scans.
   *
   * @param {any} snippet - Snippet data to save.
   * @returns {Promise<any>} The saved snippet with updated timestamps and paths.
   */
  async saveSnippet(snippet) {
    const oldSnippet = snippet?.id ? this.snippets.get(snippet.id) : null
    if (oldSnippet?.isPartial) {
      throw new Error('This large note is open in preview mode and cannot be saved.')
    }
    if (oldSnippet?.isOversized && snippet.code === '') {
      throw new Error('This oversized note is protected from blank saves. Open it after loading its content.')
    }

    const result = await WorkspaceOperations.saveSnippet(
      this.workspacePath,
      this.snippets,
      this.folders,
      snippet,
      oldSnippet
    )

    if (this.workspacePath && result?.fileName) {
      const savedPath = path.join(this.workspacePath, result.folderId || '', result.fileName)
      this.ignoredPaths.set(path.resolve(savedPath).toLowerCase(), Date.now() + 600)
    }

    if (this.workspacePath && oldSnippet?.fileName && oldSnippet.fileName !== result?.fileName) {
      const oldRelativeFolder = (oldSnippet.folderId || '').replace(/\\/g, '/')
      const oldPath = path.join(this.workspacePath, oldRelativeFolder, oldSnippet.fileName)
      this.ignoredPaths.set(path.resolve(oldPath).toLowerCase(), Date.now() + 600)
    }

    return result
  }

  /**
   * Deletes a snippet from disk and cache by ID.
   *
   * @param {string} id - Snippet ID.
   * @returns {Promise<boolean>}
   */
  async deleteSnippet(id) {
    const deletedPath = await WorkspaceOperations.deleteSnippet(this.workspacePath, this.snippets, id)
    if (deletedPath && typeof deletedPath === 'string') {
      this.ignoredPaths.set(path.resolve(deletedPath).toLowerCase(), Date.now() + 1500)
    }
    return deletedPath
  }

  /**
   * Performs bulk deletion of folders and/or snippets atomically.
   *
   * @param {{ folderIds?: string[], snippetIds?: string[] }} params
   * @returns {Promise<any>}
   */
  async bulkDelete({ folderIds = [], snippetIds = [] }) {
    if (this.watcher) await this.watcher.close()
    try {
      const result = await WorkspaceOperations.bulkDelete(
        this.workspacePath,
        this.snippets,
        this.folders,
        { folderIds, snippetIds }
      )
      await this.scanWorkspace()
      this.notifyWindows('workspace:updated')
      this.notifyWindows('vault:updated')
      return result
    } finally {
      this.setupWatcher()
    }
  }

  /**
   * Moves a file from one relative path to another.
   *
   * @param {string} oldRelPath
   * @param {string} newRelPath
   * @returns {Promise<any>}
   */
  async moveFile(oldRelPath, newRelPath) {
    const result = await WorkspaceOperations.moveFile(this.workspacePath, oldRelPath, newRelPath)
    await this.scanWorkspace()
    this.notifyWindows('workspace:updated')
    this.notifyWindows('vault:updated')
    return result
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Folder Operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new folder on disk and tracks it in the workspace folder registry.
   *
   * @param {string} folderPath - Relative folder path to create.
   * @returns {Promise<any>}
   */
  async createFolder(folderPath) {
    const result = await WorkspaceOperations.createFolder(
      this.workspacePath,
      this.folders,
      folderPath
    )
    await this.scanWorkspace()
    this.notifyWindows('workspace:updated')
    this.notifyWindows('vault:updated')
    return result
  }

  /**
   * Renames an existing folder, updating all child notes and links.
   *
   * @param {string} oldPath - Old relative folder path.
   * @param {string} newPath - New relative folder path.
   * @returns {Promise<any>}
   */
  async renameFolder(oldPath, newPath) {
    if (this.watcher) await this.watcher.close()
    try {
      const result = await WorkspaceOperations.renameFolder(
        this.workspacePath,
        this.snippets,
        this.folders,
        oldPath,
        newPath
      )
      await this.scanWorkspace()
      this.notifyWindows('workspace:updated')
      this.notifyWindows('vault:updated')
      return result
    } finally {
      this.setupWatcher()
    }
  }

  /**
   * Deletes a folder and all its contents recursively.
   *
   * @param {string} folderPath - Relative folder path to remove.
   * @returns {Promise<any>}
   */
  async deleteFolder(folderPath) {
    if (this.watcher) await this.watcher.close()
    try {
      const result = await WorkspaceOperations.deleteFolder(
        this.workspacePath,
        this.snippets,
        this.folders,
        folderPath
      )
      await this.scanWorkspace()
      this.notifyWindows('workspace:updated')
      this.notifyWindows('vault:updated')
      return result
    } finally {
      this.setupWatcher()
    }
  }

  /**
   * Imports external files or folders from the host operating system into the workspace.
   *
   * @param {string[]} [sourcePaths=[]]
   * @param {string} [targetFolderId='']
   * @returns {Promise<any>}
   */
  async importExternalPaths(sourcePaths = [], targetFolderId = '') {
    if (this.watcher) await this.watcher.close()
    try {
      const opResult = await WorkspaceOperations.importExternalPaths(
        this.workspacePath,
        this.folders,
        sourcePaths,
        targetFolderId
      )

      const scanResult = await this.scanWorkspace()
      if (scanResult && Array.isArray(scanResult.snippets)) {
        scanResult.snippets.forEach((s) => {
          const sFolder = (s.folderId || '').replace(/\\/g, '/')
          const inImportedFolder = opResult.importedFolderIds.some(
            (f) => sFolder === f || sFolder.startsWith(f + '/')
          )
          const isImportedFile = opResult.importedFileNames.some(
            (ifn) => ifn.fileName === s.fileName && (ifn.folderId || '') === (s.folderId || '')
          )
          if (inImportedFolder || isImportedFile) {
            opResult.importedSnippetIds.push(s.id)
          }
        })
      }

      this.notifyWindows('workspace:updated')
      this.notifyWindows('vault:updated')
      return opResult
    } finally {
      this.setupWatcher()
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Media & Asset Management
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Saves an image buffer to the workspace's root assets folder.
   * @param {Buffer} buffer
   * @param {string} originalName
   * @returns {Promise<any>}
   */
  async saveImage(buffer, originalName) {
    const result = await WorkspaceMediaManager.saveImage(this.workspacePath, buffer, originalName)
    await this.scanWorkspace()
    return result
  }

  /**
   * Saves an image into a designated folder inside the workspace.
   * @param {Buffer} buffer
   * @param {string} [targetFolder='']
   * @param {string} [name='']
   * @returns {Promise<any>}
   */
  async saveWorkspaceImage(buffer, targetFolder = '', name = '') {
    const result = await WorkspaceMediaManager.saveVaultImage(
      this.workspacePath,
      buffer,
      targetFolder,
      name
    )
    await this.scanWorkspace()
    this.notifyWindows('workspace:updated')
    this.notifyWindows('vault:updated')
    return result
  }

  /**
   * Deprecated alias for `saveWorkspaceImage`.
   * @deprecated Use `saveWorkspaceImage` instead.
   */
  async saveVaultImage(buffer, targetFolder = '', name = '') {
    return await this.saveWorkspaceImage(buffer, targetFolder, name)
  }

  /**
   * Reads an asset file from disk as a base64 data URL.
   * @param {string} relativePath
   * @returns {Promise<any>}
   */
  async readAsset(relativePath) {
    return await WorkspaceMediaManager.readAsset(this.workspacePath, relativePath)
  }

  /**
   * Deletes an asset file from disk.
   * @param {string} relativePath
   * @returns {Promise<any>}
   */
  async deleteAsset(relativePath) {
    return await WorkspaceMediaManager.deleteAsset(this.workspacePath, relativePath)
  }

  /**
   * Scans and removes orphaned media assets not linked by any markdown note.
   * @returns {Promise<any>}
   */
  async cleanOrphanedAssets() {
    return await WorkspaceMediaManager.cleanOrphanedAssets(this.workspacePath, this.snippets)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Data Access for Preload / Renderer
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves all snippets and folders currently tracked by the workspace.
   * If an initial or active scan is in progress, awaits the scan promise to ensure
   * complete, un-truncated data is always returned to the renderer.
   *
   * @returns {Promise<{ snippets: Array<any>, folders: Array<string> }>}
   */
  async getSnippets() {
    if (this.initializationPromise) {
      await this.initializationPromise
    }

    if (this.scanPromise) {
      await this.scanPromise
    }

    const list = Array.from(this.snippets.values())
    return {
      snippets: list
        .filter((s) => s && s.id)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
      folders: Array.from(this.folders)
    }
  }

  async readSnippet(id) {
    if (this.initializationPromise) {
      await this.initializationPromise
    }

    const snippet = this.snippets.get(id)
    if (!snippet || !this.workspacePath || !snippet.relativePath) {
      throw new Error('Snippet not found')
    }

    const filePath = path.resolve(this.workspacePath, snippet.relativePath)
    const workspaceRoot = path.resolve(this.workspacePath)
    if (!filePath.startsWith(workspaceRoot + path.sep)) {
      throw new Error('Invalid snippet path')
    }

    const rawContent = await fs.readFile(filePath, 'utf-8')
    const parsed = safeParseFrontmatter(rawContent)
    const loadNote = {
      ...snippet,
      code: parsed.content || '',
      isOversized: false
    }
    this.snippets.set(id, loadNote)
    return loadNote
  }

  async readNotePreview(id, maxBytes = 512 * 1024) {
    if (this.initializationPromise) {
      await this.initializationPromise
    }

    const snippet = this.snippets.get(id)
    if (!snippet || !this.workspacePath || !snippet.relativePath) {
      throw new Error('Snippet not found')
    }

    const filePath = path.resolve(this.workspacePath, snippet.relativePath)
    const workspaceRoot = path.resolve(this.workspacePath)
    if (!filePath.startsWith(workspaceRoot + path.sep)) {
      throw new Error('Invalid snippet path')
    }

    const handle = await fs.open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(Math.max(1, maxBytes))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      const parsed = safeParseFrontmatter(buffer.subarray(0, bytesRead).toString('utf-8'))
      return {
        ...snippet,
        code: parsed.content || '',
        isOversized: true,
        isPartial: true,
        previewBytes: bytesRead
      }
    } finally {
      await handle.close()
    }
  }
}

export default new WorkspaceManager()
