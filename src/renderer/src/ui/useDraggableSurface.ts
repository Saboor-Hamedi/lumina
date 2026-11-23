import { useRef, useCallback, useEffect } from 'react'

export interface UseDraggableSurfaceOptions {
  capture?: boolean
}

export function useDraggableSurface<T extends HTMLElement = HTMLDivElement>(
  options: UseDraggableSurfaceOptions = {}
) {
  const { capture = true } = options
  const surfaceRef = useRef<T | null>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const initialPosRef = useRef({ x: 0, y: 0 })
  const cleanupRef = useRef<(() => void) | null>(null)

  const resetPosition = useCallback(() => {
    posRef.current = { x: 0, y: 0 }
    if (surfaceRef.current) {
      surfaceRef.current.style.transform = 'translate3d(0px, 0px, 0)'
    }
  }, [])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      e.preventDefault()
      e.stopPropagation()

      cleanupRef.current?.()

      isDraggingRef.current = true
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      initialPosRef.current = { x: posRef.current.x, y: posRef.current.y }
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = 'none'
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current || !surfaceRef.current) return
        const nextX = initialPosRef.current.x + (moveEvent.clientX - dragStartRef.current.x)
        const nextY = initialPosRef.current.y + (moveEvent.clientY - dragStartRef.current.y)
        posRef.current = { x: nextX, y: nextY }
        surfaceRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`
      }

      const detach = () => {
        isDraggingRef.current = false
        if (typeof document !== 'undefined') {
          document.body.style.userSelect = ''
        }
        window.removeEventListener('mousemove', handleMouseMove, { capture })
        window.removeEventListener('mouseup', handleMouseUp, { capture })
        window.removeEventListener('blur', handleMouseUp)
        cleanupRef.current = null
      }

      const handleMouseUp = () => {
        detach()
      }

      cleanupRef.current = detach
      window.addEventListener('mousemove', handleMouseMove, { capture, passive: true })
      window.addEventListener('mouseup', handleMouseUp, { capture })
      window.addEventListener('blur', handleMouseUp)
    },
    [capture]
  )

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  return {
    surfaceRef,
    posRef,
    handleDragStart,
    resetPosition
  }
}
