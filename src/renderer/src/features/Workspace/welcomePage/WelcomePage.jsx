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
            gap: '20px'
          }}
        >
          <div className="welcome-empty-action" onClick={onNew}>
            Create new note (Ctrl + N)
          </div>
          <div className="welcome-empty-action" onClick={handlePalette}>
            Go to file (Ctrl + P)
          </div>
          <div className="welcome-empty-action" onClick={handleClose}>
            Close
          </div>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage
