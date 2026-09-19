import React from 'react'
import { Sparkles } from 'lucide-react'

export interface ThinkingIndicatorProps {
  isGenerating?: boolean
  label?: string | null
}

/**
 * ThinkingIndicator presents an animated shimmer dot or spinner
 * indicating reasoning or background AI execution status.
 */
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  isGenerating = false,
  label = null
}) => {
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

export const LuminaThinkingIndicator = ThinkingIndicator
export default ThinkingIndicator
