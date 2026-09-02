import { useState, useCallback } from 'react'
import { useContextMenu } from '../../Navigation/hooks/useContextMenu'

/**
 * @typedef {Object} FolderContextMenuState
 * @property {number} x - Horizontal mouse coordinate
 * @property {number} y - Vertical mouse coordinate
 * @property {string|null} folderId - Selected folder ID or null for workspace body
 */

/**
 * Custom hook encapsulating the Folder and Workspace Context Menu options,
 * coordinate tracking, and folder deletion confirmation.
 *
 * @param {Object} params
 * @param {Array<string>} params.pinnedFolders - List of pinned folder IDs
 * @param {Function} params.setExpandedFolders - Setter for expanded folders
 * @param {Function} params.setCreating - Setter for inline creation state
 * @param {Function} params.setCreatingValue - Setter for inline creation input value
 * @param {Function} params.setRenamingFolder - Setter for inline renaming folder ID
 * @param {Function} params.setRenamingValue - Setter for inline renaming input value
 * @param {Function} params.loadVault - Vault store loader to refresh tree after deletions
 * @returns {Object} Context menu state, handlers, options, and deletion callbacks
 */
export function useFolderContextMenu({
  pinnedFolders = [],
  setExpandedFolders,
  setCreating,
  setCreatingValue,
  setRenamingFolder,
  setRenamingValue,
  loadVault
}) {
  const [folderContext, setFolderContext] = useState(null)
  const [deleteConfirmFolder, setDeleteConfirmFolder] = useState(null)

  /**
   * Opens the context menu at current mouse pointer coordinates.
   */
  const handleFolderContextMenu = useCallback((id, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setFolderContext({
      x: e?.clientX ?? 0,
      y: e?.clientY ?? 0,
      folderId: id
    })
  }, [])

  /**
   * Generates context menu action items.
   */
  const contextMenuOptions = useContextMenu({
    item: folderContext?.folderId || null,
    type: folderContext?.folderId ? 'folder' : 'body',
    callbacks: {
      onCreateNote: () => {
        if (folderContext?.folderId) {
          setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
        }
        setCreating({ type: 'file', parentId: folderContext?.folderId || null })
        setCreatingValue('')
      },
      onCreateFolder: () => {
        if (folderContext?.folderId) {
          setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
        }
        setCreating({ type: 'folder', parentId: folderContext?.folderId || null })
        setCreatingValue('')
      },
      onRename: () => {
        if (folderContext?.folderId) {
          const parts = folderContext.folderId.split('/')
          setRenamingValue(parts[parts.length - 1])
          setRenamingFolder(folderContext.folderId)
        }
      },
      onDelete: () => {
        if (folderContext?.folderId) {
          setDeleteConfirmFolder(folderContext.folderId)
        }
      },
      onClose: () => setFolderContext(null),
      isFolderPinned: folderContext?.folderId
        ? pinnedFolders.includes(folderContext.folderId)
        : false
    }
  })

  /**
   * Executes deletion of the confirmed folder and reloads vault state.
   */
  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!deleteConfirmFolder) return
    try {
      await window.api?.deleteFolder?.(deleteConfirmFolder)
      await loadVault()
    } catch (e) {
      console.error('Failed to delete folder:', e)
    } finally {
      setDeleteConfirmFolder(null)
    }
  }, [deleteConfirmFolder, loadVault])

  return {
    folderContext,
    setFolderContext,
    deleteConfirmFolder,
    setDeleteConfirmFolder,
    handleFolderContextMenu,
    contextMenuOptions,
    handleConfirmDeleteFolder
  }
}
