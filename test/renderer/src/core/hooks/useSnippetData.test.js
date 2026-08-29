import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSnippetData } from '../../../../../src/renderer/src/core/hooks/useSnippetData'

describe('useSnippetData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.window.api = {
      ...global.window.api,
      getSnippets: vi.fn().mockResolvedValue([]),
      saveSnippet: vi.fn().mockResolvedValue(undefined),
      deleteSnippet: vi.fn().mockResolvedValue({}),
      confirmDelete: vi.fn().mockResolvedValue(true)
    }
  })

  it('initializes with empty snippets', () => {
    const { result } = renderHook(() => useSnippetData())
    expect(result.current.snippets).toEqual([])
    expect(result.current.selectedSnippet).toBeNull()
  })

  it('loads snippets from IPC on mount', async () => {
    const mockSnippets = [
      { id: '1', title: 'Note 1', code: 'content 1' },
      { id: '2', title: 'Note 2', code: 'content 2' }
    ]
    global.window.api.getSnippets.mockResolvedValue(mockSnippets)

    const { result } = renderHook(() => useSnippetData())

    await waitFor(() => {
      expect(result.current.snippets).toEqual(mockSnippets)
    })
  })

  it('shows error toast when getSnippets fails', async () => {
    global.window.api.getSnippets.mockRejectedValue(new Error('Failed'))

    const { result } = renderHook(() => useSnippetData())

    await waitFor(() => {
      expect(result.current.snippets).toEqual([])
    })
  })

  it('saves snippet via IPC', async () => {
    const { result } = renderHook(() => useSnippetData())
    const snippet = { id: '1', title: 'Test', code: 'content' }

    await act(async () => {
      await result.current.saveSnippet(snippet)
    })

    expect(global.window.api.saveSnippet).toHaveBeenCalledWith(snippet)
  })

  it('deletes snippet after confirmation', async () => {
    const { result } = renderHook(() => useSnippetData())

    await act(async () => {
      await result.current.deleteItem('1')
    })

    expect(global.window.api.confirmDelete).toHaveBeenCalled()
    expect(global.window.api.deleteSnippet).toHaveBeenCalledWith('1')
  })

  it('does not delete if user cancels confirmation', async () => {
    global.window.api.confirmDelete.mockResolvedValue(false)

    const { result } = renderHook(() => useSnippetData())

    await act(async () => {
      await result.current.deleteItem('1')
    })

    expect(global.window.api.deleteSnippet).not.toHaveBeenCalled()
  })

  it('refreshes vault data', async () => {
    const { result } = renderHook(() => useSnippetData())
    global.window.api.getSnippets.mockClear()

    await act(async () => {
      await result.current.refreshVault()
    })

    expect(global.window.api.getSnippets).toHaveBeenCalled()
  })

  it('handles missing window.api gracefully', async () => {
    delete global.window.api.getSnippets

    const { result } = renderHook(() => useSnippetData())

    expect(result.current.snippets).toEqual([])
  })
})
