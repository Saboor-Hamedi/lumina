/**
 * ============================================================================
 * Lumina Canvas Right Toolbar (ConvasToolBarRight)
 * ============================================================================
 * Slender vertical toolbar dock anchored to the right side of the canvas:
 * - Positioned parallel to RightSidebar (persisting whether sidebar is open or closed)
 * - Compact and tall vertical pill design with 26px slim buttons
 * - Controls:
 *   1. Delete selected card(s) (Del)
 *   2. Zoom In (Ctrl + Scroll Up)
 *   3. Real-time Zoom Percentage
 *   4. Zoom Out (Ctrl + Scroll Down)
 *   5. Reset Viewport Zoom/Position (Ctrl + 0)
 * ============================================================================
 */

import React, { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Trash2, Shapes } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { ConvasShapes } from './ConvasShapes'
import { CanvasShapeType } from './types'

export interface ConvasToolBarRightProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetViewport: () => void
  onDeleteSelected: () => void
  canDelete: boolean
  onAddShape?: (shapeType: CanvasShapeType, width: number, height: number) => void
}

export const ConvasToolBarRight: React.FC<ConvasToolBarRightProps> = React.memo(
  ({
    zoom,
    onZoomIn,
    onZoomOut,
    onResetViewport,
    onDeleteSelected,
    canDelete,
    onAddShape
  }) => {
    const [isShapesOpen, setIsShapesOpen] = useState(false)

    return (
      <div className="lumina-canvas-toolbar lumina-canvas-toolbar-right">
        {/* Shapes Menu Tool */}
        {onAddShape && (
          <>
            <ToolTip text="Shapes & Diagrams" position="left">
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
              onClose={() => setIsShapesOpen(false)}
              onSelectShape={(shapeType, w, h) => {
                onAddShape(shapeType, w, h)
              }}
            />

            <div className="lumina-canvas-divider horizontal" />
          </>
        )}

        {/* Delete Selected Tool */}
        <ToolTip text="Delete Selected (Del)" position="left">
          <button
            className="lumina-canvas-tool-btn"
            onClick={onDeleteSelected}
            disabled={!canDelete}
          >
            <Trash2 size={13} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider horizontal" />

        {/* Zoom In */}
        <ToolTip text="Zoom In (Ctrl + Scroll)" position="left">
          <button className="lumina-canvas-tool-btn" onClick={onZoomIn}>
            <ZoomIn size={13} />
          </button>
        </ToolTip>

        {/* Zoom Percentage */}
        <span className="lumina-canvas-zoom-label" style={{ fontSize: '10px' }}>
          {Math.round(zoom * 100)}%
        </span>

        {/* Zoom Out */}
        <ToolTip text="Zoom Out" position="left">
          <button className="lumina-canvas-tool-btn" onClick={onZoomOut}>
            <ZoomOut size={13} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider horizontal" />

        {/* Reset View */}
        <ToolTip text="Reset View (Ctrl+0)" position="left">
          <button className="lumina-canvas-tool-btn" onClick={onResetViewport}>
            <RotateCcw size={13} />
          </button>
        </ToolTip>
      </div>
    )
  }
)

ConvasToolBarRight.displayName = 'ConvasToolBarRight'

export default ConvasToolBarRight
