/**
 * ============================================================================
 * Lumina Canvas Center Toolbar (ConvasToolBarCenter)
 * ============================================================================
 * Floating bottom-center toolbar dock housing primary interaction controls:
 * - Mouse cursor / select tool (V)
 * - Hand / pan canvas tool (H / Space)
 * - Quick sticky note creation
 * - Shapes & diagramming menu
 * ============================================================================
 */

import React, { useState } from 'react'
import { MousePointer, Hand, StickyNote, Shapes } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { CanvasShapeType, CanvasNodeColor } from './types'
import ConvasShapes from './ConvasShapes'

export interface ConvasToolBarCenterProps {
  toolMode: 'select' | 'hand'
  setToolMode: (mode: 'select' | 'hand') => void
  onAddSticky: () => void
  onAddShape?: (shapeType: CanvasShapeType, width: number, height: number, color?: CanvasNodeColor) => void
}

export const ConvasToolBarCenter: React.FC<ConvasToolBarCenterProps> = React.memo(
  ({ toolMode, setToolMode, onAddSticky, onAddShape }) => {
    const [isShapesOpen, setIsShapesOpen] = useState(false)

    return (
      <div className="lumina-canvas-toolbar lumina-canvas-toolbar-center">
        {/* Tool Mode: Select (Mouse Cursor) */}
        <ToolTip text="Select Tool (V)" position="top">
          <button
            className={`lumina-canvas-tool-btn ${toolMode === 'select' ? 'active' : ''}`}
            onClick={() => setToolMode('select')}
            aria-label="Select Tool (V)"
          >
            <MousePointer size={13} />
          </button>
        </ToolTip>

        {/* Tool Mode: Hand / Pan */}
        <ToolTip text="Hand / Pan Tool (H or hold Space)" position="top">
          <button
            className={`lumina-canvas-tool-btn ${toolMode === 'hand' ? 'active' : ''}`}
            onClick={() => setToolMode('hand')}
            aria-label="Hand / Pan Tool (H or hold Space)"
          >
            <Hand size={13} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider" />

        {/* Quick Sticky Note Creator */}
        <ToolTip text="Add Sticky Note" position="top">
          <button
            className="lumina-canvas-tool-btn"
            onClick={onAddSticky}
            aria-label="Add Sticky Note"
          >
            <StickyNote size={14} />
          </button>
        </ToolTip>

        {/* Shapes Menu Tool in Center Dock */}
        {onAddShape && (
          <div style={{ position: 'relative' }}>
            <ToolTip text="Shapes & Diagrams" position="top">
              <button
                className={`lumina-canvas-tool-btn ${isShapesOpen ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsShapesOpen((prev) => !prev)
                }}
                aria-label="Shapes & Diagrams"
              >
                <Shapes size={13} />
              </button>
            </ToolTip>

            <ConvasShapes
              isOpen={isShapesOpen}
              position="top"
              onClose={() => setIsShapesOpen(false)}
              onSelectShape={(shapeType, w, h, color) => {
                onAddShape(shapeType, w, h, color)
              }}
            />
          </div>
        )}
      </div>
    )
  }
)

ConvasToolBarCenter.displayName = 'ConvasToolBarCenter'

export default ConvasToolBarCenter
