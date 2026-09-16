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
        border: `2px dashed ${isOver ? 'var(--text-accent, #40bafa)' : 'var(--border-dim)'}`,
        borderRadius: '8px',
        textAlign: 'center',
        color: isOver ? 'var(--text-accent, #40bafa)' : 'var(--text-muted)',
        background: isOver ? 'color-mix(in srgb, var(--text-accent, #40bafa) 10%, transparent)' : 'transparent',
        boxShadow: isOver ? '0 0 12px color-mix(in srgb, var(--text-accent, #40bafa) 30%, transparent)' : 'none',
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
