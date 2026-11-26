import React from 'react'
import { MessageContent } from './LuminaMessageContent'
import { ChatActions } from './LuminaChatActions'
import { ThinkingIndicator } from './LuminaThinkingIndicator'
import { LuminaEntityMention, getEntityIconForTarget } from './LuminaEntityMention'
import { useAIStore } from '../tools/lumina'
import type { ChatMessage } from '../types/ai.types'
import '../css/chatMentions.css'

export const getMentionIcon = (target: string | any): React.ReactNode => {
  return getEntityIconForTarget(target, 11.5)
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
          marginBottom: msg.role === 'user' ? '10px' : '20px',
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
              (() => {
                const rawContent = msg.content || ''
                // Extract leading @[Title] attachments (from drag-and-drop / composer chips)
                // so they render as sleek, compact, truncated file chips above the prompt text.
                const leadingAttachments: string[] = []
                let remainingText = rawContent
                const leadingRegex = /^\s*@\[([^\]]+)\]\s*/
                while (leadingRegex.test(remainingText)) {
                  const m = remainingText.match(leadingRegex)
                  if (!m) break
                  const clean = m[1].trim()
                  if (clean) leadingAttachments.push(clean)
                  remainingText = remainingText.slice(m[0].length)
                }

                const parts = remainingText.split(userMentionRegex)

                return (
                  <div className="user-message-stack">
                    {leadingAttachments.length > 0 && (
                      <div className="user-message-attachments">
                        {leadingAttachments.map((att, aIdx) => {
                          const displayName = att.split(/[/\\]/).pop() || att
                          return (
                            <LuminaEntityMention
                              key={`${att}-${aIdx}`}
                              target={att}
                              label={displayName}
                              prefixAt={false}
                              className="user-attachment-chip"
                            />
                          )
                        })}
                      </div>
                    )}
                    {remainingText.trim().length > 0 && (
                      <div
                        className="user-message-inline"
                        style={{
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          whiteSpace: 'pre-wrap',
                          textAlign: 'left',
                          maxWidth: '100%'
                        }}
                      >
                        {parts.map((part, pIdx) => {
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
                                <LuminaEntityMention
                                  target={cleanTarget}
                                  label={displayName}
                                  prefixAt={true}
                                />
                                {trailingPunc}
                              </React.Fragment>
                            )
                          }
                          return part
                        })}
                      </div>
                    )}
                  </div>
                )
              })()
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
                  onSkipThinking={() => useAIStore.getState().skipThinking?.()}
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
      prevProps.msg.sources?.join('|') === nextProps.msg.sources?.join('|') &&
      prevProps.isLast === nextProps.isLast &&
      prevProps.isChatLoading === nextProps.isChatLoading &&
      prevProps.activeThinkingStatus === nextProps.activeThinkingStatus &&
      prevProps.userMentionRegex === nextProps.userMentionRegex
    )
  }
)

export const LuminaChatMessageRow = ChatMessageRow
export default ChatMessageRow
