/**
 * searchRanker.ts
 *
 * Shared relevance-ranking, keyword extraction, and fuzzy scoring engine
 * used across FileExplorer (sidebar search), CommandPalette (Ctrl+P), and Breadcrumbs.
 * Supports multi-word queries, keyword relevance, Fuse.js fuzzy matches,
 * and extracts clean markdown content previews around hits.
 */

import { normalizeForMatching, matchesNormalized } from '../i18n'

export interface SearchableNote {
  id: string
  title?: string
  fileName?: string
  code?: string
  content?: string
  body?: string
  folderId?: string | null
  relativePath?: string
  tags?: string[] | string
  timestamp?: number
  isPinned?: boolean | string
  [key: string]: any
}

export type MatchType = 'title' | 'content' | 'fuzzy'

export interface MatchMeta {
  matchType: MatchType
  matchSnippet: string
  score: number
}

export interface SearchTokens {
  raw: string
  tokens: string[]
  significantTokens: string[]
}

export interface RankedItem<T extends SearchableNote = SearchableNote> {
  matchType: MatchType
  matchSnippet: string
  score: number
}

export type ScoredNote<T extends SearchableNote = SearchableNote> = T & RankedItem<T>

export interface RankResult<T extends SearchableNote = SearchableNote> {
  results: ScoredNote<T>[]
  fuseScoreMap: Map<string, number>
  matchMetaMap: Map<string, MatchMeta>
}

export interface FuseLikeIndex<T = any> {
  search: (query: string) => Array<{ item: T; score?: number }>
}

const STOP_WORDS = new Set<string>([
  'how',
  'the',
  'a',
  'an',
  'in',
  'on',
  'of',
  'to',
  'is',
  'are',
  'was',
  'were',
  'for',
  'and',
  'or',
  'it',
  'with',
  'that',
  'this',
  'by',
  'from',
  'at',
  'what',
  'why',
  'when',
  'where',
  'who',
  'does',
  'do',
  'did',
  'can',
  'could',
  'should',
  'would',
  'about',
  'as',
  'into',
  'like',
  'through',
  'after',
  'over',
  'between',
  'out',
  'against',
  'during',
  'without',
  'before',
  'under',
  'around',
  'among'
])

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get tokenized search info from a query string.
 */
export function getSearchTokens(query: string | null | undefined): SearchTokens {
  if (!query || !query.trim()) {
    return { raw: '', tokens: [], significantTokens: [] }
  }
  const raw = query.trim().toLowerCase()
  const tokens = raw.split(/\s+/).filter((w) => w.length > 1)
  const significantTokens = tokens.filter((w) => !STOP_WORDS.has(w))
  return {
    raw,
    tokens,
    significantTokens: significantTokens.length > 0 ? significantTokens : tokens
  }
}

/**
 * Build a RegExp to highlight matched search terms across title/preview.
 */
export function getHighlightRegex(query: string | null | undefined): RegExp | null {
  const { significantTokens, tokens } = getSearchTokens(query)
  const toHighlight = significantTokens.length > 0 ? significantTokens : tokens
  if (toHighlight.length === 0) return null
  const pattern = toHighlight.map(escapeRegExp).join('|')
  if (!pattern) return null
  return new RegExp(`(${pattern})`, 'gi')
}

/**
 * Strip markdown syntax to produce clean plaintext for previews.
 */
export function stripMarkdown(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/^---\n[\s\S]*?\n---\n/, '') // remove YAML frontmatter
    .replace(/[#*_\-~`>|+]/g, '') // remove markdown punctuation symbols
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // [link text](url) -> link text
    .replace(/\s+/g, ' ') // normalize whitespace/newlines
    .trim()
}

/**
 * Extract a clean preview snippet around the matched terms in body.
 */
export function extractContentSnippet(
  body: string | null | undefined,
  rawQuery?: string,
  significantTokens?: string[]
): string {
  if (!body) return ''
  const lowerBody = body.toLowerCase()

  // 1. Try exact phrase match
  let idx = rawQuery ? lowerBody.indexOf(rawQuery.toLowerCase()) : -1
  let hitTokenLength = rawQuery ? rawQuery.length : 0

  // 2. If no exact phrase match, find earliest significant token in body
  if (idx === -1 && significantTokens && significantTokens.length > 0) {
    let earliest = -1
    for (const token of significantTokens) {
      const pos = lowerBody.indexOf(token.toLowerCase())
      if (pos !== -1 && (earliest === -1 || pos < earliest)) {
        earliest = pos
        hitTokenLength = token.length
      }
    }
    idx = earliest
  }

  // 3. If found inside body, extract window around idx
  if (idx !== -1) {
    const start = Math.max(0, idx - 30)
    const end = Math.min(body.length, idx + hitTokenLength + 80)
    const rawChunk = body.slice(start, end)
    const cleaned = stripMarkdown(rawChunk)
    return (start > 0 ? '…' : '') + cleaned + (end < body.length ? '…' : '')
  }

  // 4. If search term not in body (e.g. title-only hit), show opening lines of note
  const cleanedFirst = stripMarkdown(body.slice(0, 140))
  return cleanedFirst + (body.length > 140 ? '…' : '')
}

/**
 * Score a single snippet against search tokens.
 */
export function scoreSnippet(
  snippet: SearchableNote,
  searchInfo: string | SearchTokens,
  fuseScore: number = 1
): number {
  const { raw, significantTokens } =
    typeof searchInfo === 'string' ? getSearchTokens(searchInfo) : searchInfo

  if (!raw) return 0

  let score = 0
  const title = (snippet.title || snippet.fileName || '').toLowerCase()
  const body = (snippet.code || snippet.content || snippet.body || '').toLowerCase()
  const folderId = (snippet.folderId || snippet.relativePath || '').toLowerCase()

  const nRaw = normalizeForMatching(raw)
  const nTitle = normalizeForMatching(snippet.title || snippet.fileName || '')

  // ── Title signals ──────────────────────────────────────────────────────────
  if (title === raw || (nTitle && nTitle === nRaw)) {
    score += 120
  } else if (title.startsWith(raw) || (nTitle && nTitle.startsWith(nRaw))) {
    score += 90
  } else if (title.includes(raw) || (nTitle && nTitle.includes(nRaw))) {
    score += 70
  } else if (matchesNormalized(snippet.title || snippet.fileName || '', raw)) {
    score += 55
  } else if (fuseScore < 1) {
    score += Math.round((1 - fuseScore) * 60)
  }

  // Title keyword bonus
  significantTokens.forEach((token) => {
    const nToken = normalizeForMatching(token)
    if (title.includes(token) || (nTitle && nTitle.includes(nToken))) score += 25
  })

  // ── Content signals ────────────────────────────────────────────────────────
  if (body) {
    const firstIdx = body.indexOf(raw)
    if (firstIdx !== -1) {
      if (firstIdx < 200) score += 40
      else if (firstIdx < 1000) score += 25
      else score += 10
    }

    // Keyword matches in body
    let matchedKeywords = 0
    significantTokens.forEach((token) => {
      if (body.includes(token)) {
        score += 15
        matchedKeywords++
      }
    })

    if (significantTokens.length > 1 && matchedKeywords === significantTokens.length) {
      score += 40 // All significant tokens matched across body
    }

    // Frequency bonus (capped at +20)
    let count = 0
    let searchIdx = 0
    while (count < 10 && raw.length > 1) {
      const found = body.indexOf(raw, searchIdx)
      if (found === -1) break
      count++
      searchIdx = found + raw.length
    }
    score += count * 2
  }

  // Folder path matches
  if (folderId && (folderId.includes(raw) || significantTokens.some((t) => folderId.includes(t)))) {
    score += 15
  }

  // ── Recency bonus (0–25) ───────────────────────────────────────────────────
  if (snippet.timestamp) {
    const daysSince = (Date.now() - snippet.timestamp) / 86_400_000
    score += Math.max(0, 25 - daysSince * 0.5)
  }

  return score
}

/**
 * Filter + rank an array of snippets against a query.
 */
export function rankSnippets<T extends SearchableNote>(
  snippets: T[],
  query: string,
  fuseIndex?: FuseLikeIndex<T>
): RankResult<T> {
  const searchInfo = getSearchTokens(query)
  const { raw, significantTokens } = searchInfo
  if (!raw) {
    return {
      results: snippets as ScoredNote<T>[],
      fuseScoreMap: new Map<string, number>(),
      matchMetaMap: new Map<string, MatchMeta>()
    }
  }

  const fuseScoreMap = new Map<string, number>()
  if (fuseIndex) {
    try {
      const fuseResults = fuseIndex.search(raw)
      if (significantTokens.length > 0 && significantTokens.join(' ') !== raw) {
        const moreResults = fuseIndex.search(significantTokens.join(' '))
        moreResults.forEach((r) => {
          if (r?.item?.id) {
            const cur = fuseScoreMap.get(r.item.id)
            const s = r.score ?? 1
            if (cur === undefined || s < cur) {
              fuseScoreMap.set(r.item.id, s)
            }
          }
        })
      }
      fuseResults.forEach((r) => {
        if (r?.item?.id) {
          const cur = fuseScoreMap.get(r.item.id)
          const s = r.score ?? 1
          if (cur === undefined || s < cur) {
            fuseScoreMap.set(r.item.id, s)
          }
        }
      })
    } catch {
      // fuse error fallback
    }
  }

  const matchMetaMap = new Map<string, MatchMeta>()
  const scored: ScoredNote<T>[] = []

  snippets.forEach((snippet) => {
    if (!snippet) return

    const title = (snippet.title || snippet.fileName || '').toLowerCase()
    const folderId = (snippet.folderId || snippet.relativePath || '').toLowerCase()
    const fuseScore = fuseScoreMap.get(snippet.id) ?? 1
    const hasFuseMatch = fuseScore < 1

    const titleHasExact = Boolean(raw && title.indexOf(raw) !== -1)
    const folderHasExact = Boolean(raw && folderId.indexOf(raw) !== -1)
    const titleTokenMatch = significantTokens.some((token) => title.indexOf(token) !== -1)
    const folderTokenMatch = significantTokens.some((token) => folderId.indexOf(token) !== -1)

    let body = ''
    let hasBodyMatch = false

    // Only scan heavy body string if query is at least 2 chars and title/folder did not match
    if (!titleHasExact && !folderHasExact && !titleTokenMatch && !folderTokenMatch && !hasFuseMatch && raw.length >= 2) {
      const rawBody = snippet.code || snippet.content || snippet.body || ''
      if (rawBody) {
        body = rawBody.toLowerCase()
        hasBodyMatch = body.indexOf(raw) !== -1 || (significantTokens.length > 0 && significantTokens.some((token) => body.indexOf(token) !== -1))
      }
    }

    if (!hasFuseMatch && !titleHasExact && !folderHasExact && !titleTokenMatch && !folderTokenMatch && !hasBodyMatch) {
      return
    }

    const score = scoreSnippet(snippet, searchInfo, fuseScore)
    if (score <= 0 && !hasFuseMatch) return

    let matchType: MatchType = 'title'
    let matchSnippet = ''

    if (titleHasExact || titleTokenMatch || hasFuseMatch) {
      matchType = 'title'
    } else {
      matchType = 'content'
      matchSnippet = extractContentSnippet(
        snippet.code || snippet.content || snippet.body || '',
        raw,
        significantTokens
      )
    }

    const enriched: ScoredNote<T> = {
      ...snippet,
      matchType,
      matchSnippet,
      score
    }

    matchMetaMap.set(snippet.id, { matchType, matchSnippet, score })
    scored.push(enriched)
  })

  scored.sort((a, b) => b.score - a.score)
  return { results: scored, fuseScoreMap, matchMetaMap }
}
