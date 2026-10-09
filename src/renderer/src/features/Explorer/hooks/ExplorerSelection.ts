import { useState, useRef, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { beginExplorerPerf, countExplorerPerfRender, markExplorerPerf } from '../utils/explorerPerf'

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
  countExplorerPerfRender('ExplorerSelection')
  const setSelectedSnippet = useWorkspaceStore((state) => state.setSelectedNote)
  const setSelectedFolder = useWorkspaceStore((state) => state.setSelectedFolder)

  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set())
  const [lastClickedNoteId, setLastClickedNoteId] = useState<string | null>(null)
  const [lastClickedFolder, setLastClickedFolder] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [sidebarFocus, setSidebarFocus] = useState<SidebarFocus>(null)

  // Anchor item ID for Shift+Click range selections (stable across tree collapse/expand)
  const [anchorId, setAnchorId] = useState<string | null>(selectedSnippetId || null)

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
    setAnchorId(null)
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
    const handleOutsideInteraction = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      // Don't clear selection if interacting with explorer popups, dialogs, context menus, or prompts
      if (
        target.closest?.(
          '[role="menu"], [role="dialog"], [data-radix-popper-content-wrapper], .context-menu, [data-state="open"], .confirm-modal-overlay, .dropdown-menu'
        )
      ) {
        return
      }

      if (modalRef.current && !modalRef.current.contains(target)) {
        setSidebarFocus(null)
        setSelectedNoteIds((prev) => {
          if (prev.size > 1) {
            return selectedSnippetId ? new Set([selectedSnippetId]) : new Set()
          }
          return prev
        })
        setSelectedFolderIds(new Set())
      }
    }

    document.addEventListener('pointerdown', handleOutsideInteraction, true)
    document.addEventListener('focusin', handleOutsideInteraction, true)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction, true)
      document.removeEventListener('focusin', handleOutsideInteraction, true)
    }
  }, [modalRef, selectedSnippetId])

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
        setAnchorId(null)
      }
      return
    }

    setSelectedNoteIds(new Set([selectedSnippetId]))
    setSelectedFolderIds(new Set())
    setLastClickedNoteId(selectedSnippetId)
    setAnchorId(selectedSnippetId)
    setSidebarFocus('note')
  }, [selectedSnippetId, query])

  const prevQueryRef = useRef(query)

  // ─── Query/search active-item tracking ────────────────────────────────────
  useEffect(() => {
    const prevQ = prevQueryRef.current
    prevQueryRef.current = query

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
        setAnchorId(targetItem.snippet.id)
      } else if (targetItem?.type === 'folder' && targetItem.id) {
        setSelectedFolderIds(new Set([targetItem.id]))
        setLastClickedFolder(targetItem.id)
        setAnchorId(targetItem.id)
        setSidebarFocus('folder')
      }
    } else if (prevQ.trim() && !query.trim()) {
      // User just cleared active search: restore selection to selectedSnippetId
      if (selectedSnippetId && flatTree.length > 0) {
        const idx = flatTree.findIndex(
          (item) => item.type === 'file' && item.snippet?.id === selectedSnippetId
        )
        setSelectedIndex(idx)
        setSelectedNoteIds(new Set([selectedSnippetId]))
        setAnchorId(selectedSnippetId)
        setSidebarFocus('note')
      } else {
        setSelectedIndex(-1)
        setSelectedNoteIds(new Set())
        setAnchorId(null)
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
    }
  }, [selectedSnippetId, flatTree, virtuosoRef])

  const selectItemAtIndex = useCallback(
    (index: number) => {
      if (index < 0 || !flatTree || index >= flatTree.length) return
      setSelectedIndex(index)
      const item = flatTree[index]
      if (item?.type === 'file' && item.snippet) {
        setSelectedNoteIds(new Set([item.snippet.id]))
        setSelectedFolderIds(new Set())
        setLastClickedNoteId(item.snippet.id)
        setAnchorId(item.snippet.id)
        setSidebarFocus('note')
      } else if (item?.type === 'folder' && item.id) {
        setSelectedFolderIds(new Set([item.id]))
        setSelectedNoteIds(new Set())
        setLastClickedFolder(item.id)
        setAnchorId(item.id)
        setSidebarFocus('folder')
      }
    },
    [flatTree]
  )

  const handleSelect = useCallback(
    (snippet: Snippet) => {
      if (!snippet) return
      markExplorerPerf('tab-open-start', { noteId: snippet.id })
      clickedInExplorerRef.current = Date.now()
      // Mark that this selection came from an explorer click — effect will skip scrollToIndex
      skipNextScrollRef.current = true
      lastScrolledSnippetRef.current = snippet.id
      setLastClickedFolder(null)
      setSelectedFolder(null)
      setSelectedNoteIds(new Set([snippet.id]))
      setSelectedFolderIds(new Set())
      setLastClickedNoteId(snippet.id)
      setAnchorId(snippet.id)
      setSidebarFocus('note')
      const storeMutationStartedAt = performance.now()
      markExplorerPerf('workspace-store-mutation-start', { noteId: snippet.id })
      setSelectedSnippet(snippet)
      markExplorerPerf('tab-open-state-mutated', {
        noteId: snippet.id,
        synchronousDurationMs: Number((performance.now() - storeMutationStartedAt).toFixed(2))
      })
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

      let itemIndex = typeof index === 'number' && index >= 0 && index < (flatTree?.length || 0) && flatTree[index]?.snippet?.id === snippet.id
        ? index
        : -1
      if (itemIndex === -1 && flatTree) {
        itemIndex = flatTree.findIndex((i) => i.type === 'file' && i.snippet?.id === snippet.id)
      }

      if (isShift && flatTree && flatTree.length > 0) {
        // Fallback to lastClickedNoteId or active selected note if anchorId isn't set yet
        const effectiveAnchorId = anchorId || lastClickedNoteId || selectedSnippetId

        let anchorPos = -1
        if (effectiveAnchorId) {
          anchorPos = flatTree.findIndex((item) =>
            item.type === 'file' ? item.snippet?.id === effectiveAnchorId : item.id === effectiveAnchorId
          )
        }

        // If previous anchor is not visible in current flatTree (e.g. was inside a collapsed folder)
        // or no anchor existed, current item becomes the anchor and is single-selected
        if (anchorPos === -1 || itemIndex === -1) {
          setAnchorId(snippet.id)
          setSelectedNoteIds(new Set([snippet.id]))
          setSelectedFolderIds(new Set())
          setLastClickedNoteId(snippet.id)
          setSelectedIndex(itemIndex)
          setSidebarFocus('note')
          return
        }

        const minIdx = Math.min(anchorPos, itemIndex)
        const maxIdx = Math.max(anchorPos, itemIndex)

        const rangeNotes = new Set<string>()
        const rangeFolders = new Set<string>()

        // Collect all visible selectable items (both files and folders) in this continuous range
        for (let i = minIdx; i <= maxIdx; i++) {
          const item = flatTree[i]
          if (item?.type === 'file' && item.snippet?.id) {
            rangeNotes.add(item.snippet.id)
          } else if (item?.type === 'folder' && item.id) {
            rangeFolders.add(item.id)
          }
        }
        rangeNotes.add(snippet.id)

        setSelectedNoteIds(rangeNotes)
        setSelectedFolderIds(rangeFolders)
        setLastClickedNoteId(snippet.id)
        setSelectedIndex(itemIndex)
        setSidebarFocus('multi')
        // Retain anchorId so subsequent Shift+Clicks expand/contract from the original anchor
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
        setAnchorId(snippet.id)
        setLastClickedNoteId(snippet.id)
        setSelectedIndex(itemIndex)
        setSidebarFocus('multi')
        setLastClickedFolder(snippet.folderId || '')
      } else {
        setAnchorId(snippet.id)
        setSelectedIndex(itemIndex)
        // handleSelect owns the single-selection state and workspace activation.
        beginExplorerPerf('note', snippet.id)
        handleSelect(snippet)
      }
    },
    [flatTree, anchorId, lastClickedNoteId, selectedSnippetId, handleSelect, setSelectedFolder]
  )

  const handleFolderClick = useCallback(
    (folderId: string, index: number | React.SyntheticEvent, e?: React.MouseEvent) => {
      if (!folderId) return

      const event = e || (typeof index === 'object' && (index as any)?.target ? (index as React.MouseEvent) : null)
      const isCtrl = (event as React.MouseEvent)?.ctrlKey || (event as React.MouseEvent)?.metaKey
      const isShift = (event as React.MouseEvent)?.shiftKey

      let itemIndex = typeof index === 'number' && index >= 0 && index < (flatTree?.length || 0) && flatTree[index]?.id === folderId
        ? index
        : -1
      if (itemIndex === -1 && flatTree) {
        itemIndex = flatTree.findIndex((i) => i.type === 'folder' && i.id === folderId)
      }

      if (isShift && flatTree && flatTree.length > 0) {
        const effectiveAnchorId = anchorId || lastClickedFolder || lastClickedNoteId || selectedSnippetId

        let anchorPos = -1
        if (effectiveAnchorId) {
          anchorPos = flatTree.findIndex((item) =>
            item.type === 'folder' ? item.id === effectiveAnchorId : item.snippet?.id === effectiveAnchorId
          )
        }

        if (anchorPos === -1 || itemIndex === -1) {
          setAnchorId(folderId)
          setSelectedFolderIds(new Set([folderId]))
          setSelectedNoteIds(new Set())
          setLastClickedFolder(folderId)
          setSelectedIndex(itemIndex)
          setSidebarFocus('folder')
          return
        }

        const minIdx = Math.min(anchorPos, itemIndex)
        const maxIdx = Math.max(anchorPos, itemIndex)

        const rangeNotes = new Set<string>()
        const rangeFolders = new Set<string>()

        for (let i = minIdx; i <= maxIdx; i++) {
          const item = flatTree[i]
          if (item?.type === 'file' && item.snippet) {
            rangeNotes.add(item.snippet.id)
          } else if (item?.type === 'folder' && item.id) {
            rangeFolders.add(item.id)
          }
        }
        rangeFolders.add(folderId)

        setSelectedNoteIds(rangeNotes)
        setSelectedFolderIds(rangeFolders)
        setLastClickedFolder(folderId)
        setSelectedIndex(itemIndex)
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
        setAnchorId(folderId)
        setLastClickedFolder(folderId)
        setSelectedIndex(itemIndex)
        setSidebarFocus('multi')
      } else {
        setSelectedFolderIds(new Set([folderId]))
        setSelectedNoteIds(new Set())
        setAnchorId(folderId)
        setLastClickedFolder(folderId)
        setSelectedIndex(itemIndex)
        setSidebarFocus('folder')
        setSelectedFolder(folderId)
      }
    },
    [flatTree, anchorId, lastClickedFolder, lastClickedNoteId, selectedSnippetId, setSelectedFolder]
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
