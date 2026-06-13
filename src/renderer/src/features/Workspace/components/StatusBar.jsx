import React from 'react'

const StatusBar = ({ wordCount, onToggleMode, mode }) => {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span 
          className={`mode-toggle ${mode === 'source' ? 'active' : ''}`}
          onClick={() => onToggleMode && onToggleMode('source')}
        >
          source
        </span>
        <span className="separator">/</span>
        <span 
          className={`mode-toggle ${mode === 'preview' ? 'active' : ''}`}
          onClick={() => onToggleMode && onToggleMode('preview')}
        >
          preview
        </span>
      </div>
      <div className="status-bar-right">
        <span>{wordCount} words</span>
        <span className="separator">•</span>
        <span>MCP</span>
      </div>
    </div>
  )
}

export default StatusBar
