import React from 'react'
import { FileText, Code } from 'lucide-react'
import { MessageContent } from './LuminaMessageContent'
import { ChatActions } from './LuminaChatActions'
import { ThinkingIndicator } from './LuminaThinkingIndicator'
import { openNoteInEditor } from './LuminaChatLink'
import { useAIStore } from '../tools/lumina'

const getMentionIcon = (target) => {
  const lower = (target || '').toLowerCase().trim()
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

export const ChatMessageRow = React.memo(
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
              width: 'auto',
              maxWidth: '100%'
            }}
          >
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
                          className="chat-user-mention-pill"
                          onClick={(e) => {
                            e.stopPropagation()
                            openNoteInEditor(cleanTarget)
                          }}
                          title={`Click to open [[${cleanTarget}]] in editor`}
                        >
                          {getMentionIcon(cleanTarget)}
                          <span className="chat-user-mention-text">{cleanTarget}</span>
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
                label={activeThinkingStatus || (msg.isGenerating ? 'Generating image...' : 'Thinking...')}
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
