import React from 'react'
import { X, Minus, Square, GripHorizontal, PanelRightOpen, PanelRightClose } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'

const WindowControls = ({ isSidebarOpen, onToggleSidebar }) => {
  return (
    <div className="window-controls-float">
      {onToggleSidebar && (
        <ToolTip text={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'} position="bottom">
          <button onClick={onToggleSidebar} className="control-btn">
            {isSidebarOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </ToolTip>
      )}
    </div>
  )
}

export default WindowControls
