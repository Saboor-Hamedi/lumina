import React, {
  useRef,
  useState,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle
} from 'react'

export type ScrollAlign = 'auto' | 'start' | 'end' | 'center' | 'smart'

export interface FixedSizeListHandle {
  readonly container: HTMLDivElement | null
  readonly scrollTop: number
  scrollToItem: (index: number, align?: ScrollAlign) => void
}

export interface ListChildComponentProps<T = unknown> {
  index: number
  style: React.CSSProperties
  data: T
}

export interface FixedSizeListProps<T = unknown> {
  height: number
  itemCount: number
  itemSize: number
  width: number | string
  itemData?: T
  children: React.ComponentType<ListChildComponentProps<T>>
  className?: string
  onScroll?: (props: { scrollOffset: number }) => void
}

function FixedSizeListInner<T = unknown>(
  {
    height,
    itemCount,
    itemSize,
    width,
    itemData,
    children: RowComponent,
    className,
    onScroll
  }: FixedSizeListProps<T>,
  ref: React.ForwardedRef<FixedSizeListHandle>
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState<number>(0)

  // Prevent browser from restoring scroll position which desyncs from React state
  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [])

  useImperativeHandle(ref, () => ({
    get container() {
      return containerRef.current
    },
    get scrollTop() {
      return scrollTop
    },
    scrollToItem: (index: number, align: ScrollAlign = 'auto') => {
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const st = e.currentTarget.scrollTop
    setScrollTop(st)
    if (onScroll) onScroll({ scrollOffset: st })
  }

  const totalHeight = itemCount * itemSize
  const startIndex = Math.max(0, Math.floor(scrollTop / itemSize))
  const endIndex = Math.min(itemCount, Math.ceil((scrollTop + height) / itemSize) + 5)

  const items: React.ReactNode[] = []
  for (let i = startIndex; i < endIndex; i++) {
    items.push(
      <RowComponent
        key={i}
        index={i}
        data={itemData as T}
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

export const FixedSizeList = forwardRef(FixedSizeListInner) as <T = unknown>(
  props: FixedSizeListProps<T> & { ref?: React.Ref<FixedSizeListHandle> }
) => React.ReactElement | null
