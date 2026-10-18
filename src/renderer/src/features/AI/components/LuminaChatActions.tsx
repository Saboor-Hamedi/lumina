import React, { useState, useMemo } from 'react'
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Folder,
  RotateCcw
} from 'lucide-react'
import type { ChatMessage, WorkspaceReviewChange } from '../types/ai.types'
import { useAIStore } from '../tools/lumina'
import { getEntityIconForTarget } from './LuminaEntityMention'
import '../css/folderTree.css'

export interface ChatActionsProps {
  msg: ChatMessage
  index: number
  onCopy: (content: string) => void
  onRate: (index: number, rating: 'up' | 'down') => void
}

/**
 * ChatActions renders action buttons (copy response, rate thumbs up/down, message timestamp,
 * and interactive Workspace Changes folder/file tree with 1-click Open and Undo) beneath completed assistant responses.
 */
export const ChatActions: React.FC<ChatActionsProps> = ({
  msg,
  index,
  onCopy,
  onRate
}) => {
  const [copied, setCopied] = useState<boolean>(false)
  const [isReviewExpanded, setIsReviewExpanded] = useState<boolean>(true)
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
      const notes: any[] = vs.notes || vs.snippets || []
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
      const notes: any[] = vs.notes || vs.snippets || []
      const target =
        (change.noteId && notes.find((n) => n.id === change.noteId)) ||
        notes.find((n) => {
          const fullPath = [n.folderId, n.title].filter(Boolean).join('/').toLowerCase()
          return (
            fullPath === change.path.toLowerCase() ||
            String(n.title || '').toLowerCase() === (change.title || change.path).toLowerCase()
          )
        })

      if (change.action === 'deleted' && change.previousContent !== undefined) {
        const saveAction = vs.saveNote || vs.saveSnippet
        if (saveAction) {
          const fileName = change.title || change.path.split('/').pop() || 'Restored Note'
          const folderId =
            change.folderId ??
            (change.path.includes('/') ? change.path.slice(0, change.path.lastIndexOf('/')) : '')
          await saveAction({
            id: change.noteId || crypto.randomUUID(),
            title: fileName,
            folderId,
            code: change.previousContent,
            language: 'markdown',
            timestamp: Date.now()
          })
          setRevertedPaths((prev) => ({ ...prev, [change.path]: true }))
        }
      } else if (change.previousContent !== undefined && target) {
        const saveAction = vs.saveNote || vs.saveSnippet
        if (saveAction) {
          const restored = await saveAction({ ...target, code: change.previousContent })
          if (vs.selectedNote?.id === target.id && vs.setSelectedNote) {
            vs.setSelectedNote(restored || { ...target, code: change.previousContent })
          }
          setRevertedPaths((prev) => ({ ...prev, [change.path]: true }))
        }
      } else if (change.action === 'created' && target && vs.deleteNote) {
        await vs.deleteNote(target.id, true)
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

  // Group reviewChanges into a folder/file tree matching LuminaFolderTree
  const reviewTree = useMemo(() => {
    const folderMap = new Map<
      string,
      { folderPath: string; folderChange?: WorkspaceReviewChange; files: WorkspaceReviewChange[] }
    >()
    const rootFiles: WorkspaceReviewChange[] = []

    for (const change of reviewChanges) {
      const cleanPath = String(change.path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      if (change.action === 'folder') {
        if (!folderMap.has(cleanPath)) {
          folderMap.set(cleanPath, { folderPath: cleanPath, folderChange: change, files: [] })
        } else {
          folderMap.get(cleanPath)!.folderChange = change
        }
        continue
      }

      const folderPath =
        change.folderId !== undefined
          ? String(change.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
          : cleanPath.includes('/')
            ? cleanPath.slice(0, cleanPath.lastIndexOf('/'))
            : ''

      if (folderPath) {
        if (!folderMap.has(folderPath)) {
          folderMap.set(folderPath, { folderPath, files: [] })
        }
        folderMap.get(folderPath)!.files.push(change)
      } else {
        rootFiles.push(change)
      }
    }

    return {
      folderGroups: Array.from(folderMap.values()),
      rootFiles
    }
  }, [reviewChanges])

  const folderCount = reviewTree.folderGroups.length
  const fileCount =
    reviewTree.rootFiles.length +
    reviewTree.folderGroups.reduce((sum, g) => sum + g.files.length, 0)
  const totalTopLevel = reviewTree.folderGroups.length + reviewTree.rootFiles.length

  const renderFileActionMeta = (change: WorkspaceReviewChange) => {
    const canUndo =
      change.previousContent !== undefined ||
      (change.action === 'created' && Boolean(change.noteId || change.title || change.path))
    const isReverted = Boolean(revertedPaths[change.path])

    return (
      <span className="lumina-folder-tree-line-meta">
        <span className={`lumina-folder-tree-action-badge action-${change.action}`}>
          {isReverted ? 'Reverted' : actionLabel[change.action] || 'Changed'}
        </span>
        {(change.addedWords > 0 || change.removedWords > 0) && (
          <span className="lumina-folder-tree-diff">
            {change.addedWords > 0 && (
              <span className="lumina-folder-tree-diff-added">+{change.addedWords}w</span>
            )}
            {change.removedWords > 0 && (
              <span className="lumina-folder-tree-diff-removed">−{change.removedWords}w</span>
            )}
          </span>
        )}
        {canUndo && (
          <button
            type="button"
            className="lumina-folder-tree-undo-btn"
            onClick={(e) => handleUndoChange(e, change)}
            disabled={isReverted}
            title={
              isReverted
                ? 'Change reverted'
                : `Undo ${actionLabel[change.action]?.toLowerCase() || 'change'}`
            }
          >
            <RotateCcw size={10} />
            <span>{isReverted ? 'Undone' : 'Undo'}</span>
          </button>
        )}
      </span>
    )
  }

  return (
    <div className="chat-response-actions">
      {hasReview && (
        <div
          className={`lumina-folder-tree-card ${
            isReviewExpanded ? 'is-expanded' : 'is-collapsed'
          }`}
        >
          <div
            className="lumina-folder-tree-header"
            onClick={() => setIsReviewExpanded((prev) => !prev)}
          >
            <div className="lumina-folder-tree-title-group">
              <FolderTree size={12} className="lumina-folder-tree-icon" />
              <span className="lumina-folder-tree-main-title">Workspace Changes</span>
              <span className="lumina-folder-tree-stats">
                {folderCount > 0 && `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`}
                {folderCount > 0 && fileCount > 0 && ' · '}
                {fileCount > 0 && `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`}
                {addedWords > 0 && (
                  <span className="lumina-folder-tree-diff-added" style={{ marginLeft: 6 }}>
                    +{addedWords}w
                  </span>
                )}
                {removedWords > 0 && (
                  <span className="lumina-folder-tree-diff-removed" style={{ marginLeft: 4 }}>
                    −{removedWords}w
                  </span>
                )}
                {hasDuration && ` · ${formatDuration(responseDuration)}`}
              </span>
            </div>

            <div className="lumina-folder-tree-controls">
              <span className="lumina-folder-tree-chevron">
                {isReviewExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            </div>
          </div>

          {isReviewExpanded && (
            <div className="lumina-folder-tree-body seamless-scrollbar">
              {reviewTree.folderGroups.map((group, gIdx) => {
                const isLastTop = gIdx === totalTopLevel - 1
                const folderBranch = isLastTop ? '└── ' : '├── '
                const childIndentGuide = isLastTop ? '    ' : '│   '

                return (
                  <React.Fragment key={`rev-folder-${group.folderPath}-${gIdx}`}>
                    <div className="lumina-folder-tree-line is-interactive">
                      <span className="lumina-folder-tree-line-left">
                        <span className="lumina-folder-tree-branch">{folderBranch}</span>
                        <span className="lumina-folder-tree-node-item">
                          <Folder size={11} className="lumina-folder-tree-folder-icon" />
                          <span className="lumina-folder-tree-label is-folder">
                            {group.folderPath}/
                          </span>
                        </span>
                      </span>
                      {group.folderChange && (
                        <span className="lumina-folder-tree-line-meta">
                          <span className="lumina-folder-tree-action-badge action-created">
                            Folder
                          </span>
                        </span>
                      )}
                    </div>

                    {group.files.map((change, fIdx) => {
                      const isLastChild = fIdx === group.files.length - 1
                      const childBranch = `${childIndentGuide}${isLastChild ? '└── ' : '├── '}`
                      const canOpen = change.action !== 'deleted'
                      const fileLabel =
                        change.title || change.path.split('/').pop() || change.path

                      return (
                        <div
                          key={`rev-file-${change.path}-${fIdx}`}
                          className="lumina-folder-tree-line is-interactive"
                          onClick={() => canOpen && handleOpenChange(change)}
                          style={canOpen ? { cursor: 'pointer' } : undefined}
                        >
                          <span className="lumina-folder-tree-line-left">
                            <span className="lumina-folder-tree-branch">{childBranch}</span>
                            <span className="lumina-folder-tree-node-item">
                              <span className="lumina-folder-tree-file-icon-wrap">
                                {getEntityIconForTarget(change.path, 11)}
                              </span>
                              <span
                                className={`lumina-folder-tree-label is-file ${
                                  canOpen ? 'is-clickable' : ''
                                }`}
                                title={canOpen ? `Open ${change.path}` : change.path}
                              >
                                {fileLabel}
                              </span>
                            </span>
                          </span>
                          {renderFileActionMeta(change)}
                        </div>
                      )
                    })}
                  </React.Fragment>
                )
              })}

              {reviewTree.rootFiles.map((change, rIdx) => {
                const topIdx = reviewTree.folderGroups.length + rIdx
                const isLastRoot = topIdx === totalTopLevel - 1
                const branch = isLastRoot ? '└── ' : '├── '
                const canOpen = change.action !== 'deleted'
                const fileLabel = change.title || change.path

                return (
                  <div
                    key={`rev-root-${change.path}-${rIdx}`}
                    className="lumina-folder-tree-line is-interactive"
                    onClick={() => canOpen && handleOpenChange(change)}
                    style={canOpen ? { cursor: 'pointer' } : undefined}
                  >
                    <span className="lumina-folder-tree-line-left">
                      <span className="lumina-folder-tree-branch">{branch}</span>
                      <span className="lumina-folder-tree-node-item">
                        <span className="lumina-folder-tree-file-icon-wrap">
                          {getEntityIconForTarget(change.path, 11)}
                        </span>
                        <span
                          className={`lumina-folder-tree-label is-file ${
                            canOpen ? 'is-clickable' : ''
                          }`}
                          title={canOpen ? `Open ${change.path}` : change.path}
                        >
                          {fileLabel}
                        </span>
                      </span>
                    </span>
                    {renderFileActionMeta(change)}
                  </div>
                )
              })}
            </div>
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
