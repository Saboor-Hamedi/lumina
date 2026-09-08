import React from 'react'
import { MessageContent } from './MessageContent'
import { ChatActions } from './ChatActions'
import { ThinkingIndicator } from './ThinkingIndicator'
import { openNoteInEditor } from './ChatLink'
import { useAIStore } from '../tools/lumina'

export const ChatMessageRow = React.memo(
  ({ msg, index, isLast, isChatLoading, userMentionRegex, handleCopy, handleRating }) => {
    const activeThinkingStatus = useAIStore((s) => s.activeThinkingStatus)
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
                      const cleanTarget = part.slice(1).trim().replace(/[.,!?:;)]+$/, '')
                      return (
                        <span
                          key={pIdx}
                          className="chat-user-mention"
                          onClick={(e) => {
                            e.stopPropagation()
                            openNoteInEditor(cleanTarget)
                          }}
                          style={{
                            color: 'var(--text-accent)',
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                          title={`Click to open ${cleanTarget} in editor`}
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
              <ThinkingIndicator
                isGenerating={msg.isGenerating}
                label={activeThinkingStatus || 'Thinking...'}
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
                  <div className="chat-interactive-cursor-row">
                    <span className="chat-streaming-cursor" />
                    {activeThinkingStatus && (
                      <span className="chat-cursor-thought">
                        <span className="thinking-dot-pulse" />
                        <span className="chat-cursor-thought-text">{activeThinkingStatus}</span>
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {msg.role === 'assistant' && !(isLast && isChatLoading) && !msg.isGenerating && (
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
      prevProps.msg.timestamp === nextProps.msg.timestamp &&
      prevProps.msg.isGenerating === nextProps.msg.isGenerating &&
      prevProps.isLast === nextProps.isLast &&
      prevProps.isChatLoading === nextProps.isChatLoading
    )
  }
)

export default ChatMessageRow
