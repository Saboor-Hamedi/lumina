import { describe, it, expect } from 'vitest'
import {
  normalizePath,
  isRootPath,
  getFolderPath,
  getChildFolders,
  getChildNotes
} from '../../../../../src/renderer/src/features/Breadcrumbs/breadcrumbUtils'

describe('breadcrumbUtils', () => {
  it('normalizes slashes and trimmed edges', () => {
    expect(normalizePath('///a\\b\\c///')).toBe('a/b/c')
    expect(normalizePath('')).toBe('')
    expect(normalizePath(null)).toBe('')
  })

  it('detects root paths accurately', () => {
    expect(isRootPath(null)).toBe(true)
    expect(isRootPath('')).toBe(true)
    expect(isRootPath('/')).toBe(true)
    expect(isRootPath('root')).toBe(true)
    expect(isRootPath('src')).toBe(false)
  })

  describe('getFolderPath', () => {
    it('returns empty array for root folder', () => {
      expect(getFolderPath(null)).toEqual([])
      expect(getFolderPath('')).toEqual([])
      expect(getFolderPath('/')).toEqual([])
    })

    it('splits string path into hierarchical segments', () => {
      const result = getFolderPath('src/features/Breadcrumbs')
      expect(result).toEqual([
        { id: 'src', name: 'src', parentId: null },
        { id: 'src/features', name: 'features', parentId: 'src' },
        { id: 'src/features/Breadcrumbs', name: 'Breadcrumbs', parentId: 'src/features' }
      ])
    })

    it('resolves object folder hierarchy using parentId', () => {
      const mockFolders = [
        { id: 'f1', name: 'src', parentId: null },
        { id: 'f2', name: 'components', parentId: 'f1' }
      ]
      const result = getFolderPath('f2', mockFolders)
      expect(result).toEqual([
        { id: 'f1', name: 'src', parentId: null },
        { id: 'f2', name: 'components', parentId: 'f1' }
      ])
    })
  })

  describe('getChildFolders', () => {
    it('extracts direct children from string folder list at root', () => {
      const folders = ['src/components', 'src/utils', 'docs/api', 'root_file_folder']
      const children = getChildFolders(null, folders)
      expect(children.map((c) => c.name)).toEqual(['docs', 'root_file_folder', 'src'])
    })

    it('extracts direct children of a nested folder', () => {
      const folders = ['src/components', 'src/utils', 'src/features/AI', 'docs']
      const children = getChildFolders('src', folders)
      expect(children.map((c) => c.name)).toEqual(['components', 'features', 'utils'])
    })

    it('handles object folders with parentId', () => {
      const folders = [
        { id: 'f1', name: 'src', parentId: null },
        { id: 'f2', name: 'components', parentId: 'f1' },
        { id: 'f3', name: 'docs', parentId: null }
      ]
      expect(getChildFolders(null, folders).map((c) => c.name)).toEqual(['docs', 'src'])
      expect(getChildFolders('f1', folders).map((c) => c.name)).toEqual(['components'])
    })
  })

  describe('getChildNotes', () => {
    const snippets = [
      { id: 's1', title: 'Root Note', folderId: null },
      { id: 's2', title: 'Src Note', folderId: 'src' },
      { id: 's3', title: 'Sub Note', folderId: 'src/features' }
    ]

    it('filters notes at root level', () => {
      const rootNotes = getChildNotes(null, snippets)
      expect(rootNotes.map((n) => n.id)).toEqual(['s1'])
    })

    it('filters notes in specific folder', () => {
      const srcNotes = getChildNotes('src', snippets)
      expect(srcNotes.map((n) => n.id)).toEqual(['s2'])
    })
  })
})
