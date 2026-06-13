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
      
      <div className="status-bar-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div 
          className="start-menu-button" 
          onClick={onToggleExplorerModal}
          title="Open Start Menu"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '0 8px', height: '24px', borderRadius: '4px', color: 'var(--text-muted)' }}
        >
          <LayoutGrid size={14} />
          <span>Start</span>
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
