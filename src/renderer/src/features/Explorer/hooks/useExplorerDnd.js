import { useState, useCallback } from 'react'
import {
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import { useVaultStore } from '../../../core/store/workspaceStore'

/**
 * @typedef {Object} DragItemData
 * @property {'folder' | 'file'} type - Item type being dragged
 * @property {string} id - Active drag identifier
 * @property {Object} [item] - Folder data payload if dragging a folder
 * @property {Object} [snippet] - Note snippet data if dragging a file
 * @property {string[]} [draggedSnippetIds] - Array of all note IDs included in drag (supports multi-selection)
 * @property {number} [count] - Number of items dragged concurrently
 * @property {number} [depth] - Indentation depth level in the file tree
 */

/**
 * Custom hook encapsulating Drag-and-Drop (DnD) sensors, state management,
 * multi-file bundling, folder nesting, and custom sorting for the File Explorer.
 *
 * @param {Object} params
 * @param {Array<Object>} params.allSnippets - All available note snippets in the workspace
 * @param {Array<Object>} params.flatTree - Flattened hierarchical tree items rendered in virtuoso
 * @param {Set<string>} params.selectedNoteIds - Active multi-selected note ID set
 * @param {Function} params.saveSnippet - Vault store function to persist snippet changes
 * @param {Function} params.loadVault - Vault store function to reload folder structures from disk
 * @param {Function} params.setExpandedFolders - State setter for expanded folder IDs
 * @returns {Object} DnD sensors, active item state, and drag event handlers
 */
export function useExplorerDnd({
  allSnippets,
  flatTree,
  selectedNoteIds,
  saveSnippet,
  loadVault,
  setExpandedFolders
}) {
  const [activeListDragItem, setActiveListDragItem] = useState(null)

  // Configure sensors with activation constraints to prevent unintentional dragging during clicks
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

  /**
   * Captures drag initiation for single notes, multi-selected notes, and folders.
   */
  const handleListDragStart = useCallback(
    (event) => {
      const { active } = event
      if (String(active.id).startsWith('drag-folder-')) {
        setActiveListDragItem({
          type: 'folder',
          id: active.id,
          item: active.data?.current?.item
        })
      } else {
        const activeSnippet = allSnippets.find((s) => s.id === active.id)
        if (activeSnippet) {
          const flatItem = flatTree.find((f) => f.type === 'file' && f.snippet?.id === active.id)
          const isMulti = selectedNoteIds.has(active.id) && selectedNoteIds.size > 1
          const draggedSnippetIds = isMulti ? Array.from(selectedNoteIds) : [active.id]

          setActiveListDragItem({
            type: 'file',
            id: active.id,
            snippet: activeSnippet,
            draggedSnippetIds,
            count: draggedSnippetIds.length,
            depth: flatItem ? flatItem.depth : 0
          })
        }
      }
    },
    [allSnippets, flatTree, selectedNoteIds]
  )

  /**
   * Resolves drop destinations:
   * 1. Dropping onto root-drop-zone (moves folder/notes to workspace root)
   * 2. Dropping a folder onto another folder (nests folder inside target)
   * 3. Dropping note(s) onto a folder (moves notes into target folder)
   * 4. Dropping note onto another note (reorders notes and updates custom sort order)
   */
  const handleListDragEnd = useCallback(
    async (event) => {
      const dragItem = activeListDragItem
      setActiveListDragItem(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      // Destination 1: Root Drop Zone (Move to workspace root)
      if (over.id === 'root-drop-zone') {
        if (String(active.id).startsWith('drag-folder-')) {
          const sourceFolderId = String(active.id).replace('drag-folder-', '')
          const folderName = sourceFolderId.split('/').pop()
          if (sourceFolderId !== folderName) {
            try {
              await window.api.renameFolder(sourceFolderId, folderName)
              await loadVault()
            } catch (e) {
              console.error('Failed to move folder to root:', e)
            }
          }
        } else {
          const idsToMove = dragItem?.draggedSnippetIds?.length
            ? dragItem.draggedSnippetIds
            : [active.id]

          const migratedImages = new Map()
          const snippetsToMove = allSnippets.filter((s) => idsToMove.includes(s.id))
          for (const s of snippetsToMove) {
            if (s.folderId !== '') {
              try {
                if (s.type === 'image') {
                  const oldRel = s.folderId ? `${s.folderId}/${s.fileName}` : s.fileName
                  const newRel = s.fileName
                  if (oldRel !== newRel) {
                    await window.api?.moveFile?.(oldRel, newRel)
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
            const freshSnippets = useVaultStore.getState().snippets || []
            useVaultStore.setState((state) => {
              let nextTabs = [...state.openTabs]
              let nextActiveId = state.activeTabId
              let nextPinned = [...state.pinnedTabIds]
              let nextSelected = state.selectedSnippet

              for (const [oldId, newRel] of migratedImages.entries()) {
                const found = freshSnippets.find((sn) => sn.relativePath === newRel)
                if (found) {
                  nextTabs = nextTabs.map((tid) => (tid === oldId ? found.id : tid))
                  nextPinned = nextPinned.map((pid) => (pid === oldId ? found.id : pid))
                  if (nextActiveId === oldId) nextActiveId = found.id
                  if (nextSelected?.id === oldId) nextSelected = found
                }
              }
              return {
                openTabs: nextTabs,
                activeTabId: nextActiveId,
                pinnedTabIds: nextPinned,
                selectedSnippet: nextSelected
              }
            })
          }
        }
        return
      }

      // Destination 2: Folder Dragged onto another Folder (Nesting)
      if (String(active.id).startsWith('drag-folder-')) {
        const sourceFolderId = String(active.id).replace('drag-folder-', '')

        if (String(over.id).startsWith('folder-') || String(over.id).startsWith('drag-folder-')) {
          const targetFolderId = String(over.id).replace('folder-', '').replace('drag-folder-', '')

          if (sourceFolderId !== targetFolderId && !targetFolderId.startsWith(sourceFolderId + '/')) {
            const folderName = sourceFolderId.split('/').pop()
            const newPath = targetFolderId ? `${targetFolderId}/${folderName}` : folderName
            if (newPath !== sourceFolderId) {
              try {
                await window.api.renameFolder(sourceFolderId, newPath)
                setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
                await loadVault()
              } catch (e) {
                console.error('Failed to move folder into target folder:', e)
              }
            }
          }
        }
        return
      }

      // Destination 3 & 4: Note(s) Dragged
      if (active.id !== over?.id && over) {
        // Dropped directly into a folder
        if (String(over.id).startsWith('folder-')) {
          const targetFolderId = String(over.id).replace('folder-', '')
          const idsToMove = dragItem?.draggedSnippetIds?.length
            ? dragItem.draggedSnippetIds
            : [active.id]

          const migratedImages = new Map()
          const snippetsToMove = allSnippets.filter((s) => idsToMove.includes(s.id))
          for (const s of snippetsToMove) {
            if (s.folderId !== targetFolderId) {
              try {
                if (s.type === 'image') {
                  const oldRel = s.folderId ? `${s.folderId}/${s.fileName}` : s.fileName
                  const newRel = targetFolderId ? `${targetFolderId}/${s.fileName}` : s.fileName
                  if (oldRel !== newRel) {
                    await window.api?.moveFile?.(oldRel, newRel)
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
          setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
          await loadVault()

          if (migratedImages.size > 0) {
            const freshSnippets = useVaultStore.getState().snippets || []
            useVaultStore.setState((state) => {
              let nextTabs = [...state.openTabs]
              let nextActiveId = state.activeTabId
              let nextPinned = [...state.pinnedTabIds]
              let nextSelected = state.selectedSnippet

              for (const [oldId, newRel] of migratedImages.entries()) {
                const found = freshSnippets.find((sn) => sn.relativePath === newRel)
                if (found) {
                  nextTabs = nextTabs.map((tid) => (tid === oldId ? found.id : tid))
                  nextPinned = nextPinned.map((pid) => (pid === oldId ? found.id : pid))
                  if (nextActiveId === oldId) nextActiveId = found.id
                  if (nextSelected?.id === oldId) nextSelected = found
                }
              }
              return {
                openTabs: nextTabs,
                activeTabId: nextActiveId,
                pinnedTabIds: nextPinned,
                selectedSnippet: nextSelected
              }
            })
          }
          return
        }

        // Reordering notes within the list
        const currentListIds = allSnippets.map((s) => s.id)
        const oldIndex = currentListIds.indexOf(active.id)
        const newIndex = currentListIds.indexOf(over.id)
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
