/**
 * PulseLoader.tsx
 *
 * Compact, reusable global pulse loader with a clean message (default: "Wait a second…").
 * Can be rendered inside tabs, modals, media viewers, or inline containers.
 */

import React, { useEffect, useState } from 'react'
import './pulseLoader.css'

export type PulseLoaderSize = 'xs' | 'sm' | 'md'
export type PulseLoaderTone = 'accent' | 'current'

export interface PulseLoaderProps {
  /** Status message displayed beside/below the pulse indicator */
  message?: string
  /** Visual size variant */
  size?: PulseLoaderSize
  /** Color tone: 'accent' uses theme accent, 'current' inherits text color */
  tone?: PulseLoaderTone
  /** Accessible label override when message is omitted or empty */
  ariaLabel?: string
  /** Render inline instead of centered full-container */
  inline?: boolean
  /** Grace delay in ms before showing so fast operations don't flash */
  delayMs?: number
  /** Optional extra CSS class */
  className?: string
}

function escapeLoaderHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Renders the standard Lumina PulseLoader markup as an HTML string for non-React DOM widgets.
 */
export function renderPulseLoaderHtml(
  message = '',
  size: PulseLoaderSize = 'sm',
  inline = true
): string {
  const safeMsg = message ? escapeLoaderHtml(message) : ''
  const inlineClass = inline ? ' is-inline' : ''
  const labelAttr = escapeLoaderHtml(message || 'Loading')
  const msgHtml = safeMsg ? `<span class="lumina-pulse-message">${safeMsg}</span>` : ''
  return `<div class="lumina-pulse-loader size-${size}${inlineClass}" role="status" aria-live="polite" aria-label="${labelAttr}" data-testid="pulse-loader"><span class="lumina-pulse-emblem" aria-hidden="true"><span class="lumina-pulse-ring ring-1"></span><span class="lumina-pulse-ring ring-2"></span><span class="lumina-pulse-dot"></span></span>${msgHtml}</div>`
}

export const PulseLoader: React.FC<PulseLoaderProps> = ({
  message = 'Wait a second…',
  size = 'sm',
  tone = 'accent',
  ariaLabel,
  inline = false,
  delayMs = 180,
  className = ''
}) => {
  const [visible, setVisible] = useState(delayMs <= 0)

  useEffect(() => {
    if (delayMs <= 0) {
      setVisible(true)
      return
    }
    setVisible(false)
    const timer = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])

  if (!visible) return null

  const resolvedLabel = ariaLabel ?? (message || 'Loading')

  return (
    <div
      className={`lumina-pulse-loader size-${size}${inline ? ' is-inline' : ''}${tone === 'current' ? ' tone-current' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={resolvedLabel}
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
