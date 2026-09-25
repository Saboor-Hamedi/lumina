/**
 * fuzzyScorer.ts
 *
 * VS Code-grade in-memory fuzzy subsequence scoring and character range extraction.
 *
 * Based on the VS Code scoring architecture (`vs/base/common/filters.ts`):
 * 1. Subsequence check: every character in `query` must appear in `target` in order.
 * 2. High-precision scoring heuristics:
 *    - Exact string match: +1000
 *    - Prefix match: +200
 *    - Start of word / separator match (`/`, `\`, `-`, `_`, `.`, ` `): +50
 *    - CamelCase uppercase boundary match: +40
 *    - Consecutive matching character bonus: +30 * consecutive count
 *    - Shorter target length bonus (higher density): up to +30
 * 3. Match range extraction: returns `[start, end]` ranges for sub-millisecond
 *    highlighting without expensive regular expressions.
 */

export interface FuzzyMatchRange {
  start: number
  end: number
}

export interface FuzzyScoreResult {
  score: number
  ranges: FuzzyMatchRange[]
}

const SEPARATORS = new Set(['/', '\\', '-', '_', '.', ' ', ':', '@', '#', '(', '[', '{'])

/**
 * Checks if a character at index is a word boundary (after separator or camelCase).
 */
function isWordBoundary(target: string, index: number): boolean {
  if (index === 0) return true
  const prev = target[index - 1]
  if (SEPARATORS.has(prev)) return true

  // CamelCase check (lowercase followed by uppercase)
  const curr = target[index]
  if (curr >= 'A' && curr <= 'Z' && prev >= 'a' && prev <= 'z') {
    return true
  }

  return false
}

/**
 * Scores a target string against a query using VS Code subsequence matching.
 * Returns null if the query is not a subsequence of the target.
 */
export function scoreFuzzy(
  target: string,
  query: string
): FuzzyScoreResult | null {
  if (!query || !target) return null

  const targetLen = target.length
  const queryLen = query.length

  if (queryLen > targetLen) return null

  const qLower = query.toLowerCase()
  const tLower = target.toLowerCase()

  // 1. Exact match fast path
  if (qLower === tLower) {
    return {
      score: 1000 + Math.max(0, 50 - targetLen),
      ranges: [{ start: 0, end: targetLen }]
    }
  }

  // 2. Exact prefix match fast path
  if (tLower.startsWith(qLower)) {
    return {
      score: 500 + Math.max(0, 50 - targetLen),
      ranges: [{ start: 0, end: queryLen }]
    }
  }

  // 3. Subsequence alignment search
  let tIdx = 0
  let qIdx = 0
  const matchedIndices: number[] = []

  let score = 0
  let consecutive = 0

  while (qIdx < queryLen && tIdx < targetLen) {
    const qChar = qLower[qIdx]
    const tChar = tLower[tIdx]

    if (qChar === tChar) {
      matchedIndices.push(tIdx)

      let charScore = 10

      // Match on word boundary
      if (isWordBoundary(target, tIdx)) {
        charScore += 45
      }

      // Consecutive bonus
      if (consecutive > 0) {
        charScore += consecutive * 25
      }
      consecutive++

      // Exact case match bonus
      if (query[qIdx] === target[tIdx]) {
        charScore += 5
      }

      score += charScore
      qIdx++
    } else {
      consecutive = 0
    }
    tIdx++
  }

  // Query was not a subsequence
  if (qIdx < queryLen) {
    return null
  }

  // Density penalty: penalize sprawling matches over very long strings
  const span = matchedIndices[matchedIndices.length - 1] - matchedIndices[0] + 1
  const excess = span - queryLen
  if (excess > 0) {
    score -= excess * 2
  }

  // Length bonus for compact targets
  score += Math.max(0, 40 - targetLen)

  // Collapse consecutive matched indices into ranges for highlighting
  const ranges: FuzzyMatchRange[] = []
  if (matchedIndices.length > 0) {
    let start = matchedIndices[0]
    let prev = start
    for (let i = 1; i < matchedIndices.length; i++) {
      const curr = matchedIndices[i]
      if (curr === prev + 1) {
        prev = curr
      } else {
        ranges.push({ start, end: prev + 1 })
        start = curr
        prev = curr
      }
    }
    ranges.push({ start, end: prev + 1 })
  }

  return { score, ranges }
}
