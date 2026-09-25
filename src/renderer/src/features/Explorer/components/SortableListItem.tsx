import React, { useRef, useEffect, useCallback } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import SidebarItem from '../../Navigation/components/SidebarItem'

export interface SortableListItemProps {
  snippet: any
  isActive?: boolean
  onClick?: (snippet: any, e?: React.MouseEvent) => void
  onContextMenu?: (snippet: any, e: React.MouseEvent) => void
  searchQuery?: string
  matchSnippet?: string
  depth?: number
}

export const SortableListItem: React.FC<SortableListItemProps> = React.memo(
  ({ snippet, isActive, onClick, onContextMenu, searchQuery, matchSnippet, depth }) => {
    const {
      attributes,
      listeners,
      setNodeRef: setDragRef,
      isDragging
    } = useDraggable({
      id: snippet.id,
      data: {
        type: 'file',
        snippet
      }
    })

    const { setNodeRef: setDropRef, isOver } = useDroppable({
      id: snippet.id,
      data: {
        type: 'file',
        snippet
      }
    })

    const wasDraggingRef = useRef(false)
    useEffect(() => {
      if (isDragging) {
        wasDraggingRef.current = true
      }
    }, [isDragging])

    const setCombinedRef = useCallback(
      (node: any) => {
        setDragRef(node)
        setDropRef(node)
      },
      [setDragRef, setDropRef]
    )

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if (wasDraggingRef.current) {
          wasDraggingRef.current = false
          return
        }
        if (onClick) onClick(snippet, e)
      },
      [onClick, snippet]
    )

    const style: React.CSSProperties = {
      opacity: isDragging ? 0.35 : 1,
      zIndex: isDragging ? 99 : 1,
      position: 'relative'
    }

    return (
      <SidebarItem
        snippet={snippet}
        variant="list"
        onClick={handleClick}
        onContextMenu={onContextMenu}
        isActive={isActive}
        searchQuery={searchQuery}
        matchSnippet={matchSnippet}
        dndProps={{ attributes, listeners, setNodeRef: setCombinedRef }}
        isDropOver={isOver && !isDragging}
        style={style}
        depth={depth}
      />
    )
  }
)

SortableListItem.displayName = 'SortableListItem'

export default SortableListItem
