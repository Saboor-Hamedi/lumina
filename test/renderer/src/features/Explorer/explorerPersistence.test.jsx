import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExplorerOperations } from '../../../../../src/renderer/src/features/Explorer/hooks/ExplorerOperations'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'
import SettingsManager from '../../../../../src/main/settings'

describe('Explorer and Sidebar Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('initializes expandedFolders from localStorage and persists toggles synchronously to localStorage', () => {
    localStorage.setItem('lumina-expanded-folders', JSON.stringify(['Work', 'Personal']))

    const { result, unmount } = renderHook(() =>
      useExplorerOperations({
        snippets: [],
        visibleFolders: ['Work', 'Personal'],
        selectedSnippetId: null,
        query: '',
        flatTree: null,
        virtuosoRef: { current: null },
        setSidebarFocus: vi.fn(),
        handleSelect: vi.fn(),
        lastClickedFolder: null
      })
    )

    // Should load initial folders from localStorage
    expect(result.current.expandedFolders.has('Work')).toBe(true)
    expect(result.current.expandedFolders.has('Personal')).toBe(true)

    // Collapse 'Work'
    act(() => {
      result.current.toggleFolder('Work')
    })

    // Must be synchronously saved in localStorage immediately (not delayed by 350ms)
    expect(result.current.expandedFolders.has('Work')).toBe(false)
    const saved = JSON.parse(localStorage.getItem('lumina-expanded-folders'))
    expect(saved).not.toContain('Work')
    expect(saved).toContain('Personal')

    unmount()
  })

  it('flushes pending updates on beforeunload / unmount immediately', () => {
    const { result, unmount } = renderHook(() =>
      useExplorerOperations({
        snippets: [],
        visibleFolders: ['Archive'],
        selectedSnippetId: null,
        query: '',
        flatTree: null,
        virtuosoRef: { current: null },
        setSidebarFocus: vi.fn(),
        handleSelect: vi.fn(),
        lastClickedFolder: null
      })
    )

    act(() => {
      result.current.setExpandedFolders(new Set(['Archive']))
    })

    // Trigger unmount
    unmount()

    const saved = JSON.parse(localStorage.getItem('lumina-expanded-folders'))
    expect(saved).toEqual(['Archive'])
  })

  it('does NOT forcefully uncollapse parent folders of active note on startup session restoration', () => {
    // User collapsed 'Work' before closing the app
    localStorage.setItem('lumina-expanded-folders', JSON.stringify([]))

    const activeNote = {
      id: 'note-1',
      title: 'My Note',
      folderId: 'Work'
    }

    const { result, rerender } = renderHook(
      ({ selectedId }) =>
        useExplorerOperations({
          snippets: [activeNote],
          visibleFolders: ['Work'],
          selectedSnippetId: selectedId,
          query: '',
          flatTree: null,
          virtuosoRef: { current: null },
          setSidebarFocus: vi.fn(),
          handleSelect: vi.fn(),
          lastClickedFolder: null
        }),
      {
        initialProps: { selectedId: null }
      }
    )

    // Simulate session restoration setting the active note
    rerender({ selectedId: 'note-1' })

    // The folder 'Work' should remain collapsed because it is initial restoration!
    expect(result.current.expandedFolders.has('Work')).toBe(false)

    // When the user explicitly navigates to a different note in a different folder during session
    const note2 = {
      id: 'note-2',
      title: 'Second Note',
      folderId: 'Personal'
    }

    const { result: navResult, rerender: navRerender } = renderHook(
      ({ selectedId, snippetsList }) =>
        useExplorerOperations({
          snippets: snippetsList,
          visibleFolders: ['Work', 'Personal'],
          selectedSnippetId: selectedId,
          query: '',
          flatTree: null,
          virtuosoRef: { current: null },
          setSidebarFocus: vi.fn(),
          handleSelect: vi.fn(),
          lastClickedFolder: null
        }),
      {
        initialProps: { selectedId: 'note-1', snippetsList: [activeNote, note2] }
      }
    )

    // Initial note-1 mount leaves folders as-is
    expect(navResult.current.expandedFolders.has('Personal')).toBe(false)

    // User switches to note-2
    act(() => {
      navRerender({ selectedId: 'note-2', snippetsList: [activeNote, note2] })
    })

    // Now smart reveal can open 'Personal'
    expect(navResult.current.expandedFolders.has('Personal')).toBe(true)
  })

  it('SettingsManager flush immediately commits saves', async () => {
    SettingsManager.saveTimeout = setTimeout(() => {}, 10000)
    SettingsManager.save = vi.fn().mockResolvedValue(true)

    await SettingsManager.flush()

    expect(SettingsManager.saveTimeout).toBeNull()
    expect(SettingsManager.save).toHaveBeenCalled()
  })
})
