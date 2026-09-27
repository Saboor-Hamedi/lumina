import React from 'react'
import { Settings as SettingsIcon, WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import { ThinkingIndicator } from './LuminaThinkingIndicator'
import type { ChatMessage } from '../types/ai.types'

export interface ChatFooterStatusProps {
  chatMessages: ChatMessage[]
  isChatLoading: boolean
  activeThinkingStatus?: string | null
  chatError?: string | null
  onRetry?: () => void
}

/**
 * Renders the bottom status area of the chat list: thinking indicator or sleek server offline / error card.
 */
export const ChatFooterStatus: React.FC<ChatFooterStatusProps> = React.memo(
  ({ chatMessages, isChatLoading, activeThinkingStatus, chatError, onRetry }) => {
    const lastMessage = chatMessages[chatMessages.length - 1]
    const hasAssistantMessage = lastMessage && lastMessage.role === 'assistant'
    const showTyping = isChatLoading && !hasAssistantMessage

    if (!showTyping && !chatError) return null

    const isServerOffline = /offline|not running|failed to fetch|fetch failed|econnrefused|unreachable/i.test(
      chatError || ''
    )
    const isApiKeyError = /api key/i.test(chatError || '')

    return (
      <div className="chat-footer-area" style={{ width: '100%' }}>
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
              marginBottom: '10px',
              display: 'flex',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <div
              className="chat-offline-alert-card"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                boxSizing: 'border-box'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  borderRadius: '7px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                {isServerOffline ? <WifiOff size={15} /> : <AlertCircle size={15} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '3px'
                  }}
                >
                  {isServerOffline
                    ? 'Server Offline'
                    : isApiKeyError
                      ? 'API Key Required'
                      : 'Notice'}
                </div>
                <div
                  style={{
                    fontSize: '12.5px',
                    lineHeight: '1.5',
                    color: 'var(--text-muted)'
                  }}
                >
                  {chatError}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-ai-settings'))}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--text-main)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <SettingsIcon size={13} />
                    <span>AI Settings</span>
                  </button>

                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--text-main)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <RefreshCw size={12} />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)

export default ChatFooterStatus
