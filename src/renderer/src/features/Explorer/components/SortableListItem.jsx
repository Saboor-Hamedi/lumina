import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SidebarItem from '../../Navigation/components/SidebarItem'

export const SortableListItem = React.memo(
  ({ snippet, isActive, onClick, searchQuery, matchSnippet, depth }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: snippet.id
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 99 : 1,
      position: 'relative',
      marginLeft: '5px',
      paddingLeft: '3px'
    }

    const handleClick = React.useCallback(
      (e) => {
        if (onClick) onClick(snippet, e)
      },
      [onClick, snippet]
    )

    return (
      <SidebarItem
        snippet={snippet}
        variant="list"
        onClick={handleClick}
        isActive={isActive}
        searchQuery={searchQuery}
        matchSnippet={matchSnippet}
        dndProps={{ attributes, listeners, setNodeRef }}
        style={style}
      />
    )
  }
)

SortableListItem.displayName = 'SortableListItem'

export default SortableListItem
