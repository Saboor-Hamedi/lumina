import React, { useRef, useEffect, useCallback } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import SidebarItem from '../../Navigation/components/SidebarItem'
import { countExplorerPerfRender } from '../utils/explorerPerf'

export interface SortableListItemProps {
  snippet: any
  isActive?: boolean
  onClick?: (snippet: any, e?: React.MouseEvent) => void
  onContextMenu?: (snippet: any, e: React.MouseEvent) => void
  searchQuery?: string
  matchSnippet?: string
  depth?: number
}

const SortableListItemComponent: React.FC<SortableListItemProps> = ({
  snippet,
  isActive,
  onClick,
  onContextMenu,
  searchQuery,
  matchSnippet,
  depth
}) => {
  countExplorerPerfRender('FileRow', snippet?.id)
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

function areNotePropsEqual(
  prev: Readonly<SortableListItemProps>,
  next: Readonly<SortableListItemProps>
): boolean {
  return (
    prev.snippet?.id === next.snippet?.id &&
    prev.snippet?.title === next.snippet?.title &&
    prev.snippet?.fileName === next.snippet?.fileName &&
    prev.snippet?.folderId === next.snippet?.folderId &&
    prev.snippet?.updatedAt === next.snippet?.updatedAt &&
    prev.snippet?.isPinned === next.snippet?.isPinned &&
    prev.isActive === next.isActive &&
    prev.searchQuery === next.searchQuery &&
    prev.matchSnippet === next.matchSnippet &&
    prev.depth === next.depth
  )
}

export const SortableListItem = React.memo(SortableListItemComponent, areNotePropsEqual)

SortableListItem.displayName = 'SortableListItem'

export default SortableListItem
