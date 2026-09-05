import React from 'react'
import { Sparkles } from 'lucide-react'

export const ThinkingIndicator = ({ isGenerating = false, label = null }) => {
  return (
    <div className="thinking-indicator">
      {isGenerating ? (
        <span className="thinking-text">
          <Sparkles size={11} className="spin" /> {label || 'Generating image...'}
        </span>
      ) : (
        <span className="thinking-text">
          <span className="thinking-dot-pulse" />
          {label || 'Thinking...'}
        </span>
      )}
    </div>
  )
}

export default ThinkingIndicator
