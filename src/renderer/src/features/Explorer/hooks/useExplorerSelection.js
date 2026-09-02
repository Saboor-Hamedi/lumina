import { useState, useRef, useEffect, useCallback } from 'react'
import { useVaultStore } from '../../../core/store/useVaultStore'

export function useExplorerSelection({
  isOpen,
  modalRef,
  virtuosoRef,
  flatTree,
  query,
  selectedSnippetId,
  onClose
}) {
  const setSelectedSnippet = useVaultStore((state) => state.setSelectedSnippet)
  const setSelectedFolder = useVaultStore((state) => state.setSelectedFolder)

  const [selectedNoteIds, setSelectedNoteIds] = useState(new Set())
  const [lastClickedNoteId, setLastClickedNoteId] = useState(null)
  const [lastClickedFolder, setLastClickedFolder] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [sidebarFocus, setSidebarFocus] = useState(null) // 'note' | 'folder' | 'root' | null

  const clickedInExplorerRef = useRef(0)
  const lastScrolledSnippetRef = useRef(null)

  // Reset focus when explorer open state changes
  useEffect(() => {
    setSidebarFocus(null)
  }, [isOpen])

  // Deselect on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedNoteIds(new Set())
        setLastClickedNoteId(null)
        setLastClickedFolder(null)
        setSelectedFolder(null)
        setSelectedIndex(-1)
        setSidebarFocus(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSelectedFolder])

  // Deselect when clicking outside the explorer (e.g. editor, inspector, header)
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
        !e.target.closest('.inline-rename-input')
      ) {
        setSelectedNoteIds(new Set())
        setLastClickedNoteId(null)
        setLastClickedFolder(null)
        setSelectedFolder(null)
        setSelectedIndex(-1)
        setSidebarFocus('root')
      }
    },
    [setSelectedFolder]
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
    (snippet, e) => {
      if (!snippet) return
      setSelectedFolder(null)
      const isCtrl = e?.ctrlKey || e?.metaKey
      const isShift = e?.shiftKey

      if (isCtrl) {
        setSelectedNoteIds((prev) => {
          const next = new Set(prev)
          if (next.has(snippet.id)) {
            next.delete(snippet.id)
          } else {
            next.add(snippet.id)
          }
          return next
        })
        setLastClickedNoteId(snippet.id)
        setSidebarFocus('note')
        setLastClickedFolder(snippet.folderId || '')
      } else if (isShift && lastClickedNoteId) {
        const visibleFiles = flatTree
          .filter((f) => f.type === 'file' && f.snippet)
          .map((f) => f.snippet)
        const startIdx = visibleFiles.findIndex((s) => s.id === lastClickedNoteId)
        const endIdx = visibleFiles.findIndex((s) => s.id === snippet.id)

        if (startIdx !== -1 && endIdx !== -1) {
          const [minIdx, maxIdx] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
          const rangeIds = visibleFiles.slice(minIdx, maxIdx + 1).map((s) => s.id)
          setSelectedNoteIds(new Set(rangeIds))
        }
        setSidebarFocus('note')
        setLastClickedFolder(snippet.folderId || '')
      } else {
        setSelectedNoteIds(new Set([snippet.id]))
        setLastClickedNoteId(snippet.id)
        setSidebarFocus('note')
        setLastClickedFolder(snippet.folderId || '')
        handleSelect(snippet)
      }
    },
    [flatTree, lastClickedNoteId, handleSelect, setSelectedFolder]
  )

  return {
    selectedNoteIds,
    setSelectedNoteIds,
    lastClickedNoteId,
    setLastClickedNoteId,
    lastClickedFolder,
    setLastClickedFolder,
    selectedIndex,
    setSelectedIndex,
    sidebarFocus,
    setSidebarFocus,
    handleSelect,
    handleNoteClick,
    handleBackgroundClick
  }
}
