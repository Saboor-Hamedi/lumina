import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  Square,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRightToLine,
  Plus,
  X
} from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ToolTip from '../../components/atoms/ToolTip'
import { useAIStore } from './tools/lumina'
import LuminaSession from './components/LuminaSession'
import { LuminaChatContent } from './components/LuminaChatContent'
import { MessageContent } from './components/LuminaMessageContent'
import { ThinkingIndicator } from './components/LuminaThinkingIndicator'
import { ChatMessageRow } from './components/LuminaChatMessageRow'
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
  const [isMaximized, setIsMaximized] = useState(false)
  const containerRef = useRef(null)

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
  } = useAIStore()

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
    setIsMaximized((prev) => !prev)
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
        style={{ outline: 'none' }}
      >
        {/* Modal Header */}
        <div className="docs-modal-header" style={{ cursor: 'default' }}>
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
                onClick={handleNewChat}
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
            <LuminaChatContent isSidebar={false} isModal={true} />
          </div>
        </div>
      </div>
    </div>
  )
}

export { LuminaChatContent, MessageContent, ThinkingIndicator, ChatMessageRow }
export default React.memo(LuminaChat)
