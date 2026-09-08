import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAIStore } from '../tools/lumina'
import { useVaultStore } from '../../../core/store/workspaceStore'
import { Composer } from '../Composer'
import { MessageContent } from './MessageContent'
import { ChatMessageRow } from './ChatMessageRow'
import { ChatSessionsSidebar } from './ChatSessionsSidebar'
import { ThinkingIndicator } from './ThinkingIndicator'
import { useChatScroll } from '../hooks/useChatScroll'

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

  const { selectedSnippet, snippets, openTabs } = useVaultStore(
    useShallow((state) => ({
      selectedSnippet: state.selectedSnippet,
      snippets: state.snippets,
      openTabs: state.openTabs
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
  const isMouseInsideRef = useRef(false)
  const isContentActiveRef = useRef(false)

  // Track active state & scoped select-all for docked sidebar mode
  useEffect(() => {
    if (!isSidebar) return

    const handlePointerDown = (e) => {
      if (rootRef.current && rootRef.current.contains(e.target)) {
        isContentActiveRef.current = true
      } else {
        isContentActiveRef.current = false
      }
    }

    const handleKeyDownCapture = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'a') {
        const target = e.target
        const activeEl = document.activeElement

        const isTargetInRoot =
          rootRef.current &&
          (rootRef.current.contains(target) || rootRef.current.contains(activeEl))
        const isHovered = isMouseInsideRef.current
        const isActive = isContentActiveRef.current

        if (isTargetInRoot || isHovered || isActive) {
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

          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          const msgContainer =
            rootRef.current?.querySelector('.chat-msg-list') ||
            rootRef.current?.querySelector('.chat-messages')

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

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDownCapture, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDownCapture, true)
    }
  }, [isSidebar])

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
      // Update local message rating
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

        // 1. If user explicitly attached mentions, ONLY focus on those mentions
        if (attachedMentions.length > 0) {
          attachedMentions.forEach((snippet) => {
            contextSnippets.push(snippet)
            addedIds.add(snippet.id)
          })
        } else {
          // 2. Otherwise add currently selected snippet
          if (selectedSnippet && !addedIds.has(selectedSnippet.id)) {
            contextSnippets.push(selectedSnippet)
            addedIds.add(selectedSnippet.id)
          }

          // 3. And other open tabs
          openTabs.forEach((tabId) => {
            const snippet = snippets.find((s) => s.id === tabId)
            if (snippet && !addedIds.has(snippet.id)) {
              contextSnippets.push(snippet)
              addedIds.add(snippet.id)
            }
          })
        }

        const limitedContext = contextSnippets.slice(0, 5)
        await sendChatMessage(text, limitedContext, mode, attachedMentions)
      } catch (err) {
        console.error('Failed to send:', err)
      }
    },
    [sendChatMessage, selectedSnippet, snippets, openTabs, autoScrollRef]
  )

  const visibleMessages = useMemo(() => {
    return chatMessages.filter((msg, index) => {
      const isEmptyAssistant = msg.role === 'assistant' && !msg.content?.trim() && !msg.imageUrl
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
      onPointerDown={() => {
        if (isSidebar) isContentActiveRef.current = true
      }}
      onMouseEnter={() => {
        isMouseInsideRef.current = true
      }}
      onMouseLeave={() => {
        isMouseInsideRef.current = false
      }}
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
              <div className="chat-empty">
                <h2
                  style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--text-main)',
                    margin: '8px 0 4px 0'
                  }}
                >
                  How can I help you today?
                </h2>
                {selectedSnippet && (
                  <button
                    className="chat-suggestion-btn"
                    onClick={() =>
                      sendChatMessage(`Explain the code in "${selectedSnippet.title}"`, [
                        selectedSnippet
                      ])
                    }
                  >
                    Explain "{selectedSnippet.title}"
                  </button>
                )}
              </div>
            ) : (
              <div className="chat-msg-list">
                {renderedMessages}
                <div className="chat-footer-area">
                  {(() => {
                    const lastMessage = chatMessages[chatMessages.length - 1]
                    const hasAssistantMessage = lastMessage && lastMessage.role === 'assistant'
                    const showTyping = isChatLoading && !hasAssistantMessage
                    return (
                      <>
                        {showTyping && (
                          <div
                            className="chat-row assistant"
                            style={{
                              marginBottom: '6px',
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'flex-start'
                            }}
                          >
                            <ThinkingIndicator />
                          </div>
                        )}
                        {chatError && (
                          <div
                            className="chat-row assistant"
                            style={{
                              marginBottom: '6px',
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'flex-start'
                            }}
                          >
                            <div
                              className="chat-content-stack"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                maxWidth: '100%',
                                minWidth: 0,
                                flexShrink: 1,
                                width: 'auto'
                              }}
                            >
                              <div
                                className="chat-bubble assistant"
                                style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}
                              >
                                <MessageContent content={`**Error:** ${chatError}`} />
                                {chatError.includes('API Key') && (
                                  <button
                                    onClick={() =>
                                      window.dispatchEvent(new CustomEvent('open-ai-settings'))
                                    }
                                    style={{
                                      marginTop: '12px',
                                      padding: '6px 12px',
                                      fontSize: '13px',
                                      background: 'var(--bg-active)',
                                      border: '1px solid var(--border-dim)',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      color: 'var(--text-main)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <SettingsIcon size={14} /> Open Settings
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
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
