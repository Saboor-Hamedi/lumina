import React from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { pointerWithin } from '@dnd-kit/core'
import SortableListItem from './SortableListItem'

/**
 * Favorites panel shown when the 'favorites' tab is active in the File Explorer.
 * Renders a sortable list of pinned notes and folders via DnD Kit.
 *
 * @param {Object} props
 * @param {Array<Object>} props.pinnedItems - Pinned notes/folders to display
 * @param {Array} props.sensors - DnD Kit sensors array
 * @param {Function} props.handleSortDragEnd - Drag-end handler for reordering pinned items
 * @param {Function} props.setExpandedFolders - Setter to expand a folder when clicked
 * @param {Function} props.setActiveTab - Tab switcher to jump back to 'all' on folder click
 * @param {Function} props.handleSelect - Note selection handler
 */
export const ExplorerFavorites = ({
  pinnedItems,
  sensors,
  handleSortDragEnd,
  setExpandedFolders,
  setActiveTab,
  handleSelect
}) => {
  return (
    <div className="start-section" style={{ flex: 1, minHeight: 0, paddingBottom: '16px' }}>
      {pinnedItems.length === 0 ? (
        <div className="empty-state">No favorite notes or folders</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragEnd={handleSortDragEnd}
        >
          <SortableContext
            items={pinnedItems.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              className="recommended-list"
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflowY: 'auto'
              }}
            >
              {pinnedItems.map((item) => (
                <div
                  key={item.id}
                  className="favorite-item-wrapper"
                  style={{ position: 'relative' }}
                >
                  <SortableListItem
                    snippet={item}
                    onClick={() => {
                      if (item.itemType === 'folder') {
                        setExpandedFolders((prev) => new Set(prev).add(item.id))
                        setActiveTab('all')
                      } else {
                        handleSelect(item)
                      }
                    }}
                    isActive={false}
                  />
                </div>
              ))}
              <div style={{ height: '36px', minHeight: '36px', width: '100%', cursor: 'default' }} />
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

export default React.memo(ExplorerFavorites)
