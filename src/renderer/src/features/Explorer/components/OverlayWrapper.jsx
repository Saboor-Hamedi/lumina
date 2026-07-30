import React from 'react'
import { useDndContext } from '@dnd-kit/core'

export const OverlayWrapper = ({ children }) => {
  const { active } = useDndContext()
  const width = active?.rect?.current?.initial?.width
  return (
    <div
      style={{
        width: width ? `${width}px` : 'auto',
        boxSizing: 'border-box',
        pointerEvents: 'none'
      }}
    >
      {children}
    </div>
  )
}

export default OverlayWrapper
