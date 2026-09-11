import { describe, it, expect } from 'vitest'
import {
  normalizePath,
  isRootPath,
  getFolderPath,
  getChildFolders,
  getChildNotes,
  extractHeadings,
  findActiveHeading,
  createUntitledSnippet
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

  describe('extractHeadings', () => {
    it('extracts Markdown headings while ignoring code blocks', () => {
      const md = `# Title\nSome text\n\`\`\`\n# Code comment\n\`\`\`\n## Subheading\n### Deep section`
      const headings = extractHeadings(md)
      expect(headings).toEqual([
        { level: 1, text: 'Title', line: 1 },
        { level: 2, text: 'Subheading', line: 6 },
        { level: 3, text: 'Deep section', line: 7 }
      ])
    })

    it('returns empty array when code is empty or has no headings', () => {
      expect(extractHeadings('')).toEqual([])
      expect(extractHeadings('Just plain text')).toEqual([])
    })
  })

  describe('findActiveHeading', () => {
    const headings = [
      { level: 1, text: 'Title', line: 1 },
      { level: 2, text: 'Installation', line: 10 },
      { level: 2, text: 'Usage', line: 25 }
    ]

    it('returns heading matching cursor line range', () => {
      expect(findActiveHeading(headings, 5)?.text).toBe('Title')
      expect(findActiveHeading(headings, 10)?.text).toBe('Installation')
      expect(findActiveHeading(headings, 18)?.text).toBe('Installation')
      expect(findActiveHeading(headings, 30)?.text).toBe('Usage')
    })
  })

  describe('createUntitledSnippet', () => {
    it('creates untitled snippet avoiding title collisions', () => {
      const existing = [{ id: 's1', title: 'Untitled' }, { id: 's2', title: 'Untitled 1' }]
      const snippet = createUntitledSnippet('docs', existing)
      expect(snippet.title).toBe('Untitled 2')
      expect(snippet.fileName).toBe('Untitled 2.md')
      expect(snippet.folderId).toBe('docs')
      expect(snippet.id).toBeDefined()
    })
  })
})
