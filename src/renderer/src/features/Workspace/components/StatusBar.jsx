import React from 'react'
const StatusBar = ({ wordCount, extension, onToggleInspector }) => {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span
          className="mode-toggle active"
        >
          {extension || 'md'}
        </span>
        <span className="separator">/</span>
        <span
          className="mode-toggle"
          onClick={onToggleInspector}
          title="Toggle Details Modal (Ctrl + \)"
        >
          details
        </span>
      </div>

      <div
        className="status-bar-center"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
      >
        {/* Empty space where start button was */}
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
