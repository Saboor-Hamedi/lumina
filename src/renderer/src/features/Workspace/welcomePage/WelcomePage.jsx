import React from 'react'

const WelcomePage = ({ onNew }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      color: 'var(--text-faint)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '18px',
      gap: '20px',
      userSelect: 'none'
    }}>
      <div
        style={{ cursor: 'pointer' }}
        onClick={onNew}
      >
        Create new note (Ctrl + N)
      </div>
      <div
        style={{ cursor: 'pointer' }}
        onClick={() => window.dispatchEvent(new CustomEvent('toggle-palette'))}
      >
        Go to file (Ctrl + P)
      </div>
      <div
        style={{ cursor: 'pointer' }}
        onClick={() => {
          if (window.api?.closeWindow) {
            window.api.closeWindow()
          }
        }}
      >
        Close
      </div>
    </div>
  )
}

export default WelcomePage
