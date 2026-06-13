import { useState, useRef, useCallback } from 'react'
import { useSettingsStore } from '../../core/store/useSettingsStore'

export const useResizable = (modalRef, initialWidth = 350, initialHeight = 500) => {
  const { settings } = useSettingsStore()
  const [size, setSize] = useState({
    width: settings.explorerModalWidth || initialWidth,
    height: settings.explorerModalHeight || initialHeight
  })

  const startSize = useRef({ width: 0, height: 0 })
  const startPos = useRef({ x: 0, y: 0 })

  const handleResizeStart = useCallback((e, direction) => {
    e.preventDefault()
    e.stopPropagation()
    startPos.current = { x: e.clientX, y: e.clientY }
    startSize.current = { width: size.width, height: size.height }

    if (modalRef.current) {
      modalRef.current.style.transition = 'none'
    }

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x
      const deltaY = startPos.current.y - moveEvent.clientY // positive when dragging UP

      let newWidth = startSize.current.width
      let newHeight = startSize.current.height

      if (direction.includes('top')) {
        newHeight = Math.max(400, Math.min(800, startSize.current.height + deltaY))
      }
      if (direction.includes('right')) {
        newWidth = Math.max(300, Math.min(800, startSize.current.width + deltaX * 2)) // *2 keeps it centered
      }
      if (direction.includes('left')) {
        newWidth = Math.max(300, Math.min(800, startSize.current.width - deltaX * 2)) // *2 keeps it centered
      }

      setSize({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      
      if (modalRef.current) {
        modalRef.current.style.transition = ''
      }

      // Persist to store without triggering infinite loop
      useSettingsStore.getState().updateSettings({
        explorerModalWidth: parseInt(modalRef.current.style.width),
        explorerModalHeight: parseInt(modalRef.current.style.height)
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [size, modalRef])

  return { size, handleResizeStart }
}
