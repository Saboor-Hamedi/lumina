import React from 'react'
import { FileText, Code, Brain } from 'lucide-react'
import { MessageContent } from './LuminaMessageContent'
import { ChatActions } from './LuminaChatActions'
import { ThinkingIndicator } from './LuminaThinkingIndicator'
import { openNoteInEditor } from './LuminaChatLink'
import { useAIStore } from '../tools/lumina'
import type { ChatMessage } from '../types/ai.types'
import '../css/chatMentions.css'

const BRAIN_DOC_KEYS = [
  'purpose',
  'shortcuts',
  'shortcut',
  'introduction',
  'intro',
  'lumina',
  'syntax',
  'code-and-syntax',
  'tables',
  'tasklists',
  'mermaid',
  'math',
  'html',
  'admonitions',
  'best-practices',
  'vision',
  'vision-guide',
  'scope',
  'suggestions',
  'error-reference'
]

export const getMentionIcon = (target: string): React.ReactNode => {
  const lower = (target || '').toLowerCase().trim()
  const clean = lower.replace(/\.md$/, '').replace(/^brain\//, '')

  if (BRAIN_DOC_KEYS.some((k) => clean === k || clean.endsWith(`/${k}`) || clean.includes(k))) {
    return <Brain size={12.5} className="chat-mention-icon brain-icon" />
  }

  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less')) {
    return <span className="chat-mention-symbol css-symbol">{'{ }'}</span>
  }
  if (lower.endsWith('.jsx') || lower.endsWith('.tsx')) {
    return <span className="chat-mention-symbol react-symbol">⚛</span>
  }
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.cjs') ||
    lower.endsWith('.py')
  ) {
    return <Code size={11.5} className="chat-mention-icon code-icon" />
  }
  return <FileText size={11.5} className="chat-mention-icon file-icon" />
}

export interface ChatMessageRowProps {
  msg: ChatMessage
  index: number
  isLast: boolean
  isChatLoading: boolean
  activeThinkingStatus?: string | null
  userMentionRegex: RegExp
  handleCopy: (content: string) => void
  handleRating: (index: number, rating: 'up' | 'down') => void
}

/**
 * ChatMessageRow renders an individual message row (user or assistant)
 * with inline mention badges, thinking indicators, message bubble, and copy/feedback actions.
 */
export const ChatMessageRow: React.FC<ChatMessageRowProps> = React.memo(
  ({
    msg,
    index,
    isLast,
    isChatLoading,
    activeThinkingStatus: propThinkingStatus,
    userMentionRegex,
    handleCopy,
    handleRating
  }) => {
    const storeThinkingStatus = useAIStore((s) => s.activeThinkingStatus)
    const activeThinkingStatus = propThinkingStatus ?? storeThinkingStatus

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
            width: msg.role === 'user' ? 'auto' : '100%',
            marginLeft: msg.role === 'user' ? 'auto' : '0'
          }}
        >
          <div
            className={`chat-bubble ${msg.role}`}
            style={{
              padding: msg.role === 'user' ? '4px 0' : undefined,
              width: msg.role === 'user' ? 'auto' : '100%',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}
          >
            {msg.role === 'user' ? (
              <div
                className="user-message-inline"
                style={{
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  textAlign: 'left'
                }}
              >
                {(() => {
                  const content = msg.content || ''
                  const parts = content.split(userMentionRegex)
                  return parts.map((part, pIdx) => {
                    if (part.startsWith('@') && part.length > 1) {
                      let rawTarget = part.slice(1)
                      if (rawTarget.startsWith('[') && rawTarget.endsWith(']')) {
                        rawTarget = rawTarget.slice(1, -1)
                      }
                      const punctMatch = rawTarget.match(/[.,!?:;)]+$/)
                      const trailingPunc = punctMatch ? punctMatch[0] : ''
                      const cleanTarget = trailingPunc
                        ? rawTarget.slice(0, -trailingPunc.length).trim()
                        : rawTarget.trim()
                      const displayName = cleanTarget.split(/[/\\]/).pop() || cleanTarget

                      return (
                        <React.Fragment key={pIdx}>
                          <span
                            className="mention-chip chat-user-mention-pill"
                            contentEditable={false}
                            onClick={(e) => {
                              e.stopPropagation()
                              openNoteInEditor(cleanTarget)
                            }}
                            title={`Click to open [[${displayName}]] in editor`}
                          >
                            <span
                              className="chat-mention-icon-wrapper"
                              onClick={(e) => {
                                e.stopPropagation()
                                openNoteInEditor(cleanTarget)
                              }}
                              title={`Open ${displayName}`}
                            >
                              {getMentionIcon(cleanTarget)}
                            </span>
                            <span className="chat-user-mention-text">
                              @{displayName}
                            </span>
                          </span>
                          {trailingPunc}
                        </React.Fragment>
                      )
                    }
                    return part
                  })
                })()}
              </div>
            ) : msg.role === 'assistant' &&
              !msg.content?.trim() &&
              !msg.imageUrl &&
              isLast &&
              (isChatLoading || msg.isGenerating) ? (
              <ThinkingIndicator
                isGenerating={msg.isGenerating}
                label={
                  activeThinkingStatus ||
                  (msg.isGenerating ? 'Generating image...' : 'Thinking...')
                }
              />
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
                  <div style={{ marginTop: '8px' }}>
                    <ThinkingIndicator
                      label={
                        activeThinkingStatus ||
                        (msg.content?.includes('<lumina-activity>')
                          ? 'Finalizing workspace changes...'
                          : 'Thinking...')
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
          {msg.role === 'assistant' && !(isLast && isChatLoading) && (
            <ChatActions
              msg={msg}
              index={index}
              onCopy={handleCopy}
              onRate={handleRating}
            />
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
      prevProps.msg.isGenerating === nextProps.msg.isGenerating &&
      prevProps.msg.rating === nextProps.msg.rating &&
      prevProps.msg.timestamp === nextProps.msg.timestamp &&
      prevProps.isLast === nextProps.isLast &&
      prevProps.isChatLoading === nextProps.isChatLoading &&
      prevProps.activeThinkingStatus === nextProps.activeThinkingStatus &&
      prevProps.userMentionRegex === nextProps.userMentionRegex
    )
  }
)

export const LuminaChatMessageRow = ChatMessageRow
export default ChatMessageRow
