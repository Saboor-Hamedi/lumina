import React from 'react'
import { useDndContext } from '@dnd-kit/core'

export interface OverlayWrapperProps {
  children?: React.ReactNode
}

export const OverlayWrapper: React.FC<OverlayWrapperProps> = ({ children }) => {
  const { active } = useDndContext()
  const width = (active?.rect?.current as any)?.initial?.width
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
