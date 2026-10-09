import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExplorerSelection } from '../../../../../src/renderer/src/features/Explorer/hooks/ExplorerSelection'
import { useExplorerDnd } from '../../../../../src/renderer/src/features/Explorer/hooks/ExplorerDnd'
import { isSnippetActive } from '../../../../../src/renderer/src/features/Explorer/utils/explorerSelectionHelper'
import { useWorkspaceStore } from '../../../../../src/renderer/src/core/store/workspaceStore'

describe('Explorer Selection and Drag-and-Drop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({
      notes: [],
      selectedNote: null,
      selectedFolder: null,
      activeTabId: null
    })
  })

  const mockFlatTree: any[] = [
    { type: 'folder', id: 'FolderA', depth: 0 },
    { type: 'file', snippet: { id: 'note-1', title: 'Note 1', folderId: 'FolderA' }, depth: 1 },
    { type: 'file', snippet: { id: 'note-2', title: 'Note 2', folderId: 'FolderA' }, depth: 1 },
    { type: 'folder', id: 'FolderB', depth: 0 },
    { type: 'file', snippet: { id: 'note-3', title: 'Note 3', folderId: 'FolderB' }, depth: 1 },
    { type: 'file', snippet: { id: 'note-4', title: 'Note 4', folderId: 'FolderB' }, depth: 1 }
  ]

  describe('Windows-Style Multi-Selection', () => {
    it('normal click selects the clicked item and clears previous selections', () => {
      const { result } = renderHook(() =>
        useExplorerSelection({
          isOpen: true,
          modalRef: { current: null },
          virtuosoRef: { current: null },
          flatTree: mockFlatTree,
          query: '',
          selectedSnippetId: null
        })
      )

      // Click note-1
      act(() => {
        result.current.handleNoteClick(mockFlatTree[1].snippet, 1)
      })

      expect(result.current.selectedNoteIds.has('note-1')).toBe(true)
      expect(result.current.selectedNoteIds.size).toBe(1)
      expect(result.current.selectedFolderIds.size).toBe(0)

      // Click note-2 normally (should clear note-1 and select note-2)
      act(() => {
        result.current.handleNoteClick(mockFlatTree[2].snippet, 2)
      })

      expect(result.current.selectedNoteIds.has('note-2')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-1')).toBe(false)
      expect(result.current.selectedNoteIds.size).toBe(1)

      // Click folder FolderA normally (should clear note-2 and select FolderA)
      act(() => {
        result.current.handleFolderClick('FolderA', 0)
      })

      expect(result.current.selectedFolderIds.has('FolderA')).toBe(true)
      expect(result.current.selectedFolderIds.size).toBe(1)
      expect(result.current.selectedNoteIds.size).toBe(0)
    })

    it('Ctrl + click toggles individual items and preserves other selected items', () => {
      const { result } = renderHook(() =>
        useExplorerSelection({
          isOpen: true,
          modalRef: { current: null },
          virtuosoRef: { current: null },
          flatTree: mockFlatTree,
          query: '',
          selectedSnippetId: null
        })
      )

      const ctrlEvent = { ctrlKey: true } as any

      // Normal click note-1
      act(() => {
        result.current.handleNoteClick(mockFlatTree[1].snippet, 1)
      })

      // Ctrl+click note-3
      act(() => {
        result.current.handleNoteClick(mockFlatTree[4].snippet, 4, ctrlEvent)
      })

      expect(result.current.selectedNoteIds.has('note-1')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-3')).toBe(true)
      expect(result.current.selectedNoteIds.size).toBe(2)

      // Ctrl+click FolderB
      act(() => {
        result.current.handleFolderClick('FolderB', 3, ctrlEvent)
      })

      expect(result.current.selectedNoteIds.has('note-1')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-3')).toBe(true)
      expect(result.current.selectedFolderIds.has('FolderB')).toBe(true)

      // Ctrl+click note-1 again (deselects note-1, keeps note-3 and FolderB)
      act(() => {
        result.current.handleNoteClick(mockFlatTree[1].snippet, 1, ctrlEvent)
      })

      expect(result.current.selectedNoteIds.has('note-1')).toBe(false)
      expect(result.current.selectedNoteIds.has('note-3')).toBe(true)
      expect(result.current.selectedFolderIds.has('FolderB')).toBe(true)
    })

    it('Shift + click selects continuous range of mixed items (notes and folders)', () => {
      const { result } = renderHook(() =>
        useExplorerSelection({
          isOpen: true,
          modalRef: { current: null },
          virtuosoRef: { current: null },
          flatTree: mockFlatTree,
          query: '',
          selectedSnippetId: null
        })
      )

      // 1. Normal click note-1 (index 1) -> anchor set to note-1
      act(() => {
        result.current.handleNoteClick(mockFlatTree[1].snippet, 1)
      })

      // 2. Shift+click note-3 (index 4) -> range [1, 4] includes note-1, note-2, FolderB, note-3
      act(() => {
        result.current.handleNoteClick(mockFlatTree[4].snippet, 4, { shiftKey: true } as any)
      })

      expect(result.current.selectedNoteIds.has('note-1')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-2')).toBe(true)
      expect(result.current.selectedFolderIds.has('FolderB')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-3')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-4')).toBe(false)

      // 3. Backward Shift+click: start from note-3, shift click FolderA (index 0)
      // Normal click note-3 to set new anchor
      act(() => {
        result.current.handleNoteClick(mockFlatTree[4].snippet, 4)
      })
      // Shift click FolderA
      act(() => {
        result.current.handleFolderClick('FolderA', 0, { shiftKey: true } as any)
      })

      expect(result.current.selectedFolderIds.has('FolderA')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-1')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-2')).toBe(true)
      expect(result.current.selectedFolderIds.has('FolderB')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-3')).toBe(true)
    })

    it('Shift + click maintains a stable anchor when endpoint changes', () => {
      const { result } = renderHook(() =>
        useExplorerSelection({
          isOpen: true,
          modalRef: { current: null },
          virtuosoRef: { current: null },
          flatTree: mockFlatTree,
          query: '',
          selectedSnippetId: null
        })
      )

      // Normal click note-1 (index 1) -> anchor is note-1
      act(() => {
        result.current.handleNoteClick(mockFlatTree[1].snippet, 1)
      })

      // Shift+click note-3 (index 4)
      act(() => {
        result.current.handleNoteClick(mockFlatTree[4].snippet, 4, { shiftKey: true } as any)
      })
      expect(result.current.selectedNoteIds.has('note-3')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-4')).toBe(false)

      // Now Shift+click note-4 (index 5) — anchor must still be note-1, expanding range to note-4
      act(() => {
        result.current.handleNoteClick(mockFlatTree[5].snippet, 5, { shiftKey: true } as any)
      })
      expect(result.current.selectedNoteIds.has('note-1')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-2')).toBe(true)
      expect(result.current.selectedFolderIds.has('FolderB')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-3')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-4')).toBe(true)

      // Now Shift+click note-2 (index 2) — anchor still note-1, contracting range to [1, 2]
      act(() => {
        result.current.handleNoteClick(mockFlatTree[2].snippet, 2, { shiftKey: true } as any)
      })
      expect(result.current.selectedNoteIds.has('note-1')).toBe(true)
      expect(result.current.selectedNoteIds.has('note-2')).toBe(true)
      expect(result.current.selectedFolderIds.has('FolderB')).toBe(false)
      expect(result.current.selectedNoteIds.has('note-3')).toBe(false)
      expect(result.current.selectedNoteIds.has('note-4')).toBe(false)
    })
  })

  describe('isSnippetActive Authoritative Highlight Resolution', () => {
    it('does not double-highlight when activeSnippetId differs from selectedNoteIds', () => {
      // note-1 is active tab in workspace, but note-2 is selected in explorer
      const isNote1Active = isSnippetActive({
        snippetId: 'note-1',
        activeSnippetId: 'note-1',
        selectedNoteIds: new Set(['note-2']),
        selectedFolderIds: new Set()
      })
      const isNote2Active = isSnippetActive({
        snippetId: 'note-2',
        activeSnippetId: 'note-1',
        selectedNoteIds: new Set(['note-2']),
        selectedFolderIds: new Set()
      })

      // ONLY note-2 should be active, NOT note-1!
      expect(isNote1Active).toBe(false)
      expect(isNote2Active).toBe(true)
    })

    it('does not highlight notes when a folder is selected', () => {
      const isNoteActive = isSnippetActive({
        snippetId: 'note-1',
        activeSnippetId: 'note-1',
        selectedNoteIds: new Set(),
        selectedFolderIds: new Set(['FolderA'])
      })
      expect(isNoteActive).toBe(false)
    })

    it('does not highlight notes when sidebarFocus is root', () => {
      const isNoteActive = isSnippetActive({
        snippetId: 'note-1',
        activeSnippetId: 'note-1',
        selectedNoteIds: new Set(),
        selectedFolderIds: new Set(),
        sidebarFocus: 'root'
      })
      expect(isNoteActive).toBe(false)
    })

    it('falls back to activeSnippetId when there is no explicit explorer selection', () => {
      const isNoteActive = isSnippetActive({
        snippetId: 'note-1',
        activeSnippetId: 'note-1',
        selectedNoteIds: new Set(),
        selectedFolderIds: new Set()
      })
      expect(isNoteActive).toBe(true)
    })
  })

  describe('Drag and Drop Selection Integration', () => {
    it('dragging an unselected item deselects previous items and drags only that item', () => {
      const setSelectedNoteIds = vi.fn()
      const setSelectedFolderIds = vi.fn()
      const setSidebarFocus = vi.fn()

      const allSnippets = [
        { id: 'note-1', title: 'Note 1' },
        { id: 'note-2', title: 'Note 2' }
      ]

      const { result } = renderHook(() =>
        useExplorerDnd({
          allSnippets,
          flatTree: mockFlatTree,
          selectedNoteIds: new Set(['note-1']), // note-1 is currently selected
          setSelectedNoteIds,
          selectedFolderIds: new Set(),
          setSelectedFolderIds,
          setSidebarFocus,
          clearSelection: vi.fn(),
          saveSnippet: vi.fn(),
          loadWorkspace: vi.fn(),
          setExpandedFolders: vi.fn()
        })
      )

      // User starts dragging unselected note-2
      act(() => {
        result.current.handleListDragStart({
          active: { id: 'note-2', data: { current: {} } }
        } as any)
      })

      // Selection must be updated to only note-2
      expect(setSelectedNoteIds).toHaveBeenCalledWith(new Set(['note-2']))
      expect(setSelectedFolderIds).toHaveBeenCalledWith(new Set())
      expect(setSidebarFocus).toHaveBeenCalledWith('note')
      expect(result.current.activeListDragItem?.draggedSnippetIds).toEqual(['note-2'])
      expect(result.current.activeListDragItem?.count).toBe(1)
    })

    it('dragging an already-selected item with multi-selection drags the entire group', () => {
      const allSnippets = [
        { id: 'note-1', title: 'Note 1' },
        { id: 'note-2', title: 'Note 2' }
      ]

      const { result } = renderHook(() =>
        useExplorerDnd({
          allSnippets,
          flatTree: mockFlatTree,
          selectedNoteIds: new Set(['note-1', 'note-2']),
          setSelectedNoteIds: vi.fn(),
          selectedFolderIds: new Set(),
          setSelectedFolderIds: vi.fn(),
          setSidebarFocus: vi.fn(),
          clearSelection: vi.fn(),
          saveSnippet: vi.fn(),
          loadWorkspace: vi.fn(),
          setExpandedFolders: vi.fn()
        })
      )

      // User drags note-1 (part of the multi-selection)
      act(() => {
        result.current.handleListDragStart({
          active: { id: 'note-1', data: { current: {} } }
        } as any)
      })

      expect(result.current.activeListDragItem?.draggedSnippetIds).toEqual(['note-1', 'note-2'])
      expect(result.current.activeListDragItem?.count).toBe(2)
    })

    it('clears selection after a successful drop', async () => {
      const setSelectedNoteIds = vi.fn()
      const clearSelection = vi.fn()
      const saveSnippet = vi.fn().mockResolvedValue(undefined)
      const loadWorkspace = vi.fn().mockResolvedValue(undefined)

      const allSnippets = [
        { id: 'note-1', title: 'Note 1', folderId: 'FolderA' }
      ]

      const { result } = renderHook(() =>
        useExplorerDnd({
          allSnippets,
          flatTree: mockFlatTree,
          selectedNoteIds: new Set(['note-1']),
          setSelectedNoteIds,
          selectedFolderIds: new Set(),
          setSelectedFolderIds: vi.fn(),
          setSidebarFocus: vi.fn(),
          clearSelection,
          saveSnippet,
          loadWorkspace,
          setExpandedFolders: vi.fn()
        })
      )

      // Start dragging note-1
      act(() => {
        result.current.handleListDragStart({
          active: { id: 'note-1', data: { current: {} } }
        } as any)
      })

      // Drop note-1 into FolderB
      await act(async () => {
        await result.current.handleListDragEnd({
          active: { id: 'note-1' },
          over: { id: 'folder-FolderB' }
        } as any)
      })

      // Selection must be cleared after successful drop!
      expect(clearSelection).toHaveBeenCalled()
    })

    it('does NOT clear selection when a drop is cancelled or dropped onto invalid target', async () => {
      const clearSelection = vi.fn()

      const allSnippets = [
        { id: 'note-1', title: 'Note 1', folderId: 'FolderA' }
      ]

      const { result } = renderHook(() =>
        useExplorerDnd({
          allSnippets,
          flatTree: mockFlatTree,
          selectedNoteIds: new Set(['note-1']),
          setSelectedNoteIds: vi.fn(),
          selectedFolderIds: new Set(),
          setSelectedFolderIds: vi.fn(),
          setSidebarFocus: vi.fn(),
          clearSelection,
          saveSnippet: vi.fn(),
          loadWorkspace: vi.fn(),
          setExpandedFolders: vi.fn()
        })
      )

      // Start drag
      act(() => {
        result.current.handleListDragStart({
          active: { id: 'note-1', data: { current: {} } }
        } as any)
      })

      // Cancel drop (over is null)
      await act(async () => {
        await result.current.handleListDragEnd({
          active: { id: 'note-1' },
          over: null
        } as any)
      })

      // Must NOT clear selection on cancelled drag!
      expect(clearSelection).not.toHaveBeenCalled()
    })
  })
})
