import { useState, useRef, useEffect, useCallback } from 'react'
import { useVaultStore } from '../../../core/store/workspaceStore'

export function useExplorerSelection({
  isOpen,
  modalRef,
  virtuosoRef,
  flatTree,
  query,
  selectedSnippetId,
  onClose,
  onRequestBulkDelete
}) {
  const setSelectedSnippet = useVaultStore((state) => state.setSelectedSnippet)
  const setSelectedFolder = useVaultStore((state) => state.setSelectedFolder)

  const [selectedNoteIds, setSelectedNoteIds] = useState(new Set())
  const [selectedFolderIds, setSelectedFolderIds] = useState(new Set())
  const [lastClickedNoteId, setLastClickedNoteId] = useState(null)
  const [lastClickedFolder, setLastClickedFolder] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [sidebarFocus, setSidebarFocus] = useState(null) // 'note' | 'folder' | 'multi' | 'root' | null

  const clickedInExplorerRef = useRef(0)
  const lastScrolledSnippetRef = useRef(null)

  // Reset focus when explorer open state changes
  useEffect(() => {
    setSidebarFocus(null)
  }, [isOpen])

  // Select all items (both files and folders)
  const selectAll = useCallback(() => {
    if (!flatTree || flatTree.length === 0) return

    const noteIds = new Set()
    const folderIds = new Set()

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

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedNoteIds(new Set())
    setSelectedFolderIds(new Set())
    setLastClickedNoteId(null)
    setLastClickedFolder(null)
    setSelectedFolder(null)
    setSelectedIndex(-1)
    setSidebarFocus(null)
  }, [setSelectedFolder])

  // Handle Ctrl+A, Escape, Delete, Backspace keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase()
      const isInput =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        document.activeElement?.isContentEditable

      if (isInput) return

      // Escape -> Clear Selection
      if (e.key === 'Escape') {
        clearSelection()
        return
      }

      // Ctrl+A / Cmd+A -> Select All in Explorer
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        // Only intercept if explorer is open or focused
        if (isOpen || document.querySelector('.unified-sidebar:hover') || modalRef?.current?.contains(document.activeElement)) {
          e.preventDefault()
          selectAll()
        }
        return
      }

      // Delete / Backspace -> Delete Selected Items
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNoteIds.size > 0 || selectedFolderIds.size > 0 || sidebarFocus === 'folder') {
          e.preventDefault()
          onRequestBulkDelete?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, modalRef, selectAll, clearSelection, selectedNoteIds, selectedFolderIds, sidebarFocus, onRequestBulkDelete])

  // Deselect when clicking outside the explorer
  useEffect(() => {
    const handleDocumentPointerDown = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setSidebarFocus(null)
      }
    }
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }, [modalRef])

  // Deselect on clicking empty background space inside explorer
  const handleBackgroundClick = useCallback(
    (e) => {
      if (
        !e.target.closest('.tree-item') &&
        !e.target.closest('.folder-tree-main') &&
        !e.target.closest('.header-actions') &&
        !e.target.closest('.sort-toggle-btn') &&
        !e.target.closest('.inline-create-input') &&
        !e.target.closest('.inline-rename-input') &&
        !e.target.closest('.start-menu-search') &&
        !e.target.closest('.explorer-segmented-tabs') &&
        !e.target.closest('.start-section-header') &&
        !e.target.closest('.explorer-header-container')
      ) {
        clearSelection()
        setSidebarFocus('root')
      }
    },
    [clearSelection]
  )

  // Intelligent selection on query changes
  useEffect(() => {
    if (query.trim() && flatTree.length > 0) {
      const q = query.toLowerCase().trim()
      let bestIndex = flatTree.findIndex(
        (item) => item.type === 'file' && (item.snippet.title || '').toLowerCase() === q
      )
      if (bestIndex === -1) {
        bestIndex = flatTree.findIndex((item) => item.type === 'file')
      }
      if (bestIndex === -1) bestIndex = 0
      setSelectedIndex(bestIndex)
    } else if (!query.trim()) {
      setSelectedIndex(-1)
    }
  }, [query, flatTree])

  // Auto-scroll to active snippet
  useEffect(() => {
    if (!selectedSnippetId || !virtuosoRef.current || flatTree.length === 0) return
    if (lastScrolledSnippetRef.current === selectedSnippetId) return

    const idx = flatTree.findIndex(
      (item) => item.type === 'file' && item.snippet && item.snippet.id === selectedSnippetId
    )

    if (Date.now() - clickedInExplorerRef.current < 200) {
      lastScrolledSnippetRef.current = selectedSnippetId
      if (idx !== -1) setSelectedIndex(idx)
      return
    }

    if (idx !== -1) {
      lastScrolledSnippetRef.current = selectedSnippetId
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ index: idx, align: 'center', behavior: 'smooth' })
        setSelectedIndex(idx)
      }, 50)
    }
  }, [selectedSnippetId, flatTree, virtuosoRef])

  const [anchorIndex, setAnchorIndex] = useState(null)

  const handleSelect = useCallback(
    (snippet) => {
      if (!snippet) return
      clickedInExplorerRef.current = Date.now()
      setLastClickedFolder(snippet.folderId || '')
      setSelectedFolder(null)
      setSidebarFocus('note')
      setSelectedSnippet(snippet)
      onClose?.()
    },
    [setSelectedSnippet, setSelectedFolder, onClose]
  )

  const handleNoteClick = useCallback(
    (snippet, index, e) => {
      if (!snippet) return
      setSelectedFolder(null)

      // Support (snippet, e) or (snippet, index, e)
      const event = e || (index?.target ? index : null)
      const isCtrl = event?.ctrlKey || event?.metaKey
      const isShift = event?.shiftKey

      let itemIndex = typeof index === 'number' ? index : -1
      if (itemIndex === -1 && flatTree) {
        itemIndex = flatTree.findIndex((i) => i.type === 'file' && i.snippet?.id === snippet.id)
      }

      if (isShift && anchorIndex !== null && flatTree && flatTree.length > 0) {
        const minIdx = Math.min(anchorIndex, itemIndex)
        const maxIdx = Math.max(anchorIndex, itemIndex)

        const rangeNotes = new Set()
        const rangeFolders = new Set()

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
    (folderId, index, e) => {
      if (!folderId) return

      // Support (folderId, e) or (folderId, index, e)
      const event = e || (index?.target ? index : null)
      const isCtrl = event?.ctrlKey || event?.metaKey
      const isShift = event?.shiftKey

      let itemIndex = typeof index === 'number' ? index : -1
      if (itemIndex === -1 && flatTree) {
        itemIndex = flatTree.findIndex((i) => i.type === 'folder' && i.id === folderId)
      }

      if (isShift && anchorIndex !== null && flatTree && flatTree.length > 0) {
        const minIdx = Math.min(anchorIndex, itemIndex)
        const maxIdx = Math.max(anchorIndex, itemIndex)

        const rangeNotes = new Set()
        const rangeFolders = new Set()

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
    handleSelect,
    handleNoteClick,
    handleFolderClick,
    handleBackgroundClick
  }
}
