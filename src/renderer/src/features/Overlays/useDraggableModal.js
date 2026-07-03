import { useState, useRef, useCallback, useEffect } from 'react'

export const useDraggableModal = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const initialPos = useRef({ x: 0, y: 0 })

  const handleDragStart = useCallback((e) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    initialPos.current = { x: position.x, y: position.y }
  }, [position])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return
      const deltaX = e.clientX - dragStart.current.x
      const deltaY = e.clientY - dragStart.current.y
      setPosition({
        x: initialPos.current.x + deltaX,
        y: initialPos.current.y + deltaY
      })
    }

    const handleMouseUp = () => {
      isDragging.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const style = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    transition: isDragging.current ? 'none' : undefined,
    position: 'relative'
  }

  return { style, handleDragStart }
}
