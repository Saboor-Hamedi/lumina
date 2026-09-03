import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import slugify from 'slugify'

export class AssetManager {
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
      console.info('[AssetManager] ✓ Image saved:', safeName)
      return `.lumina/assets/${safeName}`
    } catch (err) {
      console.error('[AssetManager] ✗ Failed to save image:', err)
      throw err
    }
  }

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
      console.error('[AssetManager] ✗ Failed to read asset:', relativePath, err)
      throw err
    }
  }

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
      console.info('[AssetManager] ✓ Asset deleted:', relativePath)
      return true
    } catch (err) {
      console.error('[AssetManager] ✗ Failed to delete asset:', relativePath, err)
      throw err
    }
  }

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
            console.info('[AssetManager] ✓ Deleted orphaned asset:', entry.name)
          }
        }
      }
    } catch (e) {
      console.warn('[AssetManager] Orphaned asset cleanup warning:', e.message)
    }
  }
}

export default AssetManager
