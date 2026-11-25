import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAIStore } from '../tools/lumina'
import { useWorkspaceStore, LUMINA_TAB_ID } from '../../../core/store/workspaceStore'
import { Composer } from '../Composer'
import { ChatMessageRow } from './LuminaChatMessageRow'
import { LuminaSession } from './LuminaSession'
import { ChatFooterStatus } from './LuminaChatFooterStatus'
import { ChatEmptyState, ChatEmptyHero, ChatEmptySuggestions } from './LuminaChatEmptyState'
import { LuminaAnalyticsDropdown } from './LuminaAnalyticsDropdown'
import { LuminaApprovalCard } from '../safety'
import { useChatScroll } from '../hooks/useChatScroll'
import { useScopedSelectAll } from '../hooks/useScopedSelectAll'
import { getBrainDocuments } from '../services/brainKnowledge'
import ToolTip from '../../../components/atoms/ToolTip'
import { Popover } from '../../../ui'
import { BarChart3, Plus, History, Trash2, Pin, MoreHorizontal } from 'lucide-react'
import '../css/lumina.css'
import '../css/luminaWorkbench.css'

export interface LuminaChatContentProps {
  isSidebar?: boolean
  isModal?: boolean
  onPopOut?: (() => void) | null
}

/**
 * LuminaChatContent is the primary chat viewport component:
 * manages session switching, message virtualized rendering, auto-scrolling,
 * copy/rating reactions, and the docked composer.
 */
export const LuminaChatContent: React.FC<LuminaChatContentProps> = React.memo(
  ({ isSidebar = false, isModal = false }) => {
    const {
      chatMessages,
      isChatLoading,
      activeThinkingStatus,
      chatError,
      sendChatMessage,
      cancelChat,
      loadSessions,
      sessions,
      activeSessionId,
      createNewSession,
      switchSession,
      deleteSession,
      renameSession,
      togglePinSession,
      duplicateSession,
      clearSessionMessages
    } = useAIStore(
      useShallow((s) => ({
        chatMessages: s.chatMessages,
        isChatLoading: s.isChatLoading,
        activeThinkingStatus: s.activeThinkingStatus,
        chatError: s.chatError,
        sendChatMessage: s.sendChatMessage,
        cancelChat: s.cancelChat,
        loadSessions: s.loadSessions,
        sessions: s.sessions,
        activeSessionId: s.activeSessionId,
        createNewSession: s.createNewSession,
        switchSession: s.switchSession,
        deleteSession: s.deleteSession,
        renameSession: s.renameSession,
        togglePinSession: s.togglePinSession,
        duplicateSession: s.duplicateSession,
        clearSessionMessages: s.clearSessionMessages
      }))
    )

    const { selectedNote, notes, folders, activeTabId, openLuminaTab } = useWorkspaceStore(
      useShallow((state: any) => ({
        selectedNote: state.selectedNote,
        notes: state.notes || [],
        folders: state.folders || [],
        activeTabId: state.activeTabId,
        openLuminaTab: state.openLuminaTab
      }))
    )

    const isInTab = activeTabId === LUMINA_TAB_ID
    const [isActionsOpen, setIsActionsOpen] = useState(false)
    const actionsMenuRef = useRef<HTMLDivElement | null>(null)

    const brainDocs = useMemo(() => getBrainDocuments(), [])

    const userMentionRegex = useMemo(() => {
      const folderItems = (folders || []).flatMap((f: string) => [f, f.split('/').pop() || f])
      const list = [...(notes || []), ...brainDocs]
      const titles = [
        ...folderItems,
        ...list.map((s: any) => s.title || s.name)
      ]
        .filter(Boolean)
        .sort((a: string, b: string) => b.length - a.length)
        .slice(0, 120)
        .map((t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

      if (titles.length > 0) {
        return new RegExp(`(@\\[[^\\]]+\\]|@(?:${titles.join('|')}|[a-zA-Z0-9_\\-./]+))`, 'gi')
      }
      return /(@\[[^\]]+\]|@[a-zA-Z0-9_\-./]+)/g
    }, [notes, folders, brainDocs])

    const [showSessions, setShowSessions] = useState<boolean>(false)
    const [isWorkbenchOpen, setIsWorkbenchOpen] = useState<boolean>(false)
    const { listRef, autoScrollRef, handleMessageScroll } = useChatScroll(
      chatMessages,
      isChatLoading
    )

    const rootRef = useRef<HTMLDivElement | null>(null)
    const { containerProps } = useScopedSelectAll({
      containerRef: rootRef,
      isEnabled: isSidebar
    })

    // Load chat history on mount only if not already initialized
    useEffect(() => {
      if ((!sessions || sessions.length === 0) && !isChatLoading) {
        loadSessions()
      }
    }, [])

    // Listen for external toggle history event (from sidebar header)
    useEffect(() => {
      const handleToggle = () => setShowSessions((prev) => !prev)
      const handleWorkbench = () => setIsWorkbenchOpen((prev) => !prev)
      window.addEventListener('ai-toggle-history', handleToggle)
      window.addEventListener('open-ai-workbench', handleWorkbench)
      return () => {
        window.removeEventListener('ai-toggle-history', handleToggle)
        window.removeEventListener('open-ai-workbench', handleWorkbench)
      }
    }, [])

    const handleCopy = useCallback((text: string) => {
      navigator.clipboard.writeText(text)
    }, [])

    const handleRating = useCallback(
      (index: number, type: 'up' | 'down') => {
        const current = chatMessages[index]?.rating
        const newRating = current === type ? null : type
        const updated = [...chatMessages]
        if (updated[index]) {
          updated[index] = { ...updated[index], rating: newRating }
          useAIStore.setState({ chatMessages: updated })
        }
      },
      [chatMessages]
    )

    const handleSendMessage = useCallback(
      async (text: string, mode: string = 'Standard', attachedMentions: any[] = []) => {
        if (!text.trim() && attachedMentions.length === 0) return
        autoScrollRef.current = true

        try {
          const contextSnippets: any[] = []
          const addedIds = new Set()

          if (attachedMentions.length > 0) {
            attachedMentions.forEach((snippet) => {
              contextSnippets.push(snippet)
              addedIds.add(snippet.id)
            })
          } else if (selectedNote && !addedIds.has(selectedNote.id)) {
            contextSnippets.push(selectedNote)
            addedIds.add(selectedNote.id)
          }

          await sendChatMessage(text, contextSnippets, mode, attachedMentions)
        } catch (err) {
          console.error('Error sending message:', err)
        }
      },
      [selectedNote, sendChatMessage, autoScrollRef]
    )

    const handleRetry = useCallback(() => {
      const lastUser = [...chatMessages].reverse().find((m) => m.role === 'user')
      if (lastUser && lastUser.content) {
        handleSendMessage(lastUser.content)
      }
    }, [chatMessages, handleSendMessage])

    const visibleMessages = useMemo(() => {
      return chatMessages.filter((msg, index) => {
        const isEmptyAssistant =
          msg.role === 'assistant' && !msg.content?.trim() && !msg.imageUrl
        const isLastMessage = index === chatMessages.length - 1

        if (isEmptyAssistant) {
          if (!isLastMessage) return false
          if (!isChatLoading && !msg.isGenerating) return false
        }
        return true
      })
    }, [chatMessages, isChatLoading])

    const renderedMessages = useMemo(() => {
      const total = visibleMessages.length
      return visibleMessages.map((msg, index) => (
        <ChatMessageRow
          key={msg.id || `msg-${index}`}
          msg={msg}
          index={index}
          isLast={index === total - 1}
          isChatLoading={isChatLoading}
          activeThinkingStatus={activeThinkingStatus}
          userMentionRegex={userMentionRegex}
          handleCopy={handleCopy}
          handleRating={handleRating}
        />
      ))
    }, [
      visibleMessages,
      isChatLoading,
      activeThinkingStatus,
      userMentionRegex,
      handleCopy,
      handleRating
    ])

    const isCenteredWelcome = !isSidebar && visibleMessages.length === 0

    return (
      <div
        ref={rootRef}
        tabIndex={-1}
        {...containerProps}
        className={`ai-chat-content-root ${isSidebar ? 'is-sidebar-docked' : ''}`}
        style={{
          outline: 'none',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'var(--font-editor, inherit)',
          background: isSidebar ? 'var(--bg-sidebar)' : 'var(--bg-app)',
          color: 'var(--text-main)'
        }}
      >
        <div
          className={`chat-container ${showSessions ? 'sidebar-open' : 'sidebar-closed'}`}
          style={{
            flex: 1,
            height: '100%',
            minHeight: 0,
            width: '100%',
            display: 'flex',
            position: 'relative'
          }}
        >
          {/* Sessions Sidebar (rendered in docked sidebar mode) */}
          {!isModal && (
            <LuminaSession
              isOpen={showSessions}
              onClose={() => setShowSessions(false)}
              sessions={sessions}
              activeSessionId={activeSessionId}
              createNewSession={() => {
                createNewSession()
                if (isSidebar) setShowSessions(false)
              }}
              switchSession={(id) => {
                switchSession(id)
                if (isSidebar) setShowSessions(false)
              }}
              deleteSession={deleteSession}
              renameSession={renameSession}
              togglePinSession={togglePinSession}
              duplicateSession={duplicateSession}
              clearSessionMessages={clearSessionMessages}
            />
          )}

          {/* Chat Main Area */}
          <div
            className={`chat-main ${isCenteredWelcome ? 'is-centered-welcome' : 'has-messages'}`}
            style={{
              flex: 1,
              height: '100%',
              minHeight: 0,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
            onClick={() => {
              if (showSessions) setShowSessions(false)
            }}
          >
            {/* Sleek AI Session Header */}
            <div className="lumina-session-header">
              <div className="session-header-left">
                <ToolTip text={showSessions ? 'Hide History' : 'Chat History'} position="bottom">
                  <button
                    type="button"
                    className={`session-header-btn ${showSessions ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (document.body.classList.contains('is-global-resizing')) return
                      setShowSessions((prev) => !prev)
                    }}
                    aria-label="Toggle Chat History"
                  >
                    <History size={13} />
                  </button>
                </ToolTip>
              </div>

              <div className="session-header-right" ref={actionsMenuRef} style={{ position: 'relative' }}>
                <ToolTip text="Chat Actions" position="bottom">
                  <button
                    type="button"
                    className={`session-header-btn ${isActionsOpen || isWorkbenchOpen ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsActionsOpen((prev) => !prev)
                    }}
                    aria-label="Chat Actions"
                    aria-expanded={isActionsOpen}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </ToolTip>

                <Popover
                  isOpen={isActionsOpen}
                  onClose={() => setIsActionsOpen(false)}
                  anchorRef={actionsMenuRef}
                  placement="bottom-end"
                  className="activity-bar-help-popover"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="activity-bar-help-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsActionsOpen(false)
                      createNewSession()
                    }}
                  >
                    <Plus size={13} />
                    <span>New Chat</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="activity-bar-help-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsActionsOpen(false)
                      setIsWorkbenchOpen((prev) => !prev)
                    }}
                  >
                    <BarChart3 size={13} />
                    <span>Analytics</span>
                  </button>
                  {chatMessages.length > 0 && (
                    <button
                      type="button"
                      role="menuitem"
                      className="activity-bar-help-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsActionsOpen(false)
                        if (activeSessionId) clearSessionMessages(activeSessionId)
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Clear Messages</span>
                    </button>
                  )}
                  {!isInTab && !isSidebar && (
                    <button
                      type="button"
                      role="menuitem"
                      className="activity-bar-help-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsActionsOpen(false)
                        openLuminaTab()
                      }}
                    >
                      <Pin size={13} />
                      <span>Open as Tab</span>
                    </button>
                  )}
                </Popover>

                {isWorkbenchOpen && (
                  <LuminaAnalyticsDropdown onClose={() => setIsWorkbenchOpen(false)} />
                )}
              </div>
            </div>

            <div
              className={`chat-messages ${isCenteredWelcome ? 'is-centered-welcome' : ''}`}
              ref={listRef}
              onScroll={handleMessageScroll}
            >
              {visibleMessages.length === 0 ? (
                isSidebar ? (
                  <ChatEmptyState
                    selectedNote={selectedNote}
                    onSendSuggestion={(snip) =>
                      sendChatMessage(`Explain the code in "${snip.title}"`, [snip])
                    }
                    onSendPrompt={(p) => sendChatMessage(p)}
                  />
                ) : (
                  <div className="chat-welcome-top-spacer">
                    <ChatEmptyHero />
                  </div>
                )
              ) : (
                <div className="chat-msg-list">
                  {renderedMessages}
                  <ChatFooterStatus
                    chatMessages={chatMessages}
                    isChatLoading={isChatLoading}
                    activeThinkingStatus={activeThinkingStatus}
                    chatError={chatError}
                    onRetry={handleRetry}
                  />
                </div>
              )}
            </div>

            <div
              className={`modal-composer-dock-wrapper ${isSidebar ? 'is-sidebar-docked' : ''} ${isCenteredWelcome ? 'is-centered-welcome' : ''}`}
              style={{
                width: '100%',
                background: 'transparent',
                display: 'flex',
                justifyContent: 'center',
                padding: isSidebar ? '0 8px 10px 8px' : '0 16px 14px 16px',
                boxSizing: 'border-box',
                flexShrink: 0,
                position: 'relative',
                overflow: 'visible',
                zIndex: 100
              }}
            >
              <div
                style={{
                  maxWidth: isSidebar ? '100%' : '760px',
                  width: '100%',
                  margin: '0 auto',
                  position: 'relative'
                }}
              >
                <LuminaApprovalCard />
                <Composer
                  isSidebar={isSidebar}
                  onSend={handleSendMessage}
                  isLoading={isChatLoading}
                  onStop={cancelChat}
                  onCancel={cancelChat}
                />
              </div>
            </div>

            {!isSidebar && (
              <div
                className={`chat-welcome-bottom-slot ${isCenteredWelcome ? 'is-open' : 'is-collapsed'}`}
                aria-hidden={!isCenteredWelcome}
              >
                <ChatEmptySuggestions
                  selectedNote={selectedNote}
                  onSendSuggestion={(snip) =>
                    sendChatMessage(`Explain the code in "${snip.title}"`, [snip])
                  }
                  onSendPrompt={(p) => sendChatMessage(p)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
)

export default LuminaChatContent
