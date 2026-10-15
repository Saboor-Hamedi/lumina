import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import slugify from 'slugify'

export interface ReadAssetResult {
  buffer: Buffer
  base64: string
  dataUrl: string
  mimeType: string
  size: number
}

export interface SaveWorkspaceImageResult {
  relativePath: string
  fileName: string
  folderId: string
}

export type SaveVaultImageResult = SaveWorkspaceImageResult

/**
 * Normalises a markdown/asset URL into a safe workspace-relative path.
 *
 * Drops `#hash` and `?query` suffixes (so cache-busted references such as
 * `./banner.png?v=2` resolve to the real file), decodes percent-encoding
 * defensively, and strips leading slashes. Query/hash are removed *before*
 * decoding so encoded `%3F`/`%23` inside a real filename are preserved.
 */
function normalizeAssetPath(relativePath?: string): string {
  const withoutQuery = String(relativePath || '')
    .split('#')[0]
    .split('?')[0]

  let decoded = withoutQuery
  try {
    decoded = decodeURIComponent(withoutQuery)
  } catch {
    // Keep the raw value when percent-encoding is malformed (e.g. a literal '%')
  }

  return decoded.replace(/^[/\\]+/, '')
}

/**
 * WorkspaceMediaManager
 *
 * Manages media assets, embedded images, binary file I/O,
 * and orphaned asset garbage collection for the workspace.
 */
export class WorkspaceMediaManager {
  /**
   * Saves a media image buffer to the workspace's `.lumina/assets/` directory.
   */
  static async saveImage(
    workspacePath: string,
    buffer: Buffer | Uint8Array | ArrayBuffer,
    originalName: string
  ): Promise<string> {
    if (!workspacePath) throw new Error('No workspace open')

    const assetsPath = path.join(workspacePath, '.lumina', 'assets')
    try {
      await fs.mkdir(assetsPath, { recursive: true })
    } catch (e) {}

    const ext = path.extname(originalName) || '.png'
    const baseName = path.basename(originalName, ext)
    const timestamp = Date.now()
    const safeName = `${slugify(baseName, { lower: true, strict: true })}-${timestamp}${ext}`
    const targetPath = path.join(assetsPath, safeName)

    try {
      await fs.writeFile(targetPath, Buffer.from(buffer as any))
      console.info('[WorkspaceMediaManager] ✓ Image saved:', safeName)
      return `.lumina/assets/${safeName}`
    } catch (err) {
      console.error('[WorkspaceMediaManager] ✗ Failed to save image:', err)
      throw err
    }
  }

  static async saveWorkspaceImage(
    workspacePath: string,
    buffer: Buffer | Uint8Array | ArrayBuffer,
    targetFolder: string = '',
    name: string = ''
  ): Promise<SaveWorkspaceImageResult> {
    if (!workspacePath) throw new Error('No workspace open')

    const normalizedFolder = (targetFolder || '').replace(/\\/g, '/')
    const folderPath = normalizedFolder ? path.join(workspacePath, normalizedFolder) : workspacePath
    try {
      await fs.mkdir(folderPath, { recursive: true })
    } catch (e) {}

    const ext = path.extname(name) || '.png'
    let baseName = name ? path.basename(name, ext) : `Pasted image ${Date.now()}`
    let fileName = `${baseName}${ext}`
    let targetPath = path.join(folderPath, fileName)
    let counter = 1

    while (fsSync.existsSync(targetPath)) {
      fileName = `${baseName} (${counter++})${ext}`
      targetPath = path.join(folderPath, fileName)
    }

    try {
      await fs.writeFile(targetPath, Buffer.from(buffer as any))
      const relPath = normalizedFolder ? `${normalizedFolder}/${fileName}` : fileName
      console.info('[WorkspaceMediaManager] ✓ Workspace image saved:', relPath)
      return {
        relativePath: relPath.replace(/\\/g, '/'),
        fileName,
        folderId: normalizedFolder
      }
    } catch (err) {
      console.error('[WorkspaceMediaManager] ✗ Failed to save workspace image:', err)
      throw err
    }
  }

  static async saveVaultImage(
    workspacePath: string,
    buffer: Buffer | Uint8Array | ArrayBuffer,
    targetFolder: string = '',
    name: string = ''
  ): Promise<SaveWorkspaceImageResult> {
    return this.saveWorkspaceImage(workspacePath, buffer, targetFolder, name)
  }

  /**
   * Reads an asset from disk and returns its binary buffer, base64 data, and MIME type.
   *
   * Returns `null` when the asset does not exist (e.g. a pasted document that
   * references images not present in the workspace) so the renderer can show a
   * placeholder instead of surfacing a hard error.
   */
  static async readAsset(
    workspacePath: string,
    relativePath: string
  ): Promise<ReadAssetResult | null> {
    if (!workspacePath) throw new Error('No workspace open')
    try {
      const cleanRel = normalizeAssetPath(relativePath)
      const workspaceRoot = path.resolve(workspacePath)
      const finalPath = path.resolve(workspaceRoot, cleanRel)

      if (!finalPath.startsWith(workspaceRoot + path.sep) && finalPath !== workspaceRoot) {
        throw new Error('Access denied: path traversal detected')
      }

      if (!fsSync.existsSync(finalPath)) {
        // Missing assets are expected and non-fatal; degrade gracefully.
        console.warn('[WorkspaceMediaManager] Asset not found:', relativePath)
        return null
      }
      const buffer = await fs.readFile(finalPath)
      const ext = path.extname(finalPath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
        '.avif': 'image/avif',
        '.pdf': 'application/pdf'
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
   */
  static async deleteAsset(workspacePath: string, relativePath: string): Promise<boolean> {
    if (!workspacePath) throw new Error('No workspace open')
    try {
      const cleanRel = normalizeAssetPath(relativePath)
      const workspaceRoot = path.resolve(workspacePath)
      const finalPath = path.resolve(workspaceRoot, cleanRel)

      if (!finalPath.startsWith(workspaceRoot + path.sep) && finalPath !== workspaceRoot) {
        throw new Error('Access denied: path traversal detected')
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
   */
  static async cleanOrphanedAssets(workspacePath: string, snippetsMap: Map<string, any>): Promise<void> {
    if (!workspacePath) return
    const assetsPath = path.join(workspacePath, '.lumina', 'assets')
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
    } catch (e: any) {
      console.warn('[WorkspaceMediaManager] Orphaned asset cleanup warning:', e.message)
    }
  }
}

export default WorkspaceMediaManager
