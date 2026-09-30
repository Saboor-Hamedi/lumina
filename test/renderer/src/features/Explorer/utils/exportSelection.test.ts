import { describe, it, expect } from 'vitest'
import {
  resolveExportNotes,
  resolveFolderExportNotes,
  notesInFolder,
  isHiddenFolder
} from '../../../../../../src/renderer/src/features/Explorer/utils/exportSelection'

const notes = [
  { id: 'a', title: 'A', code: '# A', folderId: 'Work' },
  { id: 'b', title: 'B', code: '# B', folderId: 'Work/Projects' },
  { id: 'c', title: 'C', code: '# C', folderId: 'Work/Projects/Deep' },
  { id: 'd', title: 'D', code: '# D', folderId: 'Personal' },
  { id: 'e', title: 'E', code: '# E' },
  { id: 't', title: 'Template', code: '# T', folderId: 'Templates/Daily' },
  { id: 's', title: 'System', code: '# S', folderId: '.lumina/cache' }
]

describe('exportSelection.isHiddenFolder', () => {
  it('flags internal/system folders', () => {
    expect(isHiddenFolder('Templates')).toBe(true)
    expect(isHiddenFolder('Templates/Daily')).toBe(true)
    expect(isHiddenFolder('.lumina')).toBe(true)
    expect(isHiddenFolder('.anything')).toBe(true)
    expect(isHiddenFolder('Work/Projects')).toBe(false)
    expect(isHiddenFolder(undefined)).toBe(false)
  })
})

describe('exportSelection.notesInFolder', () => {
  it('includes nested descendants but not unrelated folders', () => {
    const ids = notesInFolder(notes, 'Work').map((n) => n.id)
    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('returns empty for the root / empty folder id', () => {
    expect(notesInFolder(notes, '')).toEqual([])
  })
})

describe('exportSelection.resolveExportNotes', () => {
  it('collects directly selected notes across folders and root', () => {
    const result = resolveExportNotes({
      notes,
      selectedNoteIds: new Set(['a', 'd', 'e'])
    })
    expect(result.map((n) => n.id).sort()).toEqual(['a', 'd', 'e'])
  })

  it('expands a selected folder into its full subtree', () => {
    const result = resolveExportNotes({
      notes,
      selectedFolderIds: new Set(['Work'])
    })
    expect(result.map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('de-duplicates notes reachable directly and via a folder', () => {
    const result = resolveExportNotes({
      notes,
      selectedNoteIds: new Set(['a', 'b']),
      selectedFolderIds: new Set(['Work/Projects'])
    })
    expect(result.map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('never exports hidden/system notes', () => {
    const result = resolveExportNotes({
      notes,
      selectedNoteIds: new Set(['t', 's', 'a'])
    })
    expect(result.map((n) => n.id)).toEqual(['a'])
  })

  it('normalises title and content', () => {
    const result = resolveExportNotes({ notes: [{ id: 'x', code: 'body' }] , selectedNoteIds: new Set(['x']) })
    expect(result[0]).toEqual({ id: 'x', title: 'Untitled', content: 'body' })
  })

  it('returns an empty array for an empty selection', () => {
    expect(resolveExportNotes({ notes })).toEqual([])
  })
})

describe('exportSelection.resolveFolderExportNotes', () => {
  it('resolves a folder subtree for right-click export', () => {
    const result = resolveFolderExportNotes(notes, 'Work/Projects')
    expect(result.map((n) => n.id).sort()).toEqual(['b', 'c'])
  })

  it('returns empty for a folder with no notes', () => {
    expect(resolveFolderExportNotes(notes, 'Empty')).toEqual([])
  })

  it('preserves top-to-bottom order of notes in a folder (introduction first, install, docu)', () => {
    const docNotes = [
      { id: '1', title: 'introduction', code: '# Introduction', folderId: 'Docs' },
      { id: '2', title: 'install', code: '# Install', folderId: 'Docs' },
      { id: '3', title: 'docu', code: '# Docu', folderId: 'Docs' }
    ]
    const result = resolveFolderExportNotes(docNotes, 'Docs')
    expect(result.map((n) => n.title)).toEqual(['introduction', 'install', 'docu'])
  })
})
