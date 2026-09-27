import { useState, useRef, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'

interface Snippet {
  id: string
  folderId?: string
  title?: string
  [key: string]: unknown
}

interface FlatTreeItem {
  type: 'file' | 'folder' | 'input' | 'root-drop'
  id?: string
  snippet?: Snippet
  depth?: number
  [key: string]: unknown
}

interface UseExplorerSelectionParams {
  isOpen: boolean
  modalRef: React.RefObject<HTMLElement | null>
  virtuosoRef: React.RefObject<any>
  flatTree: FlatTreeItem[]
  query: string
  selectedSnippetId: string | null
  onClose?: () => void
  onRequestBulkDelete?: () => void
}

type SidebarFocus = 'note' | 'folder' | 'multi' | 'root' | null

interface ExplorerSelectionResult {
  selectedNoteIds: Set<string>
  setSelectedNoteIds: React.Dispatch<React.SetStateAction<Set<string>>>
  selectedFolderIds: Set<string>
  setSelectedFolderIds: React.Dispatch<React.SetStateAction<Set<string>>>
  lastClickedNoteId: string | null
  setLastClickedNoteId: React.Dispatch<React.SetStateAction<string | null>>
  lastClickedFolder: string | null
  setLastClickedFolder: React.Dispatch<React.SetStateAction<string | null>>
  selectedIndex: number
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>
  sidebarFocus: SidebarFocus
  setSidebarFocus: React.Dispatch<React.SetStateAction<SidebarFocus>>
  selectAll: () => void
  clearSelection: () => void
  selectItemAtIndex: (index: number) => void
  handleSelect: (snippet: Snippet) => void
  handleNoteClick: (snippet: Snippet, index: number | React.SyntheticEvent, e?: React.MouseEvent) => void
  handleFolderClick: (folderId: string, index: number | React.SyntheticEvent, e?: React.MouseEvent) => void
  handleBackgroundClick: (e: React.MouseEvent) => void
}

export function useExplorerSelection({
  isOpen,
  modalRef,
  virtuosoRef,
  flatTree,
  query,
  selectedSnippetId,
  onClose,
  onRequestBulkDelete
}: UseExplorerSelectionParams): ExplorerSelectionResult {
  const setSelectedSnippet = useWorkspaceStore((state) => state.setSelectedNote)
  const setSelectedFolder = useWorkspaceStore((state) => state.setSelectedFolder)

  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set())
  const [lastClickedNoteId, setLastClickedNoteId] = useState<string | null>(null)
  const [lastClickedFolder, setLastClickedFolder] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [sidebarFocus, setSidebarFocus] = useState<SidebarFocus>(null)

  const clickedInExplorerRef = useRef(0)
  const lastScrolledSnippetRef = useRef<string | null>(null)
  // When set to true, the next scrollToIndex call is skipped (user clicked from
  // inside the explorer — no need to scroll, they can already see what they clicked).
  const skipNextScrollRef = useRef(false)

  useEffect(() => {
    setSidebarFocus(null)
  }, [isOpen])

  const selectAll = useCallback(() => {
    if (!flatTree || flatTree.length === 0) return

    const noteIds = new Set<string>()
    const folderIds = new Set<string>()

    flatTree.forEach((item) => {
      if (item.type === 'file' && item.snippet) {
        noteIds.add(item.snippet.id)
      } else if (item.type === 'folder' && item.id) {
        folderIds.add(item.id)
      }
    })

    setSelectedNoteIds(noteIds)
    setSelectedFolderIds(folderIds)
    setSidebarFocus('multi')
  }, [flatTree])

  const clearSelection = useCallback(() => {
    setSelectedNoteIds(new Set())
    setSelectedFolderIds(new Set())
    setLastClickedNoteId(null)
    setLastClickedFolder(null)
    setSelectedFolder(null)
    setSelectedIndex(-1)
    setSidebarFocus(null)
  }, [setSelectedFolder])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      const isInput =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable

      if (isInput) return

      if (e.key === 'Escape') {
        clearSelection()
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (isOpen || modalRef.current?.matches(':hover') || modalRef?.current?.contains(document.activeElement)) {
          e.preventDefault()
          selectAll()
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const isExplorerActive =
          modalRef?.current?.contains(document.activeElement) ||
          Boolean(modalRef.current?.matches(':hover'))
        if (isExplorerActive && (selectedNoteIds.size > 0 || selectedFolderIds.size > 0 || sidebarFocus === 'folder')) {
          e.preventDefault()
          onRequestBulkDelete?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, modalRef, selectAll, clearSelection, selectedNoteIds, selectedFolderIds, sidebarFocus, onRequestBulkDelete])

  useEffect(() => {
    const handleDocumentPointerDown = (e: PointerEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setSidebarFocus(null)
      }
    }
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }, [modalRef])

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        !target.closest('.tree-item') &&
        !target.closest('.folder-tree-main') &&
        !target.closest('.header-actions') &&
        !target.closest('.sort-toggle-btn') &&
        !target.closest('.inline-create-input') &&
        !target.closest('.inline-rename-input') &&
        !target.closest('.start-menu-search') &&
        !target.closest('.explorer-segmented-tabs') &&
        !target.closest('.start-section-header') &&
        !target.closest('.explorer-header-container')
      ) {
        clearSelection()
        setSidebarFocus('root')
      }
    },
    [clearSelection]
  )

  // ─── Selection sync from external store (tab switching) ──────────────────────
  // When the active tab changes externally (user clicks TabBar), sync the
  // highlighted note in the explorer WITHOUT scrolling the list.
  // Only called when selectedSnippetId changes — NOT when flatTree changes.
  useEffect(() => {
    if (!selectedSnippetId) {
      if (!query.trim()) {
        setSelectedNoteIds(new Set())
        setSelectedIndex(-1)
      }
      return
    }

    setSelectedNoteIds((prev) => {
      // Don't replace a multi-selection with a single item
      if (prev.size <= 1) return new Set([selectedSnippetId])
      return prev
    })
    setSelectedFolderIds(new Set())
    setLastClickedNoteId(selectedSnippetId)
    setSidebarFocus('note')
  }, [selectedSnippetId, query])

  // ─── Query/search active-item tracking ────────────────────────────────────
  useEffect(() => {
    if (query.trim() && flatTree.length > 0) {
      const q = query.toLowerCase().trim()
      let bestIndex = flatTree.findIndex(
        (item) => item.type === 'file' && (item.snippet?.title || '').toLowerCase() === q
      )
      if (bestIndex === -1) {
        bestIndex = flatTree.findIndex((item) => item.type === 'file')
      }
      if (bestIndex === -1) bestIndex = 0

      setSelectedIndex(bestIndex)
      setSidebarFocus('note')

      const targetItem = flatTree[bestIndex]
      if (targetItem?.type === 'file' && targetItem.snippet) {
        setSelectedNoteIds(new Set([targetItem.snippet.id]))
        setLastClickedNoteId(targetItem.snippet.id)
      } else if (targetItem?.type === 'folder' && targetItem.id) {
        setSelectedFolderIds(new Set([targetItem.id]))
        setLastClickedFolder(targetItem.id)
        setSidebarFocus('folder')
      }
    } else if (!query.trim()) {
      if (selectedSnippetId && flatTree.length > 0) {
        const idx = flatTree.findIndex(
          (item) => item.type === 'file' && item.snippet?.id === selectedSnippetId
        )
        setSelectedIndex(idx)
        setSelectedNoteIds(new Set([selectedSnippetId]))
        setSidebarFocus('note')
      } else {
        setSelectedIndex(-1)
        setSelectedNoteIds(new Set())
      }
    }
  }, [query, flatTree, selectedSnippetId])

  // ─── Auto-scroll to active note in the Virtuoso list ──────────────────────
  // KEY FIX: We only scroll when the selection change came from OUTSIDE the
  // explorer (e.g. tab switch, keyboard shortcut, backlink click).
  // When the user clicks a note INSIDE the explorer, skipNextScrollRef is set
  // synchronously in handleSelect (before this effect runs), so we skip the
  // scroll and leave the list exactly where it is.
  //
  // This mirrors VS Code behavior: the file explorer never auto-scrolls when
  // switching tabs. Use "Reveal in Explorer" (or we expose scrollToActive) if
  // you want to jump to the active file.
  useEffect(() => {
    if (!selectedSnippetId || !flatTree || flatTree.length === 0) return

    const idx = flatTree.findIndex(
      (item) => item.type === 'file' && item.snippet && item.snippet.id === selectedSnippetId
    )

    if (idx !== -1) {
      // Only update selectedIndex if it actually changed (avoids cascading re-renders)
      setSelectedIndex((prev) => (prev === idx ? prev : idx))

      if (lastScrolledSnippetRef.current !== selectedSnippetId) {
        lastScrolledSnippetRef.current = selectedSnippetId

        // skipNextScrollRef is set synchronously by handleSelect when the user
        // clicks a note in the explorer — no time-race, 100% reliable.
        if (!skipNextScrollRef.current) {
          virtuosoRef.current?.scrollToIndex({ index: idx, align: 'nearest' })
        }
        skipNextScrollRef.current = false
      }
    }
  }, [selectedSnippetId, flatTree, virtuosoRef])

  const [anchorIndex, setAnchorIndex] = useState<number | null>(null)

  const selectItemAtIndex = useCallback(
    (index: number) => {
      if (index < 0 || !flatTree || index >= flatTree.length) return
      setSelectedIndex(index)
      const item = flatTree[index]
      if (item?.type === 'file' && item.snippet) {
        setSelectedNoteIds(new Set([item.snippet.id]))
        setSelectedFolderIds(new Set())
        setLastClickedNoteId(item.snippet.id)
        setSidebarFocus('note')
      } else if (item?.type === 'folder' && item.id) {
        setSelectedFolderIds(new Set([item.id]))
        setSelectedNoteIds(new Set())
        setLastClickedFolder(item.id)
        setSidebarFocus('folder')
      }
    },
    [flatTree]
  )

  const handleSelect = useCallback(
    (snippet: Snippet) => {
      if (!snippet) return
      clickedInExplorerRef.current = Date.now()
      // Mark that this selection came from an explorer click — effect will skip scrollToIndex
      skipNextScrollRef.current = true
      lastScrolledSnippetRef.current = snippet.id
      setLastClickedFolder(snippet.folderId || '')
      setSelectedFolder(null)
      setSelectedNoteIds(new Set([snippet.id]))
      setSelectedFolderIds(new Set())
      setLastClickedNoteId(snippet.id)
      setSidebarFocus('note')
      setSelectedSnippet(snippet)
      onClose?.()
    },
    [setSelectedSnippet, setSelectedFolder, onClose]
  )

  const handleNoteClick = useCallback(
    (snippet: Snippet, index: number | React.SyntheticEvent, e?: React.MouseEvent) => {
      if (!snippet) return
      setSelectedFolder(null)

      const event = e || (typeof index === 'object' && (index as any)?.target ? (index as React.MouseEvent) : null)
      const isCtrl = (event as React.MouseEvent)?.ctrlKey || (event as React.MouseEvent)?.metaKey
      const isShift = (event as React.MouseEvent)?.shiftKey

      let itemIndex = typeof index === 'number' ? index : -1
      if (itemIndex === -1 && flatTree) {
        itemIndex = flatTree.findIndex((i) => i.type === 'file' && i.snippet?.id === snippet.id)
      }

      if (isShift && anchorIndex !== null && flatTree && flatTree.length > 0) {
        const minIdx = Math.min(anchorIndex, itemIndex)
        const maxIdx = Math.max(anchorIndex, itemIndex)

        const rangeNotes = new Set<string>()
        const rangeFolders = new Set<string>()

        for (let i = minIdx; i <= maxIdx; i++) {
          const item = flatTree[i]
          if (item.type === 'file' && item.snippet) {
            rangeNotes.add(item.snippet.id)
          } else if (item.type === 'folder' && item.id) {
            rangeFolders.add(item.id)
          }
        }

        setSelectedNoteIds(rangeNotes)
        setSelectedFolderIds(rangeFolders)
        setSidebarFocus('multi')
      } else if (isCtrl) {
        setSelectedNoteIds((prev) => {
          const next = new Set(prev)
          if (next.has(snippet.id)) {
            next.delete(snippet.id)
          } else {
            next.add(snippet.id)
          }
          return next
        })
        setAnchorIndex(itemIndex)
        setLastClickedNoteId(snippet.id)
        setSidebarFocus('multi')
        setLastClickedFolder(snippet.folderId || '')
      } else {
        setSelectedNoteIds(new Set([snippet.id]))
        setSelectedFolderIds(new Set())
        setAnchorIndex(itemIndex)
        setLastClickedNoteId(snippet.id)
        setSidebarFocus('note')
        setLastClickedFolder(snippet.folderId || '')
        handleSelect(snippet)
      }
    },
    [flatTree, anchorIndex, handleSelect, setSelectedFolder]
  )

  const handleFolderClick = useCallback(
    (folderId: string, index: number | React.SyntheticEvent, e?: React.MouseEvent) => {
      if (!folderId) return

      const event = e || (typeof index === 'object' && (index as any)?.target ? (index as React.MouseEvent) : null)
      const isCtrl = (event as React.MouseEvent)?.ctrlKey || (event as React.MouseEvent)?.metaKey
      const isShift = (event as React.MouseEvent)?.shiftKey

      let itemIndex = typeof index === 'number' ? index : -1
      if (itemIndex === -1 && flatTree) {
        itemIndex = flatTree.findIndex((i) => i.type === 'folder' && i.id === folderId)
      }

      if (isShift && anchorIndex !== null && flatTree && flatTree.length > 0) {
        const minIdx = Math.min(anchorIndex, itemIndex)
        const maxIdx = Math.max(anchorIndex, itemIndex)

        const rangeNotes = new Set<string>()
        const rangeFolders = new Set<string>()

        flatTree.slice(minIdx, maxIdx + 1).forEach((item) => {
          if (item.type === 'file' && item.snippet) {
            rangeNotes.add(item.snippet.id)
          } else if (item.type === 'folder' && item.id) {
            rangeFolders.add(item.id)
          }
        })

        setSelectedNoteIds(rangeNotes)
        setSelectedFolderIds(rangeFolders)
        setSidebarFocus('multi')
      } else if (isCtrl) {
        setSelectedFolderIds((prev) => {
          const next = new Set(prev)
          if (next.has(folderId)) {
            next.delete(folderId)
          } else {
            next.add(folderId)
          }
          return next
        })
        setAnchorIndex(itemIndex)
        setSidebarFocus('multi')
        setLastClickedFolder(folderId)
      } else {
        setSelectedFolderIds(new Set([folderId]))
        setSelectedNoteIds(new Set())
        setAnchorIndex(itemIndex)
        setSidebarFocus('folder')
        setLastClickedFolder(folderId)
        setSelectedFolder(folderId)
      }
    },
    [flatTree, anchorIndex, setSelectedFolder]
  )

  return {
    selectedNoteIds,
    setSelectedNoteIds,
    selectedFolderIds,
    setSelectedFolderIds,
    lastClickedNoteId,
    setLastClickedNoteId,
    lastClickedFolder,
    setLastClickedFolder,
    selectedIndex,
    setSelectedIndex,
    sidebarFocus,
    setSidebarFocus,
    selectAll,
    clearSelection,
    selectItemAtIndex,
    handleSelect,
    handleNoteClick,
    handleFolderClick,
    handleBackgroundClick
  }
}
