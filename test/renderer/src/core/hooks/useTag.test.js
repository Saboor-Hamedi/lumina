import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTag } from '../../../../../src/renderer/src/core/hooks/useTag'
import { useWorkspaceStore } from '../../../../../src/renderer/src/core/store/workspaceStore'

describe('useTag', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ notes: [] })
  })

  it('returns empty tags array when no snippets', () => {
    const { result } = renderHook(() => useTag())
    expect(result.current.tags).toEqual([])
  })

  it('extracts tags from snippet frontmatter', () => {
    useWorkspaceStore.setState({
      notes: [{ id: '1', title: 'Test', code: '', tags: 'javascript, react' }]
    })

    const { result } = renderHook(() => useTag())
    expect(result.current.tags).toContain('#javascript')
    expect(result.current.tags).toContain('#react')
  })

  it('handles tags that already start with #', () => {
    useWorkspaceStore.setState({
      notes: [{ id: '1', title: 'Test', code: '', tags: '#javascript, #react' }]
    })

    const { result } = renderHook(() => useTag())
    expect(result.current.tags).toContain('#javascript')
    expect(result.current.tags).toContain('#react')
  })

  it('extracts inline tags from markdown body', () => {
    useWorkspaceStore.setState({
      notes: [{ id: '1', title: 'Test', code: 'This is about #javascript and #react' }]
    })

    const { result } = renderHook(() => useTag())
    expect(result.current.tags).toContain('#javascript')
    expect(result.current.tags).toContain('#react')
  })

  it('ignores tags inside code blocks', () => {
    useWorkspaceStore.setState({
      notes: [
        {
          id: '1',
          title: 'Test',
          code: '```\n#this-is-code\n```\nOutside #realtag'
        }
      ]
    })

    const { result } = renderHook(() => useTag())
    expect(result.current.tags).not.toContain('#this-is-code')
    expect(result.current.tags).toContain('#realtag')
  })

  it('deduplicates tags across snippets', () => {
    useWorkspaceStore.setState({
      notes: [
        { id: '1', title: 'Note 1', code: '#javascript', tags: '' },
        { id: '2', title: 'Note 2', code: '#javascript', tags: '' }
      ]
    })

    const { result } = renderHook(() => useTag())
    const jsTags = result.current.tags.filter((t) => t === '#javascript')
    expect(jsTags).toHaveLength(1)
  })

  it('sorts tags alphabetically', () => {
    useWorkspaceStore.setState({
      notes: [{ id: '1', title: 'Test', code: '#zebra #alpha #beta' }]
    })

    const { result } = renderHook(() => useTag())
    expect(result.current.tags).toEqual(['#alpha', '#beta', '#zebra'])
  })

  it('handles tags as array in frontmatter', () => {
    useWorkspaceStore.setState({
      notes: [{ id: '1', title: 'Test', code: '', tags: ['tag1', 'tag2'] }]
    })

    const { result } = renderHook(() => useTag())
    expect(result.current.tags).toContain('#tag1')
    expect(result.current.tags).toContain('#tag2')
  })

  it('filters out empty tags', () => {
    useWorkspaceStore.setState({
      notes: [{ id: '1', title: 'Test', code: '', tags: 'tag1, , tag2,' }]
    })

    const { result } = renderHook(() => useTag())
    expect(result.current.tags).toContain('#tag1')
    expect(result.current.tags).toContain('#tag2')
  })
})
