import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFolderContextMenu } from '../../../../../../src/renderer/src/features/Explorer/hooks/FolderMenu'

const baseParams = (overrides: Record<string, unknown> = {}) => ({
  pinnedFolders: [],
  setExpandedFolders: vi.fn(),
  setCreating: vi.fn(),
  setCreatingValue: vi.fn(),
  setRenamingFolder: vi.fn(),
  setRenamingValue: vi.fn(),
  loadWorkspace: vi.fn().mockResolvedValue(undefined),
  ...overrides
})

const findDelete = (options: Array<{ label?: string }>) =>
  options.find((o) => typeof o.label === 'string' && o.label.startsWith('Delete')) as {
    label: string
    onClick: () => void
  }

describe('useFolderContextMenu multi-selection delete', () => {
  it('routes Delete to bulk delete when multiple items are selected', () => {
    const onRequestBulkDelete = vi.fn()
    const { result } = renderHook(() =>
      useFolderContextMenu(
        baseParams({
          selectedCount: 3,
          selectedNoteIds: new Set(['a', 'b', 'c']),
          selectedFolderIds: new Set(),
          onRequestBulkDelete
        }) as never
      )
    )

    act(() => result.current.handleFolderContextMenu('a', null))
    const del = findDelete(result.current.contextMenuOptions as Array<{ label?: string }>)
    expect(del.label).toBe('Delete 3 Items')

    act(() => del.onClick())
    expect(onRequestBulkDelete).toHaveBeenCalledTimes(1)
    expect(result.current.deleteConfirmFolder).toBeNull()
  })

  it('uses the single-item confirm when only one item is selected', () => {
    const onRequestBulkDelete = vi.fn()
    const { result } = renderHook(() =>
      useFolderContextMenu(
        baseParams({
          selectedCount: 1,
          selectedNoteIds: new Set(['a']),
          selectedFolderIds: new Set(),
          onRequestBulkDelete
        }) as never
      )
    )

    act(() => result.current.handleFolderContextMenu('a', null))
    const del = findDelete(result.current.contextMenuOptions as Array<{ label?: string }>)
    expect(del.label).toBe('Delete')

    act(() => del.onClick())
    expect(onRequestBulkDelete).not.toHaveBeenCalled()
    expect(result.current.deleteConfirmFolder).toBe('a')
  })

  it('routes Delete to bulk delete for a multi folder selection', () => {
    const onRequestBulkDelete = vi.fn()
    const { result } = renderHook(() =>
      useFolderContextMenu(
        baseParams({
          selectedCount: 2,
          selectedNoteIds: new Set(),
          selectedFolderIds: new Set(['docs', 'media']),
          onRequestBulkDelete
        }) as never
      )
    )

    act(() => result.current.handleFolderContextMenu('docs', null))
    const del = findDelete(result.current.contextMenuOptions as Array<{ label?: string }>)
    act(() => del.onClick())
    expect(onRequestBulkDelete).toHaveBeenCalledTimes(1)
  })
})
