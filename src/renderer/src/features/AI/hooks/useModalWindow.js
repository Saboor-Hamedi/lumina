import { useState, useRef, useCallback, useEffect } from 'react'
import { useSettingsStore } from '../../../core/store/useSettingsStore'

export const useModalWindow = ({ isOpen, isMaximized, setIsMaximized, modalRef }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      const saved =
        useSettingsStore.getState().settings.aiChatModalState ||
        localStorage.getItem('aiChatModalState')
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
      return parsed?.isMinimized ?? false
    } catch (e) {
      return false
    }
  })

  const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  const [modalState, setModalState] = useState(() => {
    try {
      const saved =
        useSettingsStore.getState().settings.aiChatModalState ||
        localStorage.getItem('aiChatModalState')
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
        return {
          top: parsed.top ?? window.innerHeight * 0.1,
          left: parsed.left ?? window.innerWidth * 0.6,
          width: parsed.width ?? 420,
          height: parsed.height ?? 620
        }
      }
    } catch (e) {}
    return {
      top: window.innerHeight * 0.1,
      left: window.innerWidth * 0.6,
      width: 420,
      height: 620
    }
  })

  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.querySelector('textarea')?.focus()
        }
      }, 50)
    } else {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        setTimeout(() => previousFocusRef.current?.focus(), 10)
      }
    }
  }, [isOpen, modalRef])

  useEffect(() => {
    if (isOpen && !isMaximized) {
      try {
        const stateToSave = { ...modalState, isMinimized }
        localStorage.setItem('aiChatModalState', JSON.stringify(stateToSave))
        updateSetting('aiChatModalState', stateToSave)
      } catch (e) {}
    }
  }, [modalState, isMinimized, isOpen, isMaximized, updateSetting])

  // Smooth, lightweight window drag
  const handleDragStart = useCallback(
    (e) => {
      if (isMaximized || isMinimized) return
      if (e.target.closest('button')) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        top: modalState.top,
        left: modalState.left,
        latestTop: modalState.top,
        latestLeft: modalState.left
      }
    },
    [modalState, isMaximized, isMinimized]
  )

  const handleDrag = useCallback(
    (e) => {
      if (!isDragging || isMaximized) return
      const deltaX = e.clientX - dragStartPos.current.x
      const deltaY = e.clientY - dragStartPos.current.y
      const newLeft = dragStartPos.current.left + deltaX
      const newTop = dragStartPos.current.top + deltaY
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const modalWidth = isMaximized ? viewportWidth : modalState.width
      const modalHeight = isMaximized ? viewportHeight : modalState.height
      const finalLeft = Math.max(0, Math.min(newLeft, viewportWidth - modalWidth))
      const finalTop = Math.max(0, Math.min(newTop, viewportHeight - modalHeight))
      if (modalRef.current) {
        modalRef.current.style.left = `${finalLeft}px`
        modalRef.current.style.top = `${finalTop}px`
      }
      dragStartPos.current.latestLeft = finalLeft
      dragStartPos.current.latestTop = finalTop
    },
    [isDragging, isMaximized, modalState.width, modalState.height, modalRef]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    if (dragStartPos.current.latestLeft !== undefined) {
      setModalState((prev) => ({
        ...prev,
        left: dragStartPos.current.latestLeft,
        top: dragStartPos.current.latestTop
      }))
    }
  }, [])

  useEffect(() => {
    if (modalRef.current && !isDragging && !isResizing) {
      if (isMaximized) {
        modalRef.current.style.top = '0px'
        modalRef.current.style.left = '0px'
        modalRef.current.style.width = '100%'
        modalRef.current.style.height = '100%'
      } else {
        modalRef.current.style.top = `${modalState.top}px`
        modalRef.current.style.left = `${modalState.left}px`
        modalRef.current.style.width = `${modalState.width}px`
        modalRef.current.style.height = `${modalState.height}px`
      }
    }
  }, [modalState, isMaximized, isDragging, isResizing, modalRef])

  // Single Bottom-Right Corner Resize
  const handleResizeStart = useCallback(
    (e) => {
      if (isMaximized) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      resizeStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: modalState.width,
        height: modalState.height,
        left: modalState.left,
        top: modalState.top
      }
    },
    [modalState, isMaximized]
  )

  const handleResize = useCallback(
    (e) => {
      if (!isResizing || isMaximized) return
      const deltaX = e.clientX - resizeStartPos.current.x
      const deltaY = e.clientY - resizeStartPos.current.y
      const minWidth = 320
      const minHeight = 420
      const maxWidth = window.innerWidth
      const maxHeight = window.innerHeight

      const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width + deltaX))
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, resizeStartPos.current.height + deltaY)
      )

      if (modalRef.current) {
        modalRef.current.style.width = `${newWidth}px`
        modalRef.current.style.height = `${newHeight}px`
      }
      resizeStartPos.current.latestState = {
        width: newWidth,
        height: newHeight
      }
    },
    [isResizing, isMaximized, modalRef]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    if (resizeStartPos.current.latestState) {
      setModalState((prev) => ({ ...prev, ...resizeStartPos.current.latestState }))
    }
  }, [])

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev)
    if (isMinimized) setIsMinimized(false)
  }, [isMinimized, setIsMaximized])

  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev)
    if (isMaximized) setIsMaximized(false)
  }, [isMaximized, setIsMaximized])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDrag)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDrag, handleDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResize)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResize, handleResizeEnd])

  return {
    modalState,
    isDragging,
    isResizing,
    isMinimized,
    handleDragStart,
    handleResizeStart,
    handleToggleMaximize,
    handleToggleMinimize
  }
}

export default useModalWindow
