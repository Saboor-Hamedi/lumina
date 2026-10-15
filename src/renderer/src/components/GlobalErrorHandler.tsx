/**
 * ============================================================================
 * Lumina Global Error Handler (`GlobalErrorHandler.tsx`)
 * ============================================================================
 *
 * Fault-tolerant Error Boundary inspired by VS Code & modern production apps:
 * 1. Non-Fatal Async Safety:
 *    Background unhandled promise rejections and script errors are logged and
 *    surfaced as gentle, non-blocking toast notifications. They NEVER destroy
 *    or unmount the active workspace layout while the user is typing.
 *
 * 2. Component Fault Isolation:
 *    When a fatal React render cycle exception occurs in a sub-tree, only that
 *    sub-tree renders a calm, minimalist recovery card.
 *
 * 3. User Recovery Actions:
 *    Provides immediate "Try Again", "Dismiss / Keep Working", and "Reload"
 *    actions with an optional collapsible technical log.
 * ============================================================================
 */

import React, { Component, ReactNode, ErrorInfo } from 'react'
import {
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Terminal,
  X
} from 'lucide-react'
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
  showDetails: boolean
  copied: boolean
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
      showDetails: false,
      copied: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorHandlerState> {
    return {
      hasError: true,
      error,
      errorId: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[GlobalErrorHandler] React component crash caught:', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      errorId: this.state.errorId
    })

    // Forward to Electron main process error logger if available
    if ((window as any).api?.logError) {
      try {
        const res = (window as any).api.logError({
          message: error?.message || 'Unknown render error',
          stack: error?.stack || 'No stack trace',
          componentStack: errorInfo?.componentStack || 'No component stack',
          timestamp: Date.now(),
          errorId: this.state.errorId
        })
        if (res && typeof res.catch === 'function') {
          res.catch(() => {})
        }
      } catch (e) {
        console.warn('[GlobalErrorHandler] Failed to log error to main:', e)
      }
    }

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
        // Ignore benign ResizeObserver notifications and standard browser warnings
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
        // VS Code Pattern: Do NOT blow up the UI for background script warnings.
        // Surface a gentle, non-blocking toast notification instead.
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

        // Ignore benign user-cancelled fetches, aborts, or HMR reloads
        if (
          errorMsg.includes('AbortError') ||
          errorMsg.includes('ResizeObserver') ||
          errorMsg.includes('cancelled')
        ) {
          event.preventDefault?.()
          return
        }

        console.warn('[GlobalErrorHandler] Non-fatal promise rejection:', reason)

        // Forward to main logger without crashing the active React tree
        if ((window as any).api?.logError) {
          try {
            ;(window as any).api.logError({
              message: errorMsg,
              stack: reason?.stack || 'Unhandled Promise Rejection',
              timestamp: Date.now()
            }).catch?.(() => {})
          } catch (_) {}
        }

        // Inform user via non-blocking toast, keeping workspace fully interactive
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: `${errorMsg.length > 90 ? errorMsg.slice(0, 90) + '…' : errorMsg}`,
              type: 'warning'
            }
          })
        )

        event.preventDefault?.()
      }

      window.addEventListener('error', this.handleWindowError)
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
    }
  }

  componentWillUnmount(): void {
    if (this.handleWindowError) {
      window.removeEventListener('error', this.handleWindowError)
    }
    if (this.handleUnhandledRejection) {
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
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
      showDetails: false,
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
    const { error, errorInfo, errorId } = this.state
    const textToCopy = [
      `Lumina Error Log [${errorId || 'N/A'}]`,
      `Message: ${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
      `Timestamp: ${new Date().toISOString()}`,
      `\n--- Stack Trace ---`,
      error?.stack || 'No stack trace available',
      errorInfo?.componentStack ? `\n--- Component Stack ---\n${errorInfo.componentStack}` : ''
    ]
      .filter(Boolean)
      .join('\n')

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy)
    }

    this.setState({ copied: true })
    if (this.copyTimeoutRef) clearTimeout(this.copyTimeoutRef)
    this.copyTimeoutRef = setTimeout(() => {
      this.setState({ copied: false })
    }, 2000)
  }

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      const { error, errorInfo, errorId, showDetails, copied } = this.state
      const errorMessage = error?.message || 'An unexpected rendering error occurred'
      const errorStack = error?.stack || errorMessage
      const componentStack = errorInfo?.componentStack || ''

      return (
        <div className="lumina-error-boundary" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
          <div className="lumina-error-card">
            {/* Header: Icon + Friendly Title */}
            <div className="lumina-error-header">
              <div className="lumina-error-icon-box">
                <AlertTriangle size={16} />
              </div>
              <div className="lumina-error-title-wrap">
                <h3 className="lumina-error-title">Something went wrong</h3>
                {errorId && <span className="lumina-error-badge">{errorId}</span>}
              </div>
              <button
                type="button"
                className="lumina-error-dismiss-btn"
                onClick={this.handleReset}
                title="Dismiss and keep working"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>

            {/* Error Message */}
            <p className="lumina-error-message">{errorMessage}</p>

            {/* Code / Diagnostics Box */}
            <div className={`lumina-error-code-wrapper ${showDetails ? 'expanded' : 'collapsed'}`}>
              <div className="lumina-error-code-header">
                <button
                  type="button"
                  className="lumina-error-toggle-btn"
                  onClick={this.toggleDetails}
                  aria-expanded={showDetails}
                >
                  <Terminal size={12} />
                  <span>runtime.log</span>
                  {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <button
                  type="button"
                  className={`lumina-error-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={this.handleCopyError}
                  title={copied ? 'Copied to clipboard' : 'Copy error trace'}
                  aria-label="Copy error trace"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <textarea
                readOnly
                className="lumina-error-textarea"
                aria-label="Error details log"
                value={`${errorStack}${componentStack ? `\n\nComponent Stack:\n${componentStack}` : ''}`}
                spellCheck={false}
              />
            </div>

            {/* Actions: Try Again, Reload App */}
            <div className="lumina-error-actions">
              <div className="lumina-error-left-actions">
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
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default GlobalErrorHandler
