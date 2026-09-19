import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  X,
  Pin
} from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import LuminaSessionMenu from './LuminaSessionMenu'

export interface LuminaSessionProps {
  isOpen?: boolean
  onClose?: (() => void) | null
  sessions?: any[]
  activeSessionId?: string | number | null
  createNewSession?: () => void
  switchSession?: (id: any) => void
  deleteSession?: (id: any) => void
  renameSession?: (id: any, newTitle: string) => Promise<void> | void
  togglePinSession?: (id: any) => void
  duplicateSession?: (id: any) => void
  clearSessionMessages?: (id: any) => void
}

/**
 * LuminaSession - Modern Chat History Sidebar
 * Features search filtering, grouping by timeframe (Today, Previous 7 Days, Older) & Pinned,
 * inline title editing, and right-click context actions.
 */
export const LuminaSession: React.FC<LuminaSessionProps> = ({
  isOpen = true,
  onClose = null,
  sessions = [],
  activeSessionId,
  createNewSession,
  switchSession,
  deleteSession,
  renameSession,
  togglePinSession,
  duplicateSession,
  clearSessionMessages
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [contextMenu, setContextMenu] = useState<{
    session: any
    position: { x: number; y: number }
  } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const handleStartRename = useCallback((session: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setEditingId(session.id)
    setEditTitle(session.title || 'New Chat')
  }, [])

  const handleSaveRename = useCallback(
    async (sessionId: string | number, e?: React.MouseEvent | React.KeyboardEvent) => {
      if (e) e.stopPropagation()
      if (editTitle.trim()) {
        await renameSession?.(sessionId, editTitle.trim())
      }
      setEditingId(null)
    },
    [editTitle, renameSession]
  )

  const handleCancelRename = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation()
    setEditingId(null)
  }, [])

  const handleContextMenu = useCallback((session: any, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      session,
      position: { x: e.clientX, y: e.clientY }
    })
  }, [])

  // Filter sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return sessions
    return sessions.filter((s: any) => {
      const title = (s.title || '').toLowerCase()
      const hasMatchingMsg = s.messages?.some((m: any) =>
        (m.content || '').toLowerCase().includes(q)
      )
      return title.includes(q) || hasMatchingMsg
    })
  }, [sessions, searchQuery])

  // Group by pinned and timeframe
  const groups = useMemo(() => {
    if (searchQuery.trim()) {
      return [{ title: `Matching Results (${filteredSessions.length})`, items: filteredSessions }]
    }

    const pinned: any[] = []
    const today: any[] = []
    const previousWeek: any[] = []
    const older: any[] = []

    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    const sevenDays = 7 * oneDay

    filteredSessions.forEach((s: any) => {
      if (s.isPinned) {
        pinned.push(s)
        return
      }

      const time = s.timestamp || now
      const diff = now - time
      if (diff < oneDay) {
        today.push(s)
      } else if (diff < sevenDays) {
        previousWeek.push(s)
      } else {
        older.push(s)
      }
    })

    const result = []
    if (pinned.length > 0) result.push({ title: 'Pinned', items: pinned })
    if (today.length > 0) result.push({ title: 'Today', items: today })
    if (previousWeek.length > 0) result.push({ title: 'Previous 7 Days', items: previousWeek })
    if (older.length > 0) result.push({ title: 'Older', items: older })

    return result
  }, [filteredSessions, searchQuery])

  return (
    <div className={`lumina-session-sidebar ${isOpen ? 'open' : 'closed'}`}>
      {/* Search Header */}
      <div className="lumina-session-search-wrapper">
        <Search size={13} className="lumina-session-search-icon" />
        <input
          type="text"
          className="lumina-session-search-input"
          placeholder="Search chat history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="lumina-session-search-clear"
            onClick={() => setSearchQuery('')}
            title="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <button
        className="lumina-session-new-btn"
        onClick={() => {
          createNewSession?.()
          if (onClose) onClose()
        }}
      >
        <Plus size={14} style={{ color: 'var(--text-accent, #40bafa)' }} />
        <span>New Chat</span>
      </button>

      {/* Scrollable Groups */}
      <div className="lumina-session-scrollable">
        {groups.map(({ title, items }) => (
          <div className="lumina-session-group" key={title}>
            <div className="lumina-session-group-title">
              <span>{title}</span>
            </div>
            <div className="lumina-session-group-items">
              {items.map((s: any) => {
                const isActive = activeSessionId === s.id
                const isEditing = editingId === s.id

                return (
                  <div
                    key={s.id}
                    className={`lumina-session-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      if (!isEditing) {
                        switchSession?.(s.id)
                        if (onClose) onClose()
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(s, e)}
                  >
                    {s.isPinned ? (
                      <Pin
                        size={12}
                        style={{
                          marginRight: '8px',
                          color: 'var(--text-accent, #40bafa)',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <MessageSquare
                        size={13}
                        style={{
                          marginRight: '8px',
                          opacity: isActive ? 1 : 0.7,
                          flexShrink: 0
                        }}
                      />
                    )}

                    {isEditing ? (
                      <div
                        className="lumina-session-rename-box"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          ref={inputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(s.id, e)
                            if (e.key === 'Escape') handleCancelRename(e)
                          }}
                          className="lumina-session-rename-input"
                        />
                        <button
                          className="lumina-session-rename-btn"
                          onClick={(e) => handleSaveRename(s.id, e)}
                          title="Save"
                        >
                          <Check size={11} />
                        </button>
                        <button
                          className="lumina-session-rename-btn"
                          onClick={handleCancelRename}
                          title="Cancel"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className="lumina-session-item-title"
                          onDoubleClick={(e) => handleStartRename(s, e)}
                          title={`${s.title || 'New Chat'} (Right-click for options)`}
                        >
                          {s.title || 'New Chat'}
                        </span>
                        <div className="lumina-session-item-actions">
                          <ToolTip text="Rename" position="top">
                            <button
                              className="lumina-session-action-btn"
                              onClick={(e) => handleStartRename(s, e)}
                              aria-label="Rename Chat"
                            >
                              <Pencil size={11} />
                            </button>
                          </ToolTip>
                          <ToolTip text="Delete" position="top">
                            <button
                              className="lumina-session-action-btn delete"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteSession?.(s.id)
                              }}
                              aria-label="Delete Chat"
                            >
                              <Trash2 size={11} />
                            </button>
                          </ToolTip>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="lumina-session-empty">
            {searchQuery
              ? `No chats found matching "${searchQuery}".`
              : 'No chat sessions yet.'}
          </div>
        )}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <LuminaSessionMenu
          session={contextMenu.session}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onRename={() => handleStartRename(contextMenu.session)}
          onTogglePin={() => togglePinSession?.(contextMenu.session.id)}
          onDuplicate={() => duplicateSession?.(contextMenu.session.id)}
          onClear={() => clearSessionMessages?.(contextMenu.session.id)}
          onDelete={() => deleteSession?.(contextMenu.session.id)}
        />
      )}
    </div>
  )
}

export default React.memo(LuminaSession)
