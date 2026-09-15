import { useState, useCallback, useRef, useEffect } from 'react'
import {
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type SensorDescriptor,
  type SensorOptions,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import { useVaultStore } from '../../../core/store/workspaceStore'

function patchStoreForMigratedImages(migratedImages: Map<string, string>): void {
  if (migratedImages.size === 0) return
  const freshSnippets: any[] = useVaultStore.getState().snippets || []
  useVaultStore.setState((state: any) => {
    let nextTabs = [...state.openTabs]
    let nextActiveId = state.activeTabId
    let nextPinned = [...state.pinnedTabIds]
    let nextSelected = state.selectedSnippet
    for (const [oldId, newRel] of migratedImages.entries()) {
      const found = freshSnippets.find((sn: any) => sn.relativePath === newRel)
      if (found) {
        nextTabs = nextTabs.map((tid: string) => (tid === oldId ? found.id : tid))
        nextPinned = nextPinned.map((pid: string) => (pid === oldId ? found.id : pid))
        if (nextActiveId === oldId) nextActiveId = found.id
        if (nextSelected?.id === oldId) nextSelected = found
      }
    }
    return { openTabs: nextTabs, activeTabId: nextActiveId, pinnedTabIds: nextPinned, selectedSnippet: nextSelected }
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
  saveSnippet: (snippet: Snippet) => Promise<void>
  loadVault: () => Promise<void>
  setExpandedFolders: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void
}

interface ExplorerDndResult {
  sensors: SensorDescriptor<SensorOptions>[]
  activeListDragItem: DragItemData | null
  setActiveListDragItem: React.Dispatch<React.SetStateAction<DragItemData | null>>
  handleListDragStart: (event: DragStartEvent) => void
  handleListDragEnd: (event: DragEndEvent) => Promise<void>
}

export function useExplorerDnd({
  allSnippets,
  flatTree,
  selectedNoteIds,
  saveSnippet,
  loadVault,
  setExpandedFolders
}: UseExplorerDndParams): ExplorerDndResult {
  const [activeListDragItem, setActiveListDragItem] = useState<DragItemData | null>(null)
  const pointerPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!activeListDragItem) return
    const onPointerMove = (e: PointerEvent) => {
      pointerPosRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
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
        setActiveListDragItem({
          type: 'folder',
          id: active.id,
          item: (active.data?.current as any)?.item
        })
      } else {
        const activeSnippet = allSnippets.find((s) => s.id === active.id)
        if (activeSnippet) {
          const flatItem = flatTree.find((f) => f.type === 'file' && f.snippet?.id === active.id)
          const isMulti = selectedNoteIds.has(String(active.id)) && selectedNoteIds.size > 1
          const draggedSnippetIds = isMulti ? Array.from(selectedNoteIds) : [String(active.id)]

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
    [allSnippets, flatTree, selectedNoteIds]
  )

  const handleListDragEnd = useCallback(
    async (event: DragEndEvent) => {
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

      if (!over || active.id === over.id) return

      if (over.id === 'root-drop-zone') {
        if (String(active.id).startsWith('drag-folder-')) {
          const sourceFolderId = String(active.id).replace('drag-folder-', '')
          const folderName = sourceFolderId.split('/').pop()!
          if (sourceFolderId !== folderName) {
            try {
              await (window as any).api.renameFolder(sourceFolderId, folderName)
              await loadVault()
            } catch (e) {
              console.error('Failed to move folder to root:', e)
            }
          }
        } else {
          const idsToMove = dragItem?.draggedSnippetIds?.length
            ? dragItem.draggedSnippetIds
            : [String(active.id)]

          const migratedImages = new Map<string, string>()
          const snippetsToMove = allSnippets.filter((s) => idsToMove.includes(s.id))
          for (const s of snippetsToMove) {
            if (s.folderId !== '') {
              try {
                if (s.type === 'image' || s.type === 'pdf') {
                  const oldRel = s.folderId ? `${s.folderId}/${s.fileName}` : s.fileName!
                  const newRel = s.fileName!
                  if (oldRel !== newRel) {
                    await (window as any).api?.moveFile?.(oldRel, newRel)
                    migratedImages.set(s.id, newRel)
                  }
                } else {
                  await saveSnippet({ ...s, folderId: '' })
                }
              } catch (e) {
                console.error('Failed to move snippet to root:', e)
              }
            }
          }
          await loadVault()

          if (migratedImages.size > 0) {
            patchStoreForMigratedImages(migratedImages)
          }
        }
        return
      }

      if (String(active.id).startsWith('drag-folder-')) {
        const sourceFolderId = String(active.id).replace('drag-folder-', '')

        if (String(over.id).startsWith('folder-') || String(over.id).startsWith('drag-folder-')) {
          const targetFolderId = String(over.id).replace('folder-', '').replace('drag-folder-', '')

          if (sourceFolderId !== targetFolderId && !targetFolderId.startsWith(sourceFolderId + '/')) {
            const folderName = sourceFolderId.split('/').pop()!
            const newPath = targetFolderId ? `${targetFolderId}/${folderName}` : folderName
            if (newPath !== sourceFolderId) {
              try {
                await (window as any).api.renameFolder(sourceFolderId, newPath)
                setExpandedFolders((prev: Set<string>) => new Set(prev).add(targetFolderId))
                await loadVault()
              } catch (e) {
                console.error('Failed to move folder into target folder:', e)
              }
            }
          }
        }
        return
      }

      if (active.id !== over?.id && over) {
        if (String(over.id).startsWith('folder-')) {
          const targetFolderId = String(over.id).replace('folder-', '')
          const idsToMove = dragItem?.draggedSnippetIds?.length
            ? dragItem.draggedSnippetIds
            : [String(active.id)]

          const migratedImages = new Map<string, string>()
          const snippetsToMove = allSnippets.filter((s) => idsToMove.includes(s.id))
          for (const s of snippetsToMove) {
            if (s.folderId !== targetFolderId) {
              try {
                if (s.type === 'image' || s.type === 'pdf') {
                  const oldRel = s.folderId ? `${s.folderId}/${s.fileName}` : s.fileName!
                  const newRel = targetFolderId ? `${targetFolderId}/${s.fileName}` : s.fileName!
                  if (oldRel !== newRel) {
                    await (window as any).api?.moveFile?.(oldRel, newRel)
                    migratedImages.set(s.id, newRel)
                  }
                } else {
                  await saveSnippet({ ...s, folderId: targetFolderId })
                }
              } catch (e) {
                console.error('Failed to move snippet to folder:', e)
              }
            }
          }
          setExpandedFolders((prev: Set<string>) => new Set(prev).add(targetFolderId))
          await loadVault()

          if (migratedImages.size > 0) {
            patchStoreForMigratedImages(migratedImages)
          }
          return
        }

        const currentListIds = allSnippets.map((s) => s.id)
        const idxMap = new Map<string, number>(allSnippets.map((s, i) => [s.id, i]))
        const oldIndex = idxMap.get(String(active.id)) ?? -1
        const newIndex = idxMap.get(String(over.id)) ?? -1
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(currentListIds, oldIndex, newIndex)
          useSettingsStore.getState().updateSettings({
            noteOrder: newOrder,
            sortBy: 'custom'
          })
        }
      }
    },
    [activeListDragItem, allSnippets, saveSnippet, loadVault, setExpandedFolders]
  )

  return {
    sensors,
    activeListDragItem,
    setActiveListDragItem,
    handleListDragStart,
    handleListDragEnd
  }
}
