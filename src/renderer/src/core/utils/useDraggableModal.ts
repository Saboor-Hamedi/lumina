import { useState, useRef, useCallback, useEffect, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'

interface Point {
  x: number
  y: number
}

export interface UseDraggableModalReturn {
  style: CSSProperties
  handleDragStart: (e: ReactMouseEvent | MouseEvent) => void
  resetPosition: () => void
  isDragging: boolean
}

export const useDraggableModal = (): UseDraggableModalReturn => {
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef<Point>({ x: 0, y: 0 })
  const initialPos = useRef<Point>({ x: 0, y: 0 })
  const rafId = useRef<number | null>(null)

  const resetPosition = useCallback((): void => {
    setPosition({ x: 0, y: 0 })
  }, [])

  const handleDragStart = useCallback(
    (e: ReactMouseEvent | MouseEvent): void => {
      if (e.button !== 0) return
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      e.preventDefault()
      e.stopPropagation()
      isDragging.current = true
      dragStart.current = { x: e.clientX, y: e.clientY }
      initialPos.current = { x: position.x, y: position.y }
      document.body.style.userSelect = 'none'
    },
    [position]
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current) return
      if (rafId.current) cancelAnimationFrame(rafId.current)

      rafId.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragStart.current.x
        const deltaY = e.clientY - dragStart.current.y
        setPosition({
          x: initialPos.current.x + deltaX,
          y: initialPos.current.y + deltaY
        })
      })
    }

    const handleMouseUp = (): void => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.userSelect = ''
        if (rafId.current) cancelAnimationFrame(rafId.current)
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleMouseUp)
      document.body.style.userSelect = ''
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  const style: CSSProperties = {
    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
    position: 'relative',
    willChange: isDragging.current ? 'transform' : 'auto'
  }

  return { style, handleDragStart, resetPosition, isDragging: isDragging.current }
}
