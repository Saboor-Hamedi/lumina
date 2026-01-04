import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import chokidar from 'chokidar'
import slugify from 'slugify'

class VaultManager {
  constructor() {
    this.vaultPath = null
    this.watcher = null
    this.snippets = new Map()
  }

  async init(userPath, defaultDocPath) {
    this.vaultPath = userPath || path.join(defaultDocPath, 'Lumina Vault')
    await fs.mkdir(this.vaultPath, { recursive: true })
    
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

    console.log('[VaultManager] 🔍 Scanning vault:', this.vaultPath)
    try {
      const files = await fs.readdir(this.vaultPath)
      const mdFiles = files.filter(f => f.endsWith('.md'))
      console.log(`[VaultManager] Found ${mdFiles.length} markdown files`)
      
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
            type: 'snippet',
            is_draft: 0,
            fileName: fileName // Store actual filename for robust renaming
          })
        } catch (fileErr) {
          console.error(`[VaultManager] ✗ Failed to read file ${fileName}:`, fileErr)
        }
      }
      
      this.snippets = new Map(newSnippets.map(s => [s.id, s]))
      console.log(`[VaultManager] ✓ Scan complete. Loaded ${newSnippets.length} snippets.`)
      return newSnippets
    } catch (err) {
      console.error('[VaultManager] ✗ Error scanning vault:', err)
      return null // Return null to indicate FAILURE (vs empty array)
    }
  }

  async saveSnippet(snippet) {
    console.log('[VaultManager] Saving snippet:', snippet.title, 'ID:', snippet.id)
    
    // 1. Handle Renaming (Delete OLD file if it exists and differs from new one)
    const oldSnippet = this.snippets.get(snippet.id)
    const safeTitle = snippet.title.replace(/[<>:"/\\|?*]/g, '').trim() || 'untitled'
    let newFileName = safeTitle.endsWith('.md') ? safeTitle : `${safeTitle}.md`

    if (oldSnippet && oldSnippet.fileName && oldSnippet.fileName !== newFileName) {
        const oldPath = path.join(this.vaultPath, oldSnippet.fileName)
        try {
            await fs.unlink(oldPath)
            console.log('[VaultManager] ✓ Deleted old file after rename:', oldSnippet.fileName)
        } catch (err) {
            console.warn('[VaultManager] Warning: Could not delete old file:', oldSnippet.fileName, err.message)
        }
    }

    // 2. Prevent collisions with OTHER snippets (that aren't this one)
    const collision = Array.from(this.snippets.values()).find(s => {
        if (s.id === snippet.id) return false 
        return s.fileName === newFileName
    })
    
    if (collision) {
      newFileName = newFileName.replace(/\.md$/i, '') + `-${snippet.id.slice(0, 5)}.md`
    }

    const finalPath = path.join(this.vaultPath, newFileName)
    
    // 4. Prepare Content
    const fileContent = matter.stringify(snippet.code || '', {
      id: snippet.id,
      title: snippet.title,
      language: snippet.language || 'markdown',
      tags: snippet.tags || '',
      selection: snippet.selection || null,
      timestamp: Date.now()
    })
    
    try {
      await fs.writeFile(finalPath, fileContent)
      
      // 5. Update Internal State Immediately
      const updatedSnippet = { 
        ...snippet, 
        timestamp: Date.now(),
        fileName: newFileName // Update recorded filename
      }
      this.snippets.set(snippet.id, updatedSnippet)
      
      console.log('[VaultManager] ✓ File saved:', newFileName)
      return true
    } catch (err) {
      console.error('[VaultManager] ✗ Save failed:', err)
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
        console.log('[VaultManager] ✓ Deleted file:', targetPath)
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
    return list
        .filter(s => s && s.id)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }
}

export default new VaultManager()
