/**
 * =========================================================================
 * RulerScrollbar Component (`RulerScrollbar.tsx`)
 * =========================================================================
 *
 * Ultra high-performance vintage measuring tape scrollbar for the markdown editor.
 *
 * Performance Architecture:
 * - Direct GPU CSS transforms (`translateY`) bypassed from React re-renders.
 * - Zero React `setState` during rapid wheel and touch scrolls for 120 FPS parity.
 * - Smooth pointer drag scrubbing with precise delta ratio computation.
 * =========================================================================
 */

import React, { useEffect, useRef, memo } from 'react'
import './RulerScrollbar.css'

export interface RulerScrollbarProps {
  scrollerRef: React.RefObject<HTMLDivElement | null>
  isActive?: boolean
}

const NUM_TICKS = 150
const TICK_SPACING = 8
const TAPE_HEIGHT = (NUM_TICKS - 1) * TICK_SPACING

export const RulerScrollbar: React.FC<RulerScrollbarProps> = memo(({ scrollerRef, isActive = true }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tapeRef = useRef<HTMLDivElement | null>(null)
  const containerHeightRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive) return
    const scroller = scrollerRef.current
    if (!scroller) return

    let rafId: number | null = null

    const updateTapePosition = () => {
      if (!tapeRef.current) return
      const { scrollTop, scrollHeight, clientHeight } = scroller
      const maxScroll = scrollHeight - clientHeight
      const progress = maxScroll > 0 ? scrollTop / maxScroll : 0
      const centerOffset = containerHeightRef.current / 2
      const tapeOffset = centerOffset - progress * TAPE_HEIGHT
      tapeRef.current.style.transform = `translateY(${tapeOffset}px)`
    }

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateTapePosition)
    }

    scroller.addEventListener('scroll', handleScroll, { passive: true })

    const resizeObserver = new ResizeObserver(() => {
      handleScroll()
    })
    resizeObserver.observe(scroller)
    if (scroller.firstElementChild) {
      resizeObserver.observe(scroller.firstElementChild)
    }

    // Initial positioning
    handleScroll()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      scroller.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
  }, [scrollerRef, isActive])

  useEffect(() => {
    if (!isActive) return
    if (containerRef.current) {
      containerHeightRef.current = containerRef.current.clientHeight
    }
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeightRef.current = entry.contentRect.height
        if (scrollerRef.current && tapeRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollerRef.current
          const maxScroll = scrollHeight - clientHeight
          const progress = maxScroll > 0 ? scrollTop / maxScroll : 0
          const centerOffset = containerHeightRef.current / 2
          const tapeOffset = centerOffset - progress * TAPE_HEIGHT
          tapeRef.current.style.transform = `translateY(${tapeOffset}px)`
        }
      }
    })
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [scrollerRef, isActive])

  // Drag to scroll
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const scroller = scrollerRef.current
    if (!scroller) return

    const startY = e.clientY
    const startScrollTop = scroller.scrollTop
    const maxScroll = scroller.scrollHeight - scroller.clientHeight
    const ratio = maxScroll > 0 && TAPE_HEIGHT > 0 ? maxScroll / TAPE_HEIGHT : 0

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY
      scroller.scrollTop = startScrollTop + deltaY * ratio
    }

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = 'default'
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.body.style.cursor = 'ns-resize'
  }

  return (
    <div
      className="ruler-scrollbar-wrapper"
      ref={containerRef}
      onPointerDown={handlePointerDown}
    >
      <div className="ruler-tape-container">
        <div
          ref={tapeRef}
          className="ruler-tape"
          style={{ height: `${TAPE_HEIGHT}px` }}
        >
          {Array.from({ length: NUM_TICKS }).map((_, i) => (
            <div
              key={i}
              className={`ruler-tick ${i % 5 === 0 ? 'major' : 'minor'}`}
            />
          ))}
        </div>
      </div>
      <div className="ruler-center-mark" />
    </div>
  )
})

RulerScrollbar.displayName = 'RulerScrollbar'

export default RulerScrollbar
