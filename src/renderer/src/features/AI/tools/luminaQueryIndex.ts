import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'
import { useWorkspaceStore, type WorkspaceNote } from '../../../core/store/workspaceStore'
import { extractWikilinks } from './auditWikilinks'

export interface LuminaQueryIndexInput {
  query?: string
  tag?: string
  folder?: string
  linksTo?: string
  backlinksFor?: string
  hasFrontmatter?: string
  hasHeadings?: string
  sortBy?: 'modified' | 'title' | 'links' | 'size'
  limit?: number
}

export interface IndexedNoteRecord {
  id: string
  title: string
  fileName: string
  folder: string
  tags: string[]
  outgoingLinks: string[]
  backlinksCount: number
  incomingBacklinks?: string[]
  headings: string[]
  frontmatter: Record<string, string>
  contentSnippet?: string
  size: number
  wordCount: number
  lastModified?: string
}

export interface IndexQueryResult {
  totalWorkspaceNotes: number
  totalMatched: number
  filters: Record<string, string | number | undefined>
  notes: IndexedNoteRecord[]
  foldersRepresented: string[]
  isQuerying?: boolean
  error?: string
}

/**
 * Extracts YAML frontmatter key-value pairs from markdown text.
 */
export const extractFrontmatter = (text?: string): Record<string, any> | null => {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null

  const result: Record<string, any> = {}
  const lines = match[1].split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim()
      const val = trimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (key) {
        if (val === 'true') result[key.toLowerCase()] = true
        else if (val === 'false') result[key.toLowerCase()] = false
        else if (!isNaN(Number(val)) && val !== '') result[key.toLowerCase()] = Number(val)
        else result[key.toLowerCase()] = val
      }
    }
  }
  return result
}

/**
 * Extracts markdown headings from text (e.g. # Title, ## Section).
 */
export const extractHeadings = (text?: string): string[] => {
  if (!text || typeof text !== 'string') return []
  const clean = text.replace(/```[\s\S]*?```/g, '')
  const headings: string[] = []
  const lines = clean.split('\n')
  for (const line of lines) {
    const m = line.trim().match(/^#{1,6}\s+(.+)$/)
    if (m && m[1]) {
      headings.push(m[1].trim())
    }
  }
  return headings
}

/**
 * Extracts hashtag keywords from text and tags property.
 */
export const extractTags = (text?: string, noteTags?: string): string[] => {
  const tagSet = new Set<string>()

  if (noteTags && typeof noteTags === 'string') {
    noteTags.split(/[,\s]+/).forEach((t) => {
      const clean = t.trim().replace(/^#/, '').toLowerCase()
      if (clean) tagSet.add(clean)
    })
  }

  if (text && typeof text === 'string') {
    const clean = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
    const matches = clean.matchAll(/(?:^|\s)#([a-zA-Z0-9_\-/]+)/g)
    for (const m of matches) {
      if (m[1]) {
        const rawTag = m[1].toLowerCase()
        const isHexColor = /^[0-9a-f]{3}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/.test(rawTag)
        if (!isHexColor) {
          tagSet.add(rawTag)
        }
      }
    }
  }

  return Array.from(tagSet)
}

/**
 * Index notes in workspace and compute graph backlinks.
 */
export const buildWorkspaceIndexRecords = (notes: WorkspaceNote[]): IndexedNoteRecord[] => {
  const noteList = Array.isArray(notes) ? notes : []
  const outgoingMap = new Map<string, string[]>()
  const backlinksMap = new Map<string, string[]>()

  // Step 1: Extract individual note features
  const records: IndexedNoteRecord[] = noteList.map((note) => {
    const content = note.code || ''
    const title = (note.title || note.fileName || 'Untitled').replace(/\.md$/i, '')
    const folder = (note.folderId || '').trim() || 'root'
    const outgoing = extractWikilinks(content)
    const headings = extractHeadings(content)
    const frontmatter = extractFrontmatter(content) || {}
    const tags = extractTags(content, note.tags)

    outgoingMap.set(title.toLowerCase(), outgoing)

    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
    const size = content.length

    let lastModified: string | undefined
    if (note.timestamp) {
      lastModified = new Date(note.timestamp).toLocaleDateString()
    } else if (note.createdAt) {
      lastModified = new Date(note.createdAt).toLocaleDateString()
    }

    return {
      id: note.id,
      title,
      fileName: note.fileName || `${title}.md`,
      folder,
      tags,
      outgoingLinks: outgoing,
      backlinksCount: 0,
      headings,
      frontmatter,
      contentSnippet: content.slice(0, 1500),
      size,
      wordCount,
      lastModified
    }
  })

  // Step 2: Invert outgoing links into incoming backlinks
  for (const rec of records) {
    for (const target of rec.outgoingLinks) {
      const lowerTarget = target.toLowerCase()
      if (!backlinksMap.has(lowerTarget)) {
        backlinksMap.set(lowerTarget, [])
      }
      backlinksMap.get(lowerTarget)!.push(rec.title)
    }
  }

  // Step 3: Attach backlinks
  for (const rec of records) {
    const incoming = backlinksMap.get(rec.title.toLowerCase()) || []
    rec.backlinksCount = incoming.length
    rec.incomingBacklinks = incoming
  }

  return records
}

/**
 * luminaQueryIndexTool
 * Structured query tool across the entire workspace knowledge graph.
 * Allows filtering notes by tags, folder, outgoing links, incoming backlinks, frontmatter, and headings.
 */
export const luminaQueryIndexTool = aiSdk.tool({
  description:
    'Query the workspace note index like a database. Filter notes by tag, folder, outgoing links (linksTo), incoming backlinks (backlinksFor), frontmatter key/values, headings, or keywords. Returns structured metadata without loading full note text into context.',
  inputSchema: aiSdk.jsonSchema<LuminaQueryIndexInput>({
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional keyword to search across note titles, tags, and headings.'
      },
      tag: {
        type: 'string',
        description: 'Filter notes having this tag (e.g. "todo", "#architecture").'
      },
      folder: {
        type: 'string',
        description: 'Filter notes located in or under this folder path (e.g. "Nuclear", "Data Science").'
      },
      linksTo: {
        type: 'string',
        description: 'Filter notes that have an outgoing wikilink to this target note title.'
      },
      backlinksFor: {
        type: 'string',
        description: 'Filter notes that link TO this note title (find all backlinks).'
      },
      hasFrontmatter: {
        type: 'string',
        description: 'Filter notes having a specific YAML frontmatter key or "key: value" pair.'
      },
      hasHeadings: {
        type: 'string',
        description: 'Filter notes that contain a section heading matching this text.'
      },
      sortBy: {
        type: 'string',
        enum: ['modified', 'title', 'links', 'size'],
        description: 'Sort order for results: "modified", "title", "links" (total in+out connectivity), or "size".'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of note records to return (defaults to 25, max 100).'
      }
    }
  }),
  execute: async ({
    query,
    tag,
    folder,
    linksTo,
    backlinksFor,
    hasFrontmatter,
    hasHeadings,
    sortBy = 'modified',
    limit = 25
  }): Promise<AIToolExecutionResult> => {
    try {
      let rawNotes: WorkspaceNote[] = []
      try {
        const ws = useWorkspaceStore.getState()
        if (Array.isArray(ws?.notes) && ws.notes.length > 0) {
          rawNotes = ws.notes
        } else if (Array.isArray(ws?.snippets) && ws.snippets.length > 0) {
          rawNotes = ws.snippets
        }
      } catch (_) {}

      if (
        rawNotes.length === 0 &&
        typeof window !== 'undefined' &&
        (window as any).api?.getSnippets
      ) {
        try {
          const res = await (window as any).api.getSnippets()
          rawNotes = res?.snippets || (Array.isArray(res) ? res : [])
        } catch (_) {}
      }

      if (rawNotes.length === 0) {
        const emptyResult: IndexQueryResult = {
          totalWorkspaceNotes: 0,
          totalMatched: 0,
          filters: { query, tag, folder, linksTo, backlinksFor, hasFrontmatter, hasHeadings },
          notes: [],
          foldersRepresented: []
        }
        return {
          success: true,
          summary: 'Workspace contains 0 notes to query.',
          summaryMarkdown: `<<<LUMINA_INDEX_QUERY:${JSON.stringify(emptyResult)}>>>\nWorkspace contains 0 notes to query.`,
          result: emptyResult
        }
      }

      const allRecords = buildWorkspaceIndexRecords(rawNotes)
      const cleanLimit = Math.min(Math.max(Number(limit) || 25, 1), 100)

      const cleanQuery = query?.toLowerCase().trim()
      const cleanTag = tag?.toLowerCase().trim().replace(/^#/, '')
      const cleanFolder = folder?.toLowerCase().trim()
      const cleanLinksTo = linksTo?.toLowerCase().trim()
      const cleanBacklinksFor = backlinksFor?.toLowerCase().trim()
      const cleanHeading = hasHeadings?.toLowerCase().trim()

      const isTagsOverview =
        Boolean(
          cleanQuery &&
            /\b(?:all\s+(?:the\s+)?tags?|tags?\s+list|list\s+(?:all\s+)?tags?|what\s+tags?(?:\s+do\s+i\s+have)?|show\s+(?:all\s+)?tags?|find\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?tags?|tags?\s+in\s+(?:the\s+)?workspace|tags?\s+overview)\b/i.test(
              cleanQuery
            )
        ) ||
        cleanTag === '*' ||
        cleanTag === 'all'

      // Collect all tags and their frequency
      const allTagCounts = new Map<string, { count: number; sampleNotes: string[] }>()
      for (const rec of allRecords) {
        for (const t of rec.tags) {
          if (!allTagCounts.has(t)) {
            allTagCounts.set(t, { count: 0, sampleNotes: [] })
          }
          const item = allTagCounts.get(t)!
          item.count++
          if (item.sampleNotes.length < 3) {
            item.sampleNotes.push(rec.title)
          }
        }
      }

      let frontmatterKey = ''
      let frontmatterVal = ''
      if (hasFrontmatter) {
        const parts = hasFrontmatter.split(':')
        frontmatterKey = parts[0].trim().toLowerCase()
        frontmatterVal = parts[1] ? parts.slice(1).join(':').trim().toLowerCase() : ''
      }

      const matched = allRecords.filter((rec) => {
        if (cleanFolder) {
          const lowerFolder = rec.folder.toLowerCase()
          if (!lowerFolder.includes(cleanFolder)) return false
        }

        if (cleanTag && !isTagsOverview) {
          const hasTag = rec.tags.some((t) => t.includes(cleanTag))
          if (!hasTag) return false
        }

        if (cleanLinksTo) {
          const linksToTarget = rec.outgoingLinks.some((l) => l.toLowerCase().includes(cleanLinksTo))
          if (!linksToTarget) return false
        }

        if (cleanBacklinksFor) {
          const linksToTarget = rec.outgoingLinks.some((l) => l.toLowerCase().includes(cleanBacklinksFor))
          const incoming = rec.incomingBacklinks || []
          const matchesIncoming = incoming.some((b) => b.toLowerCase().includes(cleanBacklinksFor))
          if (!linksToTarget && !matchesIncoming) return false
        }

        if (frontmatterKey) {
          if (!rec.frontmatter[frontmatterKey]) return false
          if (frontmatterVal && !rec.frontmatter[frontmatterKey].toLowerCase().includes(frontmatterVal)) {
            return false
          }
        }

        if (cleanHeading) {
          const hasMatchedHeading = rec.headings.some((h) => h.toLowerCase().includes(cleanHeading))
          if (!hasMatchedHeading) return false
        }

        if (cleanQuery && !isTagsOverview) {
          const matchTitle = rec.title.toLowerCase().includes(cleanQuery)
          const matchTag = rec.tags.some((t) => t.includes(cleanQuery))
          const matchHeading = rec.headings.some((h) => h.toLowerCase().includes(cleanQuery))
          const matchFolder = rec.folder.toLowerCase().includes(cleanQuery)
          const matchContent = (rec.contentSnippet || '').toLowerCase().includes(cleanQuery)
          if (!matchTitle && !matchTag && !matchHeading && !matchFolder && !matchContent) return false
        }

        return true
      })

      // Sorting
      matched.sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title)
        }
        if (sortBy === 'links') {
          const totalA = a.outgoingLinks.length + a.backlinksCount
          const totalB = b.outgoingLinks.length + b.backlinksCount
          return totalB - totalA
        }
        if (sortBy === 'size') {
          return b.size - a.size
        }
        // Default: modified/recent
        return 0
      })

      const paginated = matched.slice(0, cleanLimit)
      const folderSet = new Set<string>()
      paginated.forEach((r) => folderSet.add(r.folder))

      const indexResult: IndexQueryResult & { allTags?: Array<{ tag: string; count: number }> } = {
        totalWorkspaceNotes: allRecords.length,
        totalMatched: matched.length,
        filters: { query, tag, folder, linksTo, backlinksFor, hasFrontmatter, hasHeadings, sortBy, limit: cleanLimit },
        notes: paginated,
        foldersRepresented: Array.from(folderSet),
        allTags: Array.from(allTagCounts.entries()).map(([t, d]) => ({ tag: `#${t}`, count: d.count })),
        isQuerying: false
      }

      // Generate a markdown table summary
      const filterDescriptions: string[] = []
      if (cleanFolder) filterDescriptions.push(`folder: "${cleanFolder}"`)
      if (cleanTag && !isTagsOverview) filterDescriptions.push(`tag: #${cleanTag}`)
      if (cleanLinksTo) filterDescriptions.push(`linksTo: [[${cleanLinksTo}]]`)
      if (cleanBacklinksFor) filterDescriptions.push(`backlinksFor: [[${cleanBacklinksFor}]]`)
      if (cleanQuery && !isTagsOverview) filterDescriptions.push(`keyword: "${cleanQuery}"`)
      if (frontmatterKey) filterDescriptions.push(`frontmatter: ${frontmatterKey}${frontmatterVal ? `="${frontmatterVal}"` : ''}`)

      const filterSummary = filterDescriptions.length > 0 ? ` [${filterDescriptions.join(', ')}]` : ''

      let summaryLines: string[] = []
      if (isTagsOverview) {
        const sortedTags = Array.from(allTagCounts.entries()).sort((a, b) => b[1].count - a[1].count)
        summaryLines = [
          `### 🏷️ Workspace Tags Overview`,
          `*Found **${sortedTags.length}** unique tags across **${allRecords.length}** notes in the workspace:*`,
          '',
          '| Tag | Notes Count | Sample Notes |',
          '| :--- | :---: | :--- |'
        ]
        if (sortedTags.length === 0) {
          summaryLines.push('| *(No tags found in workspace)* | 0 | None |')
        } else {
          sortedTags.slice(0, 30).forEach(([t, data]) => {
            const examples = data.sampleNotes.map((n) => `[[${n}]]`).join(', ')
            summaryLines.push(`| \`#${t}\` | **${data.count}** | ${examples} |`)
          })
          if (sortedTags.length > 30) {
            summaryLines.push(`| *... and ${sortedTags.length - 30} more tags* | | |`)
          }
        }
      } else {
        summaryLines = [
          `### 🔍 Workspace Index Query Results${filterSummary}`,
          `*Found **${matched.length}** matching notes (out of ${allRecords.length} total indexed in workspace).*`,
          '',
          '| Note Title | Folder | Tags | Outgoing Links | Backlinks | Size |',
          '| :--- | :--- | :--- | :---: | :---: | :---: |'
        ]

        paginated.slice(0, 15).forEach((rec) => {
          const tagsFormatted = rec.tags.length > 0 ? rec.tags.map((t) => `#${t}`).slice(0, 3).join(' ') : '—'
          summaryLines.push(
            `| [[${rec.title}]] | \`${rec.folder}\` | ${tagsFormatted} | ${rec.outgoingLinks.length} | ${rec.backlinksCount} | ${rec.wordCount}w |`
          )
        })

        if (matched.length > 15) {
          summaryLines.push(`| *... and ${matched.length - 15} more matching notes* | | | | | |`)
        }
      }

      const markerPrefix = `<<<LUMINA_INDEX_QUERY:${JSON.stringify(indexResult)}>>>\n`

      return {
        success: true,
        summary: summaryLines.join('\n'),
        summaryMarkdown: markerPrefix + summaryLines.join('\n'),
        totalWorkspaceNotes: allRecords.length,
        totalMatched: matched.length,
        filters: indexResult.filters,
        notes: paginated,
        foldersRepresented: indexResult.foldersRepresented,
        result: indexResult
      }
    } catch (err: any) {
      console.error('[LuminaQueryIndex] Failed to execute index query:', err)
      return {
        success: false,
        error: err?.message || 'Failed to query workspace index.'
      }
    }
  }
})

export const queryIndexTool = luminaQueryIndexTool
