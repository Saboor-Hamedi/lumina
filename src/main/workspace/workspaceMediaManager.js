import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import slugify from 'slugify'

/**
 * WorkspaceMediaManager
 * 
 * Manages media assets, embedded images, binary file I/O,
 * and orphaned asset garbage collection for the workspace.
 */
export class WorkspaceMediaManager {
  /**
   * Saves a media image buffer to the workspace's `.lumina/assets/` directory.
   *
   * @param {string} vaultPath - The absolute path of the workspace vault.
   * @param {Buffer|Uint8Array|ArrayBuffer} buffer - Binary data of the image.
   * @param {string} originalName - Original file name with extension.
   * @returns {Promise<string>} The relative path of the saved asset (e.g., `.lumina/assets/name.png`).
   */
  static async saveImage(vaultPath, buffer, originalName) {
    if (!vaultPath) throw new Error('No vault open')

    const assetsPath = path.join(vaultPath, '.lumina', 'assets')
    try {
      await fs.mkdir(assetsPath, { recursive: true })
    } catch (e) {}

    const ext = path.extname(originalName) || '.png'
    const baseName = path.basename(originalName, ext)
    const timestamp = Date.now()
    const safeName = `${slugify(baseName, { lower: true, strict: true })}-${timestamp}${ext}`
    const targetPath = path.join(assetsPath, safeName)

    try {
      await fs.writeFile(targetPath, Buffer.from(buffer))
      console.info('[WorkspaceMediaManager] ✓ Image saved:', safeName)
      return `.lumina/assets/${safeName}`
    } catch (err) {
      console.error('[WorkspaceMediaManager] ✗ Failed to save image:', err)
      throw err
    }
  }

  /**
   * Reads an asset from disk and returns its binary buffer, base64 data, and MIME type.
   *
   * @param {string} vaultPath - The absolute path of the workspace vault.
   * @param {string} relativePath - Relative path to the asset from the vault root.
   * @returns {Promise<{ buffer: Buffer, base64: string, dataUrl: string, mimeType: string, size: number }>}
   */
  static async readAsset(vaultPath, relativePath) {
    if (!vaultPath) throw new Error('No vault open')
    try {
      const finalPath = path.join(vaultPath, relativePath)
      if (!fsSync.existsSync(finalPath)) {
        throw new Error(`Asset not found: ${relativePath}`)
      }
      const buffer = await fs.readFile(finalPath)
      const ext = path.extname(finalPath).toLowerCase()
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
        '.avif': 'image/avif'
      }
      const mimeType = mimeTypes[ext] || 'application/octet-stream'
      const base64 = buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64}`

      return {
        buffer,
        base64,
        dataUrl,
        mimeType,
        size: buffer.length
      }
    } catch (err) {
      console.error('[WorkspaceMediaManager] ✗ Failed to read asset:', relativePath, err)
      throw err
    }
  }

  /**
   * Deletes an asset file from the workspace.
   *
   * @param {string} vaultPath - The absolute path of the workspace vault.
   * @param {string} relativePath - Relative path to the asset from the vault root.
   * @returns {Promise<boolean>} Resolves true when the asset is deleted.
   */
  static async deleteAsset(vaultPath, relativePath) {
    if (!vaultPath) throw new Error('No vault open')
    try {
      const finalPath = path.join(vaultPath, relativePath)
      if (!finalPath.startsWith(vaultPath)) {
        throw new Error('Invalid asset path')
      }
      if (fsSync.existsSync(finalPath)) {
        await fs.unlink(finalPath)
      }
      console.info('[WorkspaceMediaManager] ✓ Asset deleted:', relativePath)
      return true
    } catch (err) {
      console.error('[WorkspaceMediaManager] ✗ Failed to delete asset:', relativePath, err)
      throw err
    }
  }

  /**
   * Scans `.lumina/assets/` and deletes any media files no longer referenced in workspace notes.
   *
   * @param {string} vaultPath - The absolute path of the workspace vault.
   * @param {Map<string, Object>} snippetsMap - In-memory map of active snippets/notes.
   * @returns {Promise<void>}
   */
  static async cleanOrphanedAssets(vaultPath, snippetsMap) {
    if (!vaultPath) return
    const assetsPath = path.join(vaultPath, '.lumina', 'assets')
    try {
      if (!fsSync.existsSync(assetsPath)) return
      const entries = await fs.readdir(assetsPath, { withFileTypes: true })
      const allMarkdownContent = Array.from(snippetsMap.values())
        .map((s) => s.code || '')
        .join('\n')

      for (const entry of entries) {
        if (entry.isFile()) {
          if (!allMarkdownContent.includes(entry.name)) {
            const filePath = path.join(assetsPath, entry.name)
            await fs.unlink(filePath)
            console.info('[WorkspaceMediaManager] ✓ Deleted orphaned asset:', entry.name)
          }
        }
      }
    } catch (e) {
      console.warn('[WorkspaceMediaManager] Orphaned asset cleanup warning:', e.message)
    }
  }
}

export default WorkspaceMediaManager
