import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import WorkspaceManager from '../workspace/workspaceManager'
import SettingsManager from '../settings'
import WorkspaceIndexer from '../workspace/workspaceIndexer'
import WorkspaceSearch from '../workspace/workspaceSearch'
import BrainIndexer from '../workspace/brainIndexer'
import { validateIpc, z } from './ipcValidation'

/**
 * ============================================================================
 * Workspace & Vault IPC Handlers
 * ============================================================================
 * 
 * Manages all file, folder, note, media, indexing, and search operations:
 * - Dual Registration: Registers both `workspace:<action>` and legacy `vault:<action>`
 *   so older components never break.
 * - Note CRUD: readSnippet, saveSnippet, deleteSnippet, readNotePreview.
 * - Folder Operations: createFolder, renameFolder, deleteFolder, moveFile, bulkDelete.
 * - Media & Assets: saveImage, saveImageFromPath, saveWorkspaceImage, readAsset, deleteAsset, cleanOrphans.
 * - External Drops: importExternalPaths for drag-and-drop ingestion.
 * - Indexing & Full-text Search: index, rebuild-index, index-stats, search, search-stats, find-similar.
 * - Lumina Brain: brain:search, brain:stats, brain:reindex.
 */

const stringIdSchema = z.string().min(1)
const stringPathSchema = z.string().min(1)
const snippetObjectSchema = z.record(z.string(), z.any())

export function registerWorkspaceHandlers(getMainWindow: () => BrowserWindow | null): void {
  let hasIndexed = false

  // Helper for dual registration (`workspace:*` and legacy `vault:*`)
  const registerWorkspaceHandle = (channelSuffix: string, handler: (event: any, ...args: any[]) => any) => {
    ipcMain.handle(`workspace:${channelSuffix}`, handler)
    ipcMain.handle(`vault:${channelSuffix}`, handler)
  }

  // Retrieve all snippets/notes in the active workspace
  registerWorkspaceHandle('getSnippets', () => WorkspaceManager.getSnippets())

  // Read full content of a specific note by ID
  registerWorkspaceHandle('readSnippet', async (_, id) => {
    const validId = validateIpc(stringIdSchema, id)
    return WorkspaceManager.readSnippet(validId)
  })

  // Read lightweight note preview metadata
  registerWorkspaceHandle('readNotePreview', async (_, id) => {
    const validId = validateIpc(stringIdSchema, id)
    return WorkspaceManager.readNotePreview(validId)
  })

  // Save/update note content and trigger auto-indexing
  registerWorkspaceHandle('saveSnippet', async (_, snippet) => {
    const validSnippet = validateIpc(snippetObjectSchema, snippet)
    const updatedSnippet = await WorkspaceManager.saveSnippet(validSnippet)
    if (WorkspaceManager.workspacePath && updatedSnippet?.fileName) {
      const filePath = path.join(
        WorkspaceManager.workspacePath,
        updatedSnippet.folderId || '',
        updatedSnippet.fileName
      )
      WorkspaceIndexer.indexFile(filePath, true)
        .then(() => WorkspaceSearch.reload())
        .catch((err: any) => {
          console.error('[Main] Auto-index failed:', err)
        })
    }
    return updatedSnippet
  })

  // Save image buffer to workspace assets
  registerWorkspaceHandle('saveImage', (_, payload) => {
    const { buffer, name } = payload || {}
    return WorkspaceManager.saveImage(buffer, name)
  })

  // Ingest image from absolute file path or dropped URL
  registerWorkspaceHandle('saveImageFromPath', async (_, payload) => {
    try {
      const { filePath, name } = payload || {}
      if (!filePath) return null
      let cleanPath = String(filePath).trim().replace(/^["']|["']$/g, '')
      cleanPath = cleanPath.split('?')[0].split('#')[0]

      if (/^file:\/\//i.test(cleanPath)) {
        cleanPath = cleanPath.replace(/^file:\/\/(localhost\/)?/i, '')
        try {
          cleanPath = decodeURIComponent(cleanPath)
        } catch (_) {}
      }

      if (/^[/\\][a-zA-Z]:/.test(cleanPath)) {
        cleanPath = cleanPath.slice(1)
      }

      cleanPath = path.normalize(cleanPath)

      try {
        await fs.access(cleanPath)
      } catch {
        return null
      }
      const buffer = await fs.readFile(cleanPath)
      let fileName = name || path.basename(cleanPath) || `Pasted image ${Date.now()}.png`
      const ext = path.extname(fileName).toLowerCase()
      if (!ext || ext === '.tmp') {
        let detectedExt = '.png'
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) detectedExt = '.jpg'
        else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) detectedExt = '.gif'
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) detectedExt = '.webp'
        fileName = `${path.basename(fileName, ext)}${detectedExt}`
      }
      return await WorkspaceManager.saveImage(buffer, fileName)
    } catch (err) {
      console.error('[Main] saveImageFromPath error:', err)
      return null
    }
  })

  // Save image targeted to a specific folder
  registerWorkspaceHandle('saveWorkspaceImage', (_, payload) => {
    const { buffer, targetFolder, name } = payload || {}
    return WorkspaceManager.saveWorkspaceImage(buffer, targetFolder, name)
  })

  registerWorkspaceHandle('saveVaultImage', (_, payload) => {
    const { buffer, targetFolder, name } = payload || {}
    return WorkspaceManager.saveWorkspaceImage(buffer, targetFolder, name)
  })

  // Read asset from relative path
  registerWorkspaceHandle('readAsset', (_, relPath) => {
    const validPath = validateIpc(stringPathSchema, relPath)
    return WorkspaceManager.readAsset(validPath)
  })

  // Delete asset from relative path
  registerWorkspaceHandle('deleteAsset', (_, relPath) => {
    const validPath = validateIpc(stringPathSchema, relPath)
    return WorkspaceManager.deleteAsset(validPath)
  })

  // Delete note and remove search index entries
  registerWorkspaceHandle('deleteSnippet', async (_, id) => {
    const validId = validateIpc(stringIdSchema, id)
    const deletedPath = await WorkspaceManager.deleteSnippet(validId)
    if (deletedPath && typeof deletedPath === 'string') {
      WorkspaceIndexer.deleteChunksForFile(deletedPath)
        .then(() => WorkspaceSearch.reload())
        .catch((err: any) => console.error('[Main] Search index cleanup error:', err))
    }
    return true
  })

  // Delete vector/text chunks from search index
  registerWorkspaceHandle('deleteChunks', async (_, target) => {
    try {
      const deletePromise = Array.isArray(target)
        ? WorkspaceIndexer.deleteChunksForFiles(target)
        : WorkspaceIndexer.deleteChunksForFile(target)

      deletePromise
        .then(() => WorkspaceSearch.reload())
        .catch((err: any) => console.error('[Main] Failed to reload search after deleteChunks:', err))

      return true
    } catch (err) {
      console.error('[Main] Failed to delete chunks:', err)
      return false
    }
  })

  // Purge unreferenced asset files
  registerWorkspaceHandle('cleanOrphans', async () => await WorkspaceManager.cleanOrphanedAssets())

  // Folder creation
  registerWorkspaceHandle('createFolder', async (_, folderPath) => {
    const validPath = validateIpc(stringPathSchema, folderPath)
    return await WorkspaceManager.createFolder(validPath)
  })

  // Folder rename
  registerWorkspaceHandle('renameFolder', async (_, oldPath, newPath) => {
    const validOld = validateIpc(stringPathSchema, oldPath)
    const validNew = validateIpc(stringPathSchema, newPath)
    return await WorkspaceManager.renameFolder(validOld, validNew)
  })

  // Move file between directories
  registerWorkspaceHandle('moveFile', async (_, oldRelPath, newRelPath) => {
    const validOld = validateIpc(stringPathSchema, oldRelPath)
    const validNew = validateIpc(stringPathSchema, newRelPath)
    const result = await WorkspaceManager.moveFile(validOld, validNew)
    if (WorkspaceManager.workspacePath) {
      const oldFullPath = path.join(WorkspaceManager.workspacePath, validOld)
      const newFullPath = path.join(WorkspaceManager.workspacePath, validNew)
      await WorkspaceIndexer.deleteChunksForFile(oldFullPath)
      if (newFullPath.endsWith('.md')) {
        await WorkspaceIndexer.indexFile(newFullPath, true)
      }
      await WorkspaceSearch.reload()
    }
    return result
  })

  // Delete folder and clean indexed records
  registerWorkspaceHandle('deleteFolder', async (_, folderPath) => {
    const validPath = validateIpc(stringPathSchema, folderPath)
    const result = await WorkspaceManager.deleteFolder(validPath)
    if (result?.deletedFilePaths && Array.isArray(result.deletedFilePaths)) {
      await WorkspaceIndexer.removeFiles(result.deletedFilePaths)
      await WorkspaceSearch.reload()
    }
    return result
  })

  // Bulk deletion of multiple folders and notes
  registerWorkspaceHandle('bulkDelete', async (_, payload) => {
    const { folderIds, snippetIds } = payload || {}
    const result = await WorkspaceManager.bulkDelete({ folderIds, snippetIds })
    if (result?.deletedFilePaths && Array.isArray(result.deletedFilePaths)) {
      await WorkspaceIndexer.removeFiles(result.deletedFilePaths)
      await WorkspaceSearch.reload()
    }
    return result
  })

  // Ingest externally dragged files into workspace
  registerWorkspaceHandle('importExternalPaths', async (_, payload) => {
    const { sourcePaths, targetFolderId } = payload || {}
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('index:progress', {
        stage: 'scanning',
        progress: 0,
        total: sourcePaths?.length || 0,
        found: sourcePaths?.length || 0
      })
    }
    const result = await WorkspaceManager.importExternalPaths(sourcePaths, targetFolderId)
    if (WorkspaceManager.workspacePath) {
      WorkspaceIndexer.indexWorkspace(WorkspaceManager.workspacePath, {
        onProgress: (prog: any) => {
          const currentWin = getMainWindow()
          if (currentWin && !currentWin.isDestroyed()) {
            currentWin.webContents.send('index:progress', prog)
          }
        }
      })
        .then(() => WorkspaceSearch.reload())
        .catch((err: any) => {
          console.error('[Main] Indexing imported files failed:', err)
        })
    }
    return result
  })

  // Open native system file manager (Explorer / Finder)
  registerWorkspaceHandle('open-folder', async (_, relativePath) => {
    if (WorkspaceManager.workspacePath) {
      if (relativePath) {
        shell.showItemInFolder(path.join(WorkspaceManager.workspacePath, relativePath))
      } else {
        await shell.openPath(WorkspaceManager.workspacePath)
      }
    }
  })

  // Switch workspace to another folder
  registerWorkspaceHandle('select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (canceled) return null
    const newPath = filePaths[0]

    // Persist new workspace in app_config.json
    SettingsManager.appConfig.setLastWorkspacePath(newPath)
    await SettingsManager.appConfig.save()

    await SettingsManager.init(newPath)
    await WorkspaceManager.init(newPath)

    WorkspaceIndexer.indexWorkspace(newPath, {
      force: false,
      onProgress: (stats: any) => {
        const win = getMainWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('index:progress', stats)
        }
      }
    })
      .then(() => WorkspaceSearch.reload())
      .catch((err: any) => {
        console.error('[Main] Workspace indexing failed:', err)
      })
    return newPath
  })

  // Workspace Indexing IPC Handlers
  registerWorkspaceHandle('index', async (_, workspacePath, options = {}) => {
    try {
      const targetPath = workspacePath || WorkspaceManager.workspacePath
      if (!targetPath || typeof targetPath !== 'string') {
        throw new Error('Workspace path must be a string. Please select a workspace folder first.')
      }

      const result = await WorkspaceIndexer.indexWorkspace(targetPath, {
        ...options,
        onProgress: (stats: any) => {
          const win = getMainWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.send('index:progress', stats)
          }
          if (options.onProgress) options.onProgress(stats)
        }
      })
      await WorkspaceSearch.reload()
      return result
    } catch (err) {
      console.error('[Main] Index request failed:', err)
      throw err
    }
  })

  registerWorkspaceHandle('rebuild-index', async (_, workspacePath) => {
    try {
      const targetPath = workspacePath || WorkspaceManager.workspacePath
      const result = await WorkspaceIndexer.rebuildIndex(targetPath, {
        onProgress: (stats: any) => {
          const win = getMainWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.send('index:progress', stats)
          }
        }
      })
      await WorkspaceSearch.reload()
      return result
    } catch (err) {
      console.error('[Main] Rebuild index failed:', err)
      throw err
    }
  })

  registerWorkspaceHandle('index-stats', async () => {
    try {
      return await WorkspaceIndexer.getStats()
    } catch (err: any) {
      console.error('[Main] Get index stats failed:', err)
      return { error: err?.message }
    }
  })

  // Search IPC Handlers
  registerWorkspaceHandle('search', async (_, query, options = {}) => {
    try {
      if (!hasIndexed && WorkspaceManager.workspacePath) {
        hasIndexed = true
        WorkspaceIndexer.indexWorkspace(WorkspaceManager.workspacePath, {
          force: false,
          onProgress: (stats: any) => {
            const win = getMainWindow()
            if (win && !win.isDestroyed()) {
              win.webContents.send('index:progress', stats)
            }
          }
        })
          .then(() => WorkspaceSearch.reload())
          .catch((err: any) => console.error('[Main] Lazy indexing failed:', err))
      }

      return await WorkspaceSearch.search(query, options)
    } catch (err) {
      console.error('[Main] Search failed:', err)
      return []
    }
  })

  registerWorkspaceHandle('search-stats', () => {
    try {
      return WorkspaceSearch.getStats()
    } catch (err: any) {
      return { error: err?.message }
    }
  })

  registerWorkspaceHandle('find-similar', async (_, chunkId, limit = 10) => {
    try {
      return await WorkspaceSearch.findSimilar(chunkId, limit)
    } catch (err) {
      console.error('[Main] Find similar failed:', err)
      return []
    }
  })

  // Brain Knowledge Base Search & Index IPC
  ipcMain.handle('brain:search', async (_, query, options) => {
    try {
      return await BrainIndexer.search(query, options)
    } catch (err) {
      console.warn('[Main] brain:search notice:', err)
      return []
    }
  })

  ipcMain.handle('brain:stats', async () => {
    try {
      return BrainIndexer.getStats()
    } catch (_) {
      return { totalFiles: 0, totalChunks: 0, lastIndexTime: null, isLoaded: false }
    }
  })

  ipcMain.handle('brain:reindex', async () => {
    try {
      return await BrainIndexer.indexBrain(true)
    } catch (err) {
      console.warn('[Main] brain:reindex notice:', err)
      return { indexed: false, totalFiles: 0, totalChunks: 0 }
    }
  })
}
