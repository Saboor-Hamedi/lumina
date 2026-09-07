import React, { useState } from 'react'
import { Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'

export const ChatActions = ({ msg, index, onCopy, onRate }) => {
  const [copied, setCopied] = useState(false)

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
      {timeStr && (
        <span className="chat-response-time" title={new Date(msg.timestamp).toLocaleString()}>
          {timeStr}
        </span>
      )}
    </div>
  )
}

export default ChatActions
