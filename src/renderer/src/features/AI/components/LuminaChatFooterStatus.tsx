import React from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { ThinkingIndicator } from './LuminaThinkingIndicator'
import { MessageContent } from './LuminaMessageContent'
import type { ChatMessage } from '../types/ai.types'

export interface ChatFooterStatusProps {
  chatMessages: ChatMessage[]
  isChatLoading: boolean
  activeThinkingStatus?: string | null
  chatError?: string | null
}

/**
 * Renders the bottom status area of the chat list: thinking indicator or API error alert.
 */
export const ChatFooterStatus: React.FC<ChatFooterStatusProps> = React.memo(
  ({ chatMessages, isChatLoading, activeThinkingStatus, chatError }) => {
    const lastMessage = chatMessages[chatMessages.length - 1]
    const hasAssistantMessage = lastMessage && lastMessage.role === 'assistant'
    const showTyping = isChatLoading && !hasAssistantMessage

    if (!showTyping && !chatError) return null

    return (
      <div className="chat-footer-area">
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
            <ThinkingIndicator label={activeThinkingStatus} />
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
      </div>
    )
  }
)

export default ChatFooterStatus
