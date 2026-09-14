/**
 * ============================================================================
 * Lumina Canvas Right Toolbar (ConvasToolBarRight)
 * ============================================================================
 * Slender vertical toolbar dock anchored to the right side of the canvas:
 * - Positioned parallel to RightSidebar (persisting whether sidebar is open or closed)
 * - Compact and tall vertical pill design with 26px slim buttons
 * - Controls:
 *   1. Open in Inline Canvas Drawer (PanelBottomOpen)
 *   2. Shapes & Diagramming menu (Shapes)
 *   3. Delete selected card(s) (Del / Backspace)
 *   4. Zoom In (Ctrl + Scroll Up)
 *   5. Real-time Zoom Percentage
 *   6. Zoom Out (Ctrl + Scroll Down)
 *   7. Reset Viewport Zoom/Position (Ctrl + 0)
 *   8. Zoom to Fit Viewport (Maximize2)
 *   9. Export / Copy as Image
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Shapes,
  Camera,
  Copy,
  Download,
  Image as ImageIcon,
  PanelBottomOpen,
  Maximize2,
  Grid
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { CanvasShapeType, CanvasNodeColor } from './types'
import ConvasShapes from './ConvasShapes'

export interface ConvasToolBarRightProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetViewport: () => void
  onZoomToFit?: () => void
  onDeleteSelected: () => void
  canDelete: boolean
  onAddShape?: (shapeType: CanvasShapeType, width: number, height: number, color?: CanvasNodeColor) => void
  onCopyImage?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  onOpenDrawer?: () => void
  hasSelectedNodes?: boolean
  snapToGrid?: boolean
  onToggleSnapToGrid?: () => void
}

export const ConvasToolBarRight: React.FC<ConvasToolBarRightProps> = React.memo(
  ({
    zoom,
    onZoomIn,
    onZoomOut,
    onResetViewport,
    onZoomToFit,
    onDeleteSelected,
    canDelete,
    onAddShape,
    onCopyImage,
    onExportPNG,
    onExportSVG,
    onOpenDrawer,
    hasSelectedNodes = false,
    snapToGrid = false,
    onToggleSnapToGrid
  }) => {
    const [isShapesOpen, setIsShapesOpen] = useState(false)
    const [isExportOpen, setIsExportOpen] = useState(false)

    const exportBtnRef = useRef<HTMLButtonElement | null>(null)
    const shapesBtnRef = useRef<HTMLButtonElement | null>(null)

    // Close menus when clicking outside
    useEffect(() => {
      if (!isExportOpen && !isShapesOpen) return

      const handlePointerDown = (e: MouseEvent | PointerEvent) => {
        const target = e.target as HTMLElement | null
        if (!target) return

        if (
          isExportOpen &&
          !target.closest('.lumina-canvas-export-menu') &&
          !exportBtnRef.current?.contains(target)
        ) {
          setIsExportOpen(false)
        }
      }

      document.addEventListener('pointerdown', handlePointerDown)
      return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [isExportOpen, isShapesOpen])

    return (
      <div className="lumina-canvas-toolbar lumina-canvas-toolbar-right">
        {/* Open in Inline Canvas Drawer Button */}
        {onOpenDrawer && (
          <>
            <ToolTip text="Open as Inline Canvas Drawer" position="left">
              <button
                type="button"
                className="lumina-canvas-tool-btn"
                onClick={onOpenDrawer}
                aria-label="Open as Inline Canvas Drawer"
              >
                <PanelBottomOpen size={14} />
              </button>
            </ToolTip>

            <div className="lumina-canvas-divider horizontal" />
          </>
        )}

        {/* Shapes Menu Tool */}
        {onAddShape && (
          <>
            <div style={{ position: 'relative' }}>
              <ToolTip text="Shapes & Diagrams" position="left">
                <button
                  ref={shapesBtnRef}
                  type="button"
                  className={`lumina-canvas-tool-btn ${isShapesOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsShapesOpen((prev) => !prev)
                    setIsExportOpen(false)
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

        {/* Snap to Grid Toggle */}
        {onToggleSnapToGrid && (
          <>
            <ToolTip text={snapToGrid ? "Snap to Grid: ON (Ctrl+')" : "Snap to Grid: OFF (Ctrl+')"} position="left">
              <button
                type="button"
                className={`lumina-canvas-tool-btn ${snapToGrid ? 'active' : ''}`}
                onClick={onToggleSnapToGrid}
                aria-label="Toggle Snap to Grid"
              >
                <Grid size={13} />
              </button>
            </ToolTip>

            <div className="lumina-canvas-divider horizontal" />
          </>
        )}

        {/* Delete Selected Tool */}
        <ToolTip text="Delete Selected (Del)" position="left">
          <button
            type="button"
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
          <button type="button" className="lumina-canvas-tool-btn" onClick={onZoomIn}>
            <ZoomIn size={13} />
          </button>
        </ToolTip>

        {/* Zoom Percentage */}
        <span className="lumina-canvas-zoom-label" style={{ fontSize: '10px' }}>
          {Math.round(zoom * 100)}%
        </span>

        {/* Zoom Out */}
        <ToolTip text="Zoom Out" position="left">
          <button type="button" className="lumina-canvas-tool-btn" onClick={onZoomOut}>
            <ZoomOut size={13} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider horizontal" />

        {/* Reset View */}
        <ToolTip text="Reset View (Ctrl+0)" position="left">
          <button type="button" className="lumina-canvas-tool-btn" onClick={onResetViewport}>
            <RotateCcw size={13} />
          </button>
        </ToolTip>

        {/* Zoom to Fit View */}
        {onZoomToFit && (
          <ToolTip text="Zoom to Fit All (Shift+1)" position="left">
            <button type="button" className="lumina-canvas-tool-btn" onClick={onZoomToFit}>
              <Maximize2 size={13} />
            </button>
          </ToolTip>
        )}

        {(onCopyImage || onExportPNG || onExportSVG) && (
          <>
            <div className="lumina-canvas-divider horizontal" />

            <div style={{ position: 'relative' }}>
              <ToolTip text="Export / Copy as Image" position="left">
                <button
                  ref={exportBtnRef}
                  type="button"
                  className={`lumina-canvas-tool-btn ${isExportOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExportOpen((prev) => !prev)
                    setIsShapesOpen(false)
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
                      type="button"
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
                      type="button"
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
                      type="button"
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
