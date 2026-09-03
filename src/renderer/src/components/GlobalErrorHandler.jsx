import React from 'react'
import { AlertCircle, RotateCcw, RotateCw, Copy, Check, Terminal } from 'lucide-react'

class GlobalErrorHandler extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      errorId: null,
      copied: false
    }
    this.resetTimeoutRef = null
    this.copyTimeoutRef = null
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[GlobalErrorHandler] Caught error:', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      errorId: this.state.errorId
    })

    if (window.api?.logError) {
      try {
        window.api
          .logError({
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            componentStack: errorInfo?.componentStack || 'No component stack',
            timestamp: Date.now(),
            errorId: this.state.errorId
          })
          .catch(() => {})
      } catch (e) {
        console.warn('[GlobalErrorHandler] Failed to log error to main process:', e)
      }
    }

    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }))
  }

  componentWillUnmount() {
    if (this.resetTimeoutRef) clearTimeout(this.resetTimeoutRef)
    if (this.copyTimeoutRef) clearTimeout(this.copyTimeoutRef)
  }

  handleReset = () => {
    if (this.resetTimeoutRef) clearTimeout(this.resetTimeoutRef)

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false
    })

    this.resetTimeoutRef = setTimeout(() => {
      if (this.props.onReset) {
        try {
          this.props.onReset()
        } catch (e) {
          console.error('[GlobalErrorHandler] onReset callback failed:', e)
        }
      }
      this.resetTimeoutRef = null
    }, 100)
  }

  handleReload = () => {
    try {
      if (window.location && typeof window.location.reload === 'function') {
        window.location.reload()
      } else if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.invoke('window:reload')
      }
    } catch (e) {
      console.error('[GlobalErrorHandler] Failed to reload:', e)
    }
  }

  handleCopyError = () => {
    const { error, errorInfo, errorId } = this.state
    const textToCopy = [
      `Error: ${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
      `ID: ${errorId || 'N/A'}`,
      `Time: ${new Date().toISOString()}`,
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

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      const { error, errorInfo, errorId, errorCount, copied } = this.state
      const errorMessage = error?.message || 'An unexpected error occurred'
      const errorStack = error?.stack || errorMessage
      const componentStack = errorInfo?.componentStack || ''

      return (
        <div className="error-boundary" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
          <div className="error-boundary-content">
            <div className="error-boundary-header">
              <div className="error-boundary-title-row">
                <div className="error-boundary-icon-wrapper">
                  <AlertCircle size={16} />
                </div>
                <h2 className="error-boundary-title">Something went wrong</h2>
              </div>
              <p className="error-boundary-message">{errorMessage}</p>
            </div>

            <div className="error-boundary-code-wrapper">
              <div className="error-boundary-code-header">
                <div className="error-boundary-code-title">
                  <span className="error-boundary-code-dot" />
                  <Terminal size={12} />
                  <span>runtime.log</span>
                </div>
                <button
                  type="button"
                  className={`error-boundary-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={this.handleCopyError}
                  title={copied ? 'Copied to clipboard' : 'Copy error trace'}
                  aria-label="Copy error trace"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>

              <textarea
                readOnly
                className="error-boundary-textarea"
                value={`${errorStack}${componentStack ? `\n\nComponent Stack:\n${componentStack}` : ''}`}
                aria-label="Error details log"
                spellCheck={false}
              />
            </div>

            <div className="error-boundary-actions">
              <button className="error-boundary-button primary" onClick={this.handleReset}>
                <RotateCcw size={11} />
                <span>Try Again</span>
              </button>
              <button className="error-boundary-button secondary" onClick={this.handleReload}>
                <RotateCw size={11} />
                <span>Reload App</span>
              </button>
            </div>

            {errorCount > 3 && (
              <div className="error-boundary-warning">
                Multiple errors detected ({errorCount}). Please reload the application.
              </div>
            )}

            {errorId && (
              <div className="error-boundary-id">
                <span>{errorId}</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default GlobalErrorHandler
