import React, { useRef, useState, useEffect } from 'react'

/**
 * Native Virtual List (Engineering Standard: Zero Dependency)
 * A lightweight, pixel-perfect virtualization engine built specifically for Lumina.
 * Eliminates all bundler/ESM compatibility issues.
 */
export const FixedSizeList = ({ 
  height, 
  itemCount, 
  itemSize, 
  width, 
  children: RowComponent,
  className 
}) => {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)

  // 1. Handle Scrolling
  const onScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  // 2. Calculate Range
  const totalHeight = itemCount * itemSize
  const startIndex = Math.max(0, Math.floor(scrollTop / itemSize))
  // Render buffer of 5 items
  const endIndex = Math.min(
    itemCount, 
    Math.ceil((scrollTop + height) / itemSize) + 5
  )

  // 3. Generate Visible Items
  const items = []
  for (let i = startIndex; i < endIndex; i++) {
    items.push(
      <RowComponent
        key={i}
        index={i}
        style={{
          position: 'absolute',
          top: i * itemSize,
          left: 0,
          width: '100%',
          height: itemSize,
        }}
      />
    )
  }

  return (
    <div 
      className={className}
      ref={containerRef}
      onScroll={onScroll}
      style={{
        width,
        height,
        overflow: 'auto',
        position: 'relative',
        willChange: 'transform' // Performance optimization
      }}
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {items}
      </div>
    </div>
  )
}
