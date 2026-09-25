/**
 * Brain Knowledge Service
 *
 * Provides hybrid semantic and section-aware retrieval for Lumina's built-in
 * knowledge base (/brain documentation, specifications, guides, and references).
 *
 * Features:
 * - Primary: High-dimensional semantic vector search via BrainIndexer IPC (window.api.searchBrain).
 * - Fallback: In-memory heading-level chunking and keyword matching if IPC is unavailable.
 * - Defensive: Safely handles missing files, null queries, or errors without crashing.
 */

export interface BrainDocument {
  id: string
  path: string
  name: string
  fileName: string
  folder: string
  title: string
  code: string
  content: string
  isBrain: boolean
  heading?: string
  breadcrumb?: string
  score?: number
}

// Vite static glob fallback for client-side bundle
const brainRawFiles: Record<string, any> = (import.meta as any).glob('../../../../../../brain/**/*.md', {
  query: '?raw',
  eager: true,
  import: 'default'
})

/**
 * Returns all raw brain documents loaded by Vite.
 */
export const getBrainDocuments = (): BrainDocument[] => {
  const docs: BrainDocument[] = []
  try {
    for (const rawPath in brainRawFiles) {
      const match = rawPath.match(/brain\/(.*\.md)$/)
      if (!match) continue
      const relativePath = match[1]
      const rawVal = brainRawFiles[rawPath]
      const content = typeof rawVal === 'string' ? rawVal : (rawVal?.default || String(rawVal || ''))
      const parts = relativePath.split('/')
      const fileName = parts[parts.length - 1]
      const name = fileName.replace(/\.md$/, '')
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : ''

      docs.push({
        id: `brain:${relativePath}`,
        path: relativePath,
        name,
        fileName,
        folder,
        title: name,
        code: content,
        content,
        isBrain: true
      })
    }
  } catch (err) {
    console.warn('[BrainKnowledge] getBrainDocuments warning:', err)
  }
  return docs
}

/**
 * Retrieves a brain document by query or exact path match.
 */
export const getBrainFile = (query?: string | null): BrainDocument | null => {
  if (!query) return null
  const clean = String(query)
    .trim()
    .toLowerCase()
    .replace(/^(?:brain\/|\.\/)+/, '')
    .replace(/\.md$/, '')
  const docs = getBrainDocuments()

  let found = docs.find((d) => d.path.toLowerCase().replace(/\.md$/, '') === clean)
  if (found) return found

  found = docs.find((d) => d.name.toLowerCase() === clean || d.fileName.toLowerCase() === `${clean}.md`)
  if (found) return found

  found = docs.find((d) => d.path.toLowerCase().includes(clean) || d.name.toLowerCase().includes(clean))
  if (found) return found

  return null
}

/**
 * Keyword search across all brain documents.
 */
export const searchBrain = (query?: string | null): BrainDocument[] => {
  if (!query || !query.trim()) return []
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const docs = getBrainDocuments()

  return docs.filter((doc) => {
    const hay = `${doc.path} ${doc.name} ${doc.content}`.toLowerCase()
    return terms.some((term) => hay.includes(term))
  })
}

/**
 * Helper to split a markdown string into heading-based sections in memory (fallback).
 */
const chunkDocumentInMemory = (doc: BrainDocument): BrainDocument[] => {
  const chunks: BrainDocument[] = []
  const lines = doc.content.split(/\r?\n/)
  const headingRegex = /^(#{1,6})\s+(.+)$/

  let currentHeading = doc.name
  let headingStack: string[] = [doc.name]
  let currentLines: string[] = []

  const flush = () => {
    const text = currentLines.join('\n').trim()
    if (text.length >= 30) {
      // If a section is large (> 2500 chars), split into focused paragraphs
      const MAX_CHUNK_CHARS = 2000
      if (text.length > MAX_CHUNK_CHARS) {
        const paragraphs = text.split(/\n\s*\n/)
        let sub = ''
        let subIdx = 0
        for (const p of paragraphs) {
          if (sub.length + p.length > MAX_CHUNK_CHARS && sub.trim().length > 0) {
            chunks.push({
              ...doc,
              id: `${doc.id}#${currentHeading.toLowerCase().replace(/\s+/g, '-')}-${subIdx++}`,
              title: `${doc.name} - ${currentHeading}`,
              heading: currentHeading,
              breadcrumb: headingStack.join(' > '),
              code: sub.trim(),
              content: sub.trim()
            })
            sub = ''
          }
          sub += (sub ? '\n\n' : '') + p
        }
        if (sub.trim().length > 0) {
          chunks.push({
            ...doc,
            id: `${doc.id}#${currentHeading.toLowerCase().replace(/\s+/g, '-')}-${subIdx}`,
            title: `${doc.name} - ${currentHeading}`,
            heading: currentHeading,
            breadcrumb: headingStack.join(' > '),
            code: sub.trim(),
            content: sub.trim()
          })
        }
      } else {
        chunks.push({
          ...doc,
          id: `${doc.id}#${currentHeading.toLowerCase().replace(/\s+/g, '-')}`,
          title: `${doc.name} - ${currentHeading}`,
          heading: currentHeading,
          breadcrumb: headingStack.join(' > '),
          code: text,
          content: text
        })
      }
    }
    currentLines = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const match = line.match(headingRegex)
    if (match) {
      flush()
      const level = match[1].length
      const text = match[2].trim()
      currentHeading = text
      if (level <= headingStack.length) {
        headingStack = headingStack.slice(0, level - 1)
      }
      headingStack.push(text)
      currentLines.push(line)
    } else {
      currentLines.push(line)
    }
  }
  flush()

  return chunks.length > 0 ? chunks : [doc]
}

/**
 * Surgically retrieves the most relevant brain documentation chunks for a user prompt.
 *
 * 1. Tries semantic vector search via BrainIndexer (window.api.searchBrain).
 * 2. Falls back seamlessly to in-memory section-aware matching if IPC is unavailable.
 */
export const retrieveRelevantKnowledge = async (
  query?: string | null,
  limit: number = 3
): Promise<BrainDocument[]> => {
  if (!query || !query.trim()) return []
  const clean = query.trim()

  // 1. Try IPC semantic vector search
  try {
    const api = (window as any).api
    if (typeof api?.searchBrain === 'function') {
      const results = await api.searchBrain(clean, { limit, threshold: 0.22 })
      if (Array.isArray(results) && results.length > 0) {
        return results.map((r: any) => ({
          id: r.id || `brain:${r.relPath || r.filePath}`,
          path: r.relPath || r.filePath,
          name: r.docTitle || (r.relPath ? r.relPath.replace(/\.md$/, '').split('/').pop() : 'Guide'),
          fileName: r.relPath ? r.relPath.split('/').pop() : 'doc.md',
          folder: (r.relPath || '').includes('/') ? (r.relPath || '').split('/').slice(0, -1).join('/') : '',
          title: r.docTitle ? `${r.docTitle} > ${r.heading}` : r.heading || 'Lumina Knowledge',
          heading: r.heading,
          breadcrumb: r.breadcrumb,
          code: r.text,
          content: r.text,
          score: r.finalScore ?? r.score ?? 0,
          isBrain: true
        }))
      }
    }
  } catch (ipcErr) {
    console.warn('[BrainKnowledge] IPC search failed, falling back to local search:', ipcErr)
  }

  // 2. Fallback: In-memory heading-level chunking and keyword matching
  try {
    const cleanLower = clean.toLowerCase()
    const queryTerms = cleanLower.split(/\s+/).filter((w) => w.length >= 3)
    const docs = getBrainDocuments()
    const allChunks: BrainDocument[] = []

    for (const doc of docs) {
      allChunks.push(...chunkDocumentInMemory(doc))
    }

    const scored: Array<{ doc: BrainDocument; score: number }> = []

    for (const chunk of allChunks) {
      let score = 0
      const lowerHeading = (chunk.heading || '').toLowerCase()
      const lowerBreadcrumb = (chunk.breadcrumb || '').toLowerCase()
      const lowerContent = chunk.content.toLowerCase()

      if (cleanLower.includes(lowerHeading)) score += 12
      if (cleanLower.includes(lowerBreadcrumb)) score += 8

      for (const term of queryTerms) {
        if (lowerHeading.includes(term)) score += 5
        else if (lowerBreadcrumb.includes(term)) score += 3
        else if (lowerContent.includes(term)) score += 1
      }

      if (score > 0) {
        scored.push({ doc: chunk, score })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit).map((s) => s.doc)
  } catch (err) {
    console.warn('[BrainKnowledge] In-memory search fallback warning:', err)
    return []
  }
}

/**
 * Returns summary list of all available brain documents for the system prompt.
 */
export const getBrainSummaryList = (): string => {
  const docs = getBrainDocuments()
  if (docs.length === 0) return 'No brain documents found.'
  return docs.map((d) => `- ${d.name} (${d.folder || 'general'})`).join('\n')
}
