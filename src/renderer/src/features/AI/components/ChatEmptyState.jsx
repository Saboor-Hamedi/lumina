import React from 'react'

/**
 * Empty state screen when a chat session has no messages yet.
 */
export const ChatEmptyState = React.memo(({ selectedSnippet, onSendSuggestion }) => {
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
      {selectedSnippet && onSendSuggestion && (
        <button
          className="chat-suggestion-btn"
          onClick={() => onSendSuggestion(selectedSnippet)}
        >
          Explain "{selectedSnippet.title}"
        </button>
      )}
    </div>
  )
})

export default ChatEmptyState
