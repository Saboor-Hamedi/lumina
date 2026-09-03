import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import slugify from 'slugify'
import matter from 'gray-matter'
import { WorkspaceMediaManager } from './workspaceMediaManager'

export class WorkspaceOperations {
  static sanitizeTitleForFilename(title) {
    if (!title || typeof title !== 'string') return 'Untitled'
    return (
      title
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled'
    )
  }

  static async saveSnippet(vaultPath, snippetsMap, foldersSet, snippet, oldSnippet) {
    if (!vaultPath) throw new Error('No vault open')
    if (!snippet || !snippet.id) throw new Error('Valid snippet required')

    const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'])
    const snippetExt = path.extname(snippet.fileName || snippet.title || '').toLowerCase()
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

    const rawTitle = (snippet.title || '').trim()
    const cleanedTitle = this.sanitizeTitleForFilename(rawTitle)
    let newFileName = snippet.fileName || cleanedTitle

    if (!path.extname(newFileName) && !newFileName.startsWith('.')) {
      newFileName = `${newFileName}.md`
    }

    const isMarkdown = newFileName.toLowerCase().endsWith('.md') || newFileName.toLowerCase().endsWith('.markdown') || newFileName.toLowerCase().endsWith('.mdx')
    const relativeFolder = (snippet.folderId || '').replace(/\\/g, '/')

    if (oldSnippet) {
      const oldRelativeFolder = (oldSnippet.folderId || '').replace(/\\/g, '/')
      const oldFileName = oldSnippet.fileName || `${this.sanitizeTitleForFilename(oldSnippet.title)}.md`

      if (oldFileName !== newFileName || oldRelativeFolder !== relativeFolder) {
        const oldFilePath = path.join(vaultPath, oldRelativeFolder, oldFileName)
        try {
          if (fsSync.existsSync(oldFilePath)) {
            await fs.unlink(oldFilePath)
          }
        } catch (err) {
          console.warn('[WorkspaceOperations] Warning: Could not delete old file:', oldFileName, err.message)
        }
      }
    }

    const collision = Array.from(snippetsMap.values()).find((s) => {
      if (s.id === snippet.id) return false
      return s.fileName === newFileName && (s.folderId || '') === relativeFolder
    })

    if (collision) {
      const ext = path.extname(newFileName)
      const base = ext ? newFileName.slice(0, -ext.length) : newFileName
      newFileName = `${base}-${snippet.id.slice(0, 5)}${ext}`
    }

    const finalPath = path.join(vaultPath, relativeFolder, newFileName)
    const contentChanged = !oldSnippet || oldSnippet.code !== snippet.code
    const newTimestamp = contentChanged
      ? Date.now()
      : oldSnippet?.timestamp || snippet.timestamp || Date.now()

    let cleanCode = snippet.code || ''
    if (/^---\r?\n/.test(cleanCode)) {
      cleanCode = cleanCode.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    }

    let fileContent = ''
    if (isMarkdown) {
      try {
        fileContent = matter.stringify(cleanCode, {
          id: snippet.id,
          title: cleanedTitle,
          language: snippet.language || 'markdown',
          tags: snippet.tags || '',
          selection: snippet.selection || null,
          isPinned: !!snippet.isPinned,
          isLearned: !!snippet.isLearned,
          customIcon: snippet.customIcon || null,
          timestamp: newTimestamp
        })
      } catch (strErr) {
        const safeTitle = JSON.stringify(cleanedTitle || '')
        fileContent = `---\nid: ${snippet.id}\ntitle: ${safeTitle}\nlanguage: ${snippet.language || 'markdown'}\ntags: ${JSON.stringify(snippet.tags || '')}\nisPinned: ${!!snippet.isPinned}\nisLearned: ${!!snippet.isLearned}\ntimestamp: ${newTimestamp}\n---\n\n${cleanCode}`
      }
    } else {
      fileContent = snippet.code || ''
    }

    const targetDir = path.dirname(finalPath)
    await fs.mkdir(targetDir, { recursive: true })

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
      title: isMarkdown ? cleanedTitle : newFileName,
      timestamp: newTimestamp,
      fileName: newFileName,
      folderId: relativeFolder
    }
    snippetsMap.set(snippet.id, updatedSnippet)
    return updatedSnippet
  }

  static isProtectedPath(relPath) {
    if (!relPath) return true
    const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
    const firstSegment = norm.split('/')[0]
    const protectedNames = ['.git', '.lumina']
    return protectedNames.includes(firstSegment) || protectedNames.includes(norm)
  }

  static async deleteSnippet(vaultPath, snippetsMap, id) {
    if (!vaultPath) throw new Error('No vault open')
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

      const filePath = path.join(vaultPath, snippet.folderId || '', fileName)
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

    const directPath = path.join(vaultPath, id)
    if (fsSync.existsSync(directPath)) {
      try {
        await fs.unlink(directPath)
        return directPath
      } catch (e) {
        return null
      }
    }

    return null
  }

  static async bulkDelete(vaultPath, snippetsMap, foldersSet, { folderIds = [], snippetIds = [] }) {
    if (!vaultPath) throw new Error('No vault open')
    const deletedFilePaths = []
    const normalizedFolders = folderIds
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => !this.isProtectedPath(f))

    await Promise.all(
      normalizedFolders.map(async (normFolder) => {
        try {
          const fullPath = path.join(vaultPath, normFolder)
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
              const sFilePath = path.join(vaultPath, snippet.folderId || '', snippet.fileName || `${snippet.title}.md`)
              deletedFilePaths.push(sFilePath)
              snippetsMap.delete(id)
            }
          }
        } catch (err) {
          console.warn('[WorkspaceOperations] Bulk folder delete warning:', normFolder, err.message)
        }
      })
    )

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

            const filePath = path.join(vaultPath, snippet.folderId || '', fileName)
            deletedFilePaths.push(filePath)

            if (fsSync.existsSync(filePath)) {
              await fs.unlink(filePath)
            }
            snippetsMap.delete(snippet.id)
          } else {
            const directPath = path.join(vaultPath, id)
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

    await WorkspaceMediaManager.cleanOrphanedAssets(vaultPath, snippetsMap)

    return {
      success: true,
      deletedCount: normalizedFolders.length + snippetIds.length,
      deletedFilePaths
    }
  }

  static async moveFile(vaultPath, oldRelPath, newRelPath) {
    if (!vaultPath) throw new Error('No vault open')
    const fullOldPath = path.join(vaultPath, oldRelPath)
    const fullNewPath = path.join(vaultPath, newRelPath)
    try {
      await fs.mkdir(path.dirname(fullNewPath), { recursive: true })
      await fs.rename(fullOldPath, fullNewPath)
      return true
    } catch (err) {
      console.error('[WorkspaceOperations] Move file failed:', err)
      throw err
    }
  }

  static async createFolder(vaultPath, foldersSet, folderPath) {
    if (!vaultPath) throw new Error('No vault open')
    const fullPath = path.join(vaultPath, folderPath)
    await fs.mkdir(fullPath, { recursive: true })
    foldersSet.add(folderPath)
    return true
  }

  static async renameFolder(vaultPath, snippetsMap, foldersSet, oldPath, newPath) {
    if (!vaultPath) throw new Error('No vault open')
    const fullOldPath = path.join(vaultPath, oldPath)
    const fullNewPath = path.join(vaultPath, newPath)
    await fs.rename(fullOldPath, fullNewPath)

    foldersSet.delete(oldPath)
    foldersSet.add(newPath)

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

  static async deleteFolder(vaultPath, snippetsMap, foldersSet, folderPath) {
    if (!vaultPath) throw new Error('No vault open')
    if (this.isProtectedPath(folderPath)) {
      return { success: false, deletedFilePaths: [] }
    }
    const fullPath = path.join(vaultPath, folderPath)
    await fs.rm(fullPath, { recursive: true, force: true })

    for (const f of Array.from(foldersSet)) {
      if (f === folderPath || f.startsWith(`${folderPath}/`)) {
        foldersSet.delete(f)
      }
    }

    const deletedFilePaths = []
    for (const [id, snippet] of snippetsMap.entries()) {
      if (snippet.folderId === folderPath || snippet.folderId?.startsWith(`${folderPath}/`)) {
        const sFilePath = path.join(
          vaultPath,
          snippet.folderId || '',
          snippet.fileName || `${snippet.title}.md`
        )
        deletedFilePaths.push(sFilePath)
        snippetsMap.delete(id)
      }
    }
    return { success: true, deletedFilePaths }
  }

  static async importExternalPaths(vaultPath, foldersSet, sourcePaths = [], targetFolderId = '') {
    if (!vaultPath) throw new Error('No vault open')
    if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) {
      return { importedSnippetIds: [], importedFolderIds: [], count: 0 }
    }

    const normalizedTargetFolder = (targetFolderId || '').replace(/\\/g, '/')
    const targetBaseDir = normalizedTargetFolder
      ? path.join(vaultPath, normalizedTargetFolder)
      : vaultPath

    await fs.mkdir(targetBaseDir, { recursive: true })

    const importedSnippetIds = []
    const importedFolderIds = []
    const importedFileNames = []
    const sanitizeName = (name) => name.replace(/[<>:"/\\|?*]/g, '_').trim()

    await Promise.all(
      sourcePaths.map(async (srcPath) => {
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
