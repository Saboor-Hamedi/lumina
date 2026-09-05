import React from 'react'
import { History, Plus, MessageSquare, Trash2 } from 'lucide-react'

export const ChatSessionsSidebar = ({
  showSessions,
  setShowSessions,
  sessions,
  activeSessionId,
  createNewSession,
  switchSession,
  deleteSession
}) => {
  return (
    <div className={`chat-sessions-sidebar ${showSessions ? 'open' : ''}`}>
      <div className="sessions-header">
        <History size={14} />
        <span>History</span>
        <button
          className="new-chat-btn"
          onClick={() => {
            createNewSession()
            setShowSessions(false)
          }}
          title="New Chat"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="sessions-list">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
            onClick={() => {
              switchSession(s.id)
            }}
          >
            <MessageSquare size={14} />
            <span className="session-title">{s.title || 'New Chat'}</span>
            <button
              className="delete-session-btn"
              onClick={(e) => {
                e.stopPropagation()
                deleteSession(s.id)
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ChatSessionsSidebar
