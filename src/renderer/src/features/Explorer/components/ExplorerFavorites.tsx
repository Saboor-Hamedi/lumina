import React from 'react'
import {
  DndContext,
  pointerWithin,
  DragEndEvent,
  SensorDescriptor,
  SensorOptions
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableListItem from './SortableListItem'
import { isSnippetActive } from '../utils/explorerSelectionHelper'

export interface ExplorerFavoritesProps {
  pinnedItems: any[]
  selectedSnippetId?: string | null
  sensors?: SensorDescriptor<SensorOptions>[]
  handleSortDragEnd?: (event: DragEndEvent) => void
  setExpandedFolders: (fn: (prev: Set<string>) => Set<string>) => void
  setActiveTab: (tab: string) => void
  handleSelect: (item: any) => void
}

export const ExplorerFavorites: React.FC<ExplorerFavoritesProps> = ({
  pinnedItems,
  selectedSnippetId,
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
                    isActive={isSnippetActive({
                      snippetId: item.id,
                      activeSnippetId: selectedSnippetId
                    })}
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
