import React from 'react'
import { useDroppable } from '@dnd-kit/core'

export const DroppableRootZone = React.memo(() => {
  const { isOver, setNodeRef } = useDroppable({ id: 'root-drop-zone' })

  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '12px',
        margin: '4px 8px',
        border: `2px dashed ${isOver ? 'var(--accent-primary)' : 'var(--border-dim)'}`,
        borderRadius: '8px',
        textAlign: 'center',
        color: isOver ? 'var(--accent-primary)' : 'var(--text-muted)',
        background: isOver ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
        boxShadow: isOver ? '0 0 8px rgba(59, 130, 246, 0.15)' : 'none',
        transition: 'all 0.2s',
        fontSize: '13px',
        fontWeight: 500
      }}
    >
      Drop here to move to Root
    </div>
  )
})

export default DroppableRootZone
