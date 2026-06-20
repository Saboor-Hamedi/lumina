import { useState, useRef, useCallback, useEffect } from 'react'
import { useSettingsStore } from '../../core/store/useSettingsStore'

export const useResizable = (modalRef, initialWidth = 350, initialHeight = 500) => {
  const { settings } = useSettingsStore()
  const [size, setSize] = useState({
    width: settings.explorerModalWidth || initialWidth,
    height: settings.explorerModalHeight || initialHeight
  })

  const latestSize = useRef(size)
  const startSize = useRef({ width: 0, height: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const isResizing = useRef(false)

  // Sync with settings loaded from backend async
  useEffect(() => {
    if (!isResizing.current && (settings.explorerModalWidth || settings.explorerModalHeight)) {
      const newSize = {
        width: settings.explorerModalWidth || size.width,
        height: settings.explorerModalHeight || size.height
      }
      setSize(newSize)
      latestSize.current = newSize
    }
  }, [settings.explorerModalWidth, settings.explorerModalHeight])

  const handleResizeStart = useCallback(
    (e, direction) => {
      e.preventDefault()
      e.stopPropagation()
      isResizing.current = true
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
          newHeight = Math.max(300, Math.min(600, startSize.current.height + deltaY))
        }
        if (direction.includes('right')) {
          newWidth = Math.max(300, Math.min(600, startSize.current.width + deltaX * 2)) // *2 keeps it centered
        }
        if (direction.includes('left')) {
          newWidth = Math.max(300, Math.min(600, startSize.current.width - deltaX * 2)) // *2 keeps it centered
        }

        latestSize.current = { width: newWidth, height: newHeight }
        setSize(latestSize.current)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        if (modalRef.current) {
          modalRef.current.style.transition = ''
        }

        // Persist to store without triggering infinite loop
        useSettingsStore.getState().updateSetting('explorerModalWidth', latestSize.current.width)
        useSettingsStore.getState().updateSetting('explorerModalHeight', latestSize.current.height)
        isResizing.current = false
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [size, modalRef]
  )

  return { size, handleResizeStart }
}
