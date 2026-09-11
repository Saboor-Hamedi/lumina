import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import slugify from 'slugify'
import matter from 'gray-matter'
import { WorkspaceMediaManager } from './workspaceMediaManager'

/**
 * WorkspaceOperations
 *
 * Provides atomic, cross-platform file system operations for Lumina workspaces.
 *
 * Key Capabilities:
 * - File Name Sanitization: Strips illegal filesystem characters across Windows, macOS, and Linux.
 * - Atomic Note Persistence: Preserves and updates YAML frontmatter (tags, pin state, icons, selection),
 *   cleans up obsolete files when notes are renamed or moved, and resolves filename collisions.
 * - Safety Guards: Enforces `isProtectedPath` to prevent deletion or corruption of `.lumina` settings,
 *   `.git` repositories, and hidden configuration assets.
 * - Batch Deletions & Orphan Cleansing: Safely removes multiple notes/folders and sweeps unreferenced
 *   media attachments.
 * - External Drag & Drop Imports: Copies external files and nested directories into the workspace with
 *   automatic numbering on name collisions.
 */
export class WorkspaceOperations {
  /**
   * Cleans a raw note title so it can be safely used as a filename across all operating systems.
   * Strips reserved characters: `< > : " / \ | ? *` and collapses contiguous spaces.
   *
   * @param {string} title - Raw note title.
   * @returns {string} Sanitized filename base (defaults to 'Untitled' if blank).
   */
  static sanitizeTitleForFilename(title) {
    if (!title || typeof title !== 'string') return 'Untitled'
    return (
      title
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled'
    )
  }

  /**
   * Saves a note (snippet) or updates its metadata in the workspace.
   *
   * Workflow:
   * 1. If it's an image snippet, updates metadata in-memory without altering disk files.
   * 2. Resolves filename and extension (appends `.md` if no extension).
   * 3. Checks if the note was renamed or moved to another folder; if so, removes the old file.
   * 4. Resolves filename collisions by appending a short 5-character hash.
   * 5. Strips legacy raw frontmatter from the editor code and reconstructs standard YAML frontmatter.
   * 6. Ensures the target directory exists and writes the file atomically.
   * 7. Updates the in-memory snippets map.
   *
   * @param {string} workspacePath - Root directory of the workspace.
   * @param {Map<string, any>} snippetsMap - In-memory snippet registry.
   * @param {Set<string>} foldersSet - In-memory folder path registry.
   * @param {any} snippet - Snippet data to persist.
   * @param {any} [oldSnippet] - Previous snippet state before editing/renaming.
   * @returns {Promise<any>} The saved snippet record.
   */
  static async saveSnippet(workspacePath, snippetsMap, foldersSet, snippet, oldSnippet) {
    if (!workspacePath) throw new Error('No workspace open')
    if (!snippet || !snippet.id) throw new Error('Valid snippet required')

    const IMAGE_EXTS = new Set([
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
    const snippetExt = path.extname(snippet.fileName || snippet.title || '').toLowerCase()

    // Handle image attachments (metadata only)
    if (snippet.type === 'image' || IMAGE_EXTS.has(snippetExt)) {
      const existing = snippetsMap.get(snippet.id) || snippet
      const updated = {
        ...existing,
        customIcon: snippet.customIcon !== undefined ? snippet.customIcon : existing.customIcon,
        color: snippet.color !== undefined ? snippet.color : existing.color,
        isPinned: snippet.isPinned !== undefined ? snippet.isPinned : existing.isPinned,
        type: 'image'
      }
      snippetsMap.set(snippet.id, updated)
      return updated
    }

    let cleanCode = snippet.code || ''
    if (/^---\r?\n/.test(cleanCode)) {
      cleanCode = cleanCode.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    }

    let rawTitle = (snippet.title || '').trim()
    if (
      rawTitle === '>-' ||
      rawTitle === '>' ||
      rawTitle === '|' ||
      rawTitle === '|-' ||
      rawTitle === '-'
    ) {
      const headingMatch = cleanCode.match(/^#+\s+(.+)$/m)
      if (headingMatch && headingMatch[1].trim()) {
        rawTitle = headingMatch[1].trim()
      } else if (snippet.fileName) {
        rawTitle = path.basename(snippet.fileName, path.extname(snippet.fileName))
      } else {
        rawTitle = 'Untitled'
      }
    }

    const cleanedTitle = this.sanitizeTitleForFilename(rawTitle)

    const rawExt = path.extname(snippet.fileName || (oldSnippet?.fileName || ''))
    const isCanvas =
      rawExt.toLowerCase() === '.canvas' ||
      snippet.type === 'canvas' ||
      snippet.language === 'canvas'
    const ext = rawExt || (isCanvas ? '.canvas' : '.md')
    const isMarkdown =
      !isCanvas &&
      (!rawExt ||
        ext.toLowerCase() === '.md' ||
        ext.toLowerCase() === '.markdown' ||
        ext.toLowerCase() === '.mdx')

    let newFileName = snippet.fileName

    if (oldSnippet) {
      const oldRawTitle = (oldSnippet.title || '').trim()
      const titleChanged = rawTitle && oldRawTitle && rawTitle !== oldRawTitle
      const fileNameExplicitlyChanged =
        snippet.fileName &&
        oldSnippet.fileName &&
        snippet.fileName !== oldSnippet.fileName

      if (fileNameExplicitlyChanged) {
        newFileName = snippet.fileName
      } else if (titleChanged && (isMarkdown || isCanvas)) {
        newFileName = `${cleanedTitle}${ext}`
      } else if (!newFileName) {
        newFileName = `${cleanedTitle}${ext}`
      }
    } else {
      if (!newFileName) {
        newFileName = `${cleanedTitle}${ext}`
      } else if (isMarkdown || isCanvas) {
        const fileBase = path.basename(newFileName, ext)
        if (
          fileBase.toLowerCase() === 'new note' ||
          fileBase.toLowerCase() === 'untitled' ||
          fileBase.toLowerCase() === 'untitled canvas' ||
          (cleanedTitle &&
            cleanedTitle.toLowerCase() !== 'untitled' &&
            fileBase.toLowerCase() !== cleanedTitle.toLowerCase())
        ) {
          newFileName = `${cleanedTitle}${ext}`
        }
      }
    }

    if (!path.extname(newFileName) && !newFileName.startsWith('.')) {
      newFileName = isCanvas ? `${newFileName}.canvas` : `${newFileName}.md`
    }

    const relativeFolder = (snippet.folderId || '').replace(/\\/g, '/')

    // If the note was renamed or moved, delete the previous file
    if (oldSnippet) {
      const oldRelativeFolder = (oldSnippet.folderId || '').replace(/\\/g, '/')
      const oldFileName =
        oldSnippet.fileName || `${this.sanitizeTitleForFilename(oldSnippet.title)}.md`

      if (oldFileName !== newFileName || oldRelativeFolder !== relativeFolder) {
        const oldFilePath = path.join(workspacePath, oldRelativeFolder, oldFileName)
        try {
          if (fsSync.existsSync(oldFilePath)) {
            await fs.unlink(oldFilePath)
          }
        } catch (err) {
          console.warn(
            '[WorkspaceOperations] Warning: Could not delete old file:',
            oldFileName,
            err.message
          )
        }
      }
    }

    // Detect and resolve filename collisions in the target folder
    const collision = Array.from(snippetsMap.values()).find((s) => {
      if (s.id === snippet.id) return false
      return s.fileName === newFileName && (s.folderId || '') === relativeFolder
    })

    if (collision) {
      const ext = path.extname(newFileName)
      const base = ext ? newFileName.slice(0, -ext.length) : newFileName
      newFileName = `${base}-${snippet.id.slice(0, 5)}${ext}`
    }

    const finalPath = path.join(workspacePath, relativeFolder, newFileName)
    const contentChanged = !oldSnippet || oldSnippet.code !== snippet.code
    const newTimestamp = contentChanged
      ? Date.now()
      : oldSnippet?.timestamp || snippet.timestamp || Date.now()

    let fileContent = ''
    if (isMarkdown) {
      try {
        fileContent = matter.stringify(cleanCode, {
          id: snippet.id,
          title: rawTitle || cleanedTitle,
          language: snippet.language || 'markdown',
          tags: snippet.tags || '',
          selection: snippet.selection || null,
          isPinned: !!snippet.isPinned,
          isLearned: !!snippet.isLearned,
          customIcon: snippet.customIcon || null,
          timestamp: newTimestamp
        })
      } catch (strErr) {
        const safeTitle = JSON.stringify(rawTitle || cleanedTitle || '')
        fileContent = `---\nid: ${snippet.id}\ntitle: ${safeTitle}\nlanguage: ${snippet.language || 'markdown'}\ntags: ${JSON.stringify(snippet.tags || '')}\nisPinned: ${!!snippet.isPinned}\nisLearned: ${!!snippet.isLearned}\ntimestamp: ${newTimestamp}\n---\n\n${cleanCode}`
      }
    } else {
      fileContent = snippet.code || ''
    }

    const targetDir = path.dirname(finalPath)
    await fs.mkdir(targetDir, { recursive: true })

    // Register folder path hierarchy
    if (relativeFolder) {
      let current = ''
      relativeFolder.split('/').forEach((part) => {
        current = current ? `${current}/${part}` : part
        foldersSet.add(current)
      })
    }

    await fs.writeFile(finalPath, fileContent)

    const updatedSnippet = {
      ...snippet,
      title: isMarkdown || isCanvas ? (rawTitle || cleanedTitle) : newFileName,
      timestamp: newTimestamp,
      fileName: newFileName,
      folderId: relativeFolder,
      type: isCanvas ? 'canvas' : snippet.type || 'snippet',
      language: isCanvas ? 'canvas' : snippet.language || (isMarkdown ? 'markdown' : 'text')
    }
    snippetsMap.set(snippet.id, updatedSnippet)
    return updatedSnippet
  }

  /**
   * Checks whether a relative path points to a protected or hidden system directory.
   * Prevents accidental modification or deletion of `.lumina`, `.git`, or dotfiles.
   *
   * @param {string} relPath - Relative file or folder path.
   * @returns {boolean} True if the path is protected.
   */
  static isProtectedPath(relPath) {
    if (!relPath) return true
    const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
    const segments = norm.split('/')
    return segments.some((segment) => segment.startsWith('.'))
  }

  /**
   * Asserts that a path resolves strictly inside the workspace directory.
   * Throws an Error if path traversal is detected or if target equals the workspace root itself (when allowRoot is false).
   *
   * @param {string} workspacePath - Root workspace directory.
   * @param {string} relativePath - Relative file or folder path.
   * @param {boolean} [allowRoot=false] - Whether resolving to workspace root itself is permitted.
   * @returns {string} Fully resolved safe absolute path.
   */
  static assertSafeWorkspacePath(workspacePath, relativePath, allowRoot = false) {
    if (!workspacePath) throw new Error('No workspace open')
    const root = path.resolve(workspacePath)
    const resolved = path.resolve(root, relativePath || '')
    const isInside = resolved.startsWith(root + path.sep)
    const isRoot = resolved === root
    if (!isInside && !(allowRoot && isRoot)) {
      throw new Error(`Security Violation: Path escapes workspace boundaries: ${relativePath}`)
    }
    return resolved
  }

  /**
   * Deletes a snippet by its ID or relative file path from disk and in-memory cache.
   *
   * @param {string} workspacePath - Root workspace directory.
   * @param {Map<string, any>} snippetsMap - In-memory snippet registry.
   * @param {string} id - Snippet ID or relative path.
   * @returns {Promise<string|null>} Path of the deleted file, or null if ignored/failed.
   */
  static async deleteSnippet(workspacePath, snippetsMap, id) {
    if (!workspacePath) throw new Error('No workspace open')
    let snippet = snippetsMap.get(id)
    if (!snippet) {
      snippet = Array.from(snippetsMap.values()).find(
        (s) => s.id === id || s.relativePath === id || s.fileName === id
      )
    }

    if (snippet) {
      const sFolder = (snippet.folderId || '').replace(/\\/g, '/')
      const fileName = snippet.fileName || `${snippet.title}.md`
      const relPath = sFolder ? `${sFolder}/${fileName}` : fileName
      if (this.isProtectedPath(relPath)) {
        return null
      }

      let filePath
      try {
        filePath = this.assertSafeWorkspacePath(workspacePath, relPath)
      } catch {
        return null
      }

      try {
        if (fsSync.existsSync(filePath)) {
          await fs.unlink(filePath)
        }
        snippetsMap.delete(snippet.id)
        return filePath
      } catch (err) {
        snippetsMap.delete(snippet.id)
        return null
      }
    }

    if (this.isProtectedPath(id)) {
      return null
    }

    try {
      const directPath = this.assertSafeWorkspacePath(workspacePath, id)
      if (fsSync.existsSync(directPath)) {
        await fs.unlink(directPath)
        return directPath
      }
    } catch {
      return null
    }

    return null
  }

  /**
   * Performs bulk deletion of multiple folders and notes in parallel,
   * then sweeps orphaned assets that are no longer linked.
   *
   * @param {string} workspacePath - Root workspace directory.
   * @param {Map<string, any>} snippetsMap - In-memory snippet registry.
   * @param {Set<string>} foldersSet - In-memory folder registry.
   * @param {{ folderIds?: string[], snippetIds?: string[] }} target
   * @returns {Promise<{ success: boolean, deletedCount: number, deletedFilePaths: string[] }>}
   */
  static async bulkDelete(
    workspacePath,
    snippetsMap,
    foldersSet,
    { folderIds = [], snippetIds = [] }
  ) {
    if (!workspacePath) throw new Error('No workspace open')
    const deletedFilePaths = []
    const normalizedFolders = folderIds
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => !this.isProtectedPath(f))

    // Delete folders recursively
    await Promise.all(
      normalizedFolders.map(async (normFolder) => {
        try {
          const fullPath = path.join(workspacePath, normFolder)
          if (fsSync.existsSync(fullPath)) {
            await fs.rm(fullPath, { recursive: true, force: true })
          }

          for (const f of Array.from(foldersSet)) {
            const normF = f.replace(/\\/g, '/')
            if (normF === normFolder || normF.startsWith(`${normFolder}/`)) {
              foldersSet.delete(f)
            }
          }

          for (const [id, snippet] of snippetsMap.entries()) {
            const sFolder = (snippet.folderId || '').replace(/\\/g, '/')
            if (sFolder === normFolder || sFolder.startsWith(`${normFolder}/`)) {
              const sFilePath = path.join(
                workspacePath,
                snippet.folderId || '',
                snippet.fileName || `${snippet.title}.md`
              )
              deletedFilePaths.push(sFilePath)
              snippetsMap.delete(id)
            }
          }
        } catch (err) {
          console.warn(
            '[WorkspaceOperations] Bulk folder delete warning:',
            normFolder,
            err.message
          )
        }
      })
    )

    // Delete individual notes
    await Promise.all(
      snippetIds.map(async (id) => {
        try {
          if (this.isProtectedPath(id)) return

          let snippet = snippetsMap.get(id)
          if (!snippet) {
            snippet = Array.from(snippetsMap.values()).find(
              (s) => s.id === id || s.relativePath === id || s.fileName === id
            )
          }

          if (snippet) {
            const sFolder = (snippet.folderId || '').replace(/\\/g, '/')
            const isInsideDeletedFolder = normalizedFolders.some(
              (df) => sFolder === df || sFolder.startsWith(`${df}/`)
            )
            if (isInsideDeletedFolder) return

            const fileName = snippet.fileName || `${snippet.title}.md`
            const relPath = sFolder ? `${sFolder}/${fileName}` : fileName
            if (this.isProtectedPath(relPath)) return

            const filePath = path.join(workspacePath, snippet.folderId || '', fileName)
            deletedFilePaths.push(filePath)

            if (fsSync.existsSync(filePath)) {
              await fs.unlink(filePath)
            }
            snippetsMap.delete(snippet.id)
          } else {
            const directPath = path.join(workspacePath, id)
            if (fsSync.existsSync(directPath)) {
              deletedFilePaths.push(directPath)
              const stat = await fs.stat(directPath)
              if (stat.isDirectory()) {
                await fs.rm(directPath, { recursive: true, force: true })
              } else {
                await fs.unlink(directPath)
              }
            }
          }
        } catch (err) {
          console.warn('[WorkspaceOperations] Bulk note delete warning:', id, err.message)
        }
      })
    )

    // Clean any orphaned attachments left behind
    await WorkspaceMediaManager.cleanOrphanedAssets(workspacePath, snippetsMap)

    return {
      success: true,
      deletedCount: normalizedFolders.length + snippetIds.length,
      deletedFilePaths
    }
  }

  /**
   * Moves a file from one relative path to another.
   *
   * @param {string} workspacePath - Root workspace directory.
   * @param {string} oldRelPath - Source relative path.
   * @param {string} newRelPath - Destination relative path.
   * @returns {Promise<boolean>}
   */
  static async moveFile(workspacePath, oldRelPath, newRelPath) {
    if (!workspacePath) throw new Error('No workspace open')
    const fullOldPath = this.assertSafeWorkspacePath(workspacePath, oldRelPath)
    const fullNewPath = this.assertSafeWorkspacePath(workspacePath, newRelPath)

    if (fullOldPath === fullNewPath) return true
    if (!fsSync.existsSync(fullOldPath)) {
      throw new Error(`Source file does not exist: ${oldRelPath}`)
    }

    // Prevent overwriting existing files in the workspace (unless it's a case-only rename of the same file)
    if (fsSync.existsSync(fullNewPath) && fullOldPath.toLowerCase() !== fullNewPath.toLowerCase()) {
      throw new Error(`A file named "${path.basename(fullNewPath)}" already exists in this folder.`)
    }

    try {
      await fs.mkdir(path.dirname(fullNewPath), { recursive: true })

      // Windows case-only rename support (e.g. doc.pdf -> Doc.pdf)
      if (process.platform === 'win32' && fullOldPath.toLowerCase() === fullNewPath.toLowerCase()) {
        const tempPath = `${fullOldPath}.__lumina_tmp_${Date.now()}`
        await fs.rename(fullOldPath, tempPath)
        await fs.rename(tempPath, fullNewPath)
      } else {
        await fs.rename(fullOldPath, fullNewPath)
      }
      return true
    } catch (err) {
      console.error('[WorkspaceOperations] Move file failed:', err)
      throw err
    }
  }

  /**
   * Creates a directory on disk and registers it and parent segments in `foldersSet`.
   *
   * @param {string} workspacePath - Root workspace directory.
   * @param {Set<string>} foldersSet - In-memory folder registry.
   * @param {string} folderPath - Relative folder path to create.
   * @returns {Promise<boolean>}
   */
  static async createFolder(workspacePath, foldersSet, folderPath) {
    if (!workspacePath) throw new Error('No workspace open')
    const normalized = (folderPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (!normalized) return true
    const fullPath = this.assertSafeWorkspacePath(workspacePath, normalized)
    await fs.mkdir(fullPath, { recursive: true })

    let current = ''
    normalized.split('/').forEach((part) => {
      current = current ? `${current}/${part}` : part
      foldersSet.add(current)
    })
    return true
  }

  /**
   * Renames a folder on disk and updates folderIds for all child notes in memory.
   *
   * @param {string} workspacePath - Root workspace directory.
   * @param {Map<string, any>} snippetsMap - In-memory snippet registry.
   * @param {Set<string>} foldersSet - In-memory folder registry.
   * @param {string} oldPath - Old relative path.
   * @param {string} newPath - New relative path.
   * @returns {Promise<boolean>}
   */
  static async renameFolder(workspacePath, snippetsMap, foldersSet, oldPath, newPath) {
    if (!workspacePath) throw new Error('No workspace open')
    const fullOldPath = this.assertSafeWorkspacePath(workspacePath, oldPath)
    const fullNewPath = this.assertSafeWorkspacePath(workspacePath, newPath)
    await fs.mkdir(path.dirname(fullNewPath), { recursive: true })
    await fs.rename(fullOldPath, fullNewPath)

    for (const f of Array.from(foldersSet)) {
      if (f === oldPath) {
        foldersSet.delete(f)
        foldersSet.add(newPath)
      } else if (f.startsWith(`${oldPath}/`)) {
        foldersSet.delete(f)
        foldersSet.add(f.replace(oldPath, newPath))
      }
    }

    for (const [id, snippet] of snippetsMap.entries()) {
      if (snippet.folderId === oldPath) {
        snippetsMap.set(id, { ...snippet, folderId: newPath })
      } else if (snippet.folderId?.startsWith(`${oldPath}/`)) {
        const updatedFolderId = snippet.folderId.replace(oldPath, newPath)
        snippetsMap.set(id, { ...snippet, folderId: updatedFolderId })
      }
    }
    return true
  }

  /**
   * Deletes a folder and all its child files and subdirectories.
   *
   * @param {string} workspacePath - Root workspace directory.
   * @param {Map<string, any>} snippetsMap - In-memory snippet registry.
   * @param {Set<string>} foldersSet - In-memory folder registry.
   * @param {string} folderPath - Relative folder path to delete.
   * @returns {Promise<{ success: boolean, deletedFilePaths: string[] }>}
   */
  static async deleteFolder(workspacePath, snippetsMap, foldersSet, folderPath) {
    if (!workspacePath) throw new Error('No workspace open')
    if (!folderPath || folderPath === '.' || folderPath === '/' || folderPath === '\\') {
      return { success: false, deletedFilePaths: [] }
    }
    if (this.isProtectedPath(folderPath)) {
      return { success: false, deletedFilePaths: [] }
    }
    const normalized = (folderPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (!normalized) return { success: false, deletedFilePaths: [] }
    const fullPath = this.assertSafeWorkspacePath(workspacePath, normalized)
    try {
      await fs.rm(fullPath, { recursive: true, force: true })
    } catch (_) {}

    for (const f of Array.from(foldersSet)) {
      if (f === normalized || f.startsWith(`${normalized}/`)) {
        foldersSet.delete(f)
      }
    }

    const deletedFilePaths = []
    for (const [id, snippet] of snippetsMap.entries()) {
      if (snippet.folderId === folderPath || snippet.folderId?.startsWith(`${folderPath}/`)) {
        const sFilePath = path.join(
          workspacePath,
          snippet.folderId || '',
          snippet.fileName || `${snippet.title}.md`
        )
        deletedFilePaths.push(sFilePath)
        snippetsMap.delete(id)
      }
    }
    return { success: true, deletedFilePaths }
  }

  /**
   * Recursively imports files and directories dragged into Lumina from the host OS.
   * Automatically renames colliding file and directory names with incrementing suffixes.
   *
   * @param {string} workspacePath - Root workspace directory.
   * @param {Set<string>} foldersSet - In-memory folder registry.
   * @param {string[]} [sourcePaths=[]] - Absolute paths on host OS to import.
   * @param {string} [targetFolderId=''] - Destination relative folder path in workspace.
   * @returns {Promise<{ importedSnippetIds: string[], importedFolderIds: string[], importedFileNames: any[], count: number, targetFolderId: string }>}
   */
  static async importExternalPaths(
    workspacePath,
    foldersSet,
    sourcePaths = [],
    targetFolderId = ''
  ) {
    if (!workspacePath) throw new Error('No workspace open')
    if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) {
      return { importedSnippetIds: [], importedFolderIds: [], count: 0, targetFolderId: '' }
    }

    const normalizedTargetFolder = (targetFolderId || '').replace(/\\/g, '/')
    const targetBaseDir = normalizedTargetFolder
      ? path.join(workspacePath, normalizedTargetFolder)
      : workspacePath

    await fs.mkdir(targetBaseDir, { recursive: true })

    const importedSnippetIds = []
    const importedFolderIds = []
    const importedFileNames = []
    const sanitizeName = (name) => name.replace(/[<>:"/\\|?*]/g, '_').trim()

    const BATCH_SIZE = 4
    for (let i = 0; i < sourcePaths.length; i += BATCH_SIZE) {
      const batch = sourcePaths.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (srcPath) => {
          try {
            if (!fsSync.existsSync(srcPath)) return
            const stat = await fs.stat(srcPath)
            const rawBaseName = path.basename(srcPath)
            const baseName = sanitizeName(rawBaseName) || 'Imported'

            if (stat.isDirectory()) {
              let destDir = path.join(targetBaseDir, baseName)
              let folderRelativePath = normalizedTargetFolder
                ? `${normalizedTargetFolder}/${baseName}`
                : baseName
              folderRelativePath = folderRelativePath.replace(/\\/g, '/')

              const isDotFolder = baseName.startsWith('.')

              if (!isDotFolder) {
                let counter = 1
                while (fsSync.existsSync(destDir)) {
                  const newName = `${baseName} (${counter})`
                  destDir = path.join(targetBaseDir, newName)
                  folderRelativePath = normalizedTargetFolder
                    ? `${normalizedTargetFolder}/${newName}`
                    : newName
                  folderRelativePath = folderRelativePath.replace(/\\/g, '/')
                  counter++
                }
              }

              await fs.cp(srcPath, destDir, {
                recursive: true,
                filter: (source) => {
                  const base = path.basename(source).toLowerCase()
                  return (
                    base !== '.git' &&
                    base !== 'node_modules' &&
                    base !== '.ds_store' &&
                    base !== 'thumbs.db'
                  )
                }
              })

              foldersSet.add(folderRelativePath)
              importedFolderIds.push(folderRelativePath)
            } else if (stat.isFile()) {
              const ext = path.extname(baseName)
              const nameWithoutExt = path.basename(baseName, ext)
              let finalFileName = baseName
              let destFilePath = path.join(targetBaseDir, finalFileName)

              let counter = 1
              while (fsSync.existsSync(destFilePath)) {
                finalFileName = `${nameWithoutExt} (${counter})${ext}`
                destFilePath = path.join(targetBaseDir, finalFileName)
                counter++
              }

              importedFileNames.push({ fileName: finalFileName, folderId: normalizedTargetFolder })
              await fs.copyFile(srcPath, destFilePath)
            }
          } catch (err) {
            console.error('[WorkspaceOperations] Error importing path:', srcPath, err)
          }
        })
      )

      if (i + BATCH_SIZE < sourcePaths.length) {
        await new Promise((r) => setImmediate(r))
      }
    }

    return {
      importedSnippetIds,
      importedFolderIds,
      importedFileNames,
      count: sourcePaths.length,
      targetFolderId: normalizedTargetFolder
    }
  }
}

export default WorkspaceOperations
