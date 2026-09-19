import React from 'react'

export interface ScreenLoaderProps {
  /**
   * Primary status message displayed below the progress bar
   * @default 'Loading workspace...'
   */
  status?: string
  /**
   * Optional secondary descriptive or sub-stage message
   */
  subStatus?: string
  /**
   * Numeric progress from 0 to 100.
   * If omitted, an indeterminate animated shimmer is displayed.
   */
  progress?: number
  /**
   * Whether to show the progress bar and percentage
   * @default true
   */
  showProgress?: boolean
  /**
   * Whether to show the Obsidian-style expanding pulse wave rings
   * @default true
   */
  showPulse?: boolean
  /**
   * Whether to show the circular round accent spinner
   * @default true
   */
  showSpinner?: boolean
  /**
   * Whether to render as fixed full-screen overlay or inline container
   * @default true
   */
  fullscreen?: boolean
  /**
   * Brand title displayed above the progress bar
   * @default 'Lumina'
   */
  title?: string
  /**
   * Additional custom CSS classes
   */
  className?: string
  /**
   * Custom inline style overrides
   */
  style?: React.CSSProperties
}

export function ScreenLoader({
  status = 'Loading workspace...',
  subStatus,
  progress,
  showProgress = true,
  showPulse = true,
  showSpinner = true,
  fullscreen = true,
  title = 'Lumina',
  className = '',
  style
}: ScreenLoaderProps) {
  const clampedProgress =
    progress !== undefined ? Math.max(0, Math.min(100, Math.round(progress))) : null

  return (
    <div
      className={`screen-loader-overlay ${fullscreen ? '' : 'inline-loader'} ${className}`.trim()}
      style={style}
      role="status"
      aria-live="polite"
      aria-label={`${title} Loading: ${status}`}
      data-testid="screen-loader"
    >
      {/* Ambient background glow */}
      <div className="screen-loader-ambient" aria-hidden="true" />

      {/* Emblem with pulse rings and circular spinner */}
      <div className="screen-loader-emblem-wrap">
        {showPulse && (
          <>
            <div className="screen-loader-pulse-ring ring-1" aria-hidden="true" />
            <div className="screen-loader-pulse-ring ring-2" aria-hidden="true" />
          </>
        )}

        {showSpinner && (
          <div className="screen-loader-spinner-ring" aria-hidden="true" data-testid="screen-loader-spinner" />
        )}

        <div className="screen-loader-emblem" aria-hidden="true">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24 4L42 16V32L24 44L6 32V16L24 4Z"
              stroke="url(#react-loader-emblem-grad)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M24 4V44M6 16L42 32M6 32L42 16"
              stroke="url(#react-loader-emblem-inner)"
              strokeWidth="1.2"
              strokeOpacity="0.45"
            />
            <circle cx="24" cy="24" r="4.5" fill="url(#react-loader-core-grad)" />
            <defs>
              <linearGradient
                id="react-loader-emblem-grad"
                x1="6"
                y1="4"
                x2="42"
                y2="44"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#a855f7" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient
                id="react-loader-emblem-inner"
                x1="6"
                y1="16"
                x2="42"
                y2="32"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#c084fc" />
                <stop offset="1" stopColor="#818cf8" />
              </linearGradient>
              <linearGradient
                id="react-loader-core-grad"
                x1="20"
                y1="20"
                x2="28"
                y2="28"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#ffffff" />
                <stop offset="1" stopColor="#c084fc" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Brand title */}
      <div className="screen-loader-title">{title}</div>

      {/* Progress Bar and Status */}
      {showProgress && (
        <>
          <div
            className="screen-loader-bar-container"
            role="progressbar"
            aria-valuenow={clampedProgress !== null ? clampedProgress : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            data-testid="screen-loader-progressbar"
          >
            <div
              className="screen-loader-bar-fill"
              style={{
                width: clampedProgress !== null ? `${clampedProgress}%` : '50%'
              }}
            />
          </div>

          <div className="screen-loader-footer">
            <span className="screen-loader-status" title={status}>
              {status}
            </span>
            {clampedProgress !== null && (
              <span className="screen-loader-percent">{clampedProgress}%</span>
            )}
          </div>
        </>
      )}

      {subStatus && <div className="screen-loader-substatus">{subStatus}</div>}
    </div>
  )
}

export default ScreenLoader
