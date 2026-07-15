/**
 * searchRanker.js
 *
 * Shared relevance-ranking and keyword extraction utility used across
 * FileExplorer (sidebar search) and CommandPalette (Ctrl+P).
 * Supports multi-word queries, keyword matching, Fuse fuzzy matches,
 * and extracts clean markdown content previews around hits.
 */

const STOP_WORDS = new Set([
  'how', 'the', 'a', 'an', 'in', 'on', 'of', 'to', 'is', 'are', 'was', 'were', 'for', 'and', 'or',
  'it', 'with', 'that', 'this', 'by', 'from', 'at', 'what', 'why', 'when', 'where', 'who', 'does',
  'do', 'did', 'can', 'could', 'should', 'would', 'about', 'as', 'into', 'like', 'through', 'after',
  'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among'
])

export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get tokenized search info from a query string.
 */
export function getSearchTokens(query) {
  if (!query || !query.trim()) return { raw: '', tokens: [], significantTokens: [] }
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
export function getHighlightRegex(query) {
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
export function stripMarkdown(text) {
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
export function extractContentSnippet(body, rawQuery, significantTokens) {
  if (!body) return ''
  const lowerBody = body.toLowerCase()

  // 1. Try exact phrase match
  let idx = rawQuery ? lowerBody.indexOf(rawQuery) : -1
  let hitTokenLength = rawQuery ? rawQuery.length : 0

  // 2. If no exact phrase match, find earliest significant token in body
  if (idx === -1 && significantTokens && significantTokens.length > 0) {
    let earliest = -1
    for (const token of significantTokens) {
      const pos = lowerBody.indexOf(token)
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
export function scoreSnippet(snippet, searchInfo, fuseScore = 1) {
  const { raw, significantTokens } = typeof searchInfo === 'string'
    ? getSearchTokens(searchInfo)
    : searchInfo

  if (!raw) return 0

  let score = 0
  const title = (snippet.title || '').toLowerCase()
  const body = (snippet.code || snippet.content || '').toLowerCase()
  const folderId = (snippet.folderId || '').toLowerCase()
  const fullText = `${title} ${folderId} ${body}`

  // ── Title signals ──────────────────────────────────────────────────────────
  if (title === raw) {
    score += 120
  } else if (title.startsWith(raw)) {
    score += 90
  } else if (title.includes(raw)) {
    score += 70
  } else if (fuseScore < 1) {
    score += Math.round((1 - fuseScore) * 60)
  }

  // Title keyword bonus
  significantTokens.forEach((token) => {
    if (title.includes(token)) score += 25
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
export function rankSnippets(snippets, query, fuseIndex) {
  const searchInfo = getSearchTokens(query)
  const { raw, significantTokens } = searchInfo
  if (!raw) return { results: snippets, fuseScoreMap: new Map(), matchMetaMap: new Map() }

  const fuseScoreMap = new Map()
  if (fuseIndex) {
    const fuseResults = fuseIndex.search(raw)
    if (significantTokens.length > 0 && significantTokens.join(' ') !== raw) {
      const moreResults = fuseIndex.search(significantTokens.join(' '))
      moreResults.forEach((r) => {
        if (!fuseScoreMap.has(r.item.id) || (r.score ?? 1) < fuseScoreMap.get(r.item.id)) {
          fuseScoreMap.set(r.item.id, r.score ?? 1)
        }
      })
    }
    fuseResults.forEach((r) => {
      if (!fuseScoreMap.has(r.item.id) || (r.score ?? 1) < fuseScoreMap.get(r.item.id)) {
        fuseScoreMap.set(r.item.id, r.score ?? 1)
      }
    })
  }

  const matchMetaMap = new Map()
  const scored = []

  snippets.forEach((snippet) => {
    const title = (snippet.title || '').toLowerCase()
    const body = (snippet.code || snippet.content || '').toLowerCase()
    const folderId = (snippet.folderId || '').toLowerCase()
    const fullText = `${title} ${folderId} ${body}`

    const fuseScore = fuseScoreMap.get(snippet.id) ?? 1
    const hasFuseMatch = fuseScore < 1
    const hasExactPhrase = raw && fullText.indexOf(raw) !== -1
    const matchingTokensCount = significantTokens.filter((token) => fullText.indexOf(token) !== -1).length
    const hasKeywordMatch = matchingTokensCount > 0

    if (!hasFuseMatch && !hasExactPhrase && !hasKeywordMatch) {
      return
    }

    const score = scoreSnippet(snippet, searchInfo, fuseScore)
    if (score <= 0 && !hasFuseMatch) return

    const matchSnippet = extractContentSnippet(snippet.code || snippet.content || '', raw, significantTokens)
    let matchType = 'content'
    if (hasExactPhrase && title.indexOf(raw) !== -1) {
      matchType = 'title'
    } else if (hasFuseMatch && (!hasExactPhrase || body.indexOf(raw) === -1) && matchingTokensCount === 0) {
      matchType = 'title'
    }

    const enriched = {
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
