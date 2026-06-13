import React from 'react'
import { LayoutGrid } from 'lucide-react'

const StatusBar = ({ wordCount, onToggleMode, mode, onToggleExplorerModal }) => {
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
      
      <div className="status-bar-center">
        <div 
          className="start-menu-button" 
          onClick={onToggleExplorerModal}
          title="Open Explorer (Start Menu)"
        >
          <LayoutGrid size={14} />
        </div>
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
