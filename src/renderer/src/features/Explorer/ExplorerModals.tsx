/**
 * ExplorerModals.tsx
 * 
 * Part 3 of the 4-Part Partitioned FileExplorer Architecture.
 * 
 * Manages all overlay dialogs and floating portals for the File Explorer:
 * 1. `@dnd-kit/core` DragOverlay Portal
 *    - Renders floating visual ghosts for dragged folders and notes.
 *    - Displays a sleek single-file row with exact count badge for multi-selected files.
 *    - Teleports directly to `document.body` for smooth 60fps GPU dragging across overflow boundaries.
 * 2. Explorer Context Menu
 *    - Right-click actions for folders, root background, and bulk selections.
 * 3. Folder Delete Confirmation Dialog
 *    - Confirms deletion of entire folder trees.
 * 4. Multi-Item Bulk Delete Confirmation Dialog
 *    - Confirms deletion of multiple selected notes and folders.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core'
import { Folder, Files } from 'lucide-react'
import { getSnippetIcon } from '../Icons/FileIcon'
import Confirm from '../modals/Confirm'
import ContextMenu from '../modals/ContextMenu'
import './drop/css/externaldropOverlay.css'

export interface ExplorerModalsProps {
  activeListDragItem: {
    type: 'folder' | 'file'
    item?: any
    snippet?: any
    count?: number
  } | null
  currentOverId?: string | null
  allSnippets?: any[]
  folderContext: { folderId: string; x: number; y: number } | null
  setFolderContext: (ctx: { folderId: string; x: number; y: number } | null) => void
  contextMenuOptions: any[]
  deleteConfirmFolder: string | null
  setDeleteConfirmFolder: (folder: string | null) => void
  handleConfirmDeleteFolder: () => void
  bulkDeleteModalOpen: boolean
  setBulkDeleteModalOpen: (open: boolean) => void
  handleConfirmBulkDelete: () => void
  totalSelectedCount: number
  selectedFolderIds: Set<string>
  selectedNoteIds: Set<string>
}

export const ExplorerModals: React.FC<ExplorerModalsProps> = ({
  activeListDragItem,
  currentOverId,
  allSnippets = [],
  folderContext,
  setFolderContext,
  contextMenuOptions,
  deleteConfirmFolder,
  setDeleteConfirmFolder,
  handleConfirmDeleteFolder,
  bulkDeleteModalOpen,
  setBulkDeleteModalOpen,
  handleConfirmBulkDelete,
  totalSelectedCount,
  selectedFolderIds,
  selectedNoteIds
}) => {
  const renderDragOverlayContent = () => {
    if (!activeListDragItem) return null

    if (activeListDragItem.type === 'folder') {
      const folderName = activeListDragItem.item?.name || 'Folder'
      let targetLabel = ''
      if (currentOverId === 'root-drop-zone') {
        targetLabel = 'to Root'
      } else if (
        currentOverId &&
        (currentOverId.startsWith('folder-') || currentOverId.startsWith('drag-folder-'))
      ) {
        const targetFolderId = currentOverId.replace('folder-', '').replace('drag-folder-', '')
        const targetName = targetFolderId.split('/').pop() || targetFolderId
        targetLabel = `into "${targetName}"`
      }
      const label = targetLabel ? `Move "${folderName}" ${targetLabel}` : `Move "${folderName}"`

      return (
        <div className="external-drop-pill" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <Folder size={14} className="external-drop-icon" fill="#e8a825" color="#e8a825" />
          <span className="external-drop-text">{label}</span>
        </div>
      )
    }

    // activeListDragItem.type === 'file'
    const count = activeListDragItem.count || 1
    const snippetTitle =
      activeListDragItem.snippet?.title || activeListDragItem.snippet?.fileName || 'Note'
    const countSubject = count > 1 ? `${count} items` : `"${snippetTitle}"`

    let targetDesc = ''
    if (currentOverId === 'root-drop-zone') {
      targetDesc = 'to Root'
    } else if (
      currentOverId &&
      (currentOverId.startsWith('folder-') || currentOverId.startsWith('drag-folder-'))
    ) {
      const targetFolderId = currentOverId.replace('folder-', '').replace('drag-folder-', '')
      const targetName = targetFolderId.split('/').pop() || targetFolderId
      targetDesc = `into "${targetName}"`
    } else if (currentOverId) {
      const overSnippet = allSnippets.find((s: any) => s.id === currentOverId)
      if (overSnippet) {
        const parentFolder = overSnippet.folderId
        const targetName = parentFolder ? parentFolder.split('/').pop() : 'Root'
        targetDesc = targetName === 'Root' ? 'to Root' : `into "${targetName}"`
      }
    }

    const label = targetDesc
      ? `Move ${countSubject} ${targetDesc}`
      : count > 1
      ? `Move ${count} items`
      : snippetTitle

    return (
      <div className="external-drop-pill" style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {count > 1 ? (
          <Files size={14} className="external-drop-icon" />
        ) : (
          getSnippetIcon(activeListDragItem.snippet, 14, 'external-drop-icon')
        )}
        <span className="external-drop-text">{label}</span>
        {count > 1 && (
          <span className="external-drop-badge">{count}</span>
        )}
      </div>
    )
  }

  return (
    <>
      {/* 1. DragOverlay Portal: renders floating ghost during item reordering or folder moving */}
      {createPortal(
        <DragOverlay
          zIndex={9999}
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: { active: { opacity: '0.4' } }
            })
          }}
        >
          {renderDragOverlayContent()}
        </DragOverlay>,
        document.body
      )}

      {/* 2. Folder Context Menu */}
      {folderContext && (
        <ContextMenu
          x={folderContext.x}
          y={folderContext.y}
          onClose={() => setFolderContext(null)}
          options={contextMenuOptions}
        />
      )}

      {/* 3. Folder Delete Confirmation Dialog */}
      {!!deleteConfirmFolder && (
        <Confirm
          isOpen={!!deleteConfirmFolder}
          onClose={() => setDeleteConfirmFolder(null)}
          onConfirm={handleConfirmDeleteFolder}
          title="Delete Folder"
          message={`Are you sure you want to delete '${deleteConfirmFolder}' and all its contents? This action cannot be undone.`}
          confirmText="Delete Folder"
        />
      )}

      {/* 4. Multi-Item Bulk Deletion Confirmation Dialog */}
      {bulkDeleteModalOpen && (
        <Confirm
          isOpen={bulkDeleteModalOpen}
          onClose={() => setBulkDeleteModalOpen(false)}
          onConfirm={handleConfirmBulkDelete}
          title={`Delete ${totalSelectedCount} Selected ${totalSelectedCount === 1 ? 'Item' : 'Items'}?`}
          message={`Are you sure you want to permanently delete ${selectedFolderIds.size > 0 ? `${selectedFolderIds.size} folder${selectedFolderIds.size > 1 ? 's' : ''}` : ''}${selectedFolderIds.size > 0 && selectedNoteIds.size > 0 ? ' and ' : ''}${selectedNoteIds.size > 0 ? `${selectedNoteIds.size} note${selectedNoteIds.size > 1 ? 's' : ''}` : ''} and all nested files? This action cannot be undone.`}
          confirmText="Delete All"
        />
      )}
    </>
  )
}

export default React.memo(ExplorerModals)
