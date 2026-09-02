import { describe, it, expect } from 'vitest'
import { extractSortKey, naturalCompare, sortTableRows } from '../../../../../src/renderer/src/features/table/tableSort'

describe('tableSort.js', () => {
  describe('extractSortKey', () => {
    it('strips markdown formatting, wikilinks, links, and HTML tags', () => {
      expect(extractSortKey('**Bold Text**')).toBe('Bold Text')
      expect(extractSortKey('[Google](https://google.com)')).toBe('Google')
      expect(extractSortKey('[[My Note]]')).toBe('My Note')
      expect(extractSortKey('<code>Code</code>')).toBe('Code')
      expect(extractSortKey('  *Italic*  ')).toBe('Italic')
    })
  })

  describe('naturalCompare', () => {
    it('sorts numbers naturally (1, 2, 10)', () => {
      expect(naturalCompare('10', '2', 'asc')).toBeGreaterThan(0)
      expect(naturalCompare('2', '10', 'asc')).toBeLessThan(0)
      expect(naturalCompare('10', '2', 'desc')).toBeLessThan(0)
    })

    it('sorts currencies and percentages properly', () => {
      expect(naturalCompare('$120.50', '$45.00', 'asc')).toBeGreaterThan(0)
      expect(naturalCompare('15%', '85%', 'asc')).toBeLessThan(0)
    })

    it('handles empty values by sinking them to the bottom', () => {
      expect(naturalCompare('', 'Alpha', 'asc')).toBeGreaterThan(0)
      expect(naturalCompare('Beta', '', 'asc')).toBeLessThan(0)
      expect(naturalCompare('', '', 'asc')).toBe(0)
    })
  })

  describe('sortTableRows', () => {
    it('sorts 2D row array by specific column index ascending and descending', () => {
      const rows = [
        ['Charlie', '30'],
        ['Alice', '100'],
        ['Bob', '5']
      ]

      // Sort by Name (Col 0) Ascending
      const byNameAsc = sortTableRows(rows, 0, 'asc')
      expect(byNameAsc[0][0]).toBe('Alice')
      expect(byNameAsc[1][0]).toBe('Bob')
      expect(byNameAsc[2][0]).toBe('Charlie')

      // Sort by Value (Col 1) Ascending (Natural numeric)
      const byValAsc = sortTableRows(rows, 1, 'asc')
      expect(byValAsc[0][1]).toBe('5')
      expect(byValAsc[1][1]).toBe('30')
      expect(byValAsc[2][1]).toBe('100')

      // Sort by Value (Col 1) Descending
      const byValDesc = sortTableRows(rows, 1, 'desc')
      expect(byValDesc[0][1]).toBe('100')
      expect(byValDesc[1][1]).toBe('30')
      expect(byValDesc[2][1]).toBe('5')
    })
  })
})
