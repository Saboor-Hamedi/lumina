import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Virtuoso } from 'react-virtuoso'
import { Copy, ThumbsUp, ThumbsDown, Check, Send, Square } from 'lucide-react'
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

// Image component for displaying generated images
const GeneratedImage = React.memo(({ imageUrl, prompt, onCopy }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleImageLoad = () => {
    setIsLoading(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const handleCopyImage = () => {
    if (imageUrl) {
      // Copy image URL to clipboard
      navigator.clipboard.writeText(imageUrl)
      if (onCopy) onCopy('Image URL copied to clipboard!')
    }
  }

  if (hasError) {
    return (
      <div className="chat-image-error">
        <p>Failed to load image</p>
        {prompt && <p className="chat-image-prompt">Prompt: {prompt}</p>}
      </div>
    )
  }

  return (
    <div className="chat-generated-image-container">
      {isLoading && (
        <div className="chat-image-loading">
          <div className="typing-inline">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Generating image...</p>
        </div>
      )}
      <div className={`chat-image-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <img
          src={imageUrl}
          alt={prompt || 'Generated image'}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className="chat-generated-image"
          style={{ display: isLoading ? 'none' : 'block' }}
          onClick={() => setIsExpanded(!isExpanded)}
          title="Click to expand/collapse"
        />
        {prompt && (
          <div className="chat-image-prompt">
            <strong>Prompt:</strong> {prompt}
          </div>
        )}
        <div className="chat-image-actions">
          <button
            onClick={handleCopyImage}
            className="chat-image-action-btn"
            title="Copy image URL"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="chat-image-action-btn"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>
    </div>
  )
})

GeneratedImage.displayName = 'GeneratedImage'

const MessageContent = React.memo(({ content, imageUrl, imagePrompt, onCopy }) => {
  // If message has an image, render it
  if (imageUrl) {
    return <GeneratedImage imageUrl={imageUrl} prompt={imagePrompt} onCopy={onCopy} />
  }

  // Otherwise render markdown content
  return (
    <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: CodeBlock,
          table: ({ children }) => (
            <div className="table-wrapper">
              <table>{children}</table>
            </div>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

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
  const {
    chatMessages,
    isChatLoading,
    chatError,
    sendChatMessage,
    clearChat,
    updateMessage,
    loadChatHistory,
    generateImage,
    isImageGenerating,
    imageGenerationError,
    cancelChat,
    cancelImageGeneration
  } = useAIStore()
  const { selectedSnippet, snippets, openTabs } = useVaultStore()
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef(null)
  const virtuosoRef = useRef(null)

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory()
  }, [loadChatHistory])

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

  // Simple scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (virtuosoRef.current && chatMessages.length > 0) {
      virtuosoRef.current.scrollToIndex({
        index: chatMessages.length - 1,
        behavior: 'smooth',
        align: 'end'
      })
    }
  }, [chatMessages.length])

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (chatMessages.length > 0) {
      const timeoutId = setTimeout(() => {
        scrollToBottom()
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [chatMessages.length, scrollToBottom])

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
  }

  const handleRating = (index, type) => {
    const current = chatMessages[index].rating
    const newRating = current === type ? null : type
    updateMessage(index, { rating: newRating })
  }

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isChatLoading || isImageGenerating) return

    try {
      // Check if this is an image generation request
      const { isImageGenerationRequest } = await import('./imageGenerationService.js')

      if (isImageGenerationRequest(text)) {
        // Handle image generation

        // Add user message showing the request using the store
        const userMsg = { role: 'user', content: text }
        const currentMessages = chatMessages || []
        useAIStore.setState({ chatMessages: [...currentMessages, userMsg] })

        setInputValue('')
        if (textareaRef.current) {
          textareaRef.current.style.height = '24px'
        }

        // Generate image (this will add the assistant message with the image)
        await generateImage(text)

        // Scroll to bottom after image generation
        setTimeout(() => {
          if (virtuosoRef.current) {
            try {
              virtuosoRef.current.scrollToIndex({
                index: chatMessages.length,
                behavior: 'auto',
                align: 'end'
              })
            } catch (err) {
              // Ignore scroll errors
            }
          }
        }, 100)

        return
      }

      // Regular chat message
      // Reset scroll tracking when user sends a message - they want to see the response
      // Send chat message

      // Include all open tabs as context (not just selected snippet)
      // This gives AI awareness of all notes the user is working with
      const contextSnippets = []

      // Add selected snippet first (highest priority)
      if (selectedSnippet) {
        contextSnippets.push(selectedSnippet)
      }

      // Add other open tabs (excluding already added selected snippet)
      openTabs.forEach((tabId) => {
        const snippet = snippets.find((s) => s.id === tabId)
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
      console.error('Failed to send message:', error)
      // Error is handled by useAIStore, but we should reset input state
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }, [
    inputValue,
    isChatLoading,
    isImageGenerating,
    selectedSnippet,
    snippets,
    openTabs,
    sendChatMessage,
    generateImage,
    adjustTextareaHeight,
    chatMessages.length
  ])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

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
            initialTopMostItemIndex={chatMessages.length - 1}
            firstItemIndex={0}
            increaseViewportBy={{ top: 50, bottom: 50 }}
            overscan={50}
            itemContent={(index, msg) => {
              // Ensure stable rendering - prevent content from disappearing
              // Use key for stable React reconciliation
              return (
                <div
                  key={`msg-${index}-${msg.role}-${msg.timestamp || index}`}
                  className={`chat-row ${msg.role}`}
                  style={{
                    marginBottom: '12px',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '8px',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-start',
                    width: '100%',
                    minHeight: '40px',
                    willChange: 'auto'
                  }}
                >
                  {msg.role === 'assistant' && <LuminaAvatar />}

                  <div
                    className="chat-content-stack"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: msg.role === 'user' ? '70%' : '75%',
                      minWidth: 0,
                      flexShrink: 1,
                      width: 'auto'
                    }}
                  >
                    <div
                      className={`chat-bubble ${msg.role}`}
                      style={{ maxWidth: '100%', width: '100%' }}
                    >
                      {msg.role === 'assistant' &&
                      !msg.content &&
                      !msg.imageUrl &&
                      isChatLoading ? (
                        <div className="typing-inline">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      ) : (
                        <MessageContent
                          content={msg.content}
                          imageUrl={msg.imageUrl}
                          imagePrompt={msg.imagePrompt}
                          onCopy={handleCopy}
                        />
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
                      <div
                        className="chat-row assistant"
                        style={{
                          marginBottom: '12px',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'flex-start'
                        }}
                      >
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
                    {imageGenerationError && (
                      <div className="chat-error">
                        <strong>Image Generation Error:</strong> {imageGenerationError}
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
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              adjustTextareaHeight()
            }}
            onKeyDown={handleKeyDown}
            disabled={isChatLoading || isImageGenerating}
            rows={1}
            placeholder={
              isImageGenerating
                ? 'Generating image...'
                : 'Type a message or "draw [description]" to generate images...'
            }
          />
          <button
            className="chat-send-button"
            onClick={
              isChatLoading || isImageGenerating
                ? isChatLoading
                  ? cancelChat
                  : cancelImageGeneration
                : handleSend
            }
            disabled={!inputValue.trim() && !(isChatLoading || isImageGenerating)}
            title={isChatLoading || isImageGenerating ? 'Stop generation' : 'Send message (Enter)'}
          >
            <div style={{ position: 'relative', width: '16px', height: '16px' }}>
              {isChatLoading || isImageGenerating ? (
                <>
                  <div
                    className="chat-loading-spinner"
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }}
                  />
                  <Square
                    size={8}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: 'currentColor',
                      opacity: 0.8
                    }}
                  />
                </>
              ) : (
                <Send size={16} />
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
})

AIChatPanel.displayName = 'AIChatPanel'

export default AIChatPanel
