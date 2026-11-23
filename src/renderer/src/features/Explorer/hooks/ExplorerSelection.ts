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
  handleNoteClick: (
    snippet: Snippet,
    index: number | React.SyntheticEvent,
    e?: React.MouseEvent
  ) => void
  handleFolderClick: (
    folderId: string,
    index: number | React.SyntheticEvent,
    e?: React.MouseEvent
  ) => void
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

  // Anchor item ID for Shift+Click range selections (stable across tree collapse/expand).
  // Only ever set by explicit user clicks in the explorer — never seeded from the
  // externally-active note, otherwise Shift+Click would range from the open tab and
  // appear to "select everything".
  const [anchorId, setAnchorId] = useState<string | null>(null)

  const anchorIdRef = useRef<string | null>(anchorId)
  anchorIdRef.current = anchorId
  const lastClickedNoteIdRef = useRef<string | null>(lastClickedNoteId)
  lastClickedNoteIdRef.current = lastClickedNoteId
  const lastClickedFolderRef = useRef<string | null>(lastClickedFolder)
  lastClickedFolderRef.current = lastClickedFolder
  const flatTreeRef = useRef(flatTree)
  flatTreeRef.current = flatTree

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
        const hasSelection =
          selectedNoteIds.size > 0 || selectedFolderIds.size > 0 || sidebarFocus !== null
        const isExplorerActive =
          isOpen ||
          Boolean(modalRef.current?.matches(':hover')) ||
          Boolean(modalRef?.current?.contains(document.activeElement))
        if (hasSelection && isExplorerActive) {
          e.preventDefault()
          e.stopPropagation()
          clearSelection()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (
          isOpen ||
          modalRef.current?.matches(':hover') ||
          modalRef?.current?.contains(document.activeElement)
        ) {
          e.preventDefault()
          selectAll()
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasMultiSelection = selectedNoteIds.size + selectedFolderIds.size > 1
        const isExplorerActive =
          modalRef?.current?.contains(document.activeElement) ||
          Boolean(modalRef.current?.matches(':hover')) ||
          (isOpen && hasMultiSelection)
        if (
          isExplorerActive &&
          (selectedNoteIds.size > 0 || selectedFolderIds.size > 0 || sidebarFocus === 'folder')
        ) {
          e.preventDefault()
          onRequestBulkDelete?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isOpen,
    modalRef,
    selectAll,
    clearSelection,
    selectedNoteIds,
    selectedFolderIds,
    sidebarFocus,
    onRequestBulkDelete
  ])

  useEffect(() => {
    const handleSelectNoteInExplorer = (e: Event) => {
      const noteId = (e as CustomEvent).detail?.noteId
      if (!noteId) return
      // Mirror the activation state of a note click so folder/blocking state clears
      setSelectedFolderIds(new Set())
      setSelectedFolder(null)
      setSelectedNoteIds(new Set([noteId]))
      setLastClickedFolder(null)
      setLastClickedNoteId(noteId)
      setAnchorId(noteId)
      setSidebarFocus('note')
    }
    window.addEventListener('select-note-in-explorer', handleSelectNoteInExplorer)
    return () => window.removeEventListener('select-note-in-explorer', handleSelectNoteInExplorer)
  }, [setSelectedFolder])

  useEffect(() => {
    const handleOutsideInteraction = (e: Event) => {
      const target = e.target as HTMLElement | null

      // While a sidebar resizer is being dragged, never mutate selection state —
      // the drag gesture is not a click; the pointer may pass over explorer items.
      if (document.body.classList.contains('is-global-resizing')) {
        return
      }

      if (!target) return

      // Don't clear selection if interacting with explorer popups, dialogs, context menus, or prompts
      if (
        target.closest?.(
          '[role="menu"], [role="dialog"], [data-radix-popper-content-wrapper], .context-menu, [data-state="open"], .confirm-modal-overlay, .confirm-overlay, .confirm-modal, .modal-overlay, .modal-container, .dropdown-menu, .modal-backdrop'
        )
      ) {
        return
      }

      // Never clear selection if any confirmation modal or dialog is currently open in the DOM
      if (
        document.querySelector(
          '.confirm-overlay, .confirm-modal, .confirm-modal-overlay, [role="dialog"][aria-modal="true"]'
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
        !target.closest('.explorer-action-btn') &&
        !target.closest('.inline-create-input') &&
        !target.closest('.inline-rename-input') &&
        !target.closest('.start-menu-search') &&
        !target.closest('.explorer-segmented-tabs') &&
        !target.closest('.start-section-header') &&
        !target.closest('.explorer-header-container') &&
        !target.closest('.context-menu') &&
        !target.closest('[role="menu"]') &&
        !target.closest('[role="dialog"]') &&
        !target.closest('.modal-overlay') &&
        !target.closest('.modal-content')
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

    // Only update the highlight. Do NOT touch the range anchor here: an external
    // tab switch must not move the Shift+Click anchor to the open note.
    setSelectedNoteIds(new Set([selectedSnippetId]))
    setSelectedFolderIds(new Set())
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
      lastClickedNoteIdRef.current = snippet.id
      setLastClickedNoteId(snippet.id)
      anchorIdRef.current = snippet.id
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

      const event =
        e ||
        (typeof index === 'object' && (index as any)?.target ? (index as React.MouseEvent) : null)
      const isCtrl = (event as React.MouseEvent)?.ctrlKey || (event as React.MouseEvent)?.metaKey
      const isShift = (event as React.MouseEvent)?.shiftKey

      const currentFlatTree = flatTreeRef.current
      let itemIndex =
        typeof index === 'number' &&
        index >= 0 &&
        index < (currentFlatTree?.length || 0) &&
        currentFlatTree[index]?.snippet?.id === snippet.id
          ? index
          : -1
      if (itemIndex === -1 && currentFlatTree) {
        itemIndex = currentFlatTree.findIndex((i) => i.type === 'file' && i.snippet?.id === snippet.id)
      }

      if (isShift && currentFlatTree && currentFlatTree.length > 0) {
        // Only use an anchor that came from an explicit explorer click. The active
        // note (selectedSnippetId) is intentionally NOT used as a fallback so a
        // Shift+Click never spans from an unrelated open tab.
        const effectiveAnchorId = anchorIdRef.current || lastClickedNoteIdRef.current

        let anchorPos = -1
        if (effectiveAnchorId) {
          anchorPos = currentFlatTree.findIndex((item) =>
            item.type === 'file'
              ? item.snippet?.id === effectiveAnchorId
              : item.id === effectiveAnchorId
          )
        }

        // If previous anchor is not visible in current flatTree (e.g. was inside a collapsed folder)
        // or no anchor existed, current item becomes the anchor and is single-selected
        if (anchorPos === -1 || itemIndex === -1) {
          anchorIdRef.current = snippet.id
          setAnchorId(snippet.id)
          setSelectedNoteIds(new Set([snippet.id]))
          setSelectedFolderIds(new Set())
          lastClickedNoteIdRef.current = snippet.id
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
          const item = currentFlatTree[i]
          if (item?.type === 'file' && item.snippet?.id) {
            rangeNotes.add(item.snippet.id)
          } else if (item?.type === 'folder' && item.id) {
            rangeFolders.add(item.id)
          }
        }
        rangeNotes.add(snippet.id)

        setSelectedNoteIds(rangeNotes)
        setSelectedFolderIds(rangeFolders)
        lastClickedNoteIdRef.current = snippet.id
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
        anchorIdRef.current = snippet.id
        setAnchorId(snippet.id)
        lastClickedNoteIdRef.current = snippet.id
        setLastClickedNoteId(snippet.id)
        setSelectedIndex(itemIndex)
        setSidebarFocus('multi')
        lastClickedFolderRef.current = snippet.folderId || ''
        setLastClickedFolder(snippet.folderId || '')
      } else {
        anchorIdRef.current = snippet.id
        setAnchorId(snippet.id)
        setSelectedIndex(itemIndex)
        // handleSelect owns the single-selection state and workspace activation.
        beginExplorerPerf('note', snippet.id)
        handleSelect(snippet)
      }
    },
    [handleSelect, setSelectedFolder]
  )

  const handleFolderClick = useCallback(
    (folderId: string, index: number | React.SyntheticEvent, e?: React.MouseEvent) => {
      if (!folderId) return

      const event =
        e ||
        (typeof index === 'object' && (index as any)?.target ? (index as React.MouseEvent) : null)
      const isCtrl = (event as React.MouseEvent)?.ctrlKey || (event as React.MouseEvent)?.metaKey
      const isShift = (event as React.MouseEvent)?.shiftKey

      const currentFlatTree = flatTreeRef.current
      let itemIndex =
        typeof index === 'number' &&
        index >= 0 &&
        index < (currentFlatTree?.length || 0) &&
        currentFlatTree[index]?.id === folderId
          ? index
          : -1
      if (itemIndex === -1 && currentFlatTree) {
        itemIndex = currentFlatTree.findIndex((i) => i.type === 'folder' && i.id === folderId)
      }

      if (isShift && currentFlatTree && currentFlatTree.length > 0) {
        const effectiveAnchorId =
          anchorIdRef.current || lastClickedFolderRef.current || lastClickedNoteIdRef.current

        let anchorPos = -1
        if (effectiveAnchorId) {
          anchorPos = currentFlatTree.findIndex((item) =>
            item.type === 'folder'
              ? item.id === effectiveAnchorId
              : item.snippet?.id === effectiveAnchorId
          )
        }

        if (anchorPos === -1 || itemIndex === -1) {
          anchorIdRef.current = folderId
          setAnchorId(folderId)
          setSelectedFolderIds(new Set([folderId]))
          setSelectedNoteIds(new Set())
          lastClickedFolderRef.current = folderId
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
          const item = currentFlatTree[i]
          if (item?.type === 'file' && item.snippet) {
            rangeNotes.add(item.snippet.id)
          } else if (item?.type === 'folder' && item.id) {
            rangeFolders.add(item.id)
          }
        }
        rangeFolders.add(folderId)

        setSelectedNoteIds(rangeNotes)
        setSelectedFolderIds(rangeFolders)
        lastClickedFolderRef.current = folderId
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
        anchorIdRef.current = folderId
        setAnchorId(folderId)
        lastClickedFolderRef.current = folderId
        setLastClickedFolder(folderId)
        setSelectedIndex(itemIndex)
        setSidebarFocus('multi')
      } else {
        setSelectedFolderIds(new Set([folderId]))
        setSelectedNoteIds(new Set())
        anchorIdRef.current = folderId
        setAnchorId(folderId)
        lastClickedFolderRef.current = folderId
        setLastClickedFolder(folderId)
        setSelectedIndex(itemIndex)
        setSidebarFocus('folder')
        setSelectedFolder(folderId)
      }
    },
    [setSelectedFolder]
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
