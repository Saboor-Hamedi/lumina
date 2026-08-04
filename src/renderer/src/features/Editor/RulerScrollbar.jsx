import React, { useEffect, useState, useRef } from 'react'
import './RulerScrollbar.css'

const RulerScrollbar = ({ scrollerRef }) => {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const containerRef = useRef(null)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller
      const maxScroll = scrollHeight - clientHeight
      const progress = maxScroll > 0 ? scrollTop / maxScroll : 0
      setScrollProgress(progress)
    }

    scroller.addEventListener('scroll', handleScroll, { passive: true })

    const resizeObserver = new ResizeObserver(() => {
      handleScroll()
    })
    resizeObserver.observe(scroller)
    // Also observe the inner child just in case
    if (scroller.firstElementChild) {
      resizeObserver.observe(scroller.firstElementChild)
    }

    handleScroll()

    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
  }, [scrollerRef, scrollerRef.current])

  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight)
    }
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Drag to scroll
  const handlePointerDown = (e) => {
    e.preventDefault()
    const scroller = scrollerRef.current
    if (!scroller) return

    const startY = e.clientY
    const startScrollTop = scroller.scrollTop
    const maxScroll = scroller.scrollHeight - scroller.clientHeight

    // ratio: pixels of scroll per pixel of mouse movement
    // The tape visual length is tapeHeight.
    // If the tape moves tapeHeight, the scroll moves maxScroll.
    // So 1px of tape movement = maxScroll / tapeHeight pixels of scroll.
    const ratio = maxScroll > 0 && tapeHeight > 0 ? maxScroll / tapeHeight : 0

    const handlePointerMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY
      // dragging mouse down means we want to scroll down.
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

  const numTicks = 150 // Long enough tape
  const tickSpacing = 8
  const tapeHeight = (numTicks - 1) * tickSpacing

  const centerOffset = containerHeight / 2
  const tapeOffset = centerOffset - scrollProgress * tapeHeight

  return (
    <div className="ruler-scrollbar-wrapper" ref={containerRef} onPointerDown={handlePointerDown}>
      <div className="ruler-tape-container">
        <div
          className="ruler-tape"
          style={{ transform: `translateY(${tapeOffset}px)`, height: `${tapeHeight}px` }}
        >
          {Array.from({ length: numTicks }).map((_, i) => (
            <div key={i} className={`ruler-tick ${i % 5 === 0 ? 'major' : 'minor'}`} />
          ))}
        </div>
      </div>
      <div className="ruler-center-mark" />
    </div>
  )
}

export default RulerScrollbar
