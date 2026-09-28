import React, { useState } from 'react'
import { Copy, Check, ThumbsUp, ThumbsDown, Clock3, ChevronDown, FileText, Folder } from 'lucide-react'
import type { ChatMessage } from '../types/ai.types'
import { useAIStore } from '../tools/lumina'

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
  const precedingUserTimestamp = useAIStore((state) => {
    const preceding = state.chatMessages[index - 1]
    return preceding?.role === 'user' ? preceding.timestamp : undefined
  })

  const handleCopyClick = () => {
    onCopy(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const timeStr = msg?.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''
  const reviewChanges = Array.isArray(msg.reviewChanges) ? msg.reviewChanges : []
  const isDirectBadgeResponse = /<lumina-(?:health|audit|index)>/i.test(msg.content || '')
  const responseDuration = typeof msg.responseTimeMs === 'number'
    ? msg.responseTimeMs
    : isDirectBadgeResponse && msg.timestamp && precedingUserTimestamp
      ? Math.max(0, msg.timestamp - precedingUserTimestamp)
      : undefined
  const addedWords = reviewChanges.reduce((total, change) => total + (Number(change.addedWords) || 0), 0)
  const removedWords = reviewChanges.reduce((total, change) => total + (Number(change.removedWords) || 0), 0)
  const formatDuration = (duration?: number) => {
    if (!Number.isFinite(duration) || duration! < 0) return ''
    if (duration! < 1000) return `${Math.round(duration!)}ms`
    if (duration! < 60_000) return `${(duration! / 1000).toFixed(duration! < 10_000 ? 1 : 0)}s`
    const minutes = Math.floor(duration! / 60_000)
    const seconds = Math.floor((duration! % 60_000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const actionLabel: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    renamed: 'Renamed',
    moved: 'Moved',
    folder: 'Folder'
  }

  return (
    <div className="chat-response-actions">
      {(typeof responseDuration === 'number' || reviewChanges.length > 0) && (
        <div className="chat-response-report">
          {typeof responseDuration === 'number' && (
            <div className="chat-response-duration" title="Time from request start to completed response">
              <Clock3 size={12} /> Worked for {formatDuration(responseDuration)}
            </div>
          )}
          {reviewChanges.length > 0 && (
            <details className="chat-review-dropdown">
              <summary className="chat-review-trigger">
                <span>Review</span>
                <span className="chat-review-change-count">{reviewChanges.length} {reviewChanges.length === 1 ? 'change' : 'changes'}</span>
                {addedWords > 0 && <span className="chat-review-added">+{addedWords} words</span>}
                {removedWords > 0 && <span className="chat-review-removed">−{removedWords} words</span>}
                <ChevronDown size={12} className="chat-review-chevron" />
              </summary>
              <div className="chat-review-panel">
                <div className="chat-review-heading">Workspace changes</div>
                {reviewChanges.map((change, changeIndex) => {
                  const isFolder = change.action === 'folder'
                  return (
                    <div className="chat-review-row" key={`${change.path}-${change.action}-${changeIndex}`}>
                      <span className="chat-review-file-icon" aria-hidden="true">
                        {isFolder ? <Folder size={13} /> : <FileText size={13} />}
                      </span>
                      <span className="chat-review-path" title={change.path}>{change.path}</span>
                      <span className="chat-review-action">{actionLabel[change.action] || 'Changed'}</span>
                      <span className="chat-review-diff">
                        {change.addedWords > 0 && <span className="chat-review-added">+{change.addedWords}</span>}
                        {change.removedWords > 0 && <span className="chat-review-removed">−{change.removedWords}</span>}
                        {change.addedWords === 0 && change.removedWords === 0 && <span>—</span>}
                      </span>
                    </div>
                  )
                })}
                <div className="chat-review-legend">Word changes · green added · red removed</div>
              </div>
            </details>
          )}
        </div>
      )}
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
      <div className="chat-response-meta">
        {timeStr && (
          <span
            className="chat-response-time"
            title={msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
          >
            {timeStr}
          </span>
        )}
      </div>
    </div>
  )
}

export const LuminaChatActions = ChatActions
export default ChatActions
