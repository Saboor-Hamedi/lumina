const fs = require('fs');

const modalPath = 'b:/electron/lumina/src/renderer/src/features/Overlays/AIChatModal.jsx';
const panelPath = 'b:/electron/lumina/src/renderer/src/features/AI/AIChatPanel.jsx';
const modalCssPath = 'b:/electron/lumina/src/renderer/src/features/Overlays/AIChatModal.css';
const panelCssPath = 'b:/electron/lumina/src/renderer/src/features/AI/AIChatPanel.css';

let modalCode = fs.readFileSync(modalPath, 'utf8').replace(/\r\n/g, '\n');
let panelCode = fs.readFileSync(panelPath, 'utf8').replace(/\r\n/g, '\n');
let modalCss = fs.readFileSync(modalCssPath, 'utf8');
let panelCss = fs.readFileSync(panelCssPath, 'utf8');

// Combine CSS
let combinedCss = modalCss + '\n\n' + panelCss;
fs.writeFileSync(modalCssPath, combinedCss);

const componentsStart = panelCode.indexOf('const CodeBlock =');
const mainComponentStart = panelCode.indexOf('const AIChatPanel =');

const helperComponents = panelCode.substring(componentsStart, mainComponentStart);

// find where return is
const lastReturn = panelCode.indexOf('  return (\n    <div className="chat-container">');

const hooksStrRaw = panelCode.substring(mainComponentStart, lastReturn);
const firstBrace = hooksStrRaw.indexOf('{');
const hooksStr = hooksStrRaw.substring(firstBrace + 1);

let jsxStr = panelCode.substring(lastReturn);
const firstDiv = jsxStr.indexOf('<div className="chat-container"');
const lastDiv = jsxStr.lastIndexOf('</div>');
const innerJsx = jsxStr.substring(firstDiv, lastDiv + 6);

let cleanJsx = innerJsx;
cleanJsx = cleanJsx.replace(/<div className="chat-empty-icon".*?>✨<\/div>/, '');
cleanJsx = cleanJsx.replace(/<h2.*?>\s*How can I help you today\?\s*<\/h2>/, '');
cleanJsx = cleanJsx.replace(/<p.*?>\s*I can help you write code, explain complex concepts, or manage your workspace\.\s*<\/p>/, '');

let newModalCode = `import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createPortal } from 'react-dom'
import { MessageSquare, Maximize2, Minimize2, Trash2, ArrowDownToLine, History, Copy, ThumbsUp, ThumbsDown, Check, Send, Square, Download, X as CloseIcon, Plus, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useAIStore } from '../../core/store/useAIStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import { getSnippetIcon } from '../Icons/iconMapper'
import { Composer } from '../AI/Composer'
import ModalHeader from './ModalHeader'
import '../Layout/AppShell.css'
import './AIChatModal.css'

` + helperComponents + `

const AIChatModal = ({ isOpen, onClose, onUnfloat }) => {
  const modalRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [resizeDirection, setResizeDirection] = useState(null)
  const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

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
    } catch (e) {}
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

  useEffect(() => {
    if (isOpen && !isMaximized) {
      try {
        localStorage.setItem('aiChatModalState', JSON.stringify(modalState))
      } catch (e) {}
    }
  }, [modalState, isOpen, isMaximized])

  const handleDragStart = useCallback(
    (e) => {
      if (isMaximized) return
      if (e.target.closest('button')) return
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
        if (modalRef.current) {
          modalRef.current.style.left = \`\${finalLeft}px\`
          modalRef.current.style.top = \`\${finalTop}px\`
        }
        dragStartPos.current.latestLeft = finalLeft
        dragStartPos.current.latestTop = finalTop
      })
    },
    [isDragging, isMaximized, modalState.width, modalState.height]
  )

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

  useEffect(() => {
    if (modalRef.current && !isDragging && !isResizing) {
      if (isMaximized) {
        modalRef.current.style.top = '0px'
        modalRef.current.style.left = '0px'
        modalRef.current.style.width = '100%'
        modalRef.current.style.height = '100%'
      } else {
        modalRef.current.style.top = \`\${modalState.top}px\`
        modalRef.current.style.left = \`\${modalState.left}px\`
        modalRef.current.style.width = \`\${modalState.width}px\`
        modalRef.current.style.height = \`\${modalState.height}px\`
      }
    }
  }, [modalState, isMaximized, isDragging, isResizing])

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
        if (resizeDirection.includes('right')) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width + deltaX))
        }
        if (resizeDirection.includes('left')) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width - deltaX))
          newLeft = Math.max(0, resizeStartPos.current.left + (resizeStartPos.current.width - newWidth))
        }
        if (resizeDirection.includes('bottom')) {
          newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartPos.current.height + deltaY))
        }
        if (resizeDirection.includes('top')) {
          newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartPos.current.height - deltaY))
          newTop = Math.max(0, resizeStartPos.current.top + (resizeStartPos.current.height - newHeight))
        }
        if (modalRef.current) {
          modalRef.current.style.width = \`\${newWidth}px\`
          modalRef.current.style.height = \`\${newHeight}px\`
          modalRef.current.style.left = \`\${newLeft}px\`
          modalRef.current.style.top = \`\${newTop}px\`
        }
        resizeStartPos.current.latestState = { width: newWidth, height: newHeight, left: newLeft, top: newTop }
      })
    },
    [isResizing, isMaximized, resizeDirection]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    setResizeDirection(null)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (resizeStartPos.current.latestState) {
      setModalState((prev) => ({ ...prev, ...resizeStartPos.current.latestState }))
    }
  }, [])

  const handleToggleMaximize = useCallback(() => setIsMaximized((prev) => !prev), [])

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

` + hooksStr + `
  if (!isOpen) return null

  return (
    <div className="modal-overlay ai-chat-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={\`modal-container ai-chat-modal-container \${isMaximized ? 'maximized' : ''} \${isDragging ? 'dragging' : ''} \${isResizing ? 'resizing' : ''}\`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          maxWidth: isMaximized ? '100%' : '100vw',
          maxHeight: isMaximized ? '100%' : '100vh',
          ...(isMaximized
            ? { top: 0, left: 0, width: '100vw', height: '100vh' }
            : {
                top: modalState.top,
                left: modalState.left,
                width: modalState.width,
                height: modalState.height
              })
        }}
      >
        <ModalHeader
          onMouseDown={handleDragStart}
          style={{ cursor: 'default' }}
          title="AI Chat"
          icon={<MessageSquare size={16} />}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="modal-clear-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSessions((prev) => !prev)
                }}
                title="Toggle History"
                aria-label="Toggle History"
              >
                <History size={14} />
              </button>
              {chatMessages && chatMessages.length > 0 && (
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
                  <Trash2 size={14} />
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
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          }
          onClose={onClose}
        />

        {!isMaximized && (
          <>
            <div className="resize-handle resize-handle-right" onMouseDown={(e) => handleResizeStart(e, 'right')} />
            <div className="resize-handle resize-handle-bottom" onMouseDown={(e) => handleResizeStart(e, 'bottom')} />
            <div className="resize-handle resize-handle-bottom-right" onMouseDown={(e) => handleResizeStart(e, 'bottom-right')} />
            <div className="resize-handle resize-handle-left" onMouseDown={(e) => handleResizeStart(e, 'left')} />
            <div className="resize-handle resize-handle-top" onMouseDown={(e) => handleResizeStart(e, 'top')} />
            <div className="resize-handle resize-handle-top-left" onMouseDown={(e) => handleResizeStart(e, 'top-left')} />
            <div className="resize-handle resize-handle-top-right" onMouseDown={(e) => handleResizeStart(e, 'top-right')} />
            <div className="resize-handle resize-handle-bottom-left" onMouseDown={(e) => handleResizeStart(e, 'bottom-left')} />
          </>
        )}

        <div className="ai-chat-modal-body" style={{ height: 'calc(100% - 40px)', flex: 1, display: 'flex', flexDirection: 'column' }}>
          ` + cleanJsx + `
        </div>
      </div>
    </div>
  )
}

export default React.memo(AIChatModal)
`;

fs.writeFileSync(modalPath, newModalCode);
console.log('Successfully merged AIChatPanel into AIChatModal (FIXED)');
