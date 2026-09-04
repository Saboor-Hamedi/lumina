import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  MessageSquare,
  Maximize,
  Minimize,
  Trash2,
  History,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Check,
  Plus,
  Sparkles,
  PanelLeftClose,
  PanelRightClose,
  PanelRightOpen,
  Settings as SettingsIcon,
  ExternalLink,
  ArrowRightToLine,
  FileText,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Brain,
  ChevronDown,
  Code as CodeIcon
} from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useAIStore } from './tools/LuminaChat'
import { useVaultStore } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useShallow } from 'zustand/react/shallow'
import { Composer } from './Composer'
import ModalHeader from '../Overlays/ModalHeader'
import '../../assets/appshell.css'
import './LuminaChat.css'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const ChatPreBlock = React.memo(({ children, ...props }) => {
  const [copied, setCopied] = useState(false)

  let codeString = ''
  let className = ''

  if (React.isValidElement(children)) {
    className = children.props?.className || ''
    codeString = String(children.props?.children || '')
  } else if (typeof children === 'string') {
    codeString = children
  } else if (Array.isArray(children)) {
    codeString = children
      .map((c) => (React.isValidElement(c) ? c.props?.children : c))
      .join('')
  } else {
    codeString = String(children || '')
  }

  codeString = codeString.replace(/\n$/, '')
  const match = /language-([a-zA-Z0-9-]+)/.exec(className)
  const lang = match ? match[1] : 'text'
  const isDelete = lang.startsWith('lumina-delete')
  const lineCount = codeString ? codeString.split('\n').length : 0

  return (
    <div className="chat-code-block">
      <div className="chat-code-header">
        <div className="chat-code-header-left">
          <span className="preview-indicator-tag">{lang.toUpperCase()}</span>
          <div className="preview-stat-sep" />
          <span className="chat-code-stats">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        {!isDelete && (
          <button
            className="chat-code-copy-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(codeString)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              } catch (err) {
                console.error('Failed to copy: ', err)
              }
            }}
            title="Copy code"
          >
            {copied ? (
              <span className="copied-text">
                <Check size={11} strokeWidth={3} /> COPIED
              </span>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
      {!isDelete && (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={lang === 'text' ? 'markdown' : lang}
          PreTag="div"
          className="seamless-scrollbar"
          customStyle={{
            margin: 0,
            background: 'transparent',
            padding: '10px 14px',
            fontSize: '12px',
            lineHeight: '1.5',
            fontFamily: 'var(--font-mono, monospace)'
          }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      )}
    </div>
  )
})

const ChatInlineCode = React.memo(({ className, children, ...props }) => {
  return (
    <code className={`chat-inline-code ${className || ''}`} {...props}>
      {children}
    </code>
  )
})

const ThinkingBlock = React.memo(({ thinkContent, isStreaming = false }) => {
  const [isOpen, setIsOpen] = useState(isStreaming)

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true)
    }
  }, [isStreaming])

  if (!thinkContent?.trim()) return null

  return (
    <div className={`chat-thinking-container ${isOpen ? 'open' : 'collapsed'}`}>
      <button
        type="button"
        className="chat-thinking-header"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="chat-thinking-header-left">
          <Brain size={13} className={`chat-thinking-brain-icon ${isStreaming ? 'pulsing' : ''}`} />
          <span className="chat-thinking-title">
            {isStreaming ? 'Thinking in background...' : 'Thought Process'}
          </span>
          <span className="preview-indicator-tag chat-thinking-pill">
            {isStreaming ? 'REASONING' : 'THOUGHT'}
          </span>
        </div>
        <div className="chat-thinking-header-right">
          <ChevronDown
            size={12}
            className={`chat-thinking-chevron ${isOpen ? 'rotated' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="chat-thinking-body seamless-scrollbar">
          <div className="chat-thinking-content">
            {thinkContent.trim()}
          </div>
        </div>
      )}
    </div>
  )
})

const ChatBlockquote = ({ children }) => {
  let calloutType = null
  try {
    const arr = React.Children.toArray(children)
    if (arr.length > 0 && arr[0]?.props?.children) {
      const firstText = String(React.Children.toArray(arr[0].props.children)[0] || '')
      const match = firstText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
      if (match) {
        calloutType = match[1].toUpperCase()
      }
    }
  } catch (_) {}

  if (calloutType) {
    const config = {
      NOTE: {
        icon: Info,
        color: 'var(--text-accent, #40bafa)',
        title: 'NOTE',
        border: 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.35)',
        bg: 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.06)'
      },
      TIP: {
        icon: Lightbulb,
        color: '#4ade80',
        title: 'TIP',
        border: 'rgba(74, 222, 128, 0.35)',
        bg: 'rgba(74, 222, 128, 0.06)'
      },
      IMPORTANT: {
        icon: AlertCircle,
        color: '#a78bfa',
        title: 'IMPORTANT',
        border: 'rgba(167, 139, 250, 0.35)',
        bg: 'rgba(167, 139, 250, 0.06)'
      },
      WARNING: {
        icon: AlertTriangle,
        color: '#f59e0b',
        title: 'WARNING',
        border: 'rgba(245, 158, 11, 0.35)',
        bg: 'rgba(245, 158, 11, 0.06)'
      },
      CAUTION: {
        icon: ShieldAlert,
        color: '#ef4444',
        title: 'CAUTION',
        border: 'rgba(239, 68, 68, 0.35)',
        bg: 'rgba(239, 68, 68, 0.06)'
      }
    }[calloutType]

    const IconComp = config.icon

    return (
      <div
        className="chat-callout-card"
        style={{
          margin: '12px 0',
          padding: '10px 14px',
          borderRadius: '4px',
          borderLeft: `3px solid ${config.color}`,
          background: config.bg,
          borderTop: `1px solid ${config.border}`,
          borderRight: `1px solid ${config.border}`,
          borderBottom: `1px solid ${config.border}`
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: config.color,
            fontWeight: 600,
            fontSize: '11.5px',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}
        >
          <IconComp size={13} />
          <span>{config.title}</span>
        </div>
        <div className="chat-callout-body">{children}</div>
      </div>
    )
  }

  return <blockquote className="chat-blockquote">{children}</blockquote>
}

const openNoteInEditor = (rawTitle) => {
  if (!rawTitle) return
  try {
    const { snippets, setSelectedSnippet, setActiveTabId } = useVaultStore.getState()
    const snippetList = Array.isArray(snippets) ? snippets : Object.values(snippets || {})
    const clean = decodeURIComponent(rawTitle)
      .toLowerCase()
      .trim()
      .replace(/^#/, '')
      .replace(/\.md$/, '')
      .replace(/^file:\/\/\/?/, '')
      .split(/[/\\]/)
      .pop()

    // 1. Exact title match
    let target = snippetList.find(
      (s) => (s.title || '').toLowerCase().trim().replace(/\.md$/, '') === clean
    )
    // 2. Partial title match
    if (!target) {
      target = snippetList.find((s) =>
        (s.title || '').toLowerCase().trim().replace(/\.md$/, '').includes(clean)
      )
    }
    // 3. ID match
    if (!target) {
      target = snippetList.find((s) => s.id === rawTitle)
    }

    if (target) {
      if (setSelectedSnippet) setSelectedSnippet(target)
      if (setActiveTabId) setActiveTabId(target.id)
    }
  } catch (err) {
    console.error('Failed to open note in editor:', err)
  }
}

const ChatLink = ({ href, children, ...props }) => {
  // If it's a wikilink or internal note reference or not an external web URL
  const isExternal = href && /^(https?|mailto):/i.test(href)

  if (!isExternal || href?.startsWith('wikilink:')) {
    const rawTarget = href?.startsWith('wikilink:')
      ? href.replace('wikilink:', '')
      : href || String(children || '')

    return (
      <span
        className="chat-wikilink-chip"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openNoteInEditor(rawTarget)
        }}
        title={`Open note: ${decodeURIComponent(rawTarget)}`}
      >
        {children}
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-external-link"
      onClick={(e) => {
        if (window.electron?.ipcRenderer) {
          e.preventDefault()
          window.electron.ipcRenderer.send('open-external-url', href)
        }
      }}
      {...props}
    >
      {children}
    </a>
  )
}

export const MessageContent = React.memo(
  ({ content, isStreaming = false }) => {
    const { thinkContent, mainContent } = useMemo(() => {
      if (!content) return { thinkContent: '', mainContent: '' }

      let think = ''
      let remaining = content

      const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i)
      if (thinkMatch) {
        think = thinkMatch[1]
        remaining = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim()
      }

      return { thinkContent: think, mainContent: remaining }
    }, [content])

    const processedContent = useMemo(() => {
      if (!mainContent) return ''
      let processed = mainContent.replace(/<readFile>([\s\S]*?)<\/readFile>/g, (match, inner) => {
        const titleMatch = inner.match(/title:\s*"([^"]+)"/)
        const fileName = titleMatch ? titleMatch[1] : 'File'
        return `\n> 📄 **Reading:** ${fileName}\n`
      })

      processed = processed.replace(/\[\[(.*?)\]\]/g, (match, inner) => {
        const [target, alias] = inner.split('|')
        const cleanTarget = target.trim()
        const displayText = (alias || cleanTarget).trim()
        return `[${displayText}](wikilink:${encodeURIComponent(cleanTarget)})`
      })

      processed = processed.replace(/([^\n])\s*([├└]──|│\s+[├└]──)/g, '$1\n$2')
      processed = processed.replace(/([├└]──[^\n]+?)\s+([├└]──)/g, '$1\n$2')

      const rawLines = processed.split('\n')
      let inFence = false
      const resultLines = []
      let treeBuffer = []

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i]
        if (line.trim().startsWith('```')) {
          if (treeBuffer.length > 0) {
            resultLines.push('```text\n' + treeBuffer.join('\n') + '\n```')
            treeBuffer = []
          }
          inFence = !inFence
          resultLines.push(line)
          continue
        }

        if (!inFence) {
          const isTreeLine =
            /[├└]──/.test(line) ||
            (treeBuffer.length > 0 && (/^[│\s]*[├└─]/.test(line) || /^📁/.test(line.trim()))) ||
            (/^📁\s+[^/\n]+\s*(?:\(root\)|→|--|\/)/i.test(line.trim()) && i + 1 < rawLines.length && /[├└]──/.test(rawLines[i + 1]))

          if (isTreeLine) {
            treeBuffer.push(line)
            continue
          }
        }

        if (treeBuffer.length > 0) {
          resultLines.push('```text\n' + treeBuffer.join('\n') + '\n```')
          treeBuffer = []
        }
        resultLines.push(line)
      }

      if (treeBuffer.length > 0) {
        resultLines.push('```text\n' + treeBuffer.join('\n') + '\n```')
      }

      return resultLines.join('\n')
    }, [mainContent])

    return (
      <>
        {thinkContent && (
          <ThinkingBlock thinkContent={thinkContent} isStreaming={isStreaming} />
        )}
        {processedContent && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: ChatPreBlock,
              code: ChatInlineCode,
              blockquote: ChatBlockquote,
              a: ChatLink,
              table: ({ children }) => (
                <div className="table-wrapper chat-table-wrapper">
                  <table>{children}</table>
                </div>
              )
            }}
          >
            {processedContent}
          </ReactMarkdown>
        )}
      </>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && prevProps.isStreaming === nextProps.isStreaming
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

const ChatMessageRow = React.memo(
  ({ msg, index, isLast, isChatLoading, userMentionRegex, handleCopy, handleRating }) => {
    return (
      <div
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
            maxWidth: msg.role === 'user' ? '85%' : '100%',
            minWidth: 0,
            flexShrink: 1,
            width: 'auto',
            marginRight: msg.role === 'user' ? '4px' : '0'
          }}
        >
          <div className={`chat-bubble ${msg.role}`}>
            {msg.role === 'user' ? (
              <div
                className="user-message-inline"
                style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', textAlign: 'left' }}
              >
                {(() => {
                  const content = msg.content || ''
                  const parts = content.split(userMentionRegex)
                  return parts.map((part, pIdx) => {
                    if (part.startsWith('@') && part.length > 1) {
                      return (
                        <span
                          key={pIdx}
                          style={{
                            color: 'var(--text-accent)',
                            fontWeight: 500
                          }}
                        >
                          {part}
                        </span>
                      )
                    }
                    return part
                  })
                })()}
              </div>
            ) : msg.role === 'assistant' &&
              !msg.content?.trim() &&
              !msg.imageUrl &&
              (isLast && (isChatLoading || msg.isGenerating)) ? (
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
              <>
                <MessageContent
                  content={msg.content}
                  isStreaming={isLast && isChatLoading}
                  imageUrl={msg.imageUrl}
                  imagePrompt={msg.imagePrompt}
                  onCopy={handleCopy}
                />
                {isLast && isChatLoading && (
                  <span className="chat-streaming-cursor" />
                )}
              </>
            )}
          </div>
          {msg.role === 'assistant' && (
            <ChatActions msg={msg} index={index} onCopy={handleCopy} onRate={handleRating} />
          )}
        </div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.msg.content === nextProps.msg.content &&
      prevProps.msg.role === nextProps.msg.role &&
      prevProps.msg.imageUrl === nextProps.msg.imageUrl &&
      prevProps.msg.rating === nextProps.msg.rating &&
      prevProps.msg.isGenerating === nextProps.msg.isGenerating &&
      prevProps.isLast === nextProps.isLast &&
      prevProps.isChatLoading === nextProps.isChatLoading
    )
  }
)

/**
 * LuminaChatContent
 * Reusable chat body rendered either in the right sidebar or inside the floating modal.
 */
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

  const listRef = useRef(null)
  const autoScrollRef = useRef(true)
  const [showSessions, setShowSessions] = useState(false)

  const handleMessageScroll = useCallback(() => {
    if (!listRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    // User is at bottom if within 80px
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80
    autoScrollRef.current = isAtBottom
  }, [])

  // Auto-scroll to bottom using requestAnimationFrame
  useEffect(() => {
    if (!autoScrollRef.current || !listRef.current) return
    const rafId = requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    })
    return () => cancelAnimationFrame(rafId)
  }, [chatMessages, isChatLoading])

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
    [sendChatMessage, selectedSnippet, snippets, openTabs]
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
      className={`ai-chat-content-root ${isSidebar ? 'is-sidebar-docked' : ''}`}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div className="chat-container" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
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
                            <div className="thinking-indicator">
                              <span className="thinking-text">
                                <span className="thinking-dot-pulse" />
                                Thinking...
                              </span>
                            </div>
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

/**
 * LuminaChat Floating Modal Component
 */
const LuminaChat = ({ isOpen, onClose, onDock, onUnfloat }) => {
  useKeyboardShortcuts({
    onEscape: isOpen ? onClose : null
  })

  const modalRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      const saved =
        useSettingsStore.getState().settings.aiChatModalState ||
        localStorage.getItem('aiChatModalState')
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
      return parsed?.isMinimized ?? false
    } catch (e) {
      return false
    }
  })

  const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  const [modalState, setModalState] = useState(() => {
    try {
      const saved =
        useSettingsStore.getState().settings.aiChatModalState ||
        localStorage.getItem('aiChatModalState')
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
        return {
          top: parsed.top ?? window.innerHeight * 0.1,
          left: parsed.left ?? window.innerWidth * 0.6,
          width: parsed.width ?? 420,
          height: parsed.height ?? 620
        }
      }
    } catch (e) {}
    return {
      top: window.innerHeight * 0.1,
      left: window.innerWidth * 0.6,
      width: 420,
      height: 620
    }
  })

  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.querySelector('textarea')?.focus()
        }
      }, 50)
    } else {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        setTimeout(() => previousFocusRef.current?.focus(), 10)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && !isMaximized) {
      try {
        const stateToSave = { ...modalState, isMinimized }
        localStorage.setItem('aiChatModalState', JSON.stringify(stateToSave))
        updateSetting('aiChatModalState', stateToSave)
      } catch (e) {}
    }
  }, [modalState, isMinimized, isOpen, isMaximized, updateSetting])

  // Smooth, lightweight window drag
  const handleDragStart = useCallback(
    (e) => {
      if (isMaximized || isMinimized) return
      if (e.target.closest('button')) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        top: modalState.top,
        left: modalState.left,
        latestTop: modalState.top,
        latestLeft: modalState.left
      }
    },
    [modalState, isMaximized, isMinimized]
  )

  const handleDrag = useCallback(
    (e) => {
      if (!isDragging || isMaximized) return
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
    },
    [isDragging, isMaximized, modalState.width, modalState.height]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
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

  // Single Bottom-Right Corner Resize
  const handleResizeStart = useCallback(
    (e) => {
      if (isMaximized) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
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
      if (!isResizing || isMaximized) return
      const deltaX = e.clientX - resizeStartPos.current.x
      const deltaY = e.clientY - resizeStartPos.current.y
      const minWidth = 320
      const minHeight = 420
      const maxWidth = window.innerWidth
      const maxHeight = window.innerHeight

      const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width + deltaX))
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, resizeStartPos.current.height + deltaY)
      )

      if (modalRef.current) {
        modalRef.current.style.width = `${newWidth}px`
        modalRef.current.style.height = `${newHeight}px`
      }
      resizeStartPos.current.latestState = {
        width: newWidth,
        height: newHeight
      }
    },
    [isResizing, isMaximized]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    if (resizeStartPos.current.latestState) {
      setModalState((prev) => ({ ...prev, ...resizeStartPos.current.latestState }))
    }
  }, [])

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev)
    if (isMinimized) setIsMinimized(false)
  }, [isMinimized])

  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev)
    if (isMaximized) setIsMaximized(false)
  }, [isMaximized])

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

  if (!isOpen) return null

  return (
    <div className="modal-overlay ai-chat-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal-container ai-chat-modal-container ${isMaximized ? 'maximized' : ''} ${isMinimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...(isMaximized
            ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', borderRadius: 0 }
            : isMinimized
              ? { position: 'fixed', top: 'auto', left: 'auto', bottom: '26px', right: '14px', width: '220px' }
              : {
                  position: 'absolute',
                  top: modalState.top,
                  left: modalState.left,
                  width: modalState.width,
                  height: modalState.height
                })
        }}
      >
        <ModalHeader
          onMouseDown={handleDragStart}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{ cursor: 'move' }}
          left={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="modal-action-icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  window.dispatchEvent(new CustomEvent('ai-toggle-history'))
                }}
                title="Toggle History Sidebar"
                aria-label="Toggle History Sidebar"
              >
                <History size={14} />
              </button>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                Lumina AI
              </span>
            </div>
          }
          right={
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <button
                className="modal-clear-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onDock) onDock()
                  else if (onUnfloat) onUnfloat()
                }}
                title="Dock to Tab Sidebar"
                aria-label="Dock to Tab Sidebar"
              >
                <ArrowRightToLine size={13} />
              </button>
              <button
                className="modal-minimize-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleMinimize()
                }}
                title={isMinimized ? 'Restore' : 'Minimize'}
                aria-label={isMinimized ? 'Restore' : 'Minimize'}
              >
                <Minimize size={13} />
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
                {isMaximized ? <Minimize size={13} /> : <Maximize size={13} />}
              </button>
            </div>
          }
          onClose={onClose}
        />

        {/* Single Bottom-Right Resize Handle */}
        {!isMaximized && (
          <div
            className="resize-handle resize-handle-bottom-right"
            onMouseDown={handleResizeStart}
            title="Resize window"
          />
        )}

        {(isDragging || isResizing) && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              cursor: isDragging ? 'grabbing' : 'nwse-resize'
            }}
          />
        )}

        <div
          className="ai-chat-modal-body"
          style={{
            height: 'calc(100% - 40px)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'text'
          }}
        >
          <LuminaChatContent isSidebar={false} />
        </div>
      </div>
    </div>
  )
}

export default React.memo(LuminaChat)
