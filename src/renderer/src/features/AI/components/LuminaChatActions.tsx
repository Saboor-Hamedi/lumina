import React, { useState } from 'react'
import { Copy, Check, ThumbsUp, ThumbsDown, Clock3, ChevronDown, FileText, Folder, RotateCcw } from 'lucide-react'
import type { ChatMessage, WorkspaceReviewChange } from '../types/ai.types'
import { useAIStore } from '../tools/lumina'

export interface ChatActionsProps {
  msg: ChatMessage
  index: number
  onCopy: (content: string) => void
  onRate: (index: number, rating: 'up' | 'down') => void
}

/**
 * ChatActions renders action buttons (copy response, rate thumbs up/down, message timestamp,
 * and interactive workspace change review with 1-click Open and Undo) beneath completed assistant responses.
 */
export const ChatActions: React.FC<ChatActionsProps> = ({
  msg,
  index,
  onCopy,
  onRate
}) => {
  const [copied, setCopied] = useState<boolean>(false)
  const [revertedPaths, setRevertedPaths] = useState<Record<string, boolean>>({})
  const precedingUserTimestamp = useAIStore((state) => {
    const preceding = state.chatMessages[index - 1]
    return preceding?.role === 'user' ? preceding.timestamp : undefined
  })

  const handleCopyClick = () => {
    onCopy(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenChange = async (change: WorkspaceReviewChange) => {
    if (change.action === 'folder' || change.action === 'deleted') return
    try {
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const notes: any[] = vs.notes || []
      const target =
        (change.noteId && notes.find((n) => n.id === change.noteId)) ||
        notes.find((n) => {
          const fullPath = [n.folderId, n.title].filter(Boolean).join('/').toLowerCase()
          return (
            fullPath === change.path.toLowerCase() ||
            String(n.title || '').toLowerCase() === (change.title || change.path).toLowerCase()
          )
        })
      if (target && vs.selectNote) {
        vs.selectNote(target.id)
      } else if (target && vs.setSelectedNote) {
        vs.setSelectedNote(target)
      }
    } catch (_) {}
  }

  const handleUndoChange = async (e: React.MouseEvent, change: WorkspaceReviewChange) => {
    e.stopPropagation()
    if (revertedPaths[change.path]) return
    try {
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const notes: any[] = vs.notes || []
      const target =
        (change.noteId && notes.find((n) => n.id === change.noteId)) ||
        notes.find((n) => {
          const fullPath = [n.folderId, n.title].filter(Boolean).join('/').toLowerCase()
          return (
            fullPath === change.path.toLowerCase() ||
            String(n.title || '').toLowerCase() === (change.title || change.path).toLowerCase()
          )
        })

      if (change.previousContent !== undefined && target) {
        const saveAction = vs.saveNote || vs.saveSnippet
        if (saveAction) {
          const restored = await saveAction({ ...target, code: change.previousContent })
          if (vs.selectedNote?.id === target.id && vs.setSelectedNote) {
            vs.setSelectedNote(restored || { ...target, code: change.previousContent })
          }
          setRevertedPaths((prev) => ({ ...prev, [change.path]: true }))
        }
      } else if (change.action === 'created' && target && vs.deleteNote) {
        await vs.deleteNote(target.id)
        setRevertedPaths((prev) => ({ ...prev, [change.path]: true }))
      }
    } catch (_) {}
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

  const hasDuration = typeof responseDuration === 'number'
  const hasReview = reviewChanges.length > 0

  return (
    <div className="chat-response-actions">
      {hasReview && (
        <details className="chat-response-report">
          <summary className="chat-response-summary">
            {hasDuration && (
              <span
                className="chat-response-duration"
                title="Time from request start to completed response"
              >
                <Clock3 size={12} /> Worked for {formatDuration(responseDuration)}
              </span>
            )}
            <span className="chat-review-trigger">
              <span className="chat-review-label">Review</span>
              <span className="chat-review-change-count">
                {reviewChanges.length} {reviewChanges.length === 1 ? 'change' : 'changes'}
              </span>
              {addedWords > 0 && <span className="chat-review-added">+{addedWords} words</span>}
              {removedWords > 0 && <span className="chat-review-removed">−{removedWords} words</span>}
              <ChevronDown size={12} className="chat-review-chevron" />
            </span>
          </summary>
          <div className="chat-review-panel">
            <div className="chat-review-heading">Workspace changes</div>
            {reviewChanges.map((change, changeIndex) => {
              const isFolder = change.action === 'folder'
              const canOpen = !isFolder && change.action !== 'deleted'
              const canUndo =
                change.previousContent !== undefined ||
                (change.action === 'created' && Boolean(change.noteId || change.title || change.path))
              const isReverted = Boolean(revertedPaths[change.path])
              return (
                <div
                  className="chat-review-row"
                  key={`${change.path}-${change.action}-${changeIndex}`}
                  onClick={() => canOpen && handleOpenChange(change)}
                  style={canOpen ? { cursor: 'pointer' } : undefined}
                >
                  <span className="chat-review-file-icon" aria-hidden="true">
                    {isFolder ? <Folder size={13} /> : <FileText size={13} />}
                  </span>
                  <span className="chat-review-path" title={canOpen ? `Open ${change.path}` : change.path}>
                    {change.path}
                  </span>
                  <span className="chat-review-action">
                    {isReverted ? 'Reverted' : actionLabel[change.action] || 'Changed'}
                  </span>
                  <span className="chat-review-diff">
                    {change.addedWords > 0 && <span className="chat-review-added">+{change.addedWords}</span>}
                    {change.removedWords > 0 && <span className="chat-review-removed">−{change.removedWords}</span>}
                    {change.addedWords === 0 && change.removedWords === 0 && <span>—</span>}
                  </span>
                  {canUndo && (
                    <button
                      type="button"
                      className="chat-review-undo-btn"
                      onClick={(e) => handleUndoChange(e, change)}
                      disabled={isReverted}
                      title={isReverted ? 'Change reverted' : `Undo ${actionLabel[change.action]?.toLowerCase() || 'change'}`}
                      style={{
                        marginLeft: '6px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'transparent',
                        color: isReverted ? 'var(--text-muted, #888)' : 'inherit',
                        cursor: isReverted ? 'default' : 'pointer',
                        opacity: isReverted ? 0.6 : 0.85
                      }}
                    >
                      <RotateCcw size={10} />
                      {isReverted ? 'Undone' : 'Undo'}
                    </button>
                  )}
                </div>
              )
            })}
            <div className="chat-review-legend">Word changes · green added · red removed · click file to open</div>
          </div>
        </details>
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
