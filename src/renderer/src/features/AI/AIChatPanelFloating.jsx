import React from 'react'
import AIChatPanel from './AIChatPanel'
import './AIChatPanel.css'
import '../Layout/AppShell.css'

/**
 * AIChatPanelFloating Component
 * Wrapper for AI Chat Panel when displayed in a floating window.
 * Provides minimal container styling for the floating window context.
 */
const AIChatPanelFloating = () => {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-sidebar)',
        overflow: 'hidden'
      }}
    >
      <AIChatPanel />
    </div>
  )
}

export default AIChatPanelFloating
