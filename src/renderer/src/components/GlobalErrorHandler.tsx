/**
 * ============================================================================
 * Lumina Global Error Handler (`GlobalErrorHandler.tsx`)
 * ============================================================================
 *
 * Production-grade, non-intrusive fault recovery modeled directly after VS Code:
 *
 * 1. Environment-Aware (Dev vs Production):
 *    - In Development:
 *      Maintains developer fidelity (raw exception name, message, stack, component trace).
 *    - In Production:
 *      End-users are protected from scary technical stacks and variable leaks.
 *      Displays clean, human-readable recovery guidance ("This view encountered an unexpected error").
 *      Detects chunk loading failures (`Failed to fetch dynamically imported module`)
 *      and guides the user to reload for updated assets.
 *
 * 2. Crash-Loop Protection:
 *    - Tracks consecutive failures (`errorCount`). If `Try Again` fails repeatedly,
 *      it disables the loop, alerts the user, and shifts primary action to `Reload App`.
 *
 * 3. Privacy-Safe Diagnostics:
 *    - Automatically sanitizes personal filesystem paths (`C:\Users\<username>\...`)
 *      before exporting diagnostic reports or sending them to the main process logger.
 *
 * 4. Dual View Modes (Root vs Subview):
 *    - Subview (`isRoot=false`): Compact, subtle empty-state fitting inside narrow 240px sidebars or tabs.
 *    - Root (`isRoot=true`): Polished full-window recovery screen if the entire workbench fails.
 * ============================================================================
 */

import React, { Component, ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RotateCcw, RefreshCw, Copy, Check, ShieldAlert } from 'lucide-react'
import '../assets/globalErrorHandler.css'

export interface GlobalErrorHandlerProps {
  children?: ReactNode
  isRoot?: boolean
  fallback?: (error: Error | null, reset: () => void) => ReactNode
  onReset?: () => void
}

export interface GlobalErrorHandlerState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  errorCount: number
  copied: boolean
}

/** Check if running in production mode */
const isProdEnvironment = (): boolean => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.PROD !== undefined) {
      return Boolean(import.meta.env.PROD)
    }
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
      return process.env.NODE_ENV === 'production'
    }
  } catch {
    // fallback
  }
  return false
}

/** Check if an error was caused by a stale or failed dynamic import chunk */
const isChunkLoadError = (error: Error | null): boolean => {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('dynamically imported module')
  )
}

/** Sanitize sensitive user filesystem paths from stack traces for privacy */
const sanitizePath = (str: string): string => {
  if (!str) return ''
  return str
    // Windows: C:\Users\Username\... -> C:\Users\<user>\...
    .replace(/(?:[a-zA-Z]:\\(?:Users|home)\\[^\\]+)/gi, (match) => {
      const parts = match.split('\\')
      return `${parts[0]}\\Users\\<user>`
    })
    // Unix: /Users/Username/... or /home/username/... -> /Users/<user>/...
    .replace(/(?:\/(?:Users|home)\/[^/]+)/gi, '/Users/<user>')
}

export class GlobalErrorHandler extends Component<
  GlobalErrorHandlerProps,
  GlobalErrorHandlerState
> {
  private resetTimeoutRef: ReturnType<typeof setTimeout> | null = null
  private copyTimeoutRef: ReturnType<typeof setTimeout> | null = null
  private handleWindowError?: (event: ErrorEvent) => void
  private handleUnhandledRejection?: (event: PromiseRejectionEvent) => void

  constructor(props: GlobalErrorHandlerProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      errorCount: 0,
      copied: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorHandlerState> {
    const errorId = `LUM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const isProd = isProdEnvironment()
    const isChunk = isChunkLoadError(error)
    const sanitizedStack = sanitizePath(error?.stack || '')
    const sanitizedComponentStack = sanitizePath(errorInfo?.componentStack || '')

    // Log diagnostic payload to console
    console.error(`[GlobalErrorHandler][${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}] Component crash:`, {
      message: error?.message,
      errorId: this.state.errorId,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack
    })

    // Forward to Electron main process error logger with sanitized diagnostics
    if ((window as any).api?.logError) {
      try {
        const res = (window as any).api.logError({
          message: error?.message || 'Unknown render error',
          stack: sanitizedStack || 'No stack trace',
          componentStack: sanitizedComponentStack || 'No component stack',
          timestamp: Date.now(),
          errorId: this.state.errorId,
          environment: isProd ? 'production' : 'development',
          isRoot: Boolean(this.props.isRoot),
          isChunkLoadError: isChunk,
          retryCount: this.state.errorCount + 1
        })
        if (res && typeof res.catch === 'function') {
          res.catch(() => {})
        }
      } catch (e) {
        console.warn('[GlobalErrorHandler] Failed to log error to main process:', e)
      }
    }

    // VS Code Style: Gentle non-blocking toast notification
    let toastMessage = 'An unexpected error occurred in this view.'
    if (isChunk) {
      toastMessage = 'App components updated. Please reload the app.'
    } else if (!isProd && error?.message) {
      toastMessage = `View Error: ${error.message.length > 80 ? error.message.slice(0, 80) + '…' : error.message}`
    }

    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: {
          message: toastMessage,
          type: 'error'
        }
      })
    )

    this.setState((prev) => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1
    }))
  }

  componentDidMount(): void {
    if (this.props.isRoot) {
      this.handleWindowError = (event: ErrorEvent) => {
        const msg = event.message || ''
        // Ignore benign browser/electron events
        if (
          msg.includes('ResizeObserver') ||
          msg.includes('Script error.') ||
          msg.includes('AbortError')
        ) {
          event.stopImmediatePropagation?.()
          event.preventDefault?.()
          return
        }

        console.warn('[GlobalErrorHandler] Non-fatal script warning:', msg)
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: `Notice: ${msg.length > 90 ? msg.slice(0, 90) + '…' : msg}`,
              type: 'warning'
            }
          })
        )
      }

      this.handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const reason = event.reason
        const errorMsg =
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : 'Background promise rejected'

        if (
          errorMsg.includes('AbortError') ||
          errorMsg.includes('ResizeObserver') ||
          errorMsg.includes('cancelled')
        ) {
          event.preventDefault?.()
          return
        }

        console.warn('[GlobalErrorHandler] Unhandled rejection intercepted:', reason)
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: `Background Task: ${errorMsg.length > 90 ? errorMsg.slice(0, 90) + '…' : errorMsg}`,
              type: 'warning'
            }
          })
        )
      }

      window.addEventListener('error', this.handleWindowError)
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
    }
  }

  componentWillUnmount(): void {
    if (this.props.isRoot) {
      if (this.handleWindowError) {
        window.removeEventListener('error', this.handleWindowError)
      }
      if (this.handleUnhandledRejection) {
        window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
      }
    }
    if (this.resetTimeoutRef) clearTimeout(this.resetTimeoutRef)
    if (this.copyTimeoutRef) clearTimeout(this.copyTimeoutRef)
  }

  handleReset = (): void => {
    if (this.resetTimeoutRef) clearTimeout(this.resetTimeoutRef)

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false
    })

    this.resetTimeoutRef = setTimeout(() => {
      try {
        this.props.onReset?.()
      } catch (e) {
        console.error('[GlobalErrorHandler] onReset callback failed:', e)
      }
      this.resetTimeoutRef = null
    }, 100)
  }

  handleReload = (): void => {
    try {
      if (typeof window.location?.reload === 'function') {
        window.location.reload()
      } else if ((window as any).electron?.ipcRenderer) {
        ;(window as any).electron.ipcRenderer.invoke('window:reload')
      }
    } catch (e) {
      console.error('[GlobalErrorHandler] Failed to reload window:', e)
    }
  }

  handleCopyError = (): void => {
    const { error, errorInfo, errorId, errorCount } = this.state
    const isProd = isProdEnvironment()
    const sanitizedStack = sanitizePath(error?.stack || '')
    const sanitizedComponentStack = sanitizePath(errorInfo?.componentStack || '')

    const report = [
      `=== Lumina Diagnostic Report ===`,
      `Reference ID : ${errorId || 'N/A'}`,
      `Environment  : ${isProd ? 'Production' : 'Development'}`,
      `Timestamp    : ${new Date().toISOString()}`,
      `Retry Count  : ${errorCount}`,
      `Platform     : ${typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgent : 'Unknown'}`,
      `Error Name   : ${error?.name || 'Error'}`,
      `Message      : ${error?.message || 'Unknown error'}`,
      `\n--- Stack Trace ---`,
      sanitizedStack || 'No stack trace available',
      sanitizedComponentStack ? `\n--- Component Stack ---\n${sanitizedComponentStack}` : ''
    ]
      .filter(Boolean)
      .join('\n')

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(report)
    }

    this.setState({ copied: true })
    if (this.copyTimeoutRef) clearTimeout(this.copyTimeoutRef)
    this.copyTimeoutRef = setTimeout(() => {
      this.setState({ copied: false })
    }, 2000)

    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: {
          message: isProd ? 'Diagnostic report copied to clipboard' : 'Error trace copied to clipboard',
          type: 'info'
        }
      })
    )
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      const { error, errorInfo, errorId, errorCount, copied } = this.state
      const isProd = isProdEnvironment()
      const isChunk = isChunkLoadError(error)
      const isLoop = errorCount >= 2
      const isRoot = Boolean(this.props.isRoot)

      // Title determination
      let title = 'Something went wrong'
      if (isChunk) {
        title = 'Component Update Required'
      } else if (isLoop) {
        title = 'View crashed repeatedly'
      } else if (isRoot) {
        title = 'Lumina encountered a problem'
      }

      // Message determination:
      // In production: clean user-facing guidance. Never scare users with raw JS syntax.
      // In development / tests: keep technical error message for debugging.
      let displayMessage: string
      if (isChunk) {
        displayMessage = 'A component failed to load. Reloading the app will download the latest version.'
      } else if (isLoop) {
        displayMessage = isProd
          ? 'This view could not recover after multiple attempts. Reloading the application or opening another document may resolve this.'
          : `${error?.message || 'Error'} (Crashed ${errorCount} times)`
      } else if (isProd) {
        displayMessage = isRoot
          ? 'An unexpected error occurred and Lumina could not load the workbench.'
          : 'An unexpected error occurred while loading this view.'
      } else {
        displayMessage = error?.message || 'An unexpected rendering error occurred'
      }

      const rawStack = error?.stack || displayMessage
      const rawComponentStack = errorInfo?.componentStack || ''

      // Full Window Recovery UI when Root Workbench Fails
      if (isRoot) {
        return (
          <div className="lumina-error-root" role="alert">
            <div className="lumina-error-root-card">
              <div className="lumina-error-root-icon">
                <ShieldAlert size={28} />
              </div>
              <h2 className="lumina-error-root-title">{title}</h2>
              <p className="lumina-error-root-desc">{displayMessage}</p>

              <div className="lumina-error-root-actions">
                <button
                  type="button"
                  className="lumina-error-btn primary large"
                  onClick={this.handleReload}
                >
                  <RefreshCw size={14} />
                  <span>Reload Application</span>
                </button>

                <button
                  type="button"
                  className="lumina-error-btn secondary large"
                  onClick={this.handleReset}
                >
                  <RotateCcw size={14} />
                  <span>Try Again</span>
                </button>

                <button
                  type="button"
                  className="lumina-error-btn ghost large"
                  onClick={this.handleCopyError}
                  title="Copy diagnostic report"
                  aria-label="Copy error trace"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied Diagnostics' : 'Copy Diagnostics'}</span>
                </button>
              </div>

              {errorId && <div className="lumina-error-badge">{errorId}</div>}
            </div>

            {/* Hidden accessibility/testing trace log */}
            <textarea
              readOnly
              className="lumina-error-hidden-log"
              aria-label="Error details log"
              value={`${rawStack}${rawComponentStack ? `\n\nComponent Stack:\n${rawComponentStack}` : ''}`}
              tabIndex={-1}
            />
          </div>
        )
      }

      // Compact Inline Subview UI (for Sidebars, Tabs, Inspector)
      return (
        <div className={`lumina-error-boundary ${isLoop ? 'has-loop' : ''}`} role="alert">
          <div className="lumina-error-icon-box">
            <AlertTriangle size={18} />
          </div>

          <h3 className="lumina-error-title">{title}</h3>
          <p className="lumina-error-message">{displayMessage}</p>

          <div className="lumina-error-actions">
            {!isLoop ? (
              <>
                <button
                  type="button"
                  className="lumina-error-btn primary"
                  onClick={this.handleReset}
                >
                  <RotateCcw size={12} />
                  <span>Try Again</span>
                </button>

                <button
                  type="button"
                  className="lumina-error-btn secondary"
                  onClick={this.handleReload}
                >
                  <RefreshCw size={12} />
                  <span>Reload App</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="lumina-error-btn primary"
                  onClick={this.handleReload}
                >
                  <RefreshCw size={12} />
                  <span>Reload App</span>
                </button>

                <button
                  type="button"
                  className="lumina-error-btn secondary"
                  onClick={this.handleReset}
                >
                  <RotateCcw size={12} />
                  <span>Try Again</span>
                </button>
              </>
            )}

            <button
              type="button"
              className="lumina-error-btn ghost"
              onClick={this.handleCopyError}
              title="Copy error trace"
              aria-label="Copy error trace"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {errorId && <span className="lumina-error-badge">{errorId}</span>}

          {/* Hidden log accessible for assistive technologies and unit testing */}
          <textarea
            readOnly
            className="lumina-error-hidden-log"
            aria-label="Error details log"
            value={`${rawStack}${rawComponentStack ? `\n\nComponent Stack:\n${rawComponentStack}` : ''}`}
            tabIndex={-1}
          />
        </div>
      )
    }

    return this.props.children
  }
}

export default GlobalErrorHandler

