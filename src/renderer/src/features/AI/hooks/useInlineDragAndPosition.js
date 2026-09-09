import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

/**
 * Custom hook for silky-smooth dragging and viewport-aware positioning of InlineLumina modal.
 */
export const useInlineDragAndPosition = ({ editorView, isOpen }) => {
  const modalRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const getInitialPosition = useCallback(() => {
    const modalWidth = 440
    const defaultLeft = Math.round((window.innerWidth - modalWidth) / 2)
    const defaultTop = 120

    if (editorView?.hasFocus) {
      try {
        const selection = editorView.state.selection.main
        const pos = selection.head || selection.from
        const coords = editorView.coordsAtPos(pos)
        if (coords && coords.top >= 40 && coords.top <= window.innerHeight - 100) {
          let top = coords.bottom + 10
          let left = coords.left

          if (left + modalWidth > window.innerWidth - 20) {
            left = window.innerWidth - modalWidth - 20
          }
          if (left < 20) left = 20

          if (top + 50 > window.innerHeight - 20) {
            top = Math.max(20, coords.top - 60)
          }

          return {
            top: `${Math.round(top)}px`,
            left: `${Math.round(left)}px`,
            transform: 'none'
          }
        }
      } catch {
        // Fallback to upper center
      }
    }

    return {
      top: `${defaultTop}px`,
      left: `${Math.max(20, defaultLeft)}px`,
      transform: 'none'
    }
  }, [editorView])

  const [modalPosition, setModalPosition] = useState(getInitialPosition)

  // Reset position when opened
  useEffect(() => {
    if (isOpen && !isDragging) {
      setModalPosition(getInitialPosition())
    }
  }, [isOpen, getInitialPosition])

  // Drag handler
  const handleDragStart = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    if (!modalRef.current) return
    const rect = modalRef.current.getBoundingClientRect()

    const startX = e.clientX
    const startY = e.clientY
    const initialLeft = rect.left
    const initialTop = rect.top

    setModalPosition({
      top: `${Math.round(initialTop)}px`,
      left: `${Math.round(initialLeft)}px`,
      transform: 'none'
    })
    setIsDragging(true)

    let rafId = null

    const onPointerMove = (moveEvent) => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        const modalWidth = rect.width
        const modalHeight = rect.height
        const maxLeft = window.innerWidth - modalWidth - 10
        const maxTop = window.innerHeight - modalHeight - 10

        const newLeft = Math.max(10, Math.min(maxLeft, initialLeft + deltaX))
        const newTop = Math.max(10, Math.min(maxTop, initialTop + deltaY))

        setModalPosition({
          top: `${Math.round(newTop)}px`,
          left: `${Math.round(newLeft)}px`,
          transform: 'none'
        })
      })
    }

    const onPointerUp = () => {
      if (rafId) cancelAnimationFrame(rafId)
      setIsDragging(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { once: true })
  }, [])

  const modalStyle = useMemo(() => {
    const style = {
      top: typeof modalPosition.top === 'number' ? `${modalPosition.top}px` : modalPosition.top,
      left: typeof modalPosition.left === 'number' ? `${modalPosition.left}px` : modalPosition.left
    }
    if (modalPosition.transform) {
      style.transform = modalPosition.transform
    }
    return style
  }, [modalPosition])

  return {
    modalRef,
    modalPosition,
    isDragging,
    handleDragStart,
    modalStyle
  }
}
