import React, { useRef, useEffect, useCallback } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import SidebarItem from '../../Navigation/components/SidebarItem'

export const SortableListItem = React.memo(
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
      (node) => {
        setDragRef(node)
        setDropRef(node)
      },
      [setDragRef, setDropRef]
    )

    const handleClick = useCallback(
      (e) => {
        if (wasDraggingRef.current) {
          wasDraggingRef.current = false
          return
        }
        if (onClick) onClick(snippet, e)
      },
      [onClick, snippet]
    )

    const style = {
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
      />
    )
  }
)

SortableListItem.displayName = 'SortableListItem'

export default SortableListItem
