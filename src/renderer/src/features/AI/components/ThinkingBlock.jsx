import React, { useState, useEffect } from 'react'
import { Brain, ChevronDown } from 'lucide-react'

export const ThinkingBlock = React.memo(({ thinkContent, isStreaming = false }) => {
  const [isOpen, setIsOpen] = useState(isStreaming)

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true)
    }
  }, [isStreaming])

  if (!thinkContent?.trim()) return null

  return (
    <div className={`chat-thinking-container ${isOpen ? 'open' : 'collapsed'}`}>
      <button
        type="button"
        className="chat-thinking-header"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="chat-thinking-header-left">
          <Brain size={13} className={`chat-thinking-brain-icon ${isStreaming ? 'pulsing' : ''}`} />
          <span className="chat-thinking-title">
            {isStreaming ? 'Thinking in background...' : 'Thought Process'}
          </span>
          <span className="preview-indicator-tag chat-thinking-pill">
            {isStreaming ? 'REASONING' : 'THOUGHT'}
          </span>
        </div>
        <div className="chat-thinking-header-right">
          <ChevronDown
            size={12}
            className={`chat-thinking-chevron ${isOpen ? 'rotated' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="chat-thinking-body seamless-scrollbar">
          <div className="chat-thinking-content">
            {thinkContent.trim()}
          </div>
        </div>
      )}
    </div>
  )
})

export default ThinkingBlock
