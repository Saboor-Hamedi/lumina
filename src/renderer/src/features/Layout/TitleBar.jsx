import React from 'react'
import { Square, X, Minus, Zap } from 'lucide-react'
import './TitleBar.css'

const TitleBar = () => {
  const handleMinimize = () => window.api?.minimize()
  const handleToggleMaximize = () => window.api?.toggleMaximize()
  const handleClose = () => window.api?.closeWindow()

  return (
    <div className="title-bar">
      <div className="title-left">
        <div className="app-logo">
          <Zap size={14} fill="currentColor" />
          <span className="app-name">Lumina</span>
        </div>
      </div>
      
      <div className="title-center">
        {/* Obsidian-like document title could go here */}
      </div>

      <div className="title-right">
        <div className="window-controls">
          <button onClick={handleMinimize} className="control-btn" title="Minimize">
            <Minus size={14} />
          </button>
          <button onClick={handleToggleMaximize} className="control-btn" title="Maximize">
            <Square size={12} />
          </button>
          <button onClick={handleClose} className="control-btn close" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default TitleBar
