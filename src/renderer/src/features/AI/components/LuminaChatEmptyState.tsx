import React from 'react'

export interface ChatEmptyStateProps {
  selectedNote?: any
  selectedSnippet?: any
  onSendSuggestion?: (note: any) => void
}

/**
 * Empty state screen when a chat session has no messages yet.
 */
export const ChatEmptyState: React.FC<ChatEmptyStateProps> = React.memo(
  ({ selectedNote, selectedSnippet, onSendSuggestion }) => {
    const note = selectedNote || selectedSnippet
    return (
      <div className="chat-empty">
        <h2
          style={{
            fontSize: '15px',
            fontWeight: '600',
            color: 'var(--text-main)',
            margin: '8px 0 4px 0'
          }}
        >
          How can I help you today?
        </h2>
        {note && onSendSuggestion && (
          <button
            className="chat-suggestion-btn"
            onClick={() => onSendSuggestion(note)}
          >
            Explain "{note.title}"
          </button>
        )}
      </div>
    )
  }
)

export default ChatEmptyState
