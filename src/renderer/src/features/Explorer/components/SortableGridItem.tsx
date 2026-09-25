import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SidebarItem from '../../Navigation/components/SidebarItem'

export interface SortableGridItemProps {
  snippet: any
  getIconForLanguage?: (lang: string) => any
  onSelect: (snippet: any) => void
  onUnpin?: (snippet: any) => void
}

export const SortableGridItem: React.FC<SortableGridItemProps> = ({
  snippet,
  onSelect
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: snippet.id
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 99 : 1
  }

  return (
    <SidebarItem
      snippet={snippet}
      variant="grid"
      onClick={() => onSelect(snippet)}
      dndProps={{ attributes, listeners, setNodeRef }}
      style={style}
    />
  )
}

export default SortableGridItem
