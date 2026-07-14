import React from 'react'
import ToolTip from '../../../components/atoms/ToolTip'
const StatusBar = ({ wordCount, extension, onToggleInspector, onDocsClick }) => {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span
          className="mode-toggle active"
        >
          {extension || 'md'}
        </span>
        <span className="separator">/</span>
        <ToolTip text="Toggle Details Modal (Ctrl + \)" position="top">
          <span
            className="mode-toggle"
            onClick={onToggleInspector}
          >
            details
          </span>
        </ToolTip>
        <span className="separator">/</span>
        <ToolTip text="Open Documentation" position="top">
          <span
            className="mode-toggle"
            onClick={onDocsClick}
          >
            docs
          </span>
        </ToolTip>
      </div>

      <div
        className="status-bar-center"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
      >
        {/* Empty space where start button was */}
      </div>

      <div className="status-bar-right">
      </div>
    </div>
  )
}

export default StatusBar
