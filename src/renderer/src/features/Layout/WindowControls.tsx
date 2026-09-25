/**
 * =========================================================================
 * WindowControls Component (`WindowControls.tsx`)
 * =========================================================================
 *
 * Floating window and modal control action buttons for Lumina layouts.
 *
 * Supports:
 * - Drag handle trigger for modal repositioning (`onMouseDownDrag`).
 * - Floating inspector/right sidebar toggle action with accessible tooltip.
 * - Hardware-accelerated hover styling and memoized rendering.
 * =========================================================================
 */

import React, { memo } from 'react'
import { GripHorizontal, PanelRightOpen, PanelRightClose } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'

export interface WindowControlsProps {
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  onMouseDownDrag?: (e: React.MouseEvent<HTMLButtonElement>) => void
  title?: string
  className?: string
}

export const WindowControls: React.FC<WindowControlsProps> = memo(
  ({
    isSidebarOpen = false,
    onToggleSidebar,
    onMouseDownDrag,
    title = 'Drag modal',
    className = ''
  }) => {
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
          <ToolTip
            text={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
            position="bottom"
          >
            <button
              type="button"
              onClick={onToggleSidebar}
              className="control-btn"
              aria-label={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
            >
              {isSidebarOpen ? (
                <PanelRightClose size={14} />
              ) : (
                <PanelRightOpen size={14} />
              )}
            </button>
          </ToolTip>
        )}
      </div>
    )
  }
)

WindowControls.displayName = 'WindowControls'

export default WindowControls
