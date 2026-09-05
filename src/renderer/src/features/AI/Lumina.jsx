import React, { useRef, useState } from 'react'
import {
  History,
  Minimize,
  Maximize,
  ArrowRightToLine
} from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../Overlays/ModalHeader'
import { LuminaChatContent } from './components/LuminaChatContent'
import { MessageContent } from './components/MessageContent'
import { ThinkingIndicator } from './components/ThinkingIndicator'
import { useModalWindow } from './hooks/useModalWindow'
import '../../assets/appshell.css'
import './lumina.css'

/**
 * LuminaChat Floating Modal Component
 */
const LuminaChat = ({ isOpen, onClose, onDock, onUnfloat }) => {
  useKeyboardShortcuts({
    onEscape: isOpen ? onClose : null
  })

  const modalRef = useRef(null)
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

  if (!isOpen) return null

  return (
    <div className="modal-overlay ai-chat-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal-container ai-chat-modal-container ${isMaximized ? 'maximized' : ''} ${isMinimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
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

export { LuminaChatContent, MessageContent, ThinkingIndicator }
export default React.memo(LuminaChat)
