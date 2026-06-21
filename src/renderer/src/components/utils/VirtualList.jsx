import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'

export const FixedSizeList = forwardRef(
  ({ height, itemCount, itemSize, width, itemData, children: RowComponent, className, onScroll }, ref) => {
    const containerRef = useRef(null)
    const [scrollTop, setScrollTop] = useState(0)

    useImperativeHandle(ref, () => ({
      get container() {
        return containerRef.current
      },
      get scrollTop() {
        return scrollTop
      },
      scrollToItem: (index, align = 'auto') => {
        if (!containerRef.current) return
        const top = index * itemSize
        const bottom = top + itemSize
        const containerTop = containerRef.current.scrollTop
        const containerBottom = containerTop + height

        if (align === 'start' || (align === 'auto' && top < containerTop)) {
          containerRef.current.scrollTop = top
        } else if (align === 'end' || (align === 'auto' && bottom > containerBottom)) {
          containerRef.current.scrollTop = bottom - height
        }
      }
    }))

    const handleScroll = (e) => {
      const st = e.currentTarget.scrollTop
      setScrollTop(st)
      if (onScroll) onScroll({ scrollOffset: st })
    }

    const totalHeight = itemCount * itemSize
    const startIndex = Math.max(0, Math.floor(scrollTop / itemSize))
    const endIndex = Math.min(itemCount, Math.ceil((scrollTop + height) / itemSize) + 5)

    const items = []
    for (let i = startIndex; i < endIndex; i++) {
      items.push(
        <RowComponent
          key={i}
          index={i}
          data={itemData}
          style={{
            position: 'absolute',
            top: i * itemSize,
            left: 0,
            width: '100%',
            height: itemSize
          }}
        />
      )
    }

    return (
      <div
        className={className}
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          width,
          height,
          overflow: 'auto',
          position: 'relative',
          willChange: 'transform'
        }}
      >
        <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>{items}</div>
      </div>
    )
  }
)
