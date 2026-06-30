import React from 'react'
import './WelcomePage.css'

const WelcomePage = ({ onNew }) => {
  const handlePalette = () => window.dispatchEvent(new CustomEvent('toggle-palette'))
  const handleClose = () => window.api?.closeWindow?.()

  return (
    <div className="welcome-page">
      <div className="welcome-inner">
        <div
          className="welcome-main-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px'
          }}
        >
          <div className="welcome-empty-action" onClick={onNew} style={{ display: 'flex', justifyContent: 'space-between', width: '280px' }}>
            <span>Create new note</span>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: 500, letterSpacing: '0.5px' }}>Ctrl + N</span>
          </div>
          <div className="welcome-empty-action" onClick={handlePalette} style={{ display: 'flex', justifyContent: 'space-between', width: '280px' }}>
            <span>Go to file</span>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: 500, letterSpacing: '0.5px' }}>Ctrl + P</span>
          </div>
          <div className="welcome-empty-action" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))} style={{ display: 'flex', justifyContent: 'space-between', width: '280px' }}>
            <span>Toggle Explorer</span>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: 500, letterSpacing: '0.5px' }}>Ctrl + B</span>
          </div>
          <div className="welcome-empty-action" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', ctrlKey: true, shiftKey: true }))} style={{ display: 'flex', justifyContent: 'space-between', width: '280px' }}>
            <span>AI Chat</span>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: 500, letterSpacing: '0.5px' }}>Ctrl+Shift+I</span>
          </div>
          <div className="welcome-empty-action" onClick={handleClose} style={{ display: 'flex', justifyContent: 'center', width: '280px', marginTop: '8px' }}>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage
