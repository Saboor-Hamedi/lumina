import React from 'react'
import { X, Minus, Square, GripHorizontal, PanelRightOpen, PanelRightClose } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'

const WindowControls = ({ isSidebarOpen, onToggleSidebar }) => {
  return (
    <div className="window-controls-float">
      <ToolTip text="Drag to move window" position="bottom">
        <div className="control-btn drag-btn">
          <GripHorizontal size={14} />
        </div>
      </ToolTip>
      {onToggleSidebar && (
        <ToolTip text={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"} position="bottom">
          <button onClick={onToggleSidebar} className="control-btn">
            {isSidebarOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </ToolTip>
      )}
      <ToolTip text="Minimize" position="bottom">
        <button onClick={() => window.api?.minimize()} className="control-btn">
          <Minus size={12} />
        </button>
      </ToolTip>
      <ToolTip text="Maximize" position="bottom">
        <button onClick={() => window.api?.toggleMaximize()} className="control-btn">
          <Square size={11} />
        </button>
      </ToolTip>
      <ToolTip text="Close" position="bottom-right">
        <button onClick={() => window.api?.closeWindow()} className="control-btn close">
          <X size={12} />
        </button>
      </ToolTip>
    </div>
  )
}

export default WindowControls
