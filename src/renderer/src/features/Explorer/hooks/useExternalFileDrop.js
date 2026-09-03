import { useState, useCallback, useRef, useEffect } from 'react'
import { useVaultStore } from '../../../core/store/useVaultStore'

export function useExternalFileDrop() {
  const [isDraggingExternal, setIsDraggingExternal] = useState(false)
  const [hoveredFolderId, setHoveredFolderId] = useState(null)
  const dragCounterRef = useRef(0)
  const loadVault = useVaultStore((state) => state.loadVault)
  const setSelectedSnippet = useVaultStore((state) => state.setSelectedSnippet)

  const isExternalFileDrag = useCallback((e) => {
    if (!e?.dataTransfer) return false
    const types = Array.from(e.dataTransfer.types || [])
    return types.includes('Files') && !types.includes('application/x-lumina-node')
  }, [])

  const resetDragState = useCallback(() => {
    dragCounterRef.current = 0
    setIsDraggingExternal(false)
    setHoveredFolderId(null)
  }, [])

  useEffect(() => {
    const handleWindowDragLeave = (e) => {
      if (
        !e.relatedTarget &&
        (e.clientX <= 0 ||
          e.clientX >= window.innerWidth ||
          e.clientY <= 0 ||
          e.clientY >= window.innerHeight)
      ) {
        resetDragState()
      }
    }

    const handleWindowDrop = () => resetDragState()
    const handleWindowDragEnd = () => resetDragState()

    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('drop', handleWindowDrop)
    window.addEventListener('dragend', handleWindowDragEnd)

    return () => {
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('drop', handleWindowDrop)
      window.removeEventListener('dragend', handleWindowDragEnd)
    }
  }, [resetDragState])

  const handleDragEnter = useCallback(
    (e, folderId = null) => {
      if (!isExternalFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current += 1
      setIsDraggingExternal(true)
      if (folderId !== null) {
        setHoveredFolderId(folderId)
      }
    },
    [isExternalFileDrag]
  )

  const handleDragOver = useCallback(
    (e, folderId = null) => {
      if (!isExternalFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      if (folderId !== null && hoveredFolderId !== folderId) {
        setHoveredFolderId(folderId)
      }
    },
    [isExternalFileDrag, hoveredFolderId]
  )

  const handleDragLeave = useCallback(
    (e) => {
      if (!isExternalFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) {
        setIsDraggingExternal(false)
        setHoveredFolderId(null)
      }
    },
    [isExternalFileDrag]
  )

  const handleDrop = useCallback(
    async (e, targetFolderId = '') => {
      if (!isExternalFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()

      resetDragState()

      const files = Array.from(e.dataTransfer?.files || [])
      const paths = files
        .map((f) => (window.api?.getPathForFile ? window.api.getPathForFile(f) : f.path))
        .filter(Boolean)

      if (paths.length === 0) return

      try {
        const result = await window.api?.importExternalPaths?.(paths, targetFolderId || '')
        await loadVault()

        if (result?.importedFolderIds && result.importedFolderIds.length > 0) {
          const currentExpanded = useVaultStore.getState().expandedFolders || new Set()
          const nextExpanded = new Set(currentExpanded)
          result.importedFolderIds.forEach((fid) => nextExpanded.add(fid))
          useVaultStore.getState().setExpandedFolders?.(nextExpanded)
        }

        if (result?.importedSnippetIds && result.importedSnippetIds.length > 0) {
          const targetId = result.importedSnippetIds[0]
          const snippets = useVaultStore.getState().snippets || []
          const found = snippets.find((s) => s.id === targetId)
          if (found) {
            setSelectedSnippet(found)
          }
        }
      } catch (err) {
        console.error('Failed to import external files:', err)
      }
    },
    [isExternalFileDrag, resetDragState, loadVault, setSelectedSnippet]
  )

  return {
    isDraggingExternal,
    hoveredFolderId,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}