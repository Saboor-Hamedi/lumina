import { describe, it, expect } from 'vitest'
import {
  escapeRegExp,
  getSearchTokens,
  getHighlightRegex,
  stripMarkdown,
  extractContentSnippet,
  scoreSnippet,
  rankSnippets
} from '../../../../../src/renderer/src/core/utils/searchRanker'

describe('searchRanker', () => {
  describe('escapeRegExp', () => {
    it('escapes special regex characters', () => {
      expect(escapeRegExp('hello.world')).toBe('hello\\.world')
      expect(escapeRegExp('test (1)')).toBe('test \\(1\\)')
      expect(escapeRegExp('a+b*c')).toBe('a\\+b\\*c')
    })

    it('handles strings with no special chars', () => {
      expect(escapeRegExp('hello')).toBe('hello')
    })
  })

  describe('getSearchTokens', () => {
    it('returns empty for null/empty input', () => {
      expect(getSearchTokens('').raw).toBe('')
      expect(getSearchTokens(null).raw).toBe('')
      expect(getSearchTokens('   ').raw).toBe('')
    })

    it('splits query into tokens', () => {
      const result = getSearchTokens('hello world')
      expect(result.tokens).toEqual(['hello', 'world'])
      expect(result.raw).toBe('hello world')
    })

    it('filters out stop words from significant tokens', () => {
      const result = getSearchTokens('how to code in javascript')
      expect(result.significantTokens).not.toContain('how')
      expect(result.significantTokens).not.toContain('to')
      expect(result.significantTokens).not.toContain('in')
      expect(result.significantTokens).toContain('code')
      expect(result.significantTokens).toContain('javascript')
    })

    it('falls back to all tokens if all are stop words', () => {
      const result = getSearchTokens('the and for')
      expect(result.significantTokens).toEqual(['the', 'and', 'for'])
    })

    it('filters short tokens under 2 chars', () => {
      const result = getSearchTokens('a b cat')
      expect(result.tokens).toEqual(['cat'])
    })
  })

  describe('getHighlightRegex', () => {
    it('returns null for empty query', () => {
      expect(getHighlightRegex('')).toBeNull()
    })

    it('builds regex from significant tokens', () => {
      const regex = getHighlightRegex('hello world')
      expect(regex).toBeInstanceOf(RegExp)
      expect('hello').toMatch(regex)
      expect('world').toMatch(regex)
    })

    it('matches case-insensitively', () => {
      const regex = getHighlightRegex('Hello')
      expect('hello').toMatch(regex)
      expect('HELLO').toMatch(regex)
    })
  })

  describe('stripMarkdown', () => {
    it('removes YAML frontmatter', () => {
      const result = stripMarkdown('---\ntitle: Test\n---\nBody content')
      expect(result).toBe('Body content')
    })

    it('removes markdown symbols', () => {
      expect(stripMarkdown('# Header')).toBe('Header')
      expect(stripMarkdown('**bold**')).toBe('bold')
      expect(stripMarkdown('*italic*')).toBe('italic')
    })

    it('extracts link text from markdown links', () => {
      expect(stripMarkdown('[click here](https://example.com)')).toBe('click here')
    })

    it('normalizes whitespace', () => {
      expect(stripMarkdown('line1\n\nline2')).toBe('line1 line2')
    })

    it('returns empty string for null input', () => {
      expect(stripMarkdown(null)).toBe('')
      expect(stripMarkdown('')).toBe('')
    })
  })

  describe('extractContentSnippet', () => {
    const body = 'This is a long body of text that contains the search query somewhere in the middle for testing purposes.'

    it('returns empty for null body', () => {
      expect(extractContentSnippet(null, 'test', ['test'])).toBe('')
    })

    it('extracts snippet around exact phrase match', () => {
      const snippet = extractContentSnippet(body, 'search query', ['search', 'query'])
      expect(snippet).toContain('search query')
      expect(snippet).toMatch(/^…|^[^…]/)
    })

    it('falls back to significant token match', () => {
      const snippet = extractContentSnippet(body, 'nonexistent', ['testing'])
      expect(snippet).toContain('testing')
    })

    it('returns beginning of body when no match found', () => {
      const snippet = extractContentSnippet(body, 'zzzzzz', ['zzzzzz'])
      expect(snippet.length).toBeGreaterThan(0)
    })
  })

  describe('scoreSnippet', () => {
    it('returns 0 for empty query', () => {
      expect(scoreSnippet({ title: 'test' }, '')).toBe(0)
    })

    it('scores exact title match highest', () => {
      const snippet = { title: 'Exact Match', code: '' }
      const score = scoreSnippet(snippet, 'exact match')
      expect(score).toBeGreaterThanOrEqual(120)
    })

    it('scores title prefix match', () => {
      const snippet = { title: 'Hello World', code: '' }
      const score = scoreSnippet(snippet, 'hello')
      expect(score).toBeGreaterThanOrEqual(90)
    })

    it('gives keyword bonus for tokens in title', () => {
      const snippet = { title: 'JavaScript Guide', code: '' }
      const score = scoreSnippet(snippet, 'guide javascript')
      expect(score).toBeGreaterThanOrEqual(25)
    })

    it('scores body content matches', () => {
      const snippet = { title: 'Note', code: 'This is about javascript programming' }
      const score = scoreSnippet(snippet, 'javascript')
      expect(score).toBeGreaterThan(0)
    })

    it('applies recency bonus for recent snippets', () => {
      const recent = { title: 'Recent', code: '', timestamp: Date.now() }
      const old = { title: 'Old', code: '', timestamp: Date.now() - 86400000 * 30 }

      const recentScore = scoreSnippet(recent, 'test')
      const oldScore = scoreSnippet(old, 'test')

      expect(recentScore).toBeGreaterThan(oldScore)
    })

    it('applies frequency bonus', () => {
      const snippet = { title: 'Note', code: 'keyword '.repeat(5) }
      const score = scoreSnippet(snippet, 'keyword')
      expect(score).toBeGreaterThan(0)
    })

    it('uses content field when code is not present', () => {
      const snippet = { title: 'Note', content: 'test content' }
      const score = scoreSnippet(snippet, 'test')
      expect(score).toBeGreaterThan(0)
    })
  })

  describe('rankSnippets', () => {
    const snippets = [
      { id: '1', title: 'JavaScript Guide', code: 'Learn javascript programming', tags: 'js' },
      { id: '2', title: 'Python Tutorial', code: 'Learn python programming', tags: 'python' },
      { id: '3', title: 'React Notes', code: 'React component design patterns', tags: 'react' }
    ]

    it('returns all snippets for empty query', () => {
      const { results } = rankSnippets(snippets, '')
      expect(results).toEqual(snippets)
    })

    it('filters and ranks by relevance', () => {
      const { results } = rankSnippets(snippets, 'javascript')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].id).toBe('1')
    })

    it('attaches matchType and matchSnippet to results', () => {
      const { results } = rankSnippets(snippets, 'javascript')
      const match = results.find((r) => r.id === '1')
      expect(match).toHaveProperty('matchType')
      expect(match).toHaveProperty('matchSnippet')
      expect(match).toHaveProperty('score')
    })

    it('returns matchMetaMap', () => {
      const { matchMetaMap } = rankSnippets(snippets, 'javascript')
      expect(matchMetaMap.get('1')).toBeDefined()
      expect(matchMetaMap.get('1')).toHaveProperty('matchType')
      expect(matchMetaMap.get('1')).toHaveProperty('score')
    })

    it('handles empty snippets array', () => {
      const { results } = rankSnippets([], 'test')
      expect(results).toEqual([])
    })

    it('handles fuse index gracefully when not provided', () => {
      const { results } = rankSnippets(snippets, 'xyz')
      expect(results).toEqual([])
    })
  })
})
