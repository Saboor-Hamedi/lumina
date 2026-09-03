import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'
import { VaultScanner, safeParseFrontmatter } from './VaultScanner'
import { AssetManager } from './AssetManager'
import { VaultOperations } from './VaultOperations'

export { safeParseFrontmatter }

class VaultManager {
  constructor() {
    this.vaultPath = null
    this.snippets = new Map()
    this.folders = new Set()
    this.watcher = null
    this.isScanning = false
    this.scanDebounceTimeout = null
  }

  async init(customPath, fallbackDocumentsPath) {
    let targetPath = customPath
    if (!targetPath && fallbackDocumentsPath) {
      targetPath = path.join(fallbackDocumentsPath, 'lumina')
    }
    if (!targetPath) {
      targetPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', 'Documents', 'lumina')
    }
    await fs.mkdir(targetPath, { recursive: true })
    this.setVaultPath(targetPath)
    await this.scanVault()
    this.setupWatcher()
    return targetPath
  }

  setVaultPath(dir) {
    this.vaultPath = dir
    this.snippets.clear()
    this.folders.clear()
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  sanitizeTitleForFilename(title) {
    return VaultOperations.sanitizeTitleForFilename(title)
  }

  setupWatcher() {
    if (!this.vaultPath) return
    if (this.watcher) {
      this.watcher.close()
    }

    this.watcher = chokidar.watch(this.vaultPath, {
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
        await this.scanVault()
        this.notifyWindows('vault:updated')
      }, 50)
    }

    this.watcher.on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase()
      const valid = new Set(['.md', '.markdown', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'])
      if (valid.has(ext)) triggerScan()
    })

    this.watcher.on('unlink', triggerScan)
    this.watcher.on('addDir', triggerScan)
    this.watcher.on('unlinkDir', triggerScan)
    this.watcher.on('change', (filePath) => {
      const ext = path.extname(filePath).toLowerCase()
      const valid = new Set(['.md', '.markdown', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'])
      if (valid.has(ext)) triggerScan()
    })
  }

  notifyWindows(channel, data) {
    const wins = BrowserWindow.getAllWindows()
    wins.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }

  async scanVault() {
    if (!this.vaultPath || this.isScanning) {
      return { snippets: Array.from(this.snippets.values()), folders: Array.from(this.folders) }
    }

    this.isScanning = true
    try {
      const { snippets, folders } = await VaultScanner.scan(this.vaultPath)
      this.snippets = new Map(snippets.map((s) => [s.id, s]))
      this.folders = new Set(folders)
      return { snippets, folders }
    } finally {
      this.isScanning = false
    }
  }

  async saveSnippet(snippet) {
    const oldSnippet = snippet?.id ? this.snippets.get(snippet.id) : null
    const result = await VaultOperations.saveSnippet(
      this.vaultPath,
      this.snippets,
      this.folders,
      snippet,
      oldSnippet
    )
    return result
  }

  async deleteSnippet(id) {
    return await VaultOperations.deleteSnippet(this.vaultPath, this.snippets, id)
  }

  async bulkDelete({ folderIds = [], snippetIds = [] }) {
    if (this.watcher) await this.watcher.close()
    try {
      const result = await VaultOperations.bulkDelete(
        this.vaultPath,
        this.snippets,
        this.folders,
        { folderIds, snippetIds }
      )
      await this.scanVault()
      return result
    } finally {
      this.setupWatcher()
    }
  }

  async moveFile(oldRelPath, newRelPath) {
    const result = await VaultOperations.moveFile(this.vaultPath, oldRelPath, newRelPath)
    await this.scanVault()
    return result
  }

  async createFolder(folderPath) {
    const result = await VaultOperations.createFolder(this.vaultPath, this.folders, folderPath)
    await this.scanVault()
    this.notifyWindows('vault:updated')
    return result
  }

  async renameFolder(oldPath, newPath) {
    if (this.watcher) await this.watcher.close()
    try {
      const result = await VaultOperations.renameFolder(
        this.vaultPath,
        this.snippets,
        this.folders,
        oldPath,
        newPath
      )
      await this.scanVault()
      this.notifyWindows('vault:updated')
      return result
    } finally {
      this.setupWatcher()
    }
  }

  async deleteFolder(folderPath) {
    if (this.watcher) await this.watcher.close()
    try {
      const result = await VaultOperations.deleteFolder(
        this.vaultPath,
        this.snippets,
        this.folders,
        folderPath
      )
      await this.scanVault()
      this.notifyWindows('vault:updated')
      return result
    } finally {
      this.setupWatcher()
    }
  }

  async importExternalPaths(sourcePaths = [], targetFolderId = '') {
    if (this.watcher) await this.watcher.close()
    try {
      const opResult = await VaultOperations.importExternalPaths(
        this.vaultPath,
        this.folders,
        sourcePaths,
        targetFolderId
      )

      const scanResult = await this.scanVault()
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

      this.notifyWindows('vault:updated')
      return opResult
    } finally {
      this.setupWatcher()
    }
  }

  async saveImage(buffer, originalName) {
    const result = await AssetManager.saveImage(this.vaultPath, buffer, originalName)
    await this.scanVault()
    return result
  }

  async readAsset(relativePath) {
    return await AssetManager.readAsset(this.vaultPath, relativePath)
  }

  async deleteAsset(relativePath) {
    return await AssetManager.deleteAsset(this.vaultPath, relativePath)
  }

  async cleanOrphanedAssets() {
    return await AssetManager.cleanOrphanedAssets(this.vaultPath, this.snippets)
  }

  getSnippets() {
    const list = Array.from(this.snippets.values())
    return {
      snippets: list
        .filter((s) => s && s.id)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
      folders: Array.from(this.folders)
    }
  }
}

export default new VaultManager()
