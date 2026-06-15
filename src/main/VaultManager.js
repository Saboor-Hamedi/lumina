import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import chokidar from 'chokidar'
import slugify from 'slugify'

// Clean title for display everywhere (tabs, sidebar, metadata) and filename.
// This is the single place where we normalize note titles before:
// - Storing them in frontmatter
// - Using them to derive on-disk filenames
// The goal is to keep titles human-friendly while still being valid on all filesystems.
function sanitizeTitleForFilename(title) {
  if (!title || typeof title !== 'string') return 'untitled'

  // Remove or neutralize characters that are unsafe or ugly
  // Characters removed: < > : " / \ | ? * @ # $ % ^ & + = [ ] { } ; , ` ~
  let cleaned = String(title)
    // Strip common problematic symbols (Windows + “noisy” chars)
    .replace(/[<>:"/\\|?*@#$%^&+=\[\]{};,`~]/g, ' ')
    // Collapse multiple spaces into a single space
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'untitled'
}

class VaultManager {
  constructor() {
    this.vaultPath = null
    this.watcher = null
    this.snippets = new Map()
    this.folders = new Set()
  }

  async init(userPath, defaultDocPath) {
    this.vaultPath = userPath || path.join(defaultDocPath, 'lumina')
    await fs.mkdir(this.vaultPath, { recursive: true })

    // Ensure .lumina/assets directory exists
    const assetsPath = path.join(this.vaultPath, '.lumina', 'assets')
    try {
      await fs.mkdir(assetsPath, { recursive: true })
    } catch (e) { }

    // Initial scan
    await this.scanVault()

    // Watch for changes
    this.setupWatcher()
  }

  setupWatcher() {
    if (this.watcher) this.watcher.close()
    this.watcher = chokidar.watch(this.vaultPath, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    })

    this.watcher.on('all', async (event, filePath) => {
      if (filePath.endsWith('.md')) {
        await this.scanVault()
        // Here we could emit events to the renderer via a callback/win.webContents
      }
    })
  }

  async scanVault() {
    if (!this.vaultPath) {
      console.warn('[VaultManager] ✗ Cannot scan vault: No path set.')
      return null
    }

    // Silent scan
    try {
      const mdFiles = []
      const foundFolders = new Set()
      
      const walk = async (dir, relativePath = '') => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name === '.git' || entry.name === 'assets' || entry.name.startsWith('.')) continue
          const fullPath = path.join(dir, entry.name)
          // Always use forward slashes for cross-platform robustness
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            foundFolders.add(relPath)
            await walk(fullPath, relPath)
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            mdFiles.push({ fileName: entry.name, folderId: relativePath })
          }
        }
      }
      
      await walk(this.vaultPath)

      const newSnippets = []
      
      // Process in batches to avoid EMFILE (too many open files) and improve performance
      const BATCH_SIZE = 10
      for (let i = 0; i < mdFiles.length; i += BATCH_SIZE) {
        const batch = mdFiles.slice(i, i + BATCH_SIZE)
        
        const batchResults = await Promise.all(batch.map(async (fileObj) => {
          try {
            const { fileName, folderId } = fileObj
            const filePath = path.join(this.vaultPath, folderId, fileName)
            const stats = await fs.stat(filePath)
            const rawContent = await fs.readFile(filePath, 'utf-8')

            if (!rawContent.trim()) {
              return null
            }

            let data = {}
            let content = rawContent

            try {
              const parsed = matter(rawContent)
              data = parsed.data || {}
              content = parsed.content || rawContent
            } catch (matterErr) {
              // fallback
            }

            return {
              id: data.id || fileName.replace('.md', ''),
              title: data.title || fileName.replace('.md', ''),
              code: content || '',
              language: data.language || 'markdown',
              tags: data.tags || '',
              timestamp: data.timestamp || stats.mtimeMs,
              selection: data.selection || null,
              isPinned: data.isPinned || data.pinned || false,
              color: null,
              type: 'snippet',
              is_draft: 0,
              fileName: fileName,
              folderId: folderId || ''
            }
          } catch (fileErr) {
            console.error(`[VaultManager] ✗ Failed to read file ${fileName}:`, fileErr)
            return null
          }
        }))
        
        // Filter out nulls and add to newSnippets
        newSnippets.push(...batchResults.filter(Boolean))
      }

      this.snippets = new Map(newSnippets.map((s) => [s.id, s]))
      this.folders = foundFolders
      // Scan complete
      return { snippets: newSnippets, folders: Array.from(foundFolders) }
    } catch (err) {
      console.error('[VaultManager] ✗ Error scanning vault:', err)
      return { snippets: [], folders: [] } // Return empty structure on failure
    }
  }

  /**
   * Persist a snippet to disk and update in‑memory state.
   *
   * Storage layout:
   * - All notes are stored as Markdown files directly under `this.vaultPath`
   *   e.g. `<vaultPath>/My Note.md`
   * - The actual filename is derived from the (cleaned) title and stored on the
   *   snippet as `fileName` for robust renaming and deletion.
   * - Attachments (images, etc.) are saved under `<vaultPath>/assets/`.
   */
  async saveSnippet(snippet) {
    console.info('[VaultManager] Saving snippet:', snippet.title, 'ID:', snippet.id)

    if (!this.vaultPath) {
      throw new Error('[VaultManager] Cannot save snippet: vaultPath is not initialized')
    }

    // 1. Clean the title for display everywhere (tabs, sidebar, metadata) and filename
    // Example: "config::no" -> "config no"
    const cleanedTitle = sanitizeTitleForFilename(snippet.title)
    console.info('[VaultManager] Original title:', snippet.title, '-> Cleaned:', cleanedTitle)

    // 2. Handle Renaming (Delete OLD file if it exists and differs from new one)
    const oldSnippet = this.snippets.get(snippet.id)

    // Use cleaned title for filename
    const finalTitle = cleanedTitle || 'untitled'
    let newFileName = finalTitle.endsWith('.md') ? finalTitle : `${finalTitle}.md`
    const relativeFolder = snippet.folderId || ''

    if (oldSnippet && oldSnippet.fileName) {
      const oldRelativeFolder = oldSnippet.folderId || ''
      if (oldSnippet.fileName !== newFileName || oldRelativeFolder !== relativeFolder) {
        const oldPath = path.join(this.vaultPath, oldRelativeFolder, oldSnippet.fileName)
        try {
          await fs.unlink(oldPath)
          console.info('[VaultManager] ✓ Deleted old file after rename/move:', oldSnippet.fileName)
        } catch (err) {
          console.warn(
            '[VaultManager] Warning: Could not delete old file:',
            oldSnippet.fileName,
            err.message
          )
        }
      }
    }

    // 2. Prevent collisions with OTHER snippets in the same folder
    const collision = Array.from(this.snippets.values()).find((s) => {
      if (s.id === snippet.id) return false
      return s.fileName === newFileName && (s.folderId || '') === relativeFolder
    })

    if (collision) {
      newFileName = newFileName.replace(/\.md$/i, '') + `-${snippet.id.slice(0, 5)}.md`
    }

    // 3. Compute the final on-disk path for this note inside the current vault.
    const finalPath = path.join(this.vaultPath, relativeFolder, newFileName)

    // Only bump timestamp when content actually changes (not for color/pin/tag edits)
    const contentChanged = !oldSnippet || oldSnippet.code !== snippet.code
    const newTimestamp = contentChanged ? Date.now() : (oldSnippet?.timestamp || snippet.timestamp || Date.now())

    // 4. Prepare Content (use cleaned title everywhere)
    const fileContent = matter.stringify(snippet.code || '', {
      id: snippet.id,
      title: cleanedTitle,
      language: snippet.language || 'markdown',
      tags: snippet.tags || '',
      selection: snippet.selection || null,
      isPinned: !!snippet.isPinned,
      timestamp: newTimestamp
    })

    try {
      // Ensure the parent directory still exists (it may have been deleted externally)
      const targetDir = path.dirname(finalPath)
      await fs.mkdir(targetDir, { recursive: true })
      
      // If we created a new nested folder natively during save, make sure we track it
      if (relativeFolder) {
        let current = ''
        relativeFolder.split('/').forEach(part => {
          current = current ? `${current}/${part}` : part
          this.folders.add(current)
        })
      }

      await fs.writeFile(finalPath, fileContent)

      // 5. Update Internal State Immediately (with cleaned title and folderId)
      const updatedSnippet = {
        ...snippet,
        title: cleanedTitle, // Store cleaned title so it shows clean in UI
        timestamp: newTimestamp,
        fileName: newFileName, // Update recorded filename
        folderId: relativeFolder
      }
      this.snippets.set(snippet.id, updatedSnippet)

      console.info('[VaultManager] ✓ File saved at:', finalPath)
      // Return the updated snippet with cleaned title so renderer can update UI
      return updatedSnippet
    } catch (err) {
      console.error('[VaultManager] ✗ Save failed:', err)
      throw err
    }
  }

  async deleteSnippet(id) {
    if (!this.vaultPath) throw new Error('No vault open')
    const snippet = this.snippets.get(id)
    if (!snippet) throw new Error(`Snippet not found: ${id}`)

    const filePath = path.join(this.vaultPath, snippet.folderId, snippet.fileName)

    try {
      await fs.unlink(filePath)
      this.snippets.delete(id)
      console.info('[VaultManager] ✓ File deleted:', filePath)
      return true
    } catch (err) {
      console.error('[VaultManager] Delete failed:', err)
      throw err
    }
  }

  // Native Folder Ops
  async createFolder(folderPath) {
    if (!this.vaultPath) throw new Error('No vault open')
    try {
      const fullPath = path.join(this.vaultPath, folderPath)
      await fs.mkdir(fullPath, { recursive: true })
      this.folders.add(folderPath)
      return true
    } catch (err) {
      console.error('[VaultManager] Create folder failed:', err)
      throw err
    }
  }

  async renameFolder(oldPath, newPath) {
    if (!this.vaultPath) throw new Error('No vault open')
    
    // Temporarily close watcher to release Windows directory locks
    if (this.watcher) {
      await this.watcher.close()
    }

    try {
      const fullOldPath = path.join(this.vaultPath, oldPath)
      const fullNewPath = path.join(this.vaultPath, newPath)
      await fs.rename(fullOldPath, fullNewPath)
      
      // Update in-memory state
      this.folders.delete(oldPath)
      this.folders.add(newPath)
      
      // Find all snippets that were inside oldPath and update their folderId
      for (const [id, snippet] of this.snippets.entries()) {
        if (snippet.folderId === oldPath || snippet.folderId.startsWith(`${oldPath}/`)) {
          snippet.folderId = snippet.folderId.replace(oldPath, newPath)
          this.snippets.set(id, snippet)
        }
      }
      
      this.setupWatcher()
      return true
    } catch (err) {
      console.error('[VaultManager] Rename folder failed:', err)
      this.setupWatcher()
      throw err
    }
  }

  async deleteFolder(folderPath) {
    if (!this.vaultPath) throw new Error('No vault open')
    
    // Temporarily close watcher to release Windows directory locks
    if (this.watcher) {
      await this.watcher.close()
    }

    try {
      const fullPath = path.join(this.vaultPath, folderPath)
      await fs.rm(fullPath, { recursive: true, force: true })
      
      this.folders.delete(folderPath)
      
      // Delete snippets inside this folder from memory
      for (const [id, snippet] of this.snippets.entries()) {
        if (snippet.folderId === folderPath || snippet.folderId.startsWith(`${folderPath}/`)) {
          this.snippets.delete(id)
        }
      }
      this.setupWatcher()
      return true
    } catch (err) {
      console.error('[VaultManager] Delete folder failed:', err)
      this.setupWatcher()
      throw err
    }
  }

  async saveImage(buffer, originalName) {
    if (!this.vaultPath) throw new Error('No vault open')

    const assetsPath = path.join(this.vaultPath, '.lumina', 'assets')
    try {
      await fs.mkdir(assetsPath, { recursive: true })
    } catch (e) { }

    const ext = path.extname(originalName) || '.png'
    const baseName = path.basename(originalName, ext)
    const timestamp = Date.now()
    const safeName = `${slugify(baseName, { lower: true, strict: true })}-${timestamp}${ext}`
    const targetPath = path.join(assetsPath, safeName)

    try {
      await fs.writeFile(targetPath, Buffer.from(buffer))
      console.info('[VaultManager] ✓ Image saved:', safeName)
      // Return the pure relative path for clean Markdown, e.g. ".lumina/assets/image.png"
      return `.lumina/assets/${safeName}`
    } catch (err) {
      console.error('[VaultManager] ✗ Failed to save image:', err)
      throw err
    }
  }

  async readAsset(relativePath) {
    try {
      const finalPath = path.join(this.vaultPath, relativePath)
      const data = await fs.readFile(finalPath)
      return data
    } catch (err) {
      console.error('[VaultManager] ✗ Failed to read asset:', relativePath, err)
      throw err
    }
  }

  async deleteSnippet(id) {
    const snippet = this.snippets.get(id)
    if (!snippet) return false

    const targetPath = path.join(this.vaultPath, snippet.fileName || `${snippet.title}.md`)

    try {
      await fs.unlink(targetPath)
      this.snippets.delete(id)
      console.info('[VaultManager] ✓ Deleted file:', targetPath)
      return true
    } catch (err) {
      console.warn('[VaultManager] ✗ Delete failed for file:', targetPath, err.message)
    }

    console.warn('[VaultManager] ✗ Could not find file to delete for ID:', id)
    // Even if file is gone, clean up internal state
    this.snippets.delete(id)
    return true
  }

  getSnippets() {
    const list = Array.from(this.snippets.values())
    return {
      snippets: list.filter((s) => s && s.id).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
      folders: Array.from(this.folders)
    }
  }

  async cleanOrphanedAssets() {
    if (!this.vaultPath) return
    const assetsPath = path.join(this.vaultPath, '.lumina', 'assets')
    try {
      const entries = await fs.readdir(assetsPath, { withFileTypes: true })
      const allMarkdownContent = Array.from(this.snippets.values())
        .map(s => s.code || '')
        .join('\n')

      for (const entry of entries) {
        if (entry.isFile()) {
          // If the exact filename isn't anywhere in the combined text, it's safe to delete
          if (!allMarkdownContent.includes(entry.name)) {
            const filePath = path.join(assetsPath, entry.name)
            await fs.unlink(filePath)
            console.info('[VaultManager] ✓ Deleted orphaned asset:', entry.name)
          }
        }
      }
    } catch (e) {
      // Ignore if assets folder doesn't exist
    }
  }
}

export default new VaultManager()
