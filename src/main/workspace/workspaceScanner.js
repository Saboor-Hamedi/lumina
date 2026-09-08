import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import matter from 'gray-matter'

/**
 * Recognized image file extensions for media attachments within the workspace.
 * Files matching these extensions are tracked as image snippets and surfaced in the explorer/graph.
 * @type {Set<string>}
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
 * PDFs are tracked separately from images and notes — they open in the native PDF viewer tab.
 * @type {Set<string>}
 */
const PDF_EXTS = new Set(['.pdf'])

/**
 * Recognized text note extensions.
 * Files matching these extensions are parsed for frontmatter, markdown wikilinks, and plain text content.
 * @type {Set<string>}
 */
const TEXT_EXTS = new Set(['.md', '.markdown', '.txt'])

/**
 * Safely parses YAML frontmatter from raw markdown content without throwing fatal errors.
 *
 * Performance Optimization:
 * - Immediately short-circuits with `{ data: {}, content: rawContent }` if the document does not
 *   begin with standard YAML frontmatter markers (`---`), completely avoiding regex overhead and
 *   heavy YAML parser instantiation for standard notes.
 * - For files containing frontmatter, it sanitizes unquoted string values (e.g. titles with colons
 *   or quotes) to prevent gray-matter / js-yaml parse failures.
 * - Includes a regex-based fallback extractor if gray-matter throws an unrecoverable syntax exception.
 *
 * @param {string} rawContent - The full UTF-8 text read from disk.
 * @returns {{ data: Record<string, any>, content: string }} Parsed frontmatter data and remaining body.
 */
export function safeParseFrontmatter(rawContent) {
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
  } catch (err) {
    // Fallback: simple line-by-line key:value parsing if gray-matter fails
    let data = {}
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
 *
 * Responsibilities:
 * 1. Concurrently traverses workspace directory trees while ignoring git/node/dist build caches.
 * 2. Incremental Parsing: Reuses previously parsed snippets if file modification timestamp (mtimeMs)
 *    has not changed, eliminating massive disk read & YAML parse overhead on startup or window reloads.
 * 3. Normalizes note IDs, frontmatter titles, folders, and tags into uniform snippet records.
 * 4. Discovers image assets and exposes them as first-class image snippets.
 */
export class WorkspaceScanner {
  /**
   * Scans a workspace directory tree and returns an indexed list of snippets and folders.
   *
   * @param {string} workspacePath - Absolute root directory of the workspace.
   * @param {Map<string, any> | Array<any>} [existingCache=null] - Optional previously cached snippets
   *        used to skip re-reading unchanged files based on mtime timestamps.
   * @returns {Promise<{ snippets: Array<any>, folders: Array<string> }>}
   */
  static async scan(workspacePath, existingCache = null) {
    if (!workspacePath) return { snippets: [], folders: [] }

    try {
      const textFiles = []
      const imageFiles = []
      const pdfFiles = [] // PDFs tracked separately — open in native PDF viewer tab
      const foundFolders = new Set()

      // Build a fast lookup map for unchanged snippets by relative path
      const cacheByRelPath = new Map()
      if (existingCache) {
        const items = existingCache instanceof Map ? existingCache.values() : existingCache
        for (const item of items) {
          if (item && item.relativePath) {
            cacheByRelPath.set(item.relativePath, item)
          }
        }
      }

      /**
       * Asynchronously walks directory entries with concurrent sub-directory traversal.
       * Excludes hidden folders (.git, .lumina, etc.) and heavy build directories.
       *
       * @param {string} dir - Current directory path.
       * @param {string} [relativePath=''] - Relative path from workspace root.
       */
      const walk = async (dir, relativePath = '') => {
        let entries
        try {
          entries = await fs.readdir(dir, { withFileTypes: true })
        } catch (err) {
          // If directory is inaccessible or was deleted concurrently, skip gracefully
          return
        }

        const subDirPromises = []

        for (const entry of entries) {
          const name = entry.name

          // Skip hidden directories, version control, build outputs, and node_modules
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
              // PDFs get their own bucket — same metadata shape as images but type: 'pdf'
              pdfFiles.push({ fileName: name, folderId: relativePath, ext, fullPath, relPath })
            }
          }
        }

        // Process subdirectories concurrently for maximum I/O throughput
        if (subDirPromises.length > 0) {
          await Promise.all(subDirPromises)
        }
      }

      await walk(workspacePath)

      const seenIds = new Set()
      const newSnippets = []

      // Batch process text files concurrently to maintain high throughput without exhausting file handles
      const BATCH_SIZE = 64
      for (let i = 0; i < textFiles.length; i += BATCH_SIZE) {
        const batch = textFiles.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async ({ fileName, folderId, ext, fullPath, relPath }) => {
            try {
              const stats = await fs.stat(fullPath)
              const isMarkdown = ext === '.md' || ext === '.markdown'

              // Cache Check: If file mtime matches cached snippet, reuse it directly
              const cached = cacheByRelPath.get(relPath)
              if (
                cached &&
                cached.timestamp === stats.mtimeMs &&
                cached.fileName === fileName &&
                cached.folderId === folderId
              ) {
                // Ensure unique IDs across duplicates
                let finalId = cached.id
                if (!finalId || seenIds.has(finalId)) {
                  finalId = `note-${crypto.createHash('md5').update(relPath).digest('hex')}`
                }
                seenIds.add(finalId)
                return { ...cached, id: finalId }
              }

              // File has been added or updated: read and parse
              const rawContent = await fs.readFile(fullPath, 'utf-8')
              let data = {}
              let content = rawContent

              if (isMarkdown) {
                const parsed = safeParseFrontmatter(rawContent)
                data = parsed.data || {}
                content = parsed.content || ''
              }

              // Clean up title quotes or escape sequences
              let displayTitle = data.title
              if (displayTitle && typeof displayTitle === 'string') {
                displayTitle = displayTitle
                  .replace(/\\([:,"'\-\.\(\)])/g, '$1')
                  .replace(/^"(.*)"$/, '$1')
                  .replace(/^'(.*)'$/, '$1')
                  .trim()
                if (displayTitle) {
                  data.title = displayTitle
                }
              }

              // Ensure stable, deterministic unique note ID
              let finalId = data.id
              if (!finalId || seenIds.has(finalId)) {
                finalId = `note-${crypto.createHash('md5').update(relPath).digest('hex')}`
              }
              seenIds.add(finalId)

              const defaultLang = isMarkdown ? 'markdown' : 'text'

              return {
                id: finalId,
                title: data.title || fileName.replace(/\.[^/.]+$/, ''),
                code: content || '',
                language: data.language || defaultLang,
                tags: data.tags || '',
                timestamp: data.timestamp || stats.mtimeMs,
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
                type: 'snippet',
                is_draft: 0,
                fileName,
                folderId: folderId || '',
                relativePath: relPath
              }
            } catch (fileErr) {
              return null
            }
          })
        )

        newSnippets.push(...batchResults.filter(Boolean))

        // Yield execution every 200 files to avoid starving event loop during huge imports
        if (i > 0 && i % 256 === 0) {
          await new Promise((resolve) => setImmediate(resolve))
        }
      }

      // Batch process image assets
      for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        const batch = imageFiles.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async ({ fileName, folderId, ext, fullPath, relPath }) => {
            try {
              const stats = await fs.stat(fullPath)
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
            } catch (err) {
              return null
            }
          })
        )

        newSnippets.push(...batchResults.filter(Boolean))
      }

      // Batch process PDF documents — same shape as images but type: 'pdf', language: 'pdf'
      for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
        const batch = pdfFiles.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async ({ fileName, folderId, ext, fullPath, relPath }) => {
            try {
              const stats = await fs.stat(fullPath)
              // Use 'pdf-' prefix to keep IDs separate from images and notes
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
            } catch (err) {
              return null
            }
          })
        )

        newSnippets.push(...batchResults.filter(Boolean))
      }

      return { snippets: newSnippets, folders: Array.from(foundFolders) }
    } catch (err) {
      console.error('[WorkspaceScanner] ✗ Error scanning workspace:', err)
      return { snippets: [], folders: [] }
    }
  }
}

export default WorkspaceScanner
