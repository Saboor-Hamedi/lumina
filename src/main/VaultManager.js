import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import chokidar from 'chokidar'
import slugify from 'slugify'

// Clean title for display everywhere (tabs, sidebar, metadata) and filename
// Removes problematic symbols and makes the name clean and filesystem-safe
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
  }

  async init(userPath, defaultDocPath) {
    this.vaultPath = userPath || path.join(defaultDocPath, 'Lumina Vault')
    await fs.mkdir(this.vaultPath, { recursive: true })

    // Ensure assets directory exists
    const assetsPath = path.join(this.vaultPath, 'assets')
    try {
      await fs.mkdir(assetsPath, { recursive: true })
    } catch (e) {}

    // Initial scan
    await this.scanVault()

    // Watch for changes
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

    console.info('[VaultManager] 🔍 Scanning vault:', this.vaultPath)
    try {
      const files = await fs.readdir(this.vaultPath)
      const mdFiles = files.filter((f) => f.endsWith('.md'))
      console.info(`[VaultManager] Found ${mdFiles.length} markdown files`)

      const newSnippets = []
      for (const fileName of mdFiles) {
        try {
          const filePath = path.join(this.vaultPath, fileName)
          const stats = await fs.stat(filePath)
          const rawContent = await fs.readFile(filePath, 'utf-8')

          if (!rawContent.trim()) {
            console.warn(`[VaultManager] Skipping empty file: ${fileName}`)
            continue
          }

          let data = {}
          let content = rawContent

          try {
            const parsed = matter(rawContent)
            data = parsed.data || {}
            content = parsed.content || rawContent
          } catch (matterErr) {
            console.warn(`[VaultManager] matter could not parse ${fileName}, using raw content.`)
          }

          newSnippets.push({
            id: data.id || fileName.replace('.md', ''),
            title: data.title || fileName.replace('.md', ''),
            code: content || '',
            language: data.language || 'markdown',
            tags: data.tags || '',
            timestamp: data.timestamp || stats.mtimeMs,
            selection: data.selection || null,
            isPinned: data.isPinned || data.pinned || false,
            type: 'snippet',
            is_draft: 0,
            fileName: fileName // Store actual filename for robust renaming
          })
        } catch (fileErr) {
          console.error(`[VaultManager] ✗ Failed to read file ${fileName}:`, fileErr)
        }
      }

      this.snippets = new Map(newSnippets.map((s) => [s.id, s]))
      console.info(`[VaultManager] ✓ Scan complete. Loaded ${newSnippets.length} snippets.`)
      return newSnippets
    } catch (err) {
      console.error('[VaultManager] ✗ Error scanning vault:', err)
      return null // Return null to indicate FAILURE (vs empty array)
    }
  }

  async saveSnippet(snippet) {
    console.info('[VaultManager] Saving snippet:', snippet.title, 'ID:', snippet.id)

    // 1. Clean the title for display everywhere (tabs, sidebar, metadata) and filename
    // Example: "config::no" -> "config no"
    const cleanedTitle = sanitizeTitleForFilename(snippet.title)
    console.info('[VaultManager] Original title:', snippet.title, '-> Cleaned:', cleanedTitle)

    // 2. Handle Renaming (Delete OLD file if it exists and differs from new one)
    const oldSnippet = this.snippets.get(snippet.id)

    // Use cleaned title for filename
    const finalTitle = cleanedTitle || 'untitled'
    let newFileName = finalTitle.endsWith('.md') ? finalTitle : `${finalTitle}.md`

    if (oldSnippet && oldSnippet.fileName && oldSnippet.fileName !== newFileName) {
      const oldPath = path.join(this.vaultPath, oldSnippet.fileName)
      try {
        await fs.unlink(oldPath)
        console.info('[VaultManager] ✓ Deleted old file after rename:', oldSnippet.fileName)
      } catch (err) {
        console.warn(
          '[VaultManager] Warning: Could not delete old file:',
          oldSnippet.fileName,
          err.message
        )
      }
    }

    // 2. Prevent collisions with OTHER snippets (that aren't this one)
    const collision = Array.from(this.snippets.values()).find((s) => {
      if (s.id === snippet.id) return false
      return s.fileName === newFileName
    })

    if (collision) {
      newFileName = newFileName.replace(/\.md$/i, '') + `-${snippet.id.slice(0, 5)}.md`
    }

    const finalPath = path.join(this.vaultPath, newFileName)

    // 4. Prepare Content (use cleaned title everywhere)
    const fileContent = matter.stringify(snippet.code || '', {
      id: snippet.id,
      title: cleanedTitle, // Use cleaned title in frontmatter
      language: snippet.language || 'markdown',
      tags: snippet.tags || '',
      selection: snippet.selection || null,
      isPinned: !!snippet.isPinned,
      timestamp: Date.now()
    })

    try {
      await fs.writeFile(finalPath, fileContent)

      // 5. Update Internal State Immediately (with cleaned title)
      const updatedSnippet = {
        ...snippet,
        title: cleanedTitle, // Store cleaned title so it shows clean in UI
        timestamp: Date.now(),
        fileName: newFileName // Update recorded filename
      }
      this.snippets.set(snippet.id, updatedSnippet)

      console.info('[VaultManager] ✓ File saved:', newFileName)
      // Return the updated snippet with cleaned title so renderer can update UI
      return updatedSnippet
    } catch (err) {
      console.error('[VaultManager] ✗ Save failed:', err)
      throw err
    }
  }

  async saveImage(buffer, originalName) {
    if (!this.vaultPath) throw new Error('No vault open')

    const assetsPath = path.join(this.vaultPath, 'assets')
    try {
      await fs.mkdir(assetsPath, { recursive: true })
    } catch (e) {}

    const ext = path.extname(originalName) || '.png'
    const name = path.basename(originalName, ext)
    const timestamp = Date.now()
    const safeName = `${slugify(name)}-${timestamp}${ext}`

    const targetPath = path.join(assetsPath, safeName)
    try {
      await fs.writeFile(targetPath, Buffer.from(buffer))
      console.info('[VaultManager] ✓ Image saved:', safeName)
      // Return the relative path for Markdown, e.g. "assets/image.png"
      return `assets/${safeName}`
    } catch (err) {
      console.error('[VaultManager] ✗ Failed to save image:', err)
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
    return list.filter((s) => s && s.id).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }
}

export default new VaultManager()
