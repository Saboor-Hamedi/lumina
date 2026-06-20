import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, Maximize2, Minimize2, Trash2, ArrowDownToLine } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useAIStore } from '../../core/store/useAIStore'
import AIChatPanel from '../AI/AIChatPanel'
import ModalHeader from './ModalHeader'
import './AIChatModal.css'

/**
 * AIChatModal Component
 * Draggable, resizable, and maximizable modal overlay for AI Chat.
 * Provides a floating chat window experience within the main window.
 * Similar to ThemeModal but with drag, resize, and maximize capabilities.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is currently open
 * @param {Function} props.onClose - Callback function when modal is closed
 * @param {Function} [props.onUnfloat] - Callback function to restore modal to sidebar
 * @returns {JSX.Element|null} The modal component or null if not open
 */
const AIChatModal = ({ isOpen, onClose, onUnfloat }) => {
  const modalRef = useRef(null)
  const { chatMessages, clearChat } = useAIStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [resizeDirection, setResizeDirection] = useState(null)
  const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  // Load saved position and size from localStorage
  const [modalState, setModalState] = useState(() => {
    try {
      const saved = localStorage.getItem('aiChatModalState')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          top: parsed.top ?? window.innerHeight * 0.1,
          left: parsed.left ?? window.innerWidth * 0.6,
          width: parsed.width ?? 400,
          height: parsed.height ?? 600
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    // Default: position on right side, centered vertically
    return {
      top: window.innerHeight * 0.1,
      left: window.innerWidth * 0.6,
      width: 400,
      height: 600
    }
  })

  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen) {
        onClose()
        return true
      }
      return false
    }
  })

  /**
   * Persist modal position and size to localStorage when changed.
   * Only saves when modal is open and not maximized.
   */
  useEffect(() => {
    if (isOpen && !isMaximized) {
      try {
        localStorage.setItem('aiChatModalState', JSON.stringify(modalState))
      } catch (e) {
        // Ignore storage errors (e.g., quota exceeded)
        console.warn('[AIChatModal] Failed to save modal state:', e)
      }
    }
  }, [modalState, isOpen, isMaximized])

  /**
   * Handles the start of a drag operation on the modal header.
   * @param {MouseEvent} e - Mouse event
   */
  const handleDragStart = useCallback(
    (e) => {
      if (isMaximized) return
      if (e.target.closest('button')) return // Don't drag if clicking a button
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        top: modalState.top,
        left: modalState.left
      }
    },
    [modalState, isMaximized]
  )

  const rafRef = useRef(null)

  /**
   * Handles dragging the modal while mouse is moving.
   * Constrains the modal to stay within the viewport bounds.
   * @param {MouseEvent} e - Mouse event
   */
  const handleDrag = useCallback(
    (e) => {
      if (!isDragging || isMaximized) return

      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      rafRef.current = requestAnimationFrame(() => {
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

        // Direct DOM mutation for smooth dragging
        if (modalRef.current) {
          modalRef.current.style.left = `${finalLeft}px`
          modalRef.current.style.top = `${finalTop}px`
        }

        // Store latest position for drag end
        dragStartPos.current.latestLeft = finalLeft
        dragStartPos.current.latestTop = finalTop
      })
    },
    [isDragging, isMaximized, modalState.width, modalState.height]
  )

  /**
   * Handles the end of a drag operation.
   */
  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (dragStartPos.current.latestLeft !== undefined) {
      setModalState((prev) => ({
        ...prev,
        left: dragStartPos.current.latestLeft,
        top: dragStartPos.current.latestTop
      }))
    }
  }, [])

  // Sync modal state to DOM when not dragging/resizing
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
  }, [modalState, isMaximized, isDragging, isResizing])

  // Resize functionality
  const handleResizeStart = useCallback(
    (e, direction) => {
      if (isMaximized) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      setResizeDirection(direction)
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

  /**
   * Handles resizing the modal while mouse is moving.
   * Respects minimum and maximum size constraints.
   * @param {MouseEvent} e - Mouse event
   */
  const handleResize = useCallback(
    (e) => {
      if (!isResizing || isMaximized || !resizeDirection) return

      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      rafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - resizeStartPos.current.x
        const deltaY = e.clientY - resizeStartPos.current.y

        const minWidth = 300
        const minHeight = 400
        const maxWidth = window.innerWidth
        const maxHeight = window.innerHeight

        let newWidth = resizeStartPos.current.width
        let newHeight = resizeStartPos.current.height
        let newLeft = resizeStartPos.current.left
        let newTop = resizeStartPos.current.top

        // Handle resize based on direction
        if (resizeDirection.includes('right')) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width + deltaX))
        }
        if (resizeDirection.includes('left')) {
          const widthDelta =
            resizeStartPos.current.width - Math.max(minWidth, resizeStartPos.current.width - deltaX)
          newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width - deltaX))
          newLeft = Math.max(
            0,
            resizeStartPos.current.left + (resizeStartPos.current.width - newWidth)
          )
        }
        if (resizeDirection.includes('bottom')) {
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, resizeStartPos.current.height + deltaY)
          )
        }
        if (resizeDirection.includes('top')) {
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, resizeStartPos.current.height - deltaY)
          )
          newTop = Math.max(
            0,
            resizeStartPos.current.top + (resizeStartPos.current.height - newHeight)
          )
        }

        if (modalRef.current) {
          modalRef.current.style.width = `${newWidth}px`
          modalRef.current.style.height = `${newHeight}px`
          modalRef.current.style.left = `${newLeft}px`
          modalRef.current.style.top = `${newTop}px`
        }

        resizeStartPos.current.latestState = {
          width: newWidth,
          height: newHeight,
          left: newLeft,
          top: newTop
        }
      })
    },
    [isResizing, isMaximized, resizeDirection]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    setResizeDirection(null)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (resizeStartPos.current.latestState) {
      setModalState((prev) => ({
        ...prev,
        ...resizeStartPos.current.latestState
      }))
    }
  }, [])

  /**
   * Toggles the modal between maximized and windowed states.
   */
  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev)
  }, [])

  // Mouse event handlers
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

  if (!isOpen) return null

  return (
    <div className="modal-overlay ai-chat-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal-container ai-chat-modal-container ${isMaximized ? 'maximized' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          maxWidth: isMaximized ? '100%' : '90vw',
          maxHeight: isMaximized ? '100%' : '90vh'
        }}
      >
        <ModalHeader
          onMouseDown={handleDragStart}
          style={{ cursor: isMaximized ? 'default' : 'move' }}
          title="AI Chat"
          icon={<MessageSquare size={16} />}
          right={
            <>
              {chatMessages.length > 0 && (
                <button
                  className="modal-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    try {
                      clearChat()
                    } catch (error) {
                      console.error('[AIChatModal] Failed to clear chat:', error)
                    }
                  }}
                  title="Clear History"
                  aria-label="Clear History"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                className="modal-maximize-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleMaximize()
                }}
                title={isMaximized ? 'Restore' : 'Maximize'}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
              >
                <Minimize2 size={16} />
              </button>
              {onUnfloat && (
                <button
                  className="modal-unfloat-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnfloat()
                  }}
                  title="Unfloat (Restore to sidebar)"
                  aria-label="Unfloat"
                >
                  <ArrowDownToLine size={16} />
                </button>
              )}
            </>
          }
          onClose={onClose}
        />

        {/* Resize handles */}
        {!isMaximized && (
          <>
            <div
              className="resize-handle resize-handle-right"
              onMouseDown={(e) => handleResizeStart(e, 'right')}
            />
            <div
              className="resize-handle resize-handle-bottom"
              onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            />
            <div
              className="resize-handle resize-handle-bottom-right"
              onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
            />
            <div
              className="resize-handle resize-handle-left"
              onMouseDown={(e) => handleResizeStart(e, 'left')}
            />
            <div
              className="resize-handle resize-handle-top"
              onMouseDown={(e) => handleResizeStart(e, 'top')}
            />
            <div
              className="resize-handle resize-handle-top-left"
              onMouseDown={(e) => handleResizeStart(e, 'top-left')}
            />
            <div
              className="resize-handle resize-handle-top-right"
              onMouseDown={(e) => handleResizeStart(e, 'top-right')}
            />
            <div
              className="resize-handle resize-handle-bottom-left"
              onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
            />
          </>
        )}

        <div className="ai-chat-modal-body">
          <AIChatPanel />
        </div>
      </div>
    </div>
  )
}

export default React.memo(AIChatModal)
