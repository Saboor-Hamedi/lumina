import React from 'react'
import { MessageContent } from './MessageContent'
import { ChatActions } from './ChatActions'
import { ThinkingIndicator } from './ThinkingIndicator'

export const ChatMessageRow = React.memo(
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
              <ThinkingIndicator isGenerating={msg.isGenerating} />
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

export default ChatMessageRow
