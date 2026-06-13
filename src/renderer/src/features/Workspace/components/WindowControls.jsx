import React from 'react'
import { X, Minus, Square, GripHorizontal } from 'lucide-react'

const WindowControls = () => {
  return (
    <div className="window-controls-float">
      <div 
        className="control-btn" 
        title="Drag to move window" 
        style={{ WebkitAppRegion: 'drag', cursor: 'grab', opacity: 0.6 }}
      >
        <GripHorizontal size={14} />
      </div>
      <button onClick={() => window.api?.minimize()} className="control-btn" title="Minimize">
        <Minus size={12} />
      </button>
      <button onClick={() => window.api?.toggleMaximize()} className="control-btn" title="Maximize">
        <Square size={11} />
      </button>
      <button onClick={() => window.api?.closeWindow()} className="control-btn close" title="Close">
        <X size={12} />
      </button>
    </div>
  )
}

export default WindowControls
