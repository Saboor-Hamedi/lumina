import React, { useState } from 'react'
import { Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { ChatMessage } from '../types/ai.types'

export interface ChatActionsProps {
  msg: ChatMessage
  index: number
  onCopy: (content: string) => void
  onRate: (index: number, rating: 'up' | 'down') => void
}

/**
 * ChatActions renders action buttons (copy response, rate thumbs up/down, message timestamp)
 * beneath completed assistant responses.
 */
export const ChatActions: React.FC<ChatActionsProps> = ({
  msg,
  index,
  onCopy,
  onRate
}) => {
  const [copied, setCopied] = useState<boolean>(false)

  const handleCopyClick = () => {
    onCopy(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const timeStr = msg?.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <div className="chat-response-actions">
      <div className="chat-action-buttons">
        <button
          onClick={handleCopyClick}
          title={copied ? 'Copied!' : 'Copy Response'}
          style={copied ? { color: '#4ade80' } : {}}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
        <button
          className={msg.rating === 'up' ? 'active' : ''}
          onClick={() => onRate(index, 'up')}
          title="Helpful"
        >
          <ThumbsUp size={13} />
        </button>
        <button
          className={msg.rating === 'down' ? 'active' : ''}
          onClick={() => onRate(index, 'down')}
          title="Not Helpful"
        >
          <ThumbsDown size={13} />
        </button>
      </div>
      {timeStr && (
        <span
          className="chat-response-time"
          title={msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
        >
          {timeStr}
        </span>
      )}
    </div>
  )
}

export const LuminaChatActions = ChatActions
export default ChatActions
