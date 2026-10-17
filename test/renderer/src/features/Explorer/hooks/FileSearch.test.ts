import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFileSearch } from '../../../../../../src/renderer/src/features/Explorer/hooks/FileSearch'

const note = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  folderId: 'sqlite',
  ...extra
})

const titles = (result: { current: { allSnippets: Array<{ title?: string }> } }) =>
  result.current.allSnippets.map((s) => s.title)

describe('useFileSearch sorting', () => {
  it('sorts by name ascending with natural (numeric) ordering', () => {
    const notes = [note('c', '10 Backup'), note('a', '2 Installing'), note('b', '1 Introduction')]
    const { result } = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'name', sortDirection: 'asc' })
    )
    expect(titles(result)).toEqual(['1 Introduction', '2 Installing', '10 Backup'])
  })

  it('sorts numbered note titles 01..10 in order (default name sort)', () => {
    const ordered = [
      '01 Introduction Sqlite',
      '02 Installing Sqlite',
      '03 Sqlite Shell Commands',
      '04 Creating Tables Sqlite',
      '05 Inserting Updating Deleting Sqlite',
      '06 Querying Sqlite',
      '07 Joins Sqlite',
      '08 Indexes Sqlite',
      '09 Python Sqlite',
      '10 Backup and Limits Sqlite'
    ]
    const shuffled = [
      ordered[9],
      ordered[3],
      ordered[7],
      ordered[4],
      ordered[1],
      ordered[0],
      ordered[6],
      ordered[8],
      ordered[5],
      ordered[2]
    ]
    const notes = shuffled.map((title, i) => note(String(i), title))
    const { result } = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'name', sortDirection: 'asc' })
    )
    expect(titles(result)).toEqual(ordered)
  })

  it('sorts by name descending', () => {
    const notes = [note('a', 'Alpha'), note('b', 'Beta'), note('c', 'Gamma')]
    const { result } = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'name', sortDirection: 'desc' })
    )
    expect(titles(result)).toEqual(['Gamma', 'Beta', 'Alpha'])
  })

  it('sorts by modified (Recent: newest first)', () => {
    const notes = [
      note('a', 'Old', { timestamp: 1000 }),
      note('b', 'New', { timestamp: 3000 }),
      note('c', 'Mid', { timestamp: 2000 })
    ]
    const { result } = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'modified', sortDirection: 'desc' })
    )
    expect(titles(result)).toEqual(['New', 'Mid', 'Old'])
  })

  it('sorts by created (New: newest first / Old: oldest first)', () => {
    const notes = [
      note('a', 'A', { createdAt: '2024-01-01T00:00:00.000Z' }),
      note('b', 'B', { createdAt: '2024-03-01T00:00:00.000Z' }),
      note('c', 'C', { createdAt: '2024-02-01T00:00:00.000Z' })
    ]
    const newestFirst = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'created', sortDirection: 'desc' })
    )
    expect(titles(newestFirst.result)).toEqual(['B', 'C', 'A'])

    const oldestFirst = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'created', sortDirection: 'asc' })
    )
    expect(titles(oldestFirst.result)).toEqual(['A', 'C', 'B'])
  })

  it('honours a custom noteOrder', () => {
    const notes = [note('a', 'Alpha'), note('b', 'Beta'), note('c', 'Gamma')]
    const { result } = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'custom', noteOrder: ['c', 'a', 'b'] })
    )
    expect(titles(result)).toEqual(['Gamma', 'Alpha', 'Beta'])
  })

  it('falls back to name sort when custom order is empty', () => {
    const notes = [note('c', '10 Backup'), note('a', '2 Installing'), note('b', '1 Introduction')]
    const { result } = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'custom', noteOrder: [] })
    )
    expect(titles(result)).toEqual(['1 Introduction', '2 Installing', '10 Backup'])
  })

  it('does not crash when noteOrder is not an array', () => {
    const notes = [note('a', 'Beta'), note('b', 'Alpha')]
    const { result } = renderHook(() =>
      useFileSearch(notes, '', {
        sortBy: 'custom',
        noteOrder: 'a,b' as unknown as string[]
      })
    )
    expect(titles(result)).toEqual(['Alpha', 'Beta'])
  })

  it('defaults unknown sort modes to name', () => {
    const notes = [note('a', 'Beta'), note('b', 'Alpha')]
    const { result } = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'nonsense', sortDirection: 'asc' })
    )
    expect(titles(result)).toEqual(['Alpha', 'Beta'])
  })

  it('handles notes with missing titles without throwing', () => {
    const notes = [note('a', 'Zeta'), note('b', undefined as unknown as string), note('c', 'Alpha')]
    const { result } = renderHook(() =>
      useFileSearch(notes, '', { sortBy: 'name', sortDirection: 'asc' })
    )
    expect(titles(result)).toEqual([undefined, 'Alpha', 'Zeta'])
  })
})
