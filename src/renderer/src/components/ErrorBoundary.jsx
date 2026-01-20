import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * React Error Boundary Component
 * 
 * Catches component errors and prevents full app crashes.
 * Shows user-friendly fallback UI with recovery options.
 * 
 * @class ErrorBoundary
 * @extends {React.Component}
 * @property {React.ReactNode} children - Child components to render
 * @property {Function} fallback - Optional custom fallback render function
 * @property {Function} onReset - Optional callback when error is reset
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      errorId: null
    }
    this.resetTimeoutRef = null
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details to console
    console.error('[ErrorBoundary] Caught error:', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      errorId: this.state.errorId
    })
    
    // Log to main process if available (non-blocking)
    if (window.api?.logError) {
      try {
        window.api.logError({
          message: error?.message || 'Unknown error',
          stack: error?.stack || 'No stack trace',
          componentStack: errorInfo?.componentStack || 'No component stack',
          timestamp: Date.now(),
          errorId: this.state.errorId
        }).catch(() => {
          // Silently fail if logging fails
        })
      } catch (e) {
        // Fallback if logging API is unavailable
        console.warn('[ErrorBoundary] Failed to log error to main process:', e)
      }
    }

    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }))
  }

  componentWillUnmount() {
    // Cleanup timeout on unmount
    if (this.resetTimeoutRef) {
      clearTimeout(this.resetTimeoutRef)
    }
  }

  handleReset = () => {
    // Clear any pending timeouts
    if (this.resetTimeoutRef) {
      clearTimeout(this.resetTimeoutRef)
    }

    // Reset error state and attempt to recover
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
    
    // Force a small delay to ensure state is cleared before re-render
    this.resetTimeoutRef = setTimeout(() => {
      // Try to reload the component by forcing a re-render
      if (this.props.onReset) {
        try {
          this.props.onReset()
        } catch (e) {
          console.error('[ErrorBoundary] onReset callback failed:', e)
        }
      }
      this.resetTimeoutRef = null
    }, 100)
  }

  handleReload = () => {
    // Full page reload as last resort
    try {
      if (window.location && typeof window.location.reload === 'function') {
        window.location.reload()
      } else {
        // Fallback for Electron environments
        if (window.electron?.ipcRenderer) {
          window.electron.ipcRenderer.invoke('window:reload')
        }
      }
    } catch (e) {
      console.error('[ErrorBoundary] Failed to reload:', e)
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      // Default fallback UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">
              <AlertTriangle size={48} />
            </div>
            <h2 className="error-boundary-title">Something went wrong</h2>
            <p className="error-boundary-message">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="error-boundary-details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-boundary-stack">
                  {this.state.error?.stack}
                  {'\n\nComponent Stack:\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="error-boundary-actions">
              <button
                className="error-boundary-button primary"
                onClick={this.handleReset}
              >
                <RefreshCw size={16} />
                <span>Try Again</span>
              </button>
              <button
                className="error-boundary-button secondary"
                onClick={this.handleReload}
              >
                <RefreshCw size={16} />
                <span>Reload App</span>
              </button>
            </div>

            {this.state.errorCount > 3 && (
              <div className="error-boundary-warning">
                <p>
                  Multiple errors detected ({this.state.errorCount}). 
                  Consider reloading the application.
                </p>
              </div>
            )}

            {this.state.errorId && process.env.NODE_ENV === 'development' && (
              <div className="error-boundary-id">
                <small>Error ID: {this.state.errorId}</small>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
