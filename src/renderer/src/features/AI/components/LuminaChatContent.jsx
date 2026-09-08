import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAIStore } from '../tools/lumina'
import { useVaultStore } from '../../../core/store/workspaceStore'
import { Composer } from '../Composer'
import { ChatMessageRow } from './ChatMessageRow'
import { ChatSessionsSidebar } from './ChatSessionsSidebar'
import { ChatFooterStatus } from './ChatFooterStatus'
import { ChatEmptyState } from './ChatEmptyState'
import { useChatScroll } from '../hooks/useChatScroll'
import { useScopedSelectAll } from '../hooks/useScopedSelectAll'

export const LuminaChatContent = React.memo(({ isSidebar = false, onPopOut = null }) => {
  const {
    chatMessages,
    isChatLoading,
    chatError,
    sendChatMessage,
    cancelChat,
    loadSessions,
    sessions,
    activeSessionId,
    createNewSession,
    switchSession,
    deleteSession
  } = useAIStore()

  const { selectedSnippet, snippets } = useVaultStore(
    useShallow((state) => ({
      selectedSnippet: state.selectedSnippet,
      snippets: state.snippets
    }))
  )

  const userMentionRegex = useMemo(() => {
    const list = snippets || []
    const titles = list
      .map((s) => s.title)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    if (titles.length > 0) {
      return new RegExp(`(@(?:${titles.join('|')}|[a-zA-Z0-9_\\-./]+))`, 'gi')
    }
    return /(@[a-zA-Z0-9_\-./]+)/g
  }, [snippets])

  const [showSessions, setShowSessions] = useState(false)
  const { listRef, autoScrollRef, handleMessageScroll } = useChatScroll(chatMessages, isChatLoading)

  const rootRef = useRef(null)
  const { containerProps } = useScopedSelectAll({ containerRef: rootRef, isEnabled: isSidebar })

  // Load chat history on mount
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Listen for external toggle history event (from sidebar header)
  useEffect(() => {
    const handleToggle = () => setShowSessions((prev) => !prev)
    window.addEventListener('ai-toggle-history', handleToggle)
    return () => window.removeEventListener('ai-toggle-history', handleToggle)
  }, [])

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text)
  }, [])

  const handleRating = useCallback(
    (index, type) => {
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
    async (text, mode = 'Standard', attachedMentions = []) => {
      if (!text.trim() && attachedMentions.length === 0) return
      autoScrollRef.current = true

      try {
        const contextSnippets = []
        const addedIds = new Set()

        if (attachedMentions.length > 0) {
          attachedMentions.forEach((snippet) => {
            contextSnippets.push(snippet)
            addedIds.add(snippet.id)
          })
        } else if (selectedSnippet && !addedIds.has(selectedSnippet.id)) {
          contextSnippets.push(selectedSnippet)
          addedIds.add(selectedSnippet.id)
        }

        await sendChatMessage(text, contextSnippets, mode, attachedMentions)
      } catch (err) {
        console.error('Error sending message:', err)
      }
    },
    [selectedSnippet, sendChatMessage, autoScrollRef]
  )

  const visibleMessages = useMemo(() => {
    return chatMessages.filter(
      (m) =>
        m.role === 'user' ||
        (m.role === 'assistant' && (m.content?.trim() || m.isGenerating || m.imageUrl))
    )
  }, [chatMessages])

  const renderedMessages = useMemo(() => {
    const total = visibleMessages.length
    return visibleMessages.map((msg, index) => (
      <ChatMessageRow
        key={msg.id || `msg-${index}`}
        msg={msg}
        index={index}
        isLast={index === total - 1}
        isChatLoading={isChatLoading}
        userMentionRegex={userMentionRegex}
        handleCopy={handleCopy}
        handleRating={handleRating}
      />
    ))
  }, [visibleMessages, isChatLoading, userMentionRegex, handleCopy, handleRating])

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
        fontFamily: 'var(--font-editor, inherit)'
      }}
    >
      <div className="chat-container" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Sessions Sidebar */}
        <ChatSessionsSidebar
          showSessions={showSessions}
          setShowSessions={setShowSessions}
          sessions={sessions}
          activeSessionId={activeSessionId}
          createNewSession={createNewSession}
          switchSession={switchSession}
          deleteSession={deleteSession}
        />

        {/* Chat Main Area */}
        <div
          className="chat-main"
          onClick={() => {
            if (showSessions) setShowSessions(false)
          }}
        >
          <div className="chat-messages" ref={listRef} onScroll={handleMessageScroll}>
            {visibleMessages.length === 0 ? (
              <ChatEmptyState
                selectedSnippet={selectedSnippet}
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
                  chatError={chatError}
                />
              </div>
            )}
          </div>

          <div className="chat-input-area">
            <Composer
              isSidebar={isSidebar}
              onSend={handleSendMessage}
              isLoading={isChatLoading}
              onStop={cancelChat}
              onCancel={cancelChat}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

export default LuminaChatContent
