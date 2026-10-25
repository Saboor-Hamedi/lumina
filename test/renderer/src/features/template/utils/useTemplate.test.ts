import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTemplate, BLANK_TEMPLATE } from '../../../../../../src/renderer/src/features/template/utils/useTemplate'
import { defaultTemplates } from '../../../../../../src/renderer/src/features/template/utils/defaultTemplates'

describe('useTemplate.ts', () => {
  it('initializes with defaultTemplates and prepend BLANK_TEMPLATE', () => {
    const { result } = renderHook(() => useTemplate())

    expect(result.current.allTemplates.length).toBe(defaultTemplates.length + 1)
    expect(result.current.allTemplates[0]).toEqual(BLANK_TEMPLATE)
    expect(result.current.selectedId).toBe('blank')
    expect(result.current.selectedTemplate).toEqual(BLANK_TEMPLATE)
  })

  it('uses custom templates when provided', () => {
    const customTemplates = [
      { id: 'custom-1', title: 'Custom 1.md', code: '# Custom 1' },
      { id: 'custom-2', title: 'Custom 2', code: '# Custom 2', description: 'Desc' }
    ]

    const { result } = renderHook(() =>
      useTemplate({
        templates: customTemplates
      })
    )

    // prepends blank
    expect(result.current.allTemplates.length).toBe(3)
    expect(result.current.allTemplates[0].id).toBe('blank')
    expect(result.current.allTemplates[1].title).toBe('Custom 1') // strips .md
    expect(result.current.allTemplates[2].description).toBe('Desc')
  })

  it('does not duplicate blank template if already present', () => {
    const customTemplates = [
      { id: 'blank', title: 'Blank Note', code: '' },
      { id: 'custom-1', title: 'Custom 1', code: '# Custom 1' }
    ]

    const { result } = renderHook(() =>
      useTemplate({
        templates: customTemplates
      })
    )

    expect(result.current.allTemplates.length).toBe(2)
    expect(result.current.allTemplates[0].id).toBe('blank')
  })

  it('filters templates by title or content code case-insensitively', () => {
    const customTemplates = [
      { id: 'meeting', title: 'Meeting Notes', code: 'Attendees: Alice, Bob' },
      { id: 'standup', title: 'Daily Standup', code: 'Yesterday, Today, Blockers' },
      { id: 'review', title: 'Code Review', code: 'Pull request review checklist' }
    ]

    const { result } = renderHook(() =>
      useTemplate({
        templates: customTemplates
      })
    )

    // Search by title
    act(() => {
      result.current.setSearchQuery('standup')
    })
    expect(result.current.filteredTemplates.length).toBe(1)
    expect(result.current.filteredTemplates[0].id).toBe('standup')

    // Search by code content
    act(() => {
      result.current.setSearchQuery('alice')
    })
    expect(result.current.filteredTemplates.length).toBe(1)
    expect(result.current.filteredTemplates[0].id).toBe('meeting')

    // Clear search
    act(() => {
      result.current.setSearchQuery('')
    })
    expect(result.current.filteredTemplates.length).toBe(4) // includes blank
  })

  it('automatically selects the first available template if current selectedId is filtered out', () => {
    const customTemplates = [
      { id: 't1', title: 'Alpha', code: '' },
      { id: 't2', title: 'Beta', code: '' }
    ]

    const { result } = renderHook(() =>
      useTemplate({
        templates: customTemplates
      })
    )

    act(() => {
      result.current.setSelectedId('t2')
    })
    expect(result.current.selectedId).toBe('t2')

    // Filter to only 'Alpha'
    act(() => {
      result.current.setSearchQuery('Alpha')
    })
    // t2 is filtered out, should auto-switch to 't1'
    expect(result.current.selectedId).toBe('t1')
    expect(result.current.selectedTemplate.id).toBe('t1')
  })

  it('calls onSelectTemplate and onClose when handleApply is invoked', () => {
    const onSelectTemplate = vi.fn()
    const onClose = vi.fn()

    const { result } = renderHook(() =>
      useTemplate({
        onSelectTemplate,
        onClose
      })
    )

    act(() => {
      result.current.handleApply()
    })

    expect(onSelectTemplate).toHaveBeenCalledWith(BLANK_TEMPLATE)
    expect(onClose).toHaveBeenCalled()
  })

  it('applies a specific template when passed to handleApply', () => {
    const onSelectTemplate = vi.fn()
    const onClose = vi.fn()

    const { result } = renderHook(() =>
      useTemplate({
        onSelectTemplate,
        onClose
      })
    )

    const specificTemplate = { id: 'spec', title: 'Specific', code: 'Code' }
    act(() => {
      result.current.handleApply(specificTemplate)
    })

    expect(onSelectTemplate).toHaveBeenCalledWith(specificTemplate)
    expect(onClose).toHaveBeenCalled()
  })
})
