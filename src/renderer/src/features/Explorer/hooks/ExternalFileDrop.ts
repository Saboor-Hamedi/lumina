import { useState, useCallback, useRef, useEffect } from 'react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'

interface ExternalFileDropResult {
  isDraggingExternal: boolean
  hoveredFolderId: string | null
  handleDragEnter: (e: DragEvent | React.DragEvent, folderId?: string | null) => void
  handleDragOver: (e: DragEvent | React.DragEvent, folderId?: string | null) => void
  handleDragLeave: (e: DragEvent | React.DragEvent) => void
  handleDrop: (e: DragEvent | React.DragEvent, targetFolderId?: string) => Promise<void>
}

export function useExternalFileDrop(): ExternalFileDropResult {
  const [isDraggingExternal, setIsDraggingExternal] = useState(false)
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)
  const dragCounterRef = useRef(0)
  const loadWorkspace = useWorkspaceStore((state) => state.loadWorkspace)
  const setSelectedSnippet = useWorkspaceStore((state) => state.setSelectedNote)

  const isExternalFileDrag = useCallback((e: DragEvent | React.DragEvent): boolean => {
    if (!e?.dataTransfer) return false
    const types = e.dataTransfer.types
    return types.contains('Files') && !types.contains('application/x-lumina-node')
  }, [])

  const resetDragState = useCallback(() => {
    dragCounterRef.current = 0
    setIsDraggingExternal(false)
    setHoveredFolderId(null)
  }, [])

  useEffect(() => {
    const handleWindowDragLeave = (e: DragEvent) => {
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
    (e: DragEvent | React.DragEvent, folderId: string | null = null) => {
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
    (e: DragEvent | React.DragEvent, folderId: string | null = null) => {
      if (!isExternalFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer!.dropEffect = 'copy'
      if (folderId !== null && hoveredFolderId !== folderId) {
        setHoveredFolderId(folderId)
      }
    },
    [isExternalFileDrag, hoveredFolderId]
  )

  const handleDragLeave = useCallback(
    (e: DragEvent | React.DragEvent) => {
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
    async (e: DragEvent | React.DragEvent, targetFolderId = '') => {
      if (!isExternalFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()

      resetDragState()

      const files = Array.from(e.dataTransfer?.files || [])
      const paths = files
        .map((f) => ((window as any).api?.getPathForFile ? (window as any).api.getPathForFile(f) : (f as any).path))
        .filter(Boolean)

      if (paths.length === 0) return

      try {
        const result = await (window as any).api?.importExternalPaths?.(paths, targetFolderId || '')
        await loadWorkspace()

        if (result?.importedFolderIds && result.importedFolderIds.length > 0) {
          const currentExpanded = useSettingsStore.getState().settings.expandedFolders || []
          const nextExpanded = Array.from(new Set([...currentExpanded, ...result.importedFolderIds]))
          try {
            localStorage.setItem('lumina-expanded-folders', JSON.stringify(nextExpanded))
          } catch (_) {}
          useSettingsStore.getState().updateSetting('expandedFolders', nextExpanded)
        }

        const importedIds = result?.importedNoteIds || result?.importedSnippetIds || []
        if (importedIds.length > 0) {
          const targetId = importedIds[0]
          const notes = useWorkspaceStore.getState().notes || []
          const found = notes.find((s: any) => s.id === targetId)
          if (found) {
            setSelectedSnippet(found)
          }
        }
      } catch (err) {
        console.error('Failed to import external files:', err)
      }
    },
    [isExternalFileDrag, resetDragState, loadWorkspace, setSelectedSnippet]
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
