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
import { ZoomIn, ZoomOut, RotateCcw, Trash2, Shapes, Camera, Copy, Download, Image as ImageIcon } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { CanvasShapeType, CanvasNodeColor } from './types'
import ConvasShapes from './ConvasShapes'

export interface ConvasToolBarRightProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetViewport: () => void
  onDeleteSelected: () => void
  canDelete: boolean
  onAddShape?: (shapeType: CanvasShapeType, width: number, height: number, color?: CanvasNodeColor) => void
  onCopyImage?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  hasSelectedNodes?: boolean
}

export const ConvasToolBarRight: React.FC<ConvasToolBarRightProps> = React.memo(
  ({
    zoom,
    onZoomIn,
    onZoomOut,
    onResetViewport,
    onDeleteSelected,
    canDelete,
    onAddShape,
    onCopyImage,
    onExportPNG,
    onExportSVG,
    hasSelectedNodes = false
  }) => {
    const [isShapesOpen, setIsShapesOpen] = useState(false)
    const [isExportOpen, setIsExportOpen] = useState(false)

    return (
      <div className="lumina-canvas-toolbar lumina-canvas-toolbar-right">
        {/* Shapes Menu Tool */}
        {onAddShape && (
          <>
            <div style={{ position: 'relative' }}>
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
                position="left"
                onClose={() => setIsShapesOpen(false)}
                onSelectShape={(shapeType, w, h, color) => {
                  onAddShape(shapeType, w, h, color)
                }}
              />
            </div>

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

        {(onCopyImage || onExportPNG || onExportSVG) && (
          <>
            <div className="lumina-canvas-divider horizontal" />

            <div style={{ position: 'relative' }}>
              <ToolTip text="Export / Copy as Image" position="left">
                <button
                  className={`lumina-canvas-tool-btn ${isExportOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExportOpen((prev) => !prev)
                  }}
                  aria-label="Export / Copy as Image"
                >
                  <Camera size={13} />
                </button>
              </ToolTip>

              {isExportOpen && (
                <div
                  className="lumina-canvas-export-menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onCopyImage && (
                    <button
                      className="lumina-canvas-export-item"
                      onClick={() => {
                        setIsExportOpen(false)
                        onCopyImage()
                      }}
                    >
                      <div className="lumina-canvas-export-item-left">
                        <Copy size={13} />
                        <span>{hasSelectedNodes ? 'Copy Selection as Image' : 'Copy as Image'}</span>
                      </div>
                      <span className="lumina-canvas-export-shortcut">Ctrl+Shift+C</span>
                    </button>
                  )}

                  {onExportPNG && (
                    <button
                      className="lumina-canvas-export-item"
                      onClick={() => {
                        setIsExportOpen(false)
                        onExportPNG()
                      }}
                    >
                      <div className="lumina-canvas-export-item-left">
                        <ImageIcon size={13} />
                        <span>Export as PNG</span>
                      </div>
                      <span className="lumina-canvas-export-shortcut">PNG</span>
                    </button>
                  )}

                  {onExportSVG && (
                    <button
                      className="lumina-canvas-export-item"
                      onClick={() => {
                        setIsExportOpen(false)
                        onExportSVG()
                      }}
                    >
                      <div className="lumina-canvas-export-item-left">
                        <Download size={13} />
                        <span>Export as Vector SVG</span>
                      </div>
                      <span className="lumina-canvas-export-shortcut">SVG</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )
  }
)

ConvasToolBarRight.displayName = 'ConvasToolBarRight'

export default ConvasToolBarRight
