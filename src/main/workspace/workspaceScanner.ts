import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import matter from 'gray-matter'

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
 */
export function safeParseFrontmatter(rawContent: string): FrontmatterResult {
  if (!rawContent || typeof rawContent !== 'string') {
    return { data: {}, content: '' }
  }

  // Fast path: if the document doesn't begin with frontmatter delimiters, return immediately
  if (!rawContent.startsWith('---')) {
    return { data: {}, content: rawContent }
  }

  let preprocessed = rawContent
  const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (fmMatch) {
    const fmHeader = fmMatch[1]
    const bodyContent = fmMatch[2] || ''

    // Sanitize frontmatter lines to ensure string values with special YAML characters are quoted
    const sanitizedLines = fmHeader.split(/\r?\n/).map((line) => {
      const colonIdx = line.indexOf(':')
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim()
        let val = line.slice(colonIdx + 1).trim()
        if (
          val &&
          val !== 'true' &&
          val !== 'false' &&
          val !== 'null' &&
          val !== '~' &&
          val !== '>' &&
          val !== '|' &&
          val !== '>-' &&
          val !== '|-' &&
          val !== '>+' &&
          val !== '|+' &&
          !/^-?\d+(\.\d+)?$/.test(val) &&
          !val.startsWith('[') &&
          !val.startsWith('{') &&
          !(val.startsWith('"') && val.endsWith('"')) &&
          !(val.startsWith("'") && val.endsWith("'"))
        ) {
          return `${key}: "${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
        }
      }
      return line
    })

    preprocessed = `---\n${sanitizedLines.join('\n')}\n---\n${bodyContent}`
  }

  try {
    const parsed = matter(preprocessed)
    let content = parsed.content !== undefined ? parsed.content : rawContent
    if (content.trim() === '') content = ''
    return { data: parsed.data || {}, content }
  } catch {
    // Fallback: simple line-by-line key:value parsing if gray-matter fails
    const data: Record<string, any> = {}
    let content = rawContent
    if (fmMatch) {
      const fmText = fmMatch[1]
      content = fmMatch[2] || ''
      fmText.split(/\r?\n/).forEach((line) => {
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
    return { data, content }
  }
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
