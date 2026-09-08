import React, { useRef, useState, useEffect } from 'react'
import {
  History,
  Minimize,
  Maximize,
  ArrowRightToLine
} from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../modals/ModalHeader'
import { LuminaChatContent } from './components/LuminaChatContent'
import { MessageContent } from './components/MessageContent'
import { ThinkingIndicator } from './components/ThinkingIndicator'
import { ChatMessageRow } from './components/ChatMessageRow'
import { useModalWindow } from './hooks/useModalWindow'
import '../../assets/appshell.css'
import './lumina.css'

/**
 * LuminaChat Floating Modal Component
 */
const LuminaChat = ({ isOpen, onClose, onDock, onUnfloat }) => {
  useKeyboardShortcuts({
    onEscape: isOpen
      ? () => {
          const selection = window.getSelection()
          if (selection && !selection.isCollapsed) {
            selection.removeAllRanges()
            return
          }
          onClose()
        }
      : null
  })

  const modalRef = useRef(null)
  const isMouseInsideRef = useRef(false)
  const isLuminaActiveRef = useRef(false)
  const [isMaximized, setIsMaximized] = useState(false)

  const {
    modalState,
    isDragging,
    isResizing,
    isMinimized,
    handleDragStart,
    handleResizeStart,
    handleToggleMaximize,
    handleToggleMinimize
  } = useModalWindow({
    isOpen,
    isMaximized,
    setIsMaximized,
    modalRef
  })

  // Synchronize active state with open state
  useEffect(() => {
    if (isOpen) {
      isLuminaActiveRef.current = true
    } else {
      isLuminaActiveRef.current = false
      isMouseInsideRef.current = false
    }
  }, [isOpen])

  // Track whether mouse/pointer interaction is inside Lumina modal vs outside
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e) => {
      if (modalRef.current && modalRef.current.contains(e.target)) {
        isLuminaActiveRef.current = true
      } else {
        isLuminaActiveRef.current = false
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [isOpen])

  // Scoped Ctrl+A / Cmd+A: only select current Lumina session, never background editor
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDownCapture = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'a') {
        const target = e.target
        const activeEl = document.activeElement

        const isTargetInModal =
          modalRef.current &&
          (modalRef.current.contains(target) || modalRef.current.contains(activeEl))
        const isHovered = isMouseInsideRef.current
        const isActive = isLuminaActiveRef.current

        if (isTargetInModal || isHovered || isActive) {
          // If the user is typing in an active input/textarea with content, let native selection select inside the input
          const isEditable =
            (target &&
              (target.tagName === 'TEXTAREA' ||
                target.tagName === 'INPUT' ||
                target.isContentEditable)) ||
            (activeEl &&
              (activeEl.tagName === 'TEXTAREA' ||
                activeEl.tagName === 'INPUT' ||
                activeEl.isContentEditable))

          if (isEditable) {
            const el =
              target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT' ? target : activeEl
            if (el && typeof el.value === 'string' && el.value.length > 0) {
              return
            }
          }

          // Otherwise, intercept and prevent CodeMirror/browser document selection
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          // Select the entire current chat session (all messages)
          const msgContainer =
            modalRef.current?.querySelector('.chat-msg-list') ||
            modalRef.current?.querySelector('.chat-messages')

          if (msgContainer) {
            const selection = window.getSelection()
            if (selection) {
              const range = document.createRange()
              range.selectNodeContents(msgContainer)
              selection.removeAllRanges()
              selection.addRange(range)
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDownCapture, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, true)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay ai-chat-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`modal-container ai-chat-modal-container ${isMaximized ? 'maximized' : ''} ${isMinimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={() => {
          isLuminaActiveRef.current = true
        }}
        onMouseEnter={() => {
          isMouseInsideRef.current = true
        }}
        onMouseLeave={() => {
          isMouseInsideRef.current = false
        }}
        style={{
          outline: 'none',
          ...(isMaximized
            ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', borderRadius: 0 }
            : isMinimized
              ? { position: 'fixed', top: 'auto', left: 'auto', bottom: '26px', right: '14px', width: '220px' }
              : {
                  position: 'absolute',
                  top: modalState.top,
                  left: modalState.left,
                  width: modalState.width,
                  height: modalState.height
                })
        }}
      >
        <ModalHeader
          onMouseDown={handleDragStart}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{ cursor: 'move' }}
          left={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="modal-action-icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  window.dispatchEvent(new CustomEvent('ai-toggle-history'))
                }}
                title="Toggle History Sidebar"
                aria-label="Toggle History Sidebar"
              >
                <History size={14} />
              </button>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                Lumina AI
              </span>
            </div>
          }
          right={
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <button
                className="modal-clear-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onDock) onDock()
                  else if (onUnfloat) onUnfloat()
                }}
                title="Dock to Tab Sidebar"
                aria-label="Dock to Tab Sidebar"
              >
                <ArrowRightToLine size={13} />
              </button>
              <button
                className="modal-minimize-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleMinimize()
                }}
                title={isMinimized ? 'Restore' : 'Minimize'}
                aria-label={isMinimized ? 'Restore' : 'Minimize'}
              >
                <Minimize size={13} />
              </button>
              <button
                className="modal-maximize-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleMaximize()
                }}
                title={isMaximized ? 'Restore' : 'Maximize'}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize size={13} /> : <Maximize size={13} />}
              </button>
            </div>
          }
          onClose={onClose}
        />

        {/* Single Bottom-Right Resize Handle */}
        {!isMaximized && (
          <div
            className="resize-handle resize-handle-bottom-right"
            onMouseDown={handleResizeStart}
            title="Resize window"
          />
        )}

        {(isDragging || isResizing) && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              cursor: isDragging ? 'grabbing' : 'nwse-resize'
            }}
          />
        )}

        <div
          className="ai-chat-modal-body"
          style={{
            height: 'calc(100% - 40px)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'text'
          }}
        >
          <LuminaChatContent isSidebar={false} />
        </div>
      </div>
    </div>
  )
}

export { LuminaChatContent, MessageContent, ThinkingIndicator, ChatMessageRow }
export default React.memo(LuminaChat)
