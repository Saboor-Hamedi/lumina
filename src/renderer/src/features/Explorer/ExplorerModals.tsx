/**
 * ExplorerModals.tsx
 * 
 * Part 3 of the 4-Part Partitioned FileExplorer Architecture.
 * 
 * Manages all overlay dialogs and floating portals for the File Explorer:
 * 1. `@dnd-kit/core` DragOverlay Portal
 *    - Renders floating visual ghosts for dragged folders and notes.
 *    - Supports multi-selection badge counters (e.g. "+3").
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
import { Folder } from 'lucide-react'
import Confirm from '../modals/Confirm'
import ContextMenu from '../modals/ContextMenu'
import SidebarItem from '../Navigation/components/SidebarItem'
import { OverlayWrapper } from './components'

export interface ExplorerModalsProps {
  activeListDragItem: {
    type: 'folder' | 'file'
    item?: any
    snippet?: any
    count?: number
  } | null
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
          {activeListDragItem?.type === 'folder' ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'var(--bg-panel, #1e1e2e)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 500,
                pointerEvents: 'none',
                transform: 'translate3d(0, 0, 0)'
              }}
            >
              <Folder size={14} fill="#e8a825" color="#e8a825" />
              <span>{activeListDragItem.item?.name || 'Folder'}</span>
            </div>
          ) : activeListDragItem?.type === 'file' ? (
            <OverlayWrapper>
              <div
                className="start-section"
                style={{
                  width: '220px',
                  maxWidth: '220px',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    opacity: 0.95,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                    borderRadius: '6px',
                    background: 'var(--bg-panel, #1e1e2e)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                    overflow: 'hidden'
                  }}
                >
                  <SidebarItem
                    snippet={activeListDragItem.snippet}
                    variant="list"
                    isActive={false}
                    searchQuery=""
                  />
                </div>
                {activeListDragItem.count && activeListDragItem.count > 1 ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: 'var(--text-accent, #6366f1)',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                      zIndex: 10
                    }}
                  >
                    +{activeListDragItem.count}
                  </span>
                ) : null}
              </div>
            </OverlayWrapper>
          ) : null}
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
