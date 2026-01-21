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
  const { chatMessages, isChatLoading, chatError, sendChatMessage, clearChat, updateMessage } =
    useAIStore()
  const { selectedSnippet } = useVaultStore()
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef(null)

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    // Set initial min-height to prevent oversized textarea on first load
    const minHeight = 24 // Single line height
    const maxHeight = 200
    
    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight))
    textarea.style.height = `${newHeight}px`
  }, [])

  // Initialize textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      // Ensure proper width on mount
      textareaRef.current.style.width = '100%'
      textareaRef.current.style.minWidth = '0'
      // Set initial height to prevent oversized textarea
      textareaRef.current.style.height = '24px'
      // Then adjust if needed
      adjustTextareaHeight()
    }
  }, [adjustTextareaHeight])

  useEffect(() => {
    adjustTextareaHeight()
  }, [inputValue, adjustTextareaHeight])

  // Focus textarea when not loading
  useEffect(() => {
    if (!isChatLoading && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isChatLoading])

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
      const context = selectedSnippet ? [selectedSnippet] : []
      sendChatMessage(text, context)
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
  }, [inputValue, isChatLoading, selectedSnippet, sendChatMessage, adjustTextareaHeight])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="chat-interface">
      {chatMessages.length > 0 && (
        <button className="chat-clear-btn" onClick={clearChat} title="Clear Conversation">
          Clear History
        </button>
      )}

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
            style={{ height: '100%' }}
            data={chatMessages}
            followOutput="smooth"
            itemContent={(index, msg) => (
              <div
                className={`chat-row ${msg.role}`}
                style={{
                  marginBottom: '20px',
                  display: 'flex',
                  gap: '10px',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  paddingLeft: msg.role === 'assistant' ? '4px' : '0',
                  paddingRight: msg.role === 'user' ? '4px' : '0'
                }}
              >
                {msg.role === 'assistant' && <LuminaAvatar />}

                <div
                  className="chat-content-stack"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: 'calc(100% - 40px)'
                  }}
                >
                  <div className={`chat-bubble ${msg.role}`}>
                    <MessageContent content={msg.content} />
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
            )}
            components={{
              Footer: () => (
                <div style={{ paddingBottom: '20px' }}>
                  {isChatLoading && (
                    <div className="chat-bubble assistant typing">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
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
            }}
          />
        )}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input-textarea"
            placeholder="Type a message... (Tip: I see active note)"
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
