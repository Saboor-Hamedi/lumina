import React, { useRef, useEffect, useCallback, useMemo } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import SidebarItem from '../../Navigation/components/SidebarItem'
import { countExplorerPerfRender } from '../utils/explorerPerf'

const STYLE_NORMAL: React.CSSProperties = {
  opacity: 1,
  zIndex: 1,
  position: 'relative'
}

const STYLE_DIMMED: React.CSSProperties = {
  opacity: 0.35,
  zIndex: 99,
  position: 'relative'
}

export interface SortableListItemProps {
  snippet: any
  isActive?: boolean
  isMultiDragging?: boolean
  onClick?: (snippet: any, e?: React.MouseEvent) => void
  onContextMenu?: (snippet: any, e: React.MouseEvent) => boolean | void
  searchQuery?: string
  matchSnippet?: string
  depth?: number
}

const SortableListItemComponent: React.FC<SortableListItemProps> = ({
  snippet,
  isActive,
  isMultiDragging,
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

  const isDimmed = isDragging || isMultiDragging
  const style = isDimmed ? STYLE_DIMMED : STYLE_NORMAL
  const dndProps = useMemo(
    () => ({ attributes, listeners, setNodeRef: setCombinedRef }),
    [attributes, listeners, setCombinedRef]
  )

  return (
    <SidebarItem
      snippet={snippet}
      variant="list"
      onClick={handleClick}
      onContextMenu={onContextMenu}
      isActive={isActive}
      searchQuery={searchQuery}
      matchSnippet={matchSnippet}
      dndProps={dndProps}
      isDropOver={isOver && !isDragging}
      style={style}
      depth={depth}
    />
  )
}

export function areNotePropsEqual(
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
    prev.snippet?.customIcon === next.snippet?.customIcon &&
    prev.snippet?.color === next.snippet?.color &&
    prev.isActive === next.isActive &&
    prev.isMultiDragging === next.isMultiDragging &&
    prev.searchQuery === next.searchQuery &&
    prev.matchSnippet === next.matchSnippet &&
    prev.depth === next.depth
  )
}

export const SortableListItem = React.memo(SortableListItemComponent, areNotePropsEqual)

SortableListItem.displayName = 'SortableListItem'

export default SortableListItem
