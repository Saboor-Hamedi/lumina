import { useState, useRef, useCallback, useEffect } from 'react'

export const useDraggableModal = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const initialPos = useRef({ x: 0, y: 0 })
  const rafId = useRef(null)

  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 })
  }, [])

  const handleDragStart = useCallback(
    (e) => {
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
    const handleMouseMove = (e) => {
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

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.userSelect = ''
        if (rafId.current) cancelAnimationFrame(rafId.current)
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  const style = {
    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
    position: 'relative',
    willChange: isDragging.current ? 'transform' : 'auto'
  }

  return { style, handleDragStart, resetPosition, isDragging: isDragging.current }
}
