import { describe, it, expect } from 'vitest'
import { areNotePropsEqual } from '../../../../../src/renderer/src/features/Explorer/components/SortableListItem'

const baseSnippet = {
  id: 'note-1',
  title: 'Note',
  fileName: 'note.md',
  folderId: '',
  updatedAt: 1,
  isPinned: false,
  customIcon: null,
  color: null
}

describe('SortableListItem memo comparator', () => {
  it('re-renders when customIcon changes', () => {
    const prev = { snippet: { ...baseSnippet } }
    const next = { snippet: { ...baseSnippet, customIcon: 'Star' } }
    expect(areNotePropsEqual(prev, next)).toBe(false)
  })

  it('re-renders when color changes', () => {
    const prev = { snippet: { ...baseSnippet } }
    const next = { snippet: { ...baseSnippet, color: '#ff0000' } }
    expect(areNotePropsEqual(prev, next)).toBe(false)
  })

  it('skips re-render when nothing relevant changed', () => {
    const prev = { snippet: { ...baseSnippet }, isActive: false }
    const next = { snippet: { ...baseSnippet }, isActive: false }
    expect(areNotePropsEqual(prev, next)).toBe(true)
  })
})
