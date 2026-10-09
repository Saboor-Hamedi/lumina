import { useState, useCallback, useRef, useEffect } from 'react'
import {
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type SensorDescriptor,
  type SensorOptions,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'

function patchStoreForMigratedImages(migratedImages: Map<string, string>): void {
  if (migratedImages.size === 0) return
  const freshSnippets: any[] = useWorkspaceStore.getState().notes || []
  useWorkspaceStore.setState((state: any) => {
    let nextTabs = [...state.openTabs]
    let nextActiveId = state.activeTabId
    let nextPinned = [...state.pinnedTabIds]
    let nextSelected = state.selectedNote || state.selectedSnippet
    for (const [oldId, newRel] of migratedImages.entries()) {
      const found = freshSnippets.find((sn: any) => sn.relativePath === newRel)
      if (found) {
        nextTabs = nextTabs.map((tid: string) => (tid === oldId ? found.id : tid))
        nextPinned = nextPinned.map((pid: string) => (pid === oldId ? found.id : pid))
        if (nextActiveId === oldId) nextActiveId = found.id
        if (nextSelected?.id === oldId) nextSelected = found
      }
    }
    return {
      openTabs: nextTabs,
      activeTabId: nextActiveId,
      pinnedTabIds: nextPinned,
      selectedNote: nextSelected,
      selectedSnippet: nextSelected
    }
  })
}

interface Snippet {
  id: string
  folderId?: string
  type?: string
  fileName?: string
  relativePath?: string
  [key: string]: unknown
}

interface FlatTreeItem {
  type: 'file' | 'folder' | 'input' | 'root-drop'
  snippet?: Snippet
  depth?: number
  [key: string]: unknown
}

interface DragItemData {
  type: 'folder' | 'file'
  id: string | number
  item?: unknown
  snippet?: Snippet
  draggedSnippetIds?: string[]
  count?: number
  depth?: number
}

interface UseExplorerDndParams {
  allSnippets: Snippet[]
  flatTree: FlatTreeItem[]
  selectedNoteIds: Set<string>
  setSelectedNoteIds?: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  selectedFolderIds?: Set<string>
  setSelectedFolderIds?: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  setSidebarFocus?: (focus: any) => void
  clearSelection?: () => void
  saveSnippet: (snippet: Snippet) => Promise<void>
  loadWorkspace: () => Promise<void>
  setExpandedFolders: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void
}

interface ExplorerDndResult {
  sensors: SensorDescriptor<SensorOptions>[]
  activeListDragItem: DragItemData | null
  setActiveListDragItem: React.Dispatch<React.SetStateAction<DragItemData | null>>
  currentOverId: string | null
  handleListDragStart: (event: DragStartEvent) => void
  handleListDragOver: (event: DragOverEvent) => void
  handleListDragEnd: (event: DragEndEvent) => Promise<void>
}

export function useExplorerDnd({
  allSnippets,
  flatTree,
  selectedNoteIds,
  setSelectedNoteIds,
  selectedFolderIds,
  setSelectedFolderIds,
  setSidebarFocus,
  clearSelection,
  saveSnippet,
  loadWorkspace,
  setExpandedFolders
}: UseExplorerDndParams): ExplorerDndResult {
  const [activeListDragItem, setActiveListDragItem] = useState<DragItemData | null>(null)
  const [currentOverId, setCurrentOverId] = useState<string | null>(null)
  const pointerPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!activeListDragItem) {
      window.dispatchEvent(
        new CustomEvent('lumina:workspace-drag-hover', {
          detail: { isOver: false }
        })
      )
      return
    }

    let rafId: number | null = null
    let lastDispatched = false

    const onPointerMove = (e: PointerEvent) => {
      pointerPosRef.current = { x: e.clientX, y: e.clientY }

      if (activeListDragItem.type === 'file') {
        if (rafId !== null) return
        rafId = requestAnimationFrame(() => {
          rafId = null
          const workspaceEl = document.querySelector('.shell-center-workspace')
          if (workspaceEl) {
            const r = workspaceEl.getBoundingClientRect()
            const inWorkspace =
              e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
            const isOverCanvas =
              inWorkspace &&
              Boolean(
                document.elementFromPoint(e.clientX, e.clientY)?.closest('.lumina-canvas-container')
              )
            const shouldBeOver = inWorkspace && !isOverCanvas
            if (shouldBeOver !== lastDispatched) {
              lastDispatched = shouldBeOver
              window.dispatchEvent(
                new CustomEvent('lumina:workspace-drag-hover', {
                  detail: {
                    isOver: shouldBeOver,
                    title: activeListDragItem.snippet?.title || 'Note',
                    count: activeListDragItem.count || 1
                  }
                })
              )
            }
          }
        })
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', onPointerMove)
      window.dispatchEvent(
        new CustomEvent('lumina:workspace-drag-hover', {
          detail: { isOver: false }
        })
      )
    }
  }, [activeListDragItem])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
    })
  )

  const handleListDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      if (String(active.id).startsWith('drag-folder-')) {
        const folderId = String(active.id).replace('drag-folder-', '')
        const isFolderSelected = selectedFolderIds?.has(folderId)
        if (!isFolderSelected) {
          // Dragging an unselected folder: follow Windows behavior (select this folder, clear others)
          setSelectedFolderIds?.(new Set([folderId]))
          setSelectedNoteIds?.(new Set())
          setSidebarFocus?.('folder')
        }
        setActiveListDragItem({
          type: 'folder',
          id: active.id,
          item: (active.data?.current as any)?.item
        })
      } else {
        const activeSnippet = allSnippets.find((s) => s.id === active.id)
        if (activeSnippet) {
          const flatItem = flatTree.find((f) => f.type === 'file' && f.snippet?.id === active.id)
          const fileId = String(active.id)
          const isFileSelected = selectedNoteIds.has(fileId)

          let draggedSnippetIds: string[]
          if (isFileSelected) {
            // Dragging an already-selected item: drag entire group if multiple selected
            draggedSnippetIds = selectedNoteIds.size > 1 ? Array.from(selectedNoteIds) : [fileId]
          } else {
            // Dragging an unselected item: deselect previous items and select only this item
            setSelectedNoteIds?.(new Set([fileId]))
            setSelectedFolderIds?.(new Set())
            setSidebarFocus?.('note')
            draggedSnippetIds = [fileId]
          }

          setActiveListDragItem({
            type: 'file',
            id: active.id,
            snippet: activeSnippet,
            draggedSnippetIds,
            count: draggedSnippetIds.length,
            depth: flatItem ? (flatItem.depth ?? 0) : 0
          })
        }
      }
    },
    [allSnippets, flatTree, selectedNoteIds, selectedFolderIds, setSelectedNoteIds, setSelectedFolderIds, setSidebarFocus]
  )

  const handleListDragOver = useCallback((event: DragOverEvent) => {
    setCurrentOverId(event.over ? String(event.over.id) : null)
  }, [])

  const handleListDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setCurrentOverId(null)
      const dragItem = activeListDragItem
      setActiveListDragItem(null)
      const { active, over } = event

      const activatorEvent = (event as any).activatorEvent
      const delta = (event as any).delta

      const dropX =
        pointerPosRef.current.x ||
        (activatorEvent?.clientX ? activatorEvent.clientX + (delta?.x || 0) : 0)
      const dropY =
        pointerPosRef.current.y ||
        (activatorEvent?.clientY ? activatorEvent.clientY + (delta?.y || 0) : 0)

      let targetCanvas: Element | null = null
      const canvasContainers = document.querySelectorAll('.lumina-canvas-container')
      for (const canvas of canvasContainers) {
        const r = canvas.getBoundingClientRect()
        if (dropX >= r.left && dropX <= r.right && dropY >= r.top && dropY <= r.bottom) {
          targetCanvas = canvas
          break
        }
      }

      if (!targetCanvas && dropX > 0 && dropY > 0) {
        const el = document.elementFromPoint(dropX, dropY)
        targetCanvas = el?.closest('.lumina-canvas-container') ?? null
      }

      if (!targetCanvas && !over) {
        for (const canvas of canvasContainers) {
          const r = canvas.getBoundingClientRect()
          if (r.width > 50 && r.height > 50 && dropX >= r.left - 50) {
            targetCanvas = canvas
            break
          }
        }
      }

      if (targetCanvas) {
        const idsToDrop = dragItem?.draggedSnippetIds?.length
          ? dragItem.draggedSnippetIds
          : [String(active.id)]
        let snippetsToDrop = (allSnippets || []).filter((s) => idsToDrop.includes(s.id))

        if (snippetsToDrop.length === 0) {
          const directSnippet = dragItem?.snippet || (active.data?.current as any)?.snippet
          if (directSnippet) {
            snippetsToDrop = [directSnippet]
          }
        }

        if (snippetsToDrop.length > 0) {
          window.dispatchEvent(
            new CustomEvent('lumina:canvas-drop-item', {
              detail: {
                snippets: snippetsToDrop,
                clientX: dropX,
                clientY: dropY
              }
            })
          )
          return
        }
      }

      // Check if dropped onto workspace (and not a canvas) to open in tab
      if (!targetCanvas && dragItem?.type === 'file') {
        const workspaceEl = document.querySelector('.shell-center-workspace')
        if (workspaceEl) {
          const r = workspaceEl.getBoundingClientRect()
          const isOverWorkspace =
            dropX >= r.left && dropX <= r.right && dropY >= r.top && dropY <= r.bottom
          if (isOverWorkspace) {
            window.dispatchEvent(
              new CustomEvent('lumina:workspace-drag-hover', {
                detail: { isOver: false }
              })
            )
            const idsToOpen = dragItem?.draggedSnippetIds?.length
              ? dragItem.draggedSnippetIds
              : [String(active.id)]
            let snippetsToOpen = (allSnippets || []).filter((s) => idsToOpen.includes(s.id))
            if (snippetsToOpen.length === 0 && dragItem?.snippet) {
              snippetsToOpen = [dragItem.snippet]
            }

            if (snippetsToOpen.length > 0) {
              useWorkspaceStore.setState((state) => {
                const nextTabs = [...state.openTabs]
                for (const s of snippetsToOpen) {
                  if (!nextTabs.includes(s.id)) {
                    nextTabs.push(s.id)
                  }
                }
                const activeSnippet = snippetsToOpen[snippetsToOpen.length - 1]
                return {
                  openTabs: nextTabs,
                  activeTabId: activeSnippet.id,
                  selectedNote: activeSnippet
                }
              })
              return
            }
          }
        }
      }

      if (!over || active.id === over.id) return

      // --- 1. Dropping a folder ---
      if (String(active.id).startsWith('drag-folder-')) {
        const sourceFolderId = String(active.id).replace('drag-folder-', '')
        let targetFolderId: string | null = null

        if (over.id === 'root-drop-zone') {
          targetFolderId = ''
        } else if (String(over.id).startsWith('folder-') || String(over.id).startsWith('drag-folder-')) {
          targetFolderId = String(over.id).replace('folder-', '').replace('drag-folder-', '')
        } else {
          const overSnippet = allSnippets.find((s) => s.id === String(over.id))
          if (overSnippet) {
            targetFolderId = overSnippet.folderId || ''
          }
        }

        if (targetFolderId !== null) {
          if (sourceFolderId !== targetFolderId && !targetFolderId.startsWith(sourceFolderId + '/')) {
            const folderName = sourceFolderId.split('/').pop()!
            const newPath = targetFolderId ? `${targetFolderId}/${folderName}` : folderName
            if (newPath !== sourceFolderId) {
              try {
                await (window as any).api.renameFolder(sourceFolderId, newPath)
                if (targetFolderId) {
                  setExpandedFolders((prev: Set<string>) => new Set(prev).add(targetFolderId!))
                }
                await loadWorkspace()
                setSelectedFolderIds?.((prev) => {
                  const next = new Set(prev)
                  next.delete(sourceFolderId)
                  return next
                })
                clearSelection?.()
              } catch (e) {
                console.error('Failed to move folder into target folder:', e)
              }
            }
          }
        }
        return
      }

      // --- 2. Dropping file(s) (single or bulk multi-selection) ---
      const idsToMove = dragItem?.draggedSnippetIds?.length
        ? dragItem.draggedSnippetIds
        : [String(active.id)]

      // If user dropped inside their own multi-selection and didn't drop on folder/root, nothing to move
      if (
        idsToMove.includes(String(over.id)) &&
        !String(over.id).startsWith('folder-') &&
        !String(over.id).startsWith('drag-folder-') &&
        over.id !== 'root-drop-zone'
      ) {
        return
      }

      const snippetsToMove = allSnippets.filter((s) => idsToMove.includes(s.id))
      if (snippetsToMove.length === 0) return

      let targetFolderId: string | null = null
      let overSnippet: Snippet | null = null

      if (over.id === 'root-drop-zone') {
        targetFolderId = ''
      } else if (String(over.id).startsWith('folder-') || String(over.id).startsWith('drag-folder-')) {
        targetFolderId = String(over.id).replace('folder-', '').replace('drag-folder-', '')
      } else {
        const found = allSnippets.find((s) => s.id === String(over.id))
        if (found) {
          overSnippet = found
          targetFolderId = found.folderId || ''
        }
      }

      if (targetFolderId !== null) {
        const migratedImages = new Map<string, string>()
        let hasFolderChanged = false
        const moves: Array<{ oldRelPath: string; newRelPath: string }> = []
        const fallbackMoves: Array<{ snippet: Snippet; targetFolder: string; oldRel: string; newRel: string }> = []

        for (const s of snippetsToMove) {
          const normSource = (s.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
          const normTarget = (targetFolderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')

          if (normSource !== normTarget) {
            hasFolderChanged = true
            const fileName =
              s.fileName || (s.relativePath ? s.relativePath.split('/').pop() : `${s.title}.md`)
            const oldRel = s.relativePath || (normSource ? `${normSource}/${fileName}` : fileName)
            const newRel = normTarget ? `${normTarget}/${fileName}` : fileName

            if (oldRel && newRel && oldRel !== newRel) {
              moves.push({ oldRelPath: oldRel, newRelPath: newRel })
              fallbackMoves.push({ snippet: s, targetFolder: normTarget, oldRel, newRel })
              if (s.type === 'image' || s.type === 'pdf') {
                migratedImages.set(s.id, newRel)
              }
            }
          }
        }

        if (moves.length > 0) {
          let batchSuccess = false
          if ((window as any).api?.moveFiles) {
            try {
              const res = await (window as any).api.moveFiles(moves)
              batchSuccess = res?.success ?? true
            } catch (err) {
              console.warn('[ExplorerDnd] api.moveFiles failed, falling back to sequential move:', err)
            }
          }

          if (!batchSuccess) {
            for (const fb of fallbackMoves) {
              let moved = false
              if ((window as any).api?.moveFile) {
                try {
                  await (window as any).api.moveFile(fb.oldRel, fb.newRel)
                  moved = true
                } catch (e) {
                  console.warn('[ExplorerDnd] api.moveFile fallback failed:', e)
                }
              }
              if (!moved) {
                await saveSnippet({ ...fb.snippet, folderId: fb.targetFolder })
              }
            }
          }
        }

        if (targetFolderId) {
          setExpandedFolders((prev: Set<string>) => new Set(prev).add(targetFolderId!))
        }

        // If dropped onto a specific note row, reorder the entire block of dragged snippets next to that note
        if (overSnippet) {
          const currentListIds = allSnippets.map((s) => s.id)
          const remaining = currentListIds.filter((id) => !idsToMove.includes(id))
          const overIdx = remaining.indexOf(String(over.id))
          const insertIdx = overIdx === -1 ? remaining.length : overIdx
          const newOrder = [
            ...remaining.slice(0, insertIdx),
            ...idsToMove,
            ...remaining.slice(insertIdx)
          ]
          useSettingsStore.getState().updateSettings({
            noteOrder: newOrder,
            sortBy: 'custom'
          })
        }

        if (hasFolderChanged) {
          await loadWorkspace()
          if (migratedImages.size > 0) {
            patchStoreForMigratedImages(migratedImages)
          }
        }

        if (setSelectedNoteIds) {
          setSelectedNoteIds((prev) => {
            const next = new Set(prev)
            idsToMove.forEach((id) => next.delete(id))
            return next
          })
        }
        if (clearSelection) {
          clearSelection()
        }
      }
    },
    [activeListDragItem, allSnippets, saveSnippet, loadWorkspace, setExpandedFolders, setSelectedNoteIds, setSelectedFolderIds, clearSelection]
  )

  return {
    sensors,
    activeListDragItem,
    setActiveListDragItem,
    currentOverId,
    handleListDragStart,
    handleListDragOver,
    handleListDragEnd
  }
}
