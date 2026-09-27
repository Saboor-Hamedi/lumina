import { useState, useRef, useEffect, useCallback, MouseEvent as ReactMouseEvent } from 'react'

interface Position {
  x: number
  y: number
}

/**
 * Custom hook to manage floating draggable window behavior for the Settings modal.
 * Smoothly synchronizes drag displacement with requestAnimationFrame and disables
 * dragging when maximized.
 */
export function useModalDrag(isMaximized: boolean) {
  const [isDraggingModal, setIsDraggingModal] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const modalPos = useRef<Position>({ x: 0, y: 0 })
  const dragStart = useRef<Position>({ x: 0, y: 0 })
  const rafId = useRef<number | null>(null)

  // Global mousemove and mouseup listeners for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingModal || isMaximized) return

      const newX = e.clientX - dragStart.current.x
      const newY = e.clientY - dragStart.current.y
      modalPos.current = { x: newX, y: newY }

      if (rafId.current) cancelAnimationFrame(rafId.current)

      rafId.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
        }
      })
    }

    const handleMouseUp = () => {
      setIsDraggingModal(false)
      if (rafId.current) cancelAnimationFrame(rafId.current)
      if (containerRef.current && !isMaximized) {
        containerRef.current.style.transition = '0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isMaximized, isDraggingModal])

  // Mouse down handler attached to modal header bar
  const handleModalHeaderMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (isMaximized) return
      setIsDraggingModal(true)

      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }

      dragStart.current = {
        x: e.clientX - modalPos.current.x,
        y: e.clientY - modalPos.current.y
      }
    },
    [isMaximized]
  )

  // Reset coordinates when maximized
  useEffect(() => {
    if (isMaximized) {
      modalPos.current = { x: 0, y: 0 }
      if (containerRef.current) {
        containerRef.current.style.transform = 'none'
      }
    }
  }, [isMaximized])

  return {
    containerRef,
    modalPos,
    isDraggingModal,
    handleModalHeaderMouseDown
  }
}
