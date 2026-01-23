import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Virtuoso } from 'react-virtuoso'
import { createPortal } from 'react-dom'
import { 
  Copy, ThumbsUp, ThumbsDown, Check, Send, 
  Square, Download, Maximize2, X as CloseIcon,
  Plus, Trash2, History, MessageSquare, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAIStore } from '../../core/store/useAIStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import { getSnippetIcon } from '../../core/utils/fileIconMapper'
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

  useEffect(() => {
    if (isExpanded) {
      const handleEsc = (e) => {
        if (e.key === 'Escape') setIsExpanded(false)
      }
      window.addEventListener('keydown', handleEsc)
      return () => window.removeEventListener('keydown', handleEsc)
    }
    return undefined
  }, [isExpanded])

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

  const handleDownloadImage = async () => {
    if (!imageUrl) return
    try {
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = imageUrl
      
      const basePrompt = prompt || 'generated-image'
      const filename = basePrompt.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()
      a.download = `lumina_${filename}.png`
      
      document.body.appendChild(a)
      a.click()
      
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a)
      }, 100)
      
      if (onCopy) onCopy('Download started...')
    } catch (err) {
      console.error('Failed to download image:', err)
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
          title="Generated AI image"
        />
        {prompt && (
          <div className="chat-image-prompt">
            <strong>Prompt:</strong> {prompt}
          </div>
        )}
        <div className="chat-image-actions">
          <button
            onClick={handleDownloadImage}
            className="chat-image-action-btn"
            title="Download image"
          >
            <Download size={10} />
          </button>
          <button
            onClick={handleCopyImage}
            className="chat-image-action-btn"
            title="Copy image URL"
          >
            <Copy size={10} />
          </button>
          <button
            onClick={() => setIsExpanded(true)}
            className="chat-image-action-btn"
            title="View full screen"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* Full screen modal for image - using Portal to escape sidebar container constraints */}
      {isExpanded && createPortal(
        <div 
          className="chat-image-modal-overlay" 
          onClick={() => setIsExpanded(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsExpanded(false)
          }}
          tabIndex={-1}
          ref={(el) => el && el.focus()}
          style={{ cursor: 'zoom-out' }}
        >
          <div className="chat-image-modal-view">
            <button className="chat-image-modal-close-inner" onClick={() => setIsExpanded(false)}>
              <CloseIcon size={14} />
            </button>
            <img 
              src={imageUrl} 
              alt={prompt} 
              className="chat-image-modal-img" 
              onClick={e => e.stopPropagation()}
              style={{ cursor: 'default' }}
            />
          </div>
        </div>,
        document.body
      )}
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
    generateImage,
    isImageGenerating,
    imageGenerationError,
    cancelChat,
    cancelImageGeneration,
    loadSessions,
    sessions,
    activeSessionId,
    createNewSession,
    switchSession,
    deleteSession
  } = useAIStore()
  const { selectedSnippet, snippets, openTabs } = useVaultStore()
  const [inputValue, setInputValue] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  
  // Mention search state
  const [mentionState, setMentionState] = useState({
    active: false,
    query: '',
    cursorPos: 0,
    results: [],
    index: 0
  })

  // Filter snippets for mentions - OPTIMIZED
  const mentionResults = useMemo(() => {
    if (!mentionState.active) return []
    const query = mentionState.query.toLowerCase()
    
    // Performance: If query is empty, prefer Open Tabs + Recent
    if (!query) {
      const openSnippetObjs = openTabs
        .map(id => snippets.find(s => s.id === id))
        .filter(Boolean)
      
      // If we have few open tabs, fill with some random/top snippets
      if (openSnippetObjs.length < 5) {
        const others = snippets
          .filter(s => !openTabs.includes(s.id))
          .slice(0, 5 - openSnippetObjs.length)
        return [...openSnippetObjs, ...others]
      }
      return openSnippetObjs.slice(0, 8)
    }

    // Standard search
    return snippets
      .filter(s => s.title.toLowerCase().includes(query))
      .slice(0, 8)
  }, [mentionState.active, mentionState.query, snippets, openTabs])

  const textareaRef = useRef(null)
  const backdropRef = useRef(null)

  // Sync scroll for highlighter
  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Generate highlighted HTML
  const getHighlightedText = () => {
    if (!inputValue) return ''
    // Split by @mentions to wrap them
    // Note: We need to preserve whitespace EXACTLY for alignment
    // Use a regex that captures the @mention parts
    const parts = inputValue.split(/(@[^ \n\t]+)/g)
    
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        // Verify it looks like a valid mention pattern
        return <span key={i} className="highlight-mention">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }
  const virtuosoRef = useRef(null)

  // Load chat history on mount and ENSURE it scrolls to bottom
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Sync scroll when active session changes
  useEffect(() => {
    if (activeSessionId) {
      setTimeout(() => {
        if (virtuosoRef.current) {
          virtuosoRef.current.scrollToIndex({
            index: chatMessages.length > 0 ? chatMessages.length - 1 : 0,
            align: 'end',
            behavior: 'auto'
          })
        }
      }, 100)
    }
  }, [activeSessionId, chatMessages.length])

  const [showSessions, setShowSessions] = useState(false)

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
      setAtBottom(true)
      
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
      // Handle mention navigation
      if (mentionState.active && mentionResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMentionState(s => ({ ...s, index: (s.index + 1) % mentionResults.length }))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMentionState(s => ({ ...s, index: (s.index - 1 + mentionResults.length) % mentionResults.length }))
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          insertMention(mentionResults[mentionState.index])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setMentionState(s => ({ ...s, active: false }))
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, mentionState.active, mentionResults, mentionState.index]
  )

  const insertMention = (snippet) => {
    const before = inputValue.slice(0, mentionState.cursorPos - mentionState.query.length - 1)
    const after = inputValue.slice(mentionState.cursorPos)
    const newValue = `${before}@${snippet.title.replace(/\s+/g, '')} ${after}`
    setInputValue(newValue)
    setMentionState({ active: false, query: '', cursorPos: 0, results: [], index: 0 })
    
    // Focus back and adjust height
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        adjustTextareaHeight()
      }
    }, 0)
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    const pos = e.target.selectionStart
    setInputValue(value)

    // Check for @ mention
    const textBeforeCursor = value.slice(0, pos)
    const mentionMatch = textBeforeCursor.match(/@([^ \n\t]*)$/)

    if (mentionMatch) {
      setMentionState({
        active: true,
        query: mentionMatch[1],
        cursorPos: pos,
        results: [],
        index: 0
      })
    } else {
      setMentionState(s => s.active ? { ...s, active: false } : s)
    }
    
    adjustTextareaHeight()
  }

  return (
    <div className="chat-container">
       {/* Sessions Sidebar */}
       <div className={`chat-sessions-sidebar ${showSessions ? 'open' : ''}`}>
        <div className="sessions-header">
          <History size={14} />
          <span>History</span>
          <button className="new-chat-btn" onClick={createNewSession} title="New Chat">
            <Plus size={14} />
          </button>
        </div>
        <div className="sessions-list">
          {sessions.map((s) => (
            <div 
              key={s.id} 
              className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
              onClick={() => switchSession(s.id)}
            >
              <MessageSquare size={14} />
              <span className="session-title">{s.title || 'New Chat'}</span>
              <button 
                className="delete-session-btn" 
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSession(s.id)
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        <header className="chat-header">
          <div className="chat-header-left">
            <button 
              className="toggle-sessions-btn" 
              onClick={() => setShowSessions(!showSessions)}
              title="Toggle History"
            >
              {showSessions ? <ChevronLeft size={16} /> : <History size={16} />}
            </button>
            <h3>DeepSeek AI</h3>
          </div>
          <div className="chat-header-actions">
            <button className="icon-btn" onClick={clearChat} title="Clear conversation history">
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        <div className="chat-messages">
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
            style={{ height: '100%', outline: 'none' }}
            data={chatMessages}
            followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
            initialTopMostItemIndex={chatMessages.length > 0 ? chatMessages.length - 1 : 0}
            atBottomStateChange={setAtBottom}
            firstItemIndex={0}
            increaseViewportBy={{ top: 200, bottom: 200 }}
            overscan={200}
            totalListHeightChanged={(height) => {
              if (atBottom) {
                virtuosoRef.current?.scrollToIndex({
                  index: chatMessages.length - 1,
                  align: 'end',
                  behavior: 'auto'
                })
              }
            }}
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
        {mentionState.active && mentionResults.length > 0 && (
          <div className="chat-mention-list">
            {mentionResults.map((s, i) => (
              <div 
                key={s.id} 
                className={`mention-item ${mentionState.index === i ? 'active' : ''}`}
                onClick={() => insertMention(s)}
              >
                {getSnippetIcon(s, 14)}
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-wrapper">
          <div className="chat-textarea-container">
            <div 
              ref={backdropRef}
              className="chat-input-backdrop" 
              aria-hidden="true"
            >
              {getHighlightedText()}
              <span style={{ visibility: 'hidden' }}>.</span>
            </div>
            <textarea
              ref={textareaRef}
              className="chat-input-textarea"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              disabled={isChatLoading || isImageGenerating}
              autoComplete="off"
              spellCheck="false"
              rows={1}
              placeholder={
                isImageGenerating
                  ? 'Generating image...'
                  : 'Type a message or "draw [description]" to generate images...'
              }
            />
          </div>
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
  </div>
)
})

AIChatPanel.displayName = 'AIChatPanel'

export default AIChatPanel
