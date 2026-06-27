import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createPortal } from 'react-dom'
import { MessageSquare, Maximize2, Minimize2, Trash2, ArrowDownToLine, History, Copy, ThumbsUp, ThumbsDown, Check, Send, Square, Download, X as CloseIcon, Plus, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useAIStore } from '../../core/store/useAIStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import { getSnippetIcon } from '../Icons/iconMapper'
import { Composer } from '../AI/Composer'
import ModalHeader from './ModalHeader'
import '../Layout/AppShell.css'
import './AIChatModal.css'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const CodeBlock = React.memo(({ inline, className, children, ...props }) => {
  const match = /language-([a-zA-Z0-9-]+)/.exec(className || '')
  const [copied, setCopied] = useState(false)

  if (!inline && match) {
    const lang = match[1]
    const isDelete = lang.startsWith('lumina-delete')
    const codeString = String(children).replace(/\n$/, '')

    return (
      <div className="chat-code-block">
        <div className="chat-code-header" style={{ justifyContent: 'flex-end' }}>
          <span 
            className="chat-code-lang" 
            style={{ 
              textTransform: 'uppercase', 
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onClick={async () => {
              if (!isDelete) {
                try {
                  await navigator.clipboard.writeText(codeString)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 3000)
                } catch (err) {
                  console.error('Failed to copy: ', err)
                }
              }
            }}
            onMouseEnter={(e) => {
              if (!isDelete) e.target.style.background = 'rgba(255, 255, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              if (!isDelete) e.target.style.background = 'transparent'
            }}
          >
            {copied ? (
              <span style={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                COPIED
              </span>
            ) : lang}
          </span>
        </div>
        {!isDelete && (
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={lang}
            PreTag="div"
            customStyle={{
              margin: 0,
              background: 'transparent',
              padding: '12px',
              fontSize: '13px',
              lineHeight: '1.5'
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        )}
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
      const filename = basePrompt
        .slice(0, 30)
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
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
      {isExpanded &&
        createPortal(
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
                onClick={(e) => e.stopPropagation()}
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

const MessageContent = React.memo(
  ({ content, imageUrl, imagePrompt, onCopy }) => {
    // If message has an image, render it
    if (imageUrl) {
      return <GeneratedImage imageUrl={imageUrl} prompt={imagePrompt} onCopy={onCopy} />
    }

    // Pre-process content to handle custom XML tags like <readFile>
    const processedContent = content?.replace(/<readFile>([\s\S]*?)<\/readFile>/g, (match, inner) => {
      const titleMatch = inner.match(/title:\s*"([^"]+)"/);
      const fileName = titleMatch ? titleMatch[1] : 'File';
      return `\n> 📄 **Reading:** ${fileName}\n`;
    }) || content;

    return (
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
        {processedContent}
      </ReactMarkdown>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && prevProps.imageUrl === nextProps.imageUrl
  }
)

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


const AIChatModal = ({ isOpen, onClose, onUnfloat }) => {
  const modalRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [resizeDirection, setResizeDirection] = useState(null)
  const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  const [modalState, setModalState] = useState(() => {
    try {
      const saved = localStorage.getItem('aiChatModalState')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          top: parsed.top ?? window.innerHeight * 0.1,
          left: parsed.left ?? window.innerWidth * 0.6,
          width: parsed.width ?? 400,
          height: parsed.height ?? 600
        }
      }
    } catch (e) {}
    return {
      top: window.innerHeight * 0.1,
      left: window.innerWidth * 0.6,
      width: 400,
      height: 600
    }
  })

  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen) {
        onClose()
        return true
      }
      return false
    }
  })

  useEffect(() => {
    if (isOpen && !isMaximized) {
      try {
        localStorage.setItem('aiChatModalState', JSON.stringify(modalState))
      } catch (e) {}
    }
  }, [modalState, isOpen, isMaximized])

  const handleDragStart = useCallback(
    (e) => {
      if (isMaximized) return
      if (e.target.closest('button')) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        top: modalState.top,
        left: modalState.left
      }
    },
    [modalState, isMaximized]
  )

  const rafRef = useRef(null)

  const handleDrag = useCallback(
    (e) => {
      if (!isDragging || isMaximized) return
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragStartPos.current.x
        const deltaY = e.clientY - dragStartPos.current.y
        const newLeft = dragStartPos.current.left + deltaX
        const newTop = dragStartPos.current.top + deltaY
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const modalWidth = isMaximized ? viewportWidth : modalState.width
        const modalHeight = isMaximized ? viewportHeight : modalState.height
        const finalLeft = Math.max(0, Math.min(newLeft, viewportWidth - modalWidth))
        const finalTop = Math.max(0, Math.min(newTop, viewportHeight - modalHeight))
        if (modalRef.current) {
          modalRef.current.style.left = `${finalLeft}px`
          modalRef.current.style.top = `${finalTop}px`
        }
        dragStartPos.current.latestLeft = finalLeft
        dragStartPos.current.latestTop = finalTop
      })
    },
    [isDragging, isMaximized, modalState.width, modalState.height]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (dragStartPos.current.latestLeft !== undefined) {
      setModalState((prev) => ({
        ...prev,
        left: dragStartPos.current.latestLeft,
        top: dragStartPos.current.latestTop
      }))
    }
  }, [])

  useEffect(() => {
    if (modalRef.current && !isDragging && !isResizing) {
      if (isMaximized) {
        modalRef.current.style.top = '0px'
        modalRef.current.style.left = '0px'
        modalRef.current.style.width = '100%'
        modalRef.current.style.height = '100%'
      } else {
        modalRef.current.style.top = `${modalState.top}px`
        modalRef.current.style.left = `${modalState.left}px`
        modalRef.current.style.width = `${modalState.width}px`
        modalRef.current.style.height = `${modalState.height}px`
      }
    }
  }, [modalState, isMaximized, isDragging, isResizing])

  const handleResizeStart = useCallback(
    (e, direction) => {
      if (isMaximized) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      setResizeDirection(direction)
      resizeStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: modalState.width,
        height: modalState.height,
        left: modalState.left,
        top: modalState.top
      }
    },
    [modalState, isMaximized]
  )

  const handleResize = useCallback(
    (e) => {
      if (!isResizing || isMaximized || !resizeDirection) return
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - resizeStartPos.current.x
        const deltaY = e.clientY - resizeStartPos.current.y
        const minWidth = 300
        const minHeight = 400
        const maxWidth = window.innerWidth
        const maxHeight = window.innerHeight
        let newWidth = resizeStartPos.current.width
        let newHeight = resizeStartPos.current.height
        let newLeft = resizeStartPos.current.left
        let newTop = resizeStartPos.current.top
        if (resizeDirection.includes('right')) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width + deltaX))
        }
        if (resizeDirection.includes('left')) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width - deltaX))
          newLeft = Math.max(0, resizeStartPos.current.left + (resizeStartPos.current.width - newWidth))
        }
        if (resizeDirection.includes('bottom')) {
          newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartPos.current.height + deltaY))
        }
        if (resizeDirection.includes('top')) {
          newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartPos.current.height - deltaY))
          newTop = Math.max(0, resizeStartPos.current.top + (resizeStartPos.current.height - newHeight))
        }
        if (modalRef.current) {
          modalRef.current.style.width = `${newWidth}px`
          modalRef.current.style.height = `${newHeight}px`
          modalRef.current.style.left = `${newLeft}px`
          modalRef.current.style.top = `${newTop}px`
        }
        resizeStartPos.current.latestState = { width: newWidth, height: newHeight, left: newLeft, top: newTop }
      })
    },
    [isResizing, isMaximized, resizeDirection]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    setResizeDirection(null)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (resizeStartPos.current.latestState) {
      setModalState((prev) => ({ ...prev, ...resizeStartPos.current.latestState }))
    }
  }, [])

  const handleToggleMaximize = useCallback(() => setIsMaximized((prev) => !prev), [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDrag)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDrag, handleDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResize)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResize, handleResizeEnd])


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

  const listRef = useRef(null)

  // Auto-scroll to bottom when messages change, on open, or during streaming
  useEffect(() => {
    const scrollToBottom = () => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    }
    
    scrollToBottom()
    // Small delay to ensure DOM is fully laid out (e.g. after modal open)
    const timeoutId = setTimeout(scrollToBottom, 50)
    return () => clearTimeout(timeoutId)
  }, [chatMessages, isChatLoading, isOpen])

  // Load chat history on mount
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const [showSessions, setShowSessions] = useState(false)

  // Listen for external history toggle (from tab bar button in AppShell)
  useEffect(() => {
    const handler = () => setShowSessions((prev) => !prev)
    window.addEventListener('ai-toggle-history', handler)
    return () => window.removeEventListener('ai-toggle-history', handler)
  }, [])



  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
  }

  const handleRating = (index, type) => {
    const current = chatMessages[index].rating
    const newRating = current === type ? null : type
    updateMessage(index, { rating: newRating })
  }

  const handleSendMessage = useCallback(
    async (text, mode = 'Standard') => {
      // 0. Base validation
      if ((!text || !text.trim()) && !text.startsWith('/image') && !text.startsWith('/img')) return

      // 1. Check for Image Generation Command IMMEDIATELY (before mode injection)
      // Supports "/image <prompt>" or "/img <prompt>"
      if (text.startsWith('/image ') || text.startsWith('/img ')) {
        const prompt = text.replace(/^\/(image|img)\s+/, '')
        try {
          await generateImage(prompt)
          // Add user message showing the request using the store
          const userMsg = { role: 'user', content: text }
          const currentMessages = (chatMessages || []).filter((msg) => msg.content.trim() !== '')
          useAIStore.setState({ chatMessages: [...currentMessages, userMsg] })
          
          // Scroll to bottom after image generation
          setTimeout(() => {
            if (listRef.current) {
              listRef.current.scrollTop = listRef.current.scrollHeight
            }
          }, 100)
        } catch (err) {
          // Error handled in store
        }
        return // Stop processing text chat
      }

      try {
        // Include all open tabs as context (not just selected snippet)
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

        await sendChatMessage(text, limitedContext, mode)
      } catch (err) {
        console.error('Failed to send:', err)
      }
    },
    [sendChatMessage, generateImage, chatMessages, selectedSnippet, snippets, openTabs]
  )

  const visibleMessages = useMemo(() => {
    return chatMessages.filter((msg, index) => {
      const isEmptyAssistant = msg.role === 'assistant' && !msg.content?.trim() && !msg.imageUrl
      const isLastMessage = index === chatMessages.length - 1

      if (isEmptyAssistant) {
        // If it's not the last message, it's a leftover error message. Always hide it.
        if (!isLastMessage) return false
        // If it IS the last message, only show it if it's currently generating
        if (!isChatLoading && !msg.isGenerating) return false
      }
      return true
    })
  }, [chatMessages, isChatLoading])

  const renderedMessages = useMemo(() => {
    return visibleMessages.map((msg, index) => (
      <div
        key={msg.id || `msg-${index}`}
        className={`chat-row ${msg.role}`}
        style={{
          marginBottom: '6px',
          display: 'flex',
          flexDirection: 'row',
          gap: '6px',
          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          alignItems: 'flex-start',
          width: '100%',
          minHeight: '28px',
          willChange: 'auto'
        }}
      >
        <div
          className="chat-content-stack"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: msg.role === 'user' ? '70%' : '95%',
            minWidth: 0,
            flexShrink: 1,
            width: 'auto',
            marginRight: msg.role === 'user' ? '5px' : '0'
          }}
        >
          <div
            className={`chat-bubble ${msg.role}`}
            style={{ maxWidth: '100%', width: '100%' }}
          >
            {msg.role === 'assistant' &&
            !msg.content?.trim() &&
            !msg.imageUrl &&
            ((index === visibleMessages.length - 1 && isChatLoading) || msg.isGenerating) ? (
              <div className="thinking-indicator">
                {msg.isGenerating ? (
                  <span className="thinking-text">
                    <Sparkles size={11} className="spin" /> Generating image...
                  </span>
                ) : (
                  <span className="thinking-text">
                    <span className="thinking-dot-pulse" />
                    Thinking...
                  </span>
                )}
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
      </div>
    ))
  }, [visibleMessages, isChatLoading, handleCopy, handleRating])

  if (!isOpen) return null

  return (
    <div className="modal-overlay ai-chat-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal-container ai-chat-modal-container ${isMaximized ? 'maximized' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          margin: 0,
          transform: 'none',
          maxWidth: isMaximized ? '100%' : '100vw',
          maxHeight: isMaximized ? '100%' : '100vh',
          ...(isMaximized
            ? { top: 0, left: 0, width: '100vw', height: '100vh' }
            : {
                top: modalState.top,
                left: modalState.left,
                width: modalState.width,
                height: modalState.height
              })
        }}
      >
        <ModalHeader
          onMouseDown={handleDragStart}
          style={{ cursor: 'default' }}
          title="AI Chat"
          icon={<MessageSquare size={16} />}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="modal-clear-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSessions((prev) => !prev)
                }}
                title="Toggle History"
                aria-label="Toggle History"
              >
                <History size={14} />
              </button>
              <button
                className="modal-maximize-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleMaximize()
                }}
                title={isMaximized ? 'Restore' : 'Maximize'}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          }
          onClose={onClose}
        />

        {!isMaximized && (
          <>
            <div className="resize-handle resize-handle-right" onMouseDown={(e) => handleResizeStart(e, 'right')} />
            <div className="resize-handle resize-handle-bottom" onMouseDown={(e) => handleResizeStart(e, 'bottom')} />
            <div className="resize-handle resize-handle-bottom-right" onMouseDown={(e) => handleResizeStart(e, 'bottom-right')} />
            <div className="resize-handle resize-handle-left" onMouseDown={(e) => handleResizeStart(e, 'left')} />
            <div className="resize-handle resize-handle-top" onMouseDown={(e) => handleResizeStart(e, 'top')} />
            <div className="resize-handle resize-handle-top-left" onMouseDown={(e) => handleResizeStart(e, 'top-left')} />
            <div className="resize-handle resize-handle-top-right" onMouseDown={(e) => handleResizeStart(e, 'top-right')} />
            <div className="resize-handle resize-handle-bottom-left" onMouseDown={(e) => handleResizeStart(e, 'bottom-left')} />
          </>
        )}

        <div className="ai-chat-modal-body" style={{ height: 'calc(100% - 40px)', flex: 1, display: 'flex', flexDirection: 'column', userSelect: 'text' }}>
          <div className="chat-container">
      {/* Sessions Sidebar */}
      <div className={`chat-sessions-sidebar ${showSessions ? 'open' : ''}`}>
        <div className="sessions-header">
          <History size={14} />
          <span>History</span>
          <button
            className="new-chat-btn"
            onClick={() => {
              createNewSession()
              setShowSessions(false)
            }}
            title="New Chat"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="sessions-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
              onClick={() => {
                switchSession(s.id)
              }}
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

      <div className="chat-main" onClick={() => { if (showSessions) setShowSessions(false) }}>
        <div className="chat-messages" ref={listRef}>
          {visibleMessages.length === 0 ? (
            <div className="chat-empty">
              
              <h2
                style={{
                  fontSize: '16px',
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
                          <div className="thinking-indicator">
                            <span className="thinking-text">
                              <span className="thinking-dot-pulse" />
                              Thinking...
                            </span>
                          </div>
                        </div>
                      )}
                      {chatError && (
                        <div className="chat-error">
                          <strong>Error:</strong> {chatError}
                          {chatError.includes('API Key') && (
                            <button
                              onClick={() =>
                                window.dispatchEvent(new CustomEvent('open-settings-ai'))
                              }
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
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="chat-input-area">
          <Composer
            onSend={handleSendMessage}
            isLoading={isChatLoading || isImageGenerating}
            onCancel={() => {
              if (isChatLoading) cancelChat()
              if (isImageGenerating) cancelImageGeneration()
            }}
          />
        </div>
      </div>
    </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(AIChatModal)
