import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import matter from 'gray-matter'
import { NativeEngine } from './nativeEngine'

/**
 * Recognized image file extensions for media attachments within the workspace.
 */
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

/**
 * Recognized PDF file extensions for document attachments within the workspace.
 */
const PDF_EXTS = new Set(['.pdf'])

export const MAX_WORKSPACE_TEXT_BYTES = 5 * 1024 * 1024

/**
 * Recognized text note extensions.
 */
const TEXT_EXTS = new Set(['.md', '.markdown', '.txt', '.canvas'])

/**
 * Known frontmatter / metadata keys supported when parsing loose note headers.
 */
const KNOWN_METADATA_KEYS = new Set([
  'title',
  'tags',
  'language',
  'ispinned',
  'is_pinned',
  'pinned',
  'customicon',
  'custom_icon',
  'color',
  'timestamp',
  'createdat',
  'created_at',
  'updatedat',
  'updated_at',
  'id',
  'type',
  'isdraft',
  'is_draft',
  'folderid',
  'folder_id'
])

export interface WorkspaceSnippet {
  id: string
  title: string
  code: string
  language: string
  tags: string
  timestamp: number
  createdAt?: string
  selection?: any
  isPinned: boolean
  isLearned: boolean
  customIcon: string | null
  color: string | null
  type: 'snippet' | 'canvas' | 'image' | 'pdf'
  is_draft: number
  fileName: string
  folderId: string
  relativePath: string
  size?: number
  isOversized?: boolean
  ext?: string
  [key: string]: any
}

export interface FrontmatterResult {
  data: Record<string, any>
  content: string
}

export interface WorkspaceScanResult {
  snippets: WorkspaceSnippet[]
  folders: string[]
}

/**
 * Safely parses YAML frontmatter from raw markdown content without throwing fatal errors.
 * Robustly strips both standard `---...---` blocks and loose metadata blocks.
 */
export function safeParseFrontmatter(rawContent: string): FrontmatterResult {
  if (!rawContent || typeof rawContent !== 'string') {
    return { data: {}, content: '' }
  }

  let text = rawContent.replace(/^\uFEFF/, '')
  const data: Record<string, any> = {}

  // 1. Strip any standard `---...---` blocks (including repeated/nested)
  while (/^\s*---\r?\n/.test(text)) {
    const match = text.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!match) break
    const fmHeader = match[1]
    text = match[2] || ''

    try {
      const parsed = matter(`---\n${fmHeader}\n---`)
      if (parsed.data) {
        Object.assign(data, parsed.data)
      }
    } catch {
      fmHeader.split(/\r?\n/).forEach((line) => {
        const colonIdx = line.indexOf(':')
        if (colonIdx !== -1) {
          const key = line.slice(0, colonIdx).trim()
          let val = line.slice(colonIdx + 1).trim()
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          if (key) data[key] = val
        }
      })
    }
  }

  // 2. Strip any loose metadata key: value lines at the top of content
  const lines = text.split(/\r?\n/)
  let lineIdx = 0
  let foundLooseMetadata = false

  while (lineIdx < lines.length) {
    const line = lines[lineIdx].trim()
    if (!line) {
      if (foundLooseMetadata) {
        lineIdx++
        continue
      }
      lineIdx++
      continue
    }

    const colonIdx = line.indexOf(':')
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim().toLowerCase()
      if (KNOWN_METADATA_KEYS.has(key)) {
        foundLooseMetadata = true
        let val: any = line.slice(colonIdx + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        if (val === 'true') val = true
        else if (val === 'false') val = false
        else if (val === 'null') val = null
        else if (!isNaN(Number(val)) && val !== '') val = Number(val)

        const originalKey = line.slice(0, colonIdx).trim()
        if (!data[originalKey]) {
          data[originalKey] = val
        }
        lineIdx++
        continue
      }
    }

    break
  }

  if (foundLooseMetadata) {
    text = lines.slice(lineIdx).join('\n')
  }

  return { data, content: text.replace(/^[\r\n]+/, '') }
}

/**
 * High-performance file scanner for Lumina workspaces.
 */
export class WorkspaceScanner {
  static async scan(
    workspacePath: string,
    existingCache: Map<string, WorkspaceSnippet> | WorkspaceSnippet[] | null = null
  ): Promise<WorkspaceScanResult> {
    if (!workspacePath) return { snippets: [], folders: [] }

    // 1. Ultra-fast native Rust scanner path (multithreaded Rayon)
    if (NativeEngine.isAvailable()) {
      try {
        const nativeResult = NativeEngine.scanVault(workspacePath, MAX_WORKSPACE_TEXT_BYTES)
        if (nativeResult && Array.isArray(nativeResult.notes)) {
          const foldersSet = new Set<string>(nativeResult.folders || [])
          for (const note of nativeResult.notes) {
            if (note.folderId) {
              const parts = note.folderId.split('/')
              let current = ''
              for (const part of parts) {
                if (!part) continue
                current = current ? `${current}/${part}` : part
                foldersSet.add(current)
              }
            }
          }
          return {
            snippets: nativeResult.notes as WorkspaceSnippet[],
            folders: Array.from(foldersSet)
          }
        }
      } catch (err) {
        console.warn('[WorkspaceScanner] Native scan error, falling back to JS scanner:', err)
      }
    }

    try {
      const textFiles: Array<{ fileName: string; folderId: string; ext: string; fullPath: string; relPath: string }> = []
      const imageFiles: Array<{ fileName: string; folderId: string; ext: string; fullPath: string; relPath: string }> = []
      const pdfFiles: Array<{ fileName: string; folderId: string; ext: string; fullPath: string; relPath: string }> = []
      const foundFolders = new Set<string>()

      // Build a fast lookup map for unchanged snippets by relative path
      const cacheByRelPath = new Map<string, WorkspaceSnippet>()
      if (existingCache) {
        const items = existingCache instanceof Map ? existingCache.values() : existingCache
        for (const item of items) {
          if (item && item.relativePath) {
            cacheByRelPath.set(item.relativePath, item)
          }
        }
      }

      const walk = async (dir: string, relativePath = ''): Promise<void> => {
        let entries
        try {
          entries = await fs.readdir(dir, { withFileTypes: true })
        } catch {
          return
        }

        const subDirPromises: Promise<void>[] = []

        for (const entry of entries) {
          const name = entry.name

          if (
            name === '.git' ||
            name === '.lumina' ||
            name === 'node_modules' ||
            name === 'dist' ||
            name === 'build' ||
            name === 'log' ||
            (entry.isDirectory() && name.startsWith('.'))
          ) {
            continue
          }

          const fullPath = path.join(dir, name)
          const relPath = relativePath ? `${relativePath}/${name}` : name

          if (entry.isDirectory()) {
            foundFolders.add(relPath)
            subDirPromises.push(walk(fullPath, relPath))
          } else if (entry.isFile()) {
            const ext = path.extname(name).toLowerCase()
            if (TEXT_EXTS.has(ext)) {
              textFiles.push({ fileName: name, folderId: relativePath, ext, fullPath, relPath })
            } else if (IMAGE_EXTS.has(ext)) {
              imageFiles.push({ fileName: name, folderId: relativePath, ext, fullPath, relPath })
            } else if (PDF_EXTS.has(ext)) {
              pdfFiles.push({ fileName: name, folderId: relativePath, ext, fullPath, relPath })
            }
          }
        }

        if (subDirPromises.length > 0) {
          await Promise.all(subDirPromises)
        }
      }

      await walk(workspacePath)

      const seenIds = new Set<string>()
      const newSnippets: WorkspaceSnippet[] = []

      const BATCH_SIZE = 64
      for (let i = 0; i < textFiles.length; i += BATCH_SIZE) {
        const batch = textFiles.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async ({ fileName, folderId, ext, fullPath, relPath }): Promise<WorkspaceSnippet | null> => {
            try {
              const stats = await fs.stat(fullPath)
              const isMarkdown = ext === '.md' || ext === '.markdown'
              const isOversized = stats.size > MAX_WORKSPACE_TEXT_BYTES

              if (isOversized) {
                const id = `note-${crypto.createHash('md5').update(relPath).digest('hex')}`
                return {
                  id,
                  title: fileName.replace(/\.[^/.]+$/, ''),
                  code: '',
                  language: isMarkdown ? 'markdown' : 'text',
                  tags: '',
                  timestamp: stats.mtimeMs,
                  createdAt: new Date(stats.birthtimeMs || stats.mtimeMs).toISOString(),
                  selection: null,
                  isPinned: false,
                  isLearned: false,
                  customIcon: null,
                  color: null,
                  type: 'snippet',
                  is_draft: 0,
                  fileName,
                  folderId: folderId || '',
                  relativePath: relPath,
                  size: stats.size,
                  isOversized: true
                }
              }

              const cached = cacheByRelPath.get(relPath)
              if (
                cached &&
                cached.timestamp === stats.mtimeMs &&
                cached.fileName === fileName &&
                cached.folderId === folderId
              ) {
                let finalId = cached.id
                if (!finalId || seenIds.has(finalId)) {
                  finalId = `note-${crypto.createHash('md5').update(relPath).digest('hex')}`
                }
                seenIds.add(finalId)
                return { ...cached, id: finalId }
              }

              const rawContent = await fs.readFile(fullPath, 'utf-8')
              let data: Record<string, any> = {}
              let content = rawContent

              if (isMarkdown) {
                const parsed = safeParseFrontmatter(rawContent)
                data = parsed.data || {}
                content = parsed.content || ''
              }

              let displayTitle = data.title
              if (displayTitle && typeof displayTitle === 'string') {
                displayTitle = displayTitle
                  .replace(/\\([:,"'\-\.\(\)])/g, '$1')
                  .replace(/^"(.*)"$/, '$1')
                  .replace(/^'(.*)'$/, '$1')
                  .trim()
                if (
                  displayTitle === '>-' ||
                  displayTitle === '>' ||
                  displayTitle === '|' ||
                  displayTitle === '|-' ||
                  displayTitle === '-'
                ) {
                  const headingMatch = content.match(/^#+\s+(.+)$/m)
                  displayTitle = headingMatch ? headingMatch[1].trim() : fileName.replace(/\.[^/.]+$/, '')
                }
                if (displayTitle) {
                  data.title = displayTitle
                }
              }

              let finalId = data.id
              if (!finalId || seenIds.has(finalId)) {
                finalId = `note-${crypto.createHash('md5').update(relPath).digest('hex')}`
              }
              seenIds.add(finalId)

              const isCanvas = ext === '.canvas'
              const defaultLang = isCanvas ? 'canvas' : isMarkdown ? 'markdown' : 'text'

              return {
                id: finalId,
                title: data.title || fileName.replace(/\.[^/.]+$/, ''),
                code: content || '',
                language: data.language || defaultLang,
                tags: data.tags || '',
                timestamp: data.timestamp || stats.mtimeMs,
                createdAt: data.createdAt || new Date(stats.birthtimeMs || stats.mtimeMs).toISOString(),
                selection: data.selection || null,
                isPinned: data.isPinned === true || data.isPinned === 'true',
                isLearned: data.isLearned === true || data.isLearned === 'true',
                customIcon:
                  !data.customIcon ||
                  data.customIcon === 'null' ||
                  data.customIcon === 'undefined'
                    ? null
                    : String(data.customIcon),
                color: null,
                type: isCanvas ? 'canvas' : 'snippet',
                is_draft: 0,
                fileName,
                folderId: folderId || '',
                relativePath: relPath
              }
            } catch {
              return null
            }
          })
        )

        newSnippets.push(...batchResults.filter((s): s is WorkspaceSnippet => s !== null))

        if (i > 0 && i % 256 === 0) {
          await new Promise((resolve) => setImmediate(resolve))
        }
      }

      for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        const batch = imageFiles.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async ({ fileName, folderId, ext, fullPath, relPath }): Promise<WorkspaceSnippet | null> => {
            try {
              const stats = await fs.stat(fullPath)
              const cached = cacheByRelPath.get(relPath)
              if (
                cached &&
                cached.timestamp === stats.mtimeMs &&
                cached.fileName === fileName &&
                cached.size === stats.size
              ) {
                return cached
              }

              const id = `img-${crypto.createHash('md5').update(relPath).digest('hex')}`

              return {
                id,
                title: fileName,
                code: '',
                language: 'image',
                tags: '',
                timestamp: stats.mtimeMs,
                selection: null,
                isPinned: false,
                isLearned: false,
                customIcon: null,
                color: null,
                type: 'image',
                ext,
                size: stats.size,
                is_draft: 0,
                fileName,
                folderId: folderId || '',
                relativePath: relPath
              }
            } catch {
              return null
            }
          })
        )

        newSnippets.push(...batchResults.filter((s): s is WorkspaceSnippet => s !== null))
      }

      for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
        const batch = pdfFiles.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async ({ fileName, folderId, ext, fullPath, relPath }): Promise<WorkspaceSnippet | null> => {
            try {
              const stats = await fs.stat(fullPath)
              const cached = cacheByRelPath.get(relPath)
              if (
                cached &&
                cached.timestamp === stats.mtimeMs &&
                cached.fileName === fileName &&
                cached.size === stats.size
              ) {
                return cached
              }

              const id = `pdf-${crypto.createHash('md5').update(relPath).digest('hex')}`

              return {
                id,
                title: fileName,
                code: '',
                language: 'pdf',
                tags: '',
                timestamp: stats.mtimeMs,
                selection: null,
                isPinned: false,
                isLearned: false,
                customIcon: null,
                color: null,
                type: 'pdf',
                ext,
                size: stats.size,
                is_draft: 0,
                fileName,
                folderId: folderId || '',
                relativePath: relPath
              }
            } catch {
              return null
            }
          })
        )

        newSnippets.push(...batchResults.filter((s): s is WorkspaceSnippet => s !== null))
      }

      return { snippets: newSnippets, folders: Array.from(foundFolders) }
    } catch (err) {
      console.error('[WorkspaceScanner] ✗ Error scanning workspace:', err)
      return { snippets: [], folders: [] }
    }
  }
}

export default WorkspaceScanner
