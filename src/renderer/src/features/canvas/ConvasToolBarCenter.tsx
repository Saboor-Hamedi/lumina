/**
 * ============================================================================
 * Lumina Canvas Center Toolbar (ConvasToolBarCenter)
 * ============================================================================
 * Floating bottom-center toolbar dock housing primary interaction controls:
 * - Mouse cursor / select tool (V)
 * - Hand / pan canvas tool (H / Space)
 * - Quick sticky note creation
 * ============================================================================
 */

import React from 'react'
import { MousePointer, Hand, StickyNote } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'

export interface ConvasToolBarCenterProps {
  toolMode: 'select' | 'hand'
  setToolMode: (mode: 'select' | 'hand') => void
  onAddSticky: () => void
}

export const ConvasToolBarCenter: React.FC<ConvasToolBarCenterProps> = React.memo(
  ({ toolMode, setToolMode, onAddSticky }) => {
    return (
      <div className="lumina-canvas-toolbar lumina-canvas-toolbar-center">
        {/* Tool Mode: Select (Mouse Cursor) */}
        <ToolTip text="Select Tool (V)" position="top">
          <button
            className={`lumina-canvas-tool-btn ${toolMode === 'select' ? 'active' : ''}`}
            onClick={() => setToolMode('select')}
          >
            <MousePointer size={13} />
          </button>
        </ToolTip>

        {/* Tool Mode: Hand / Pan */}
        <ToolTip text="Hand / Pan Tool (H or hold Space)" position="top">
          <button
            className={`lumina-canvas-tool-btn ${toolMode === 'hand' ? 'active' : ''}`}
            onClick={() => setToolMode('hand')}
          >
            <Hand size={13} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider" />

        {/* Quick Sticky Note Creator */}
        <ToolTip text="Add Sticky Note" position="top">
          <button className="lumina-canvas-tool-btn" onClick={onAddSticky}>
            <StickyNote size={14} />
          </button>
        </ToolTip>
      </div>
    )
  }
)

ConvasToolBarCenter.displayName = 'ConvasToolBarCenter'

export default ConvasToolBarCenter
