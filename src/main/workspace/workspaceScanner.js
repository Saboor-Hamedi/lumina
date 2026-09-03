import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import crypto from 'crypto'
import matter from 'gray-matter'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'])

const TEXT_EXTS = new Set(['.md', '.markdown', '.txt'])

export function safeParseFrontmatter(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { data: {}, content: '' }
  }

  let preprocessed = rawContent
  const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (fmMatch) {
    const fmHeader = fmMatch[1]
    const bodyContent = fmMatch[2] || ''

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
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (key) data[key] = val
        }
      })
    }
    return { data, content }
  }
}

export class WorkspaceScanner {
  static async scan(vaultPath) {
    if (!vaultPath) return { snippets: [], folders: [] }

    try {
      const textFiles = []
      const imageFiles = []
      const foundFolders = new Set()

      const walk = async (dir, relativePath = '') => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (
            entry.name === '.git' ||
            entry.name === '.lumina' ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === 'log' ||
            (entry.isDirectory() && entry.name.startsWith('.'))
          )
            continue
          const fullPath = path.join(dir, entry.name)
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            foundFolders.add(relPath)
            await walk(fullPath, relPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (TEXT_EXTS.has(ext)) {
              textFiles.push({ fileName: entry.name, folderId: relativePath, ext })
            } else if (IMAGE_EXTS.has(ext)) {
              imageFiles.push({ fileName: entry.name, folderId: relativePath, ext })
            }
          }
        }
      }

      await walk(vaultPath)

      const luminaAssetsPath = path.join(vaultPath, '.lumina', 'assets')
      if (fsSync.existsSync(luminaAssetsPath)) {
        try {
          const luminaEntries = await fs.readdir(luminaAssetsPath, { withFileTypes: true })
          for (const entry of luminaEntries) {
            if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase()
              if (IMAGE_EXTS.has(ext)) {
                imageFiles.push({ fileName: entry.name, folderId: '.lumina/assets', ext })
              }
            }
          }
        } catch (e) {}
      }

      const seenIds = new Set()
      const newSnippets = []

      const BATCH_SIZE = 50
      for (let i = 0; i < textFiles.length; i += BATCH_SIZE) {
        const batch = textFiles.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async ({ fileName, folderId, ext }) => {
            try {
              const filePath = path.join(vaultPath, folderId || '', fileName)
              if (!fsSync.existsSync(filePath)) {
                return null
              }

              const relPath = folderId ? `${folderId}/${fileName}` : fileName
              const stats = await fs.stat(filePath)
              const rawContent = await fs.readFile(filePath, 'utf-8')

              let data = {}
              let content = rawContent
              const isMarkdown = ext === '.md' || ext === '.markdown'

              if (isMarkdown) {
                const parsed = safeParseFrontmatter(rawContent)
                data = parsed.data || {}
                content = parsed.content || ''
              }

              let finalId = data.id
              if (data.title && typeof data.title === 'string') {
                const displayTitle = data.title
                  .replace(/\\([:,"'\-\.\(\)])/g, '$1')
                  .replace(/^"(.*)"$/, '$1')
                  .replace(/^'(.*)'$/, '$1')
                  .trim()

                if (displayTitle) {
                  data.title = displayTitle
                }
              }

              if (!finalId || seenIds.has(finalId)) {
                finalId = `note-${crypto.createHash('md5').update(relPath).digest('hex')}`
              }
              seenIds.add(finalId)

              const defaultLang = isMarkdown
                ? 'markdown'
                : ext === '.txt'
                  ? 'text'
                  : ext.replace(/^\./, '')

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
                customIcon: !data.customIcon || data.customIcon === 'null' || data.customIcon === 'undefined' ? null : String(data.customIcon),
                color: null,
                type: 'snippet',
                is_draft: 0,
                fileName: fileName,
                folderId: folderId || '',
                relativePath: relPath
              }
            } catch (fileErr) {
              return null
            }
          })
        )

        newSnippets.push(...batchResults.filter(Boolean))

        if (i % 100 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2))
        }
      }

      for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        const batch = imageFiles.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async ({ fileName, folderId, ext }) => {
            try {
              const filePath = path.join(vaultPath, folderId || '', fileName)
              if (!fsSync.existsSync(filePath)) {
                return null
              }
              const stats = await fs.stat(filePath)
              const relPath = folderId ? `${folderId}/${fileName}` : fileName
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

      return { snippets: newSnippets, folders: Array.from(foundFolders) }
    } catch (err) {
      console.error('[WorkspaceScanner] ✗ Error scanning workspace:', err)
      return { snippets: [], folders: [] }
    }
  }
}

export default WorkspaceScanner
