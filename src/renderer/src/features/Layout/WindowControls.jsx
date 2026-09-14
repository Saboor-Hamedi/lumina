import React from 'react'
import { X, Minus, Square, GripHorizontal, PanelRightOpen, PanelRightClose } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'

const WindowControls = ({ isSidebarOpen, onToggleSidebar, onMouseDownDrag, title = 'Drag modal', className = '' }) => {
  if (onMouseDownDrag) {
    return (
      <ToolTip text={title} position="bottom">
        <button
          type="button"
          className={`email-modal-drag-handle ${className}`}
          onMouseDown={onMouseDownDrag}
          aria-label={title}
        >
          <GripHorizontal size={14} />
        </button>
      </ToolTip>
    )
  }

  return (
    <div className={`window-controls-float ${className}`}>
      {onToggleSidebar && (
        <ToolTip text={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'} position="bottom">
          <button onClick={onToggleSidebar} className="control-btn" aria-label={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}>
            {isSidebarOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </ToolTip>
      )}
    </div>
  )
}

export default WindowControls
