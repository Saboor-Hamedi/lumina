import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Square,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRightToLine,
  Plus,
  X,
  BarChart3,
  MessageSquare
} from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import ToolTip from '../../components/atoms/ToolTip'
import { useAIStore } from './tools/lumina'
import LuminaSession from './components/LuminaSession'
import { LuminaChatContent } from './components/LuminaChatContent'
import { MessageContent } from './components/LuminaMessageContent'
import { ThinkingIndicator } from './components/LuminaThinkingIndicator'
import { ChatMessageRow } from './components/LuminaChatMessageRow'
import { LuminaWorkbench } from './components/LuminaWorkbench'
import { useScopedSelectAll } from './hooks/useScopedSelectAll'
import '../modals/css/guide.css'
import '../Docs/Documentation.css'
import './css/lumina.css'

/**
 * Lumina AI Chat Modal
 * Matches Documentation.jsx modal container, header, and clean flex sidebar architecture.
 */
const LuminaChat = ({ isOpen, onClose, onDock, onUnfloat }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [viewMode, setViewMode] = useState('chat')
  const isMaximized = useSettingsStore((s) => s.settings.aiModalMaximized ?? false)
  const [isDraggingModal, setIsDraggingModal] = useState(false)
  const containerRef = useRef(null)
  const modalPos = useRef({ x: 0, y: 0 })
  const dragStart = useRef({ x: 0, y: 0 })
  const rafId = useRef(null)

  // Drag logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingModal || isMaximized) return

      const newX = e.clientX - dragStart.current.x
      const newY = e.clientY - dragStart.current.y
      modalPos.current = { x: newX, y: newY }

      if (rafId.current) cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
        }
      })
    }

    const handleMouseUp = () => {
      setIsDraggingModal(false)
      if (rafId.current) cancelAnimationFrame(rafId.current)
      if (containerRef.current && !isMaximized) {
        containerRef.current.style.transition = '0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isMaximized, isDraggingModal])

  const handleModalHeaderMouseDown = useCallback(
    (e) => {
      if (isMaximized) return
      if (e.target.closest('button')) return
      setIsDraggingModal(true)

      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }

      dragStart.current = {
        x: e.clientX - modalPos.current.x,
        y: e.clientY - modalPos.current.y
      }
    },
    [isMaximized]
  )

  useEffect(() => {
    if (isMaximized) {
      modalPos.current = { x: 0, y: 0 }
      if (containerRef.current) {
        containerRef.current.style.transform = 'none'
      }
    }
  }, [isMaximized, isOpen])

  const {
    sessions,
    activeSessionId,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    togglePinSession,
    duplicateSession,
    clearSessionMessages,
    loadSessions,
    isChatLoading
  } = useAIStore(
    useShallow((s) => ({
      sessions: s.sessions,
      activeSessionId: s.activeSessionId,
      createNewSession: s.createNewSession,
      switchSession: s.switchSession,
      deleteSession: s.deleteSession,
      renameSession: s.renameSession,
      togglePinSession: s.togglePinSession,
      duplicateSession: s.duplicateSession,
      clearSessionMessages: s.clearSessionMessages,
      loadSessions: s.loadSessions,
      isChatLoading: s.isChatLoading
    }))
  )

  // Clean up any previously stored drag positions so modal is always centered
  useEffect(() => {
    try {
      localStorage.removeItem('aiChatModalState')
    } catch {
      // ignore
    }
  }, [])

  // Ensure sessions are loaded
  useEffect(() => {
    if (isOpen && (!sessions || sessions.length === 0) && !isChatLoading) {
      loadSessions()
    }
  }, [isOpen, loadSessions])

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || null
  }, [sessions, activeSessionId])

  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ aiModalMaximized: !(settings.aiModalMaximized ?? false) })
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const handleNewChat = useCallback(() => {
    createNewSession()
  }, [createNewSession])

  const { containerProps } = useScopedSelectAll({ containerRef, isEnabled: isOpen })

  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen && onClose) {
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) {
          selection.removeAllRanges()
          return true
        }
        onClose()
        return true
      }
      return false
    }
  })

  if (!isOpen) return null

  return (
    <div className="guide-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        tabIndex={-1}
        {...containerProps}
        className={`docs-modal-container ai-chat-docs-modal${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          outline: 'none',
          transform: isMaximized
            ? 'none'
            : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
          transition: '0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Modal Header */}
        <div
          className={`docs-modal-header${isDraggingModal ? ' is-dragging' : ''}`}
          onMouseDown={handleModalHeaderMouseDown}
          style={{ cursor: isMaximized ? 'default' : isDraggingModal ? 'grabbing' : 'grab' }}
        >
          <div className="docs-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                className="docs-sidebar-toggle-btn"
                onClick={handleToggleSidebar}
                aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={15} strokeWidth={2} />
                ) : (
                  <PanelLeftOpen size={15} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-main)',
                letterSpacing: '-0.01em',
                background: 'transparent',
                padding: 0
              }}
            >
              Lumina AI
            </span>
            {activeSession?.title && (
              <>
                <span style={{ opacity: 0.35, color: 'var(--text-muted)', fontSize: '12px' }}>/</span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 450,
                    color: 'var(--text-muted)',
                    maxWidth: '220px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: 'transparent',
                    padding: 0
                  }}
                  title={activeSession.title}
                >
                  {activeSession.title}
                </span>
              </>
            )}
          </div>

          <div className="docs-header-right">
            <ToolTip text="New Chat" position="bottom">
              <button
                className="docs-window-btn"
                onClick={() => {
                  if (viewMode === 'workbench') setViewMode('chat')
                  handleNewChat()
                }}
                aria-label="New Chat"
              >
                <Plus size={14} strokeWidth={2} />
              </button>
            </ToolTip>
            <ToolTip text="Dock to Tab Sidebar" position="bottom">
              <button
                className="docs-window-btn"
                onClick={() => {
                  if (onDock) onDock()
                  else if (onUnfloat) onUnfloat()
                }}
                aria-label="Dock to Tab Sidebar"
              >
                <ArrowRightToLine size={13} strokeWidth={2} />
              </button>
            </ToolTip>
            <ToolTip text={viewMode === 'workbench' ? 'Back to Chat' : 'AI Workbench & Analytics'} position="bottom">
              <button
                className={`docs-window-btn${viewMode === 'workbench' ? ' active' : ''}`}
                onClick={() => setViewMode((prev) => (prev === 'workbench' ? 'chat' : 'workbench'))}
                aria-label="AI Workbench & Analytics"
              >
                {viewMode === 'workbench' ? <MessageSquare size={13} strokeWidth={2} /> : <BarChart3 size={13} strokeWidth={2} />}
              </button>
            </ToolTip>
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                className="docs-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} strokeWidth={2} />
                ) : (
                  <Square size={13} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                className="guide-close-btn"
                onClick={onClose}
                aria-label="Close Lumina AI (Esc)"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Modal Body with Floating Card Sidebar & Content */}
        <div className={`lumina-ai-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <LuminaSession
            isOpen={isSidebarOpen}
            sessions={sessions}
            activeSessionId={activeSessionId}
            createNewSession={createNewSession}
            switchSession={switchSession}
            deleteSession={deleteSession}
            renameSession={renameSession}
            togglePinSession={togglePinSession}
            duplicateSession={duplicateSession}
            clearSessionMessages={clearSessionMessages}
          />

          <div className="lumina-ai-content">
            {viewMode === 'workbench' ? (
              <LuminaWorkbench onClose={() => setViewMode('chat')} />
            ) : (
              <LuminaChatContent isSidebar={false} isModal={true} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export { LuminaChatContent, MessageContent, ThinkingIndicator, ChatMessageRow }
export default React.memo(LuminaChat)
