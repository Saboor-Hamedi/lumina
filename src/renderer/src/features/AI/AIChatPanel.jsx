import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Virtuoso } from 'react-virtuoso'
import { Copy, ThumbsUp, ThumbsDown, Check, Send } from 'lucide-react'
import { useAIStore } from '../../core/store/useAIStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import '../Layout/AppShell.css'
import './AIChatPanel.css'

const LuminaAvatar = React.memo(() => <div className="lumina-avatar">L</div>)
const UserAvatar = React.memo(() => <div className="user-avatar">Me</div>)

const CodeBlock = React.memo(({ inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '')
  const [copied, setCopied] = useState(false)

  if (!inline && match) {
    return (
      <div className="chat-code-block">
        <div className="chat-code-header">
          <span className="chat-code-lang">{match[1]}</span>
          <button
            className="chat-copy-btn"
            onClick={() => {
              navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre>
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    )
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
})

const MessageContent = React.memo(({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      pre: ({ children }) => <>{children}</>,
      code: CodeBlock
    }}
  >
    {content}
  </ReactMarkdown>
))

const ChatActions = ({ msg, index, onCopy, onRate }) => {
  const [copied, setCopied] = useState(false)

  const handleCopyClick = () => {
    onCopy(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="chat-response-actions">
      <button
        onClick={handleCopyClick}
        title={copied ? 'Copied!' : 'Copy Response'}
        style={copied ? { color: '#4ade80' } : {}}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <div className="action-divider" />
      <button
        className={msg.rating === 'up' ? 'active' : ''}
        onClick={() => onRate(index, 'up')}
        title="Helpful"
      >
        <ThumbsUp size={12} />
      </button>
      <button
        className={msg.rating === 'down' ? 'active' : ''}
        onClick={() => onRate(index, 'down')}
        title="Not Helpful"
      >
        <ThumbsDown size={12} />
      </button>
    </div>
  )
}

/**
 * AIChatPanel Component
 * Memoized for performance - expensive AI operations and message rendering.
 */
const AIChatPanel = React.memo(() => {
  const { chatMessages, isChatLoading, chatError, sendChatMessage, clearChat, updateMessage, loadChatHistory } =
    useAIStore()
  const { selectedSnippet, snippets, openTabs } = useVaultStore()
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef(null)
  const virtuosoRef = useRef(null)
  const [shouldFollowOutput, setShouldFollowOutput] = useState(true)
  const rangeChangedTimeoutRef = useRef(null)
  const hasInitialScrolledRef = useRef(false)
  
  // Ensure followOutput is enabled during streaming for smooth scrolling
  useEffect(() => {
    if (isChatLoading) {
      setShouldFollowOutput(true)
    }
  }, [isChatLoading])
  
  // Track the last message count to detect new messages during streaming
  const lastMessageCountRef = useRef(0)
  
  // When new messages are added during streaming, ensure they're visible
  useEffect(() => {
    if (isChatLoading && chatMessages.length > lastMessageCountRef.current && virtuosoRef.current && shouldFollowOutput) {
      lastMessageCountRef.current = chatMessages.length
      
      // Wait for content to render before scrolling - use multiple attempts
      let attemptCount = 0
      const maxAttempts = 3
      
      const scrollToNewMessage = () => {
        if (virtuosoRef.current && attemptCount < maxAttempts) {
          try {
            const lastIndex = chatMessages.length - 1
            // Use scrollToIndex with align: 'end' to ensure content is visible
            virtuosoRef.current.scrollToIndex({
              index: lastIndex,
              behavior: 'auto',
              align: 'end'
            })
            attemptCount++
            // Try again after a brief delay to ensure content is fully rendered
            if (attemptCount < maxAttempts) {
              setTimeout(scrollToNewMessage, 100)
            }
          } catch (err) {
            // Ignore scroll errors during streaming
            attemptCount++
            if (attemptCount < maxAttempts) {
              setTimeout(scrollToNewMessage, 100)
            }
          }
        }
      }
      
      // Start scrolling after a brief delay
      const timeoutId = setTimeout(scrollToNewMessage, 50)
      return () => clearTimeout(timeoutId)
    } else if (!isChatLoading) {
      // Reset counter when not loading
      lastMessageCountRef.current = chatMessages.length
    }
  }, [chatMessages.length, isChatLoading, shouldFollowOutput])

  // Reset initial scroll flag when messages are cleared
  useEffect(() => {
    if (chatMessages.length === 0) {
      hasInitialScrolledRef.current = false
    }
  }, [chatMessages.length])

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory()
  }, [loadChatHistory])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (rangeChangedTimeoutRef.current) {
        clearTimeout(rangeChangedTimeoutRef.current)
      }
    }
  }, [])

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    // Set initial min-height to prevent oversized textarea on first load
    const minHeight = 24 // Single line height
    const maxHeight = 200
    
    // If empty, set to min height immediately and hide overflow
    if (!textarea.value.trim()) {
      textarea.style.height = `${minHeight}px`
      textarea.style.overflowY = 'hidden'
      return
    }
    
    // Enable overflow for scrolling when content exists
    textarea.style.overflowY = 'auto'
    
    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight))
    textarea.style.height = `${newHeight}px`
  }, [])

  // Initialize textarea on mount - ensure it starts at 24px
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      // Ensure proper width on mount
      textarea.style.width = '100%'
      textarea.style.minWidth = '0'
      // Force initial height to 24px - override any browser calculation
      textarea.style.height = '24px'
      textarea.style.overflowY = 'hidden'
      // Force a reflow to ensure the height is applied
      void textarea.offsetHeight
    }
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [inputValue, adjustTextareaHeight])

  // Focus textarea when not loading
  useEffect(() => {
    if (!isChatLoading && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isChatLoading])

  // Track scroll position to determine if user has scrolled up
  // During AI streaming, always follow output for smooth scrolling
  // Only debounce when user is manually scrolling (not during streaming)
  const handleRangeChanged = useCallback((range) => {
    if (!range || chatMessages.length === 0) return
    
    // If AI is actively streaming, always enable followOutput for smooth scrolling
    if (isChatLoading) {
      setShouldFollowOutput(true)
      return
    }
    
    // Clear any pending timeout
    if (rangeChangedTimeoutRef.current) {
      clearTimeout(rangeChangedTimeoutRef.current)
    }
    
    // Debounce only when user is manually scrolling (not during streaming)
    rangeChangedTimeoutRef.current = setTimeout(() => {
      // Check if user is near the bottom (within last 3 items for better tolerance)
      const threshold = Math.max(1, chatMessages.length - 3)
      const isNearBottom = range.endIndex >= threshold
      
      // Only update if there's a meaningful change
      setShouldFollowOutput((prev) => {
        if (isNearBottom !== prev) {
          return isNearBottom
        }
        return prev
      })
    }, 100) // Reduced debounce for more responsive feel
  }, [chatMessages.length, isChatLoading])

  // Scroll to bottom on initial load when chat history is loaded
  useEffect(() => {
    if (chatMessages.length > 0 && !hasInitialScrolledRef.current) {
      // Wait for Virtuoso to be fully mounted and rendered
      let retryCount = 0
      const maxRetries = 15
      
      const scrollToBottom = () => {
        if (virtuosoRef.current) {
          try {
            const lastIndex = chatMessages.length - 1
            virtuosoRef.current.scrollToIndex({
              index: lastIndex,
              behavior: 'auto',
              align: 'end'
            })
            // Double-check by scrolling again after a brief moment
            setTimeout(() => {
              if (virtuosoRef.current && !hasInitialScrolledRef.current) {
                try {
                  virtuosoRef.current.scrollToIndex({
                    index: lastIndex,
                    behavior: 'auto',
                    align: 'end'
                  })
                } catch (e) {
                  // Ignore second attempt errors
                }
              }
            }, 100)
            hasInitialScrolledRef.current = true
            // Ensure followOutput is enabled after initial scroll
            setShouldFollowOutput(true)
          } catch (err) {
            // If scroll fails, try again (up to max retries)
            retryCount++
            if (retryCount < maxRetries) {
              setTimeout(scrollToBottom, 100)
            } else {
              console.warn('[AIChatPanel] Failed to scroll to bottom after retries')
              hasInitialScrolledRef.current = true // Mark as attempted to prevent infinite retries
            }
          }
        } else {
          // Virtuoso not ready yet, try again (up to max retries)
          retryCount++
          if (retryCount < maxRetries) {
            setTimeout(scrollToBottom, 50)
          } else {
            console.warn('[AIChatPanel] Virtuoso ref not available after retries')
            hasInitialScrolledRef.current = true // Mark as attempted
          }
        }
      }
      
      // Start scrolling after a brief delay to ensure DOM is ready
      // Use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        setTimeout(scrollToBottom, 100)
      })
    }
  }, [chatMessages.length])



  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
  }

  const handleRating = (index, type) => {
    const current = chatMessages[index].rating
    const newRating = current === type ? null : type
    updateMessage(index, { rating: newRating })
  }

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || isChatLoading) return

    try {
      // Reset scroll tracking when user sends a message - they want to see the response
      // Force enable followOutput immediately for smooth streaming
      setShouldFollowOutput(true)

      // Include all open tabs as context (not just selected snippet)
      // This gives AI awareness of all notes the user is working with
      const contextSnippets = []
      
      // Add selected snippet first (highest priority)
      if (selectedSnippet) {
        contextSnippets.push(selectedSnippet)
      }
      
      // Add other open tabs (excluding already added selected snippet)
      openTabs.forEach(tabId => {
        const snippet = snippets.find(s => s.id === tabId)
        if (snippet && snippet.id !== selectedSnippet?.id) {
          contextSnippets.push(snippet)
        }
      })
      
      // Limit to 5 most recent/important snippets to avoid token overflow
      const limitedContext = contextSnippets.slice(0, 5)
      
      sendChatMessage(text, limitedContext)
      setInputValue('')
      // Reset textarea height after clearing input
      if (textareaRef.current) {
        textareaRef.current.style.height = '24px'
        // Ensure it's visible and focused
        setTimeout(() => {
          if (textareaRef.current) {
            adjustTextareaHeight()
            textareaRef.current.focus()
          }
        }, 0)
      }
    } catch (error) {
      console.error('Failed to send chat message:', error)
      // Error is handled by useAIStore, but we should reset input state
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }, [inputValue, isChatLoading, selectedSnippet, snippets, openTabs, sendChatMessage, adjustTextareaHeight])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="chat-interface">
      {/* Virtualized List Container */}
      <div
        className="chat-messages"
        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">✨</div>
            <p>Ask me anything...</p>
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
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%' }}
            data={chatMessages}
            followOutput={shouldFollowOutput ? 'auto' : false}
            rangeChanged={handleRangeChanged}
            initialTopMostItemIndex={chatMessages.length > 0 ? Math.max(0, chatMessages.length - 1) : 0}
            atBottomStateChange={(atBottom) => {
              // If we're at bottom and haven't scrolled yet, mark as scrolled
              if (atBottom && chatMessages.length > 0 && !hasInitialScrolledRef.current) {
                hasInitialScrolledRef.current = true
              }
            }}
            firstItemIndex={0}
            increaseViewportBy={{ top: 400, bottom: 400 }}
            overscan={400}
            defaultItemHeight={100}
            scrollSeekConfiguration={{
              enter: (velocity) => Math.abs(velocity) > 200,
              exit: (velocity) => Math.abs(velocity) < 30
            }}
            itemContent={(index, msg) => (
              <div
                className={`chat-row ${msg.role}`}
                style={{
                  marginBottom: '12px',
                  display: 'flex',
                  gap: '8px',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  paddingLeft: msg.role === 'assistant' ? '0' : '0',
                  paddingRight: msg.role === 'user' ? '0' : '0',
                  alignItems: 'flex-start'
                }}
              >
                {msg.role === 'assistant' && <LuminaAvatar />}

                <div
                  className="chat-content-stack"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: 'calc(100% - 32px)',
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  <div className={`chat-bubble ${msg.role}`}>
                    {msg.role === 'assistant' && !msg.content && isChatLoading ? (
                      <div className="typing-inline">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <MessageContent content={msg.content} />
                    )}
                  </div>
                  {msg.role === 'assistant' && (
                    <ChatActions
                      msg={msg}
                      index={index}
                      onCopy={handleCopy}
                      onRate={handleRating}
                    />
                  )}
                </div>

                {msg.role === 'user' && <UserAvatar />}
              </div>
              )
            }}
            components={{
              Footer: () => {
                // Only show typing indicator in footer if loading AND no assistant message exists yet
                // (Once assistant message exists, typing shows inline in that message)
                const lastMessage = chatMessages[chatMessages.length - 1]
                const hasAssistantMessage = lastMessage && lastMessage.role === 'assistant'
                const showTyping = isChatLoading && !hasAssistantMessage
                
                return (
                  <div style={{ paddingBottom: '12px' }}>
                    {showTyping && (
                      <div className="chat-row assistant" style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <LuminaAvatar />
                        <div className="chat-bubble assistant">
                          <div className="typing-inline">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </div>
                    )}
                    {chatError && (
                      <div className="chat-error">
                        <strong>Error:</strong> {chatError}
                        {chatError.includes('API Key') && (
                          <button
                            onClick={() => {
                              // Could trigger settings modal to open AI tab
                              window.dispatchEvent(new CustomEvent('open-settings-ai'))
                            }}
                            style={{
                              marginTop: '8px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              background: 'var(--bg-active)',
                              border: '1px solid var(--border-dim)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Open Settings
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              }
            }}
          />
        )}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input-textarea"
            placeholder="Type a message... (I see all your open notes and vault)"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              adjustTextareaHeight()
            }}
            onKeyDown={handleKeyDown}
            disabled={isChatLoading}
            rows={1}
          />
          <button
            className="chat-send-button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isChatLoading}
            title="Send message (Enter)"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
})

AIChatPanel.displayName = 'AIChatPanel'

export default AIChatPanel
