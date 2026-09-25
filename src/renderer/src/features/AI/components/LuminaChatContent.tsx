import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAIStore } from '../tools/lumina'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { Composer } from '../Composer'
import { ChatMessageRow } from './LuminaChatMessageRow'
import { LuminaSession } from './LuminaSession'
import { ChatFooterStatus } from './LuminaChatFooterStatus'
import { ChatEmptyState } from './LuminaChatEmptyState'
import { LuminaWorkbench } from './LuminaWorkbench'
import { useChatScroll } from '../hooks/useChatScroll'
import { useScopedSelectAll } from '../hooks/useScopedSelectAll'
import { getBrainDocuments } from '../services/brainKnowledge'

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

    const { selectedNote, notes } = useWorkspaceStore(
      useShallow((state: any) => ({
        selectedNote: state.selectedNote,
        notes: state.notes || []
      }))
    )

    const brainDocs = useMemo(() => getBrainDocuments(), [])

    const userMentionRegex = useMemo(() => {
      const list = [...(notes || []), ...brainDocs]
      if (list.length === 0) return /(@\[[^\]]+\]|@[a-zA-Z0-9_\-./]+)/g
      const titles = list
        .map((s: any) => s.title || s.name)
        .filter(Boolean)
        .sort((a: string, b: string) => b.length - a.length)
        .slice(0, 100)
        .map((t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

      if (titles.length > 0) {
        return new RegExp(`(@\\[[^\\]]+\\]|@(?:${titles.join('|')}|[a-zA-Z0-9_\\-./]+))`, 'gi')
      }
      return /(@\[[^\]]+\]|@[a-zA-Z0-9_\-./]+)/g
    }, [notes, brainDocs])

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
            className="chat-main"
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
            {isWorkbenchOpen ? (
              <LuminaWorkbench onClose={() => setIsWorkbenchOpen(false)} />
            ) : (
              <>
                <div
                  className="chat-messages"
                  ref={listRef}
                  onScroll={handleMessageScroll}
                >
                  {visibleMessages.length === 0 ? (
                    <ChatEmptyState
                      selectedNote={selectedNote}
                      onSendSuggestion={(snip) =>
                        sendChatMessage(`Explain the code in "${snip.title}"`, [snip])
                      }
                    />
                  ) : (
                    <div className="chat-msg-list">
                      {renderedMessages}
                      <ChatFooterStatus
                        chatMessages={chatMessages}
                        isChatLoading={isChatLoading}
                        activeThinkingStatus={activeThinkingStatus}
                        chatError={chatError}
                      />
                    </div>
                  )}
                </div>

                <div
                  className={`modal-composer-dock-wrapper ${isSidebar ? 'is-sidebar-docked' : ''}`}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    display: 'flex',
                    justifyContent: 'center',
                    padding: isSidebar ? '0 8px 8px 8px' : '0 16px 14px 16px',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                    position: 'relative',
                    overflow: 'visible',
                    zIndex: 100
                  }}
                >
                  <div
                    className={`inspector-footer-section is-chat-composer ${isSidebar ? 'is-docked-composer' : 'is-modal-composer'}`}
                    style={{
                      maxWidth: isSidebar ? '100%' : '800px',
                      width: '100%',
                      margin: '0 auto',
                      borderRadius: '8px',
                      border: '1px solid var(--border-card, var(--border-dim))',
                      background: 'var(--bg-card, var(--bg-panel))',
                      overflow: 'visible',
                      position: 'relative',
                      boxShadow: 'var(--shadow-soft, 0 4px 16px rgba(0, 0, 0, 0.15))',
                      boxSizing: 'border-box'
                    }}
                  >
                    <Composer
                      isSidebar={isSidebar}
                      onSend={handleSendMessage}
                      isLoading={isChatLoading}
                      onStop={cancelChat}
                      onCancel={cancelChat}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }
)

export default LuminaChatContent
