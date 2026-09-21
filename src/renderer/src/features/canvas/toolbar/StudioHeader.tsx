import React from 'react'
import { SlidersHorizontal, PanelBottomOpen, PanelRightClose, Undo2, Redo2 } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'

export interface StudioHeaderProps {
  cardCount: number
  onOpenDrawer?: () => void
  onCollapse: () => void
  onUndo?: () => void
  canUndo?: boolean
  onRedo?: () => void
  canRedo?: boolean
}

export const StudioHeader: React.FC<StudioHeaderProps> = React.memo(
  ({ cardCount, onOpenDrawer, onCollapse, onUndo, canUndo, onRedo, canRedo }) => {
    return (
      <div className="lumina-canvas-studio-header">
        <div className="lumina-canvas-studio-title-group">
          <SlidersHorizontal size={14} className="lumina-canvas-studio-title-icon" />
          <span className="lumina-canvas-studio-title">Canvas Studio</span>
          <span className="lumina-canvas-studio-badge">{cardCount} item{cardCount !== 1 ? 's' : ''}</span>
        </div>

        <div className="lumina-canvas-studio-actions">
          {onUndo && (
            <ToolTip text="Undo (Ctrl+Z)" position="bottom">
              <button
                type="button"
                className="lumina-canvas-studio-header-btn"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="Undo"
              >
                <Undo2 size={13} />
              </button>
            </ToolTip>
          )}

          {onRedo && (
            <ToolTip text="Redo (Ctrl+Y)" position="bottom">
              <button
                type="button"
                className="lumina-canvas-studio-header-btn"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="Redo"
              >
                <Redo2 size={13} />
              </button>
            </ToolTip>
          )}

          {onOpenDrawer && (
            <ToolTip text="Open in Drawer" position="bottom">
              <button
                type="button"
                className="lumina-canvas-studio-header-btn"
                onClick={onOpenDrawer}
                aria-label="Open as Drawer"
              >
                <PanelBottomOpen size={13} />
              </button>
            </ToolTip>
          )}

          <ToolTip text="Collapse Studio" position="bottom">
            <button
              type="button"
              className="lumina-canvas-studio-header-btn close"
              onClick={onCollapse}
              aria-label="Collapse Studio"
            >
              <PanelRightClose size={14} />
            </button>
          </ToolTip>
        </div>
      </div>
    )
  }
)

StudioHeader.displayName = 'StudioHeader'
export default StudioHeader
