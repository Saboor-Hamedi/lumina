/**
 * PulseLoader.tsx
 *
 * Compact, reusable global pulse loader with a clean message (default: "Wait a second…").
 * Can be rendered inside tabs, modals, media viewers, or inline containers.
 */

import React from 'react'
import './pulseLoader.css'

export interface PulseLoaderProps {
  /** Status message displayed beside/below the pulse indicator */
  message?: string
  /** Visual size variant */
  size?: 'sm' | 'md'
  /** Render inline instead of centered full-container */
  inline?: boolean
  /** Optional extra CSS class */
  className?: string
}

export const PulseLoader: React.FC<PulseLoaderProps> = ({
  message = 'Wait a second…',
  size = 'sm',
  inline = false,
  className = ''
}) => {
  return (
    <div
      className={`lumina-pulse-loader size-${size}${inline ? ' is-inline' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={message}
      data-testid="pulse-loader"
    >
      <span className="lumina-pulse-emblem" aria-hidden="true">
        <span className="lumina-pulse-ring ring-1" />
        <span className="lumina-pulse-ring ring-2" />
        <span className="lumina-pulse-dot" />
      </span>
      {message && <span className="lumina-pulse-message">{message}</span>}
    </div>
  )
}

export default PulseLoader
