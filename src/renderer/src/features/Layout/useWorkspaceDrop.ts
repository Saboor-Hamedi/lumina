import { useState, useEffect, useRef, useCallback, useMemo, type DragEvent as ReactDragEvent } from 'react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export interface WorkspaceDropState {
  isOver: boolean
  isExternal: boolean
  title: string
  count: number
  label: string
}

export interface WorkspaceDropProps {
  onDragEnter: (e: ReactDragEvent) => void
  onDragOver: (e: ReactDragEvent) => void
  onDragLeave: (e: ReactDragEvent) => void
  onDrop: (e: ReactDragEvent) => Promise<void>
}

export function useWorkspaceDrop(): {
  workspaceDrop: WorkspaceDropState
  workspaceDropProps: WorkspaceDropProps
} {
  const [dropState, setDropState] = useState({
    isOver: false,
    isExternal: false,
    title: '',
    count: 1
  })

  const dragCounterRef = useRef(0)

  useEffect(() => {
    const handleWorkspaceDragHover = (e: Event) => {
      const detail = (e as CustomEvent).detail || {
        isOver: false,
        isExternal: false,
        title: '',
        count: 1
      }
      setDropState((prev) => {
        if (
          prev.isOver === detail.isOver &&
          prev.isExternal === detail.isExternal &&
          prev.title === detail.title &&
          prev.count === detail.count
        ) {
          return prev
        }
        return {
          isOver: Boolean(detail.isOver),
          isExternal: Boolean(detail.isExternal),
          title: detail.title || '',
          count: detail.count || 1
        }
      })
    }

    const handleWindowDragLeave = (e: DragEvent) => {
      if (
        !e.relatedTarget &&
        (e.clientX <= 0 ||
          e.clientX >= window.innerWidth ||
          e.clientY <= 0 ||
          e.clientY >= window.innerHeight)
      ) {
        dragCounterRef.current = 0
        setDropState((prev) =>
          prev.isOver ? { isOver: false, isExternal: false, title: '', count: 1 } : prev
        )
      }
    }

    const handleWindowDropOrEnd = () => {
      dragCounterRef.current = 0
      setDropState((prev) =>
        prev.isOver ? { isOver: false, isExternal: false, title: '', count: 1 } : prev
      )
    }

    window.addEventListener('lumina:workspace-drag-hover', handleWorkspaceDragHover)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('drop', handleWindowDropOrEnd)
    window.addEventListener('dragend', handleWindowDropOrEnd)

    return () => {
      window.removeEventListener('lumina:workspace-drag-hover', handleWorkspaceDragHover)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('drop', handleWindowDropOrEnd)
      window.removeEventListener('dragend', handleWindowDropOrEnd)
    }
  }, [])

  const onDragEnter = useCallback((e: ReactDragEvent) => {
    const types = Array.from(e.dataTransfer?.types || [])
    const isSnippet = types.includes('application/lumina-snippet')
    const isFile = types.includes('Files') && !types.includes('application/x-lumina-node')

    if (isSnippet || isFile) {
      e.preventDefault()
      dragCounterRef.current += 1
      setDropState((prev) => {
        if (prev.isOver && prev.isExternal === isFile) return prev
        return { isOver: true, isExternal: isFile, title: isFile ? 'Files' : 'Note', count: 1 }
      })
    }
  }, [])

  const onDragOver = useCallback((e: ReactDragEvent) => {
    const types = Array.from(e.dataTransfer?.types || [])
    const isSnippet = types.includes('application/lumina-snippet')
    const isFile = types.includes('Files') && !types.includes('application/x-lumina-node')

    if (isSnippet || isFile) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDropState((prev) => {
        if (prev.isOver && prev.isExternal === isFile) return prev
        return { isOver: true, isExternal: isFile, title: isFile ? 'Files' : 'Note', count: 1 }
      })
    }
  }, [])

  const onDragLeave = useCallback((e: ReactDragEvent) => {
    const types = Array.from(e.dataTransfer?.types || [])
    const isSnippet = types.includes('application/lumina-snippet')
    const isFile = types.includes('Files') && !types.includes('application/x-lumina-node')

    if (isSnippet || isFile) {
      e.preventDefault()
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) {
        setDropState({ isOver: false, isExternal: false, title: '', count: 1 })
      }
    }
  }, [])

  const onDrop = useCallback(async (e: ReactDragEvent) => {
    dragCounterRef.current = 0
    const types = Array.from(e.dataTransfer?.types || [])
    const isSnippet = types.includes('application/lumina-snippet')
    const isFile = types.includes('Files') && !types.includes('application/x-lumina-node')

    if (isSnippet) {
      const raw = e.dataTransfer?.getData('application/lumina-snippet')
      if (raw) {
        e.preventDefault()
        e.stopPropagation()
        setDropState({ isOver: false, isExternal: false, title: '', count: 1 })
        try {
          const snippet = JSON.parse(raw)
          if (snippet && snippet.id) {
            useWorkspaceStore.setState((state) => {
              const nextTabs = state.openTabs.includes(snippet.id)
                ? state.openTabs
                : [...state.openTabs, snippet.id]
              return {
                openTabs: nextTabs,
                activeTabId: snippet.id,
                selectedNote: snippet
              }
            })
          }
        } catch (err) {
          console.error('[useWorkspaceDrop] Failed to parse dropped snippet:', err)
        }
      }
    } else if (isFile) {
      e.preventDefault()
      e.stopPropagation()
      setDropState({ isOver: false, isExternal: false, title: '', count: 1 })

      const files = Array.from(e.dataTransfer?.files || [])
      const paths = files
        .map((f) =>
          (window as any).api?.getPathForFile
            ? (window as any).api.getPathForFile(f)
            : (f as any).path
        )
        .filter(Boolean)

      if (paths.length > 0 && (window as any).api?.importExternalPaths) {
        try {
          const res = await (window as any).api.importExternalPaths(paths, '')
          await useWorkspaceStore.getState().loadWorkspace()
          const importedIds = res?.importedNoteIds || res?.importedSnippetIds || []
          if (importedIds.length > 0) {
            const allNotes = useWorkspaceStore.getState().notes || []
            const found = allNotes.find((n: any) => n.id === importedIds[0])
            if (found) {
              useWorkspaceStore.getState().setSelectedNote(found)
            }
          }
        } catch (err) {
          console.error('[useWorkspaceDrop] Failed to import external files:', err)
        }
      }
    }
  }, [])

  const label = useMemo(() => {
    if (dropState.isExternal) {
      return 'Drop files to import into Lumina'
    }
    if (dropState.count > 1) {
      return `Open ${dropState.count} Notes in Tabs`
    }
    return `Open "${dropState.title || 'Note'}" in Tab`
  }, [dropState.isExternal, dropState.count, dropState.title])

  const workspaceDrop: WorkspaceDropState = useMemo(
    () => ({
      ...dropState,
      label
    }),
    [dropState, label]
  )

  const workspaceDropProps: WorkspaceDropProps = useMemo(
    () => ({
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop
    }),
    [onDragEnter, onDragOver, onDragLeave, onDrop]
  )

  return {
    workspaceDrop,
    workspaceDropProps
  }
}
