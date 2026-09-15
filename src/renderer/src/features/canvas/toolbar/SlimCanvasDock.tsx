import React, { useState, useRef, useEffect } from 'react'
import {
  PanelRight,
  PanelBottomOpen,
  Shapes,
  Grid,
  Map as MapIcon,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Camera,
  Copy,
  Download,
  Image as ImageIcon
} from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { CanvasShapeType, CanvasNodeColor } from '../types'

export interface SlimCanvasDockProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetViewport: () => void
  onZoomToFit?: () => void
  onDeleteSelected: () => void
  canDelete: boolean
  onToggleExpand: () => void
  onAddShape?: (
    shapeType: CanvasShapeType,
    width: number,
    height: number,
    color?: CanvasNodeColor
  ) => void
  onCopyImage?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  onOpenDrawer?: () => void
  hasSelectedNodes?: boolean
  snapToGrid?: boolean
  onToggleSnapToGrid?: () => void
  isMiniMapOpen?: boolean
  onToggleMiniMap?: () => void
}

export const SlimCanvasDock: React.FC<SlimCanvasDockProps> = React.memo(
  ({
    zoom,
    onZoomIn,
    onZoomOut,
    onResetViewport,
    onZoomToFit,
    onDeleteSelected,
    canDelete,
    onToggleExpand,
    onAddShape,
    onCopyImage,
    onExportPNG,
    onExportSVG,
    onOpenDrawer,
    hasSelectedNodes = false,
    snapToGrid = false,
    onToggleSnapToGrid,
    isMiniMapOpen = false,
    onToggleMiniMap
  }) => {
    const [isSlimExportOpen, setIsSlimExportOpen] = useState(false)
    const slimExportBtnRef = useRef<HTMLButtonElement | null>(null)

    useEffect(() => {
      if (!isSlimExportOpen) return
      const handlePointerDown = (e: MouseEvent | PointerEvent) => {
        const target = e.target as HTMLElement | null
        if (!target) return
        if (
          isSlimExportOpen &&
          !target.closest('.lumina-canvas-export-menu') &&
          !slimExportBtnRef.current?.contains(target)
        ) {
          setIsSlimExportOpen(false)
        }
      }
      document.addEventListener('pointerdown', handlePointerDown)
      return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [isSlimExportOpen])

    return (
      <div
        className="lumina-canvas-toolbar lumina-canvas-toolbar-right"
        aria-label="Canvas Dock"
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Toggle Expand Studio Button */}
        <ToolTip text="Expand Canvas Studio" position="left">
          <button
            type="button"
            className="lumina-canvas-tool-btn active-hover"
            onClick={onToggleExpand}
            aria-label="Expand Canvas Studio"
          >
            <PanelRight size={14} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider horizontal" />

        {/* Open in Inline Canvas Drawer */}
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
            <ToolTip text="Shapes & Diagrams (Click Studio to browse)" position="left">
              <button
                type="button"
                className="lumina-canvas-tool-btn"
                onClick={onToggleExpand}
                aria-label="Shapes & Diagrams"
              >
                <Shapes size={13} />
              </button>
            </ToolTip>

            <div className="lumina-canvas-divider horizontal" />
          </>
        )}

        {/* Snap to Grid Toggle */}
        {onToggleSnapToGrid && (
          <>
            <ToolTip
              text={snapToGrid ? "Snap to Grid: ON (Ctrl+')" : "Snap to Grid: OFF (Ctrl+')"}
              position="left"
            >
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

        {/* Mini-Map Navigator Toggle */}
        {onToggleMiniMap && (
          <>
            <ToolTip
              text={isMiniMapOpen ? 'Mini-Map Navigator (Open)' : 'Mini-Map Navigator (Closed)'}
              position="left"
            >
              <button
                type="button"
                className={`lumina-canvas-tool-btn ${isMiniMapOpen ? 'active' : ''}`}
                onClick={onToggleMiniMap}
                aria-label="Toggle Mini-Map Navigator"
              >
                <MapIcon size={13} />
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

        {/* Export / Copy Menu */}
        {(onCopyImage || onExportPNG || onExportSVG) && (
          <>
            <div className="lumina-canvas-divider horizontal" />

            <div style={{ position: 'relative' }}>
              <ToolTip text="Export / Copy as Image" position="left">
                <button
                  ref={slimExportBtnRef}
                  type="button"
                  className={`lumina-canvas-tool-btn ${isSlimExportOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsSlimExportOpen((prev) => !prev)
                  }}
                  aria-label="Export / Copy as Image"
                >
                  <Camera size={13} />
                </button>
              </ToolTip>

              {isSlimExportOpen && (
                <div
                  className="lumina-canvas-export-menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onCopyImage && (
                    <button
                      type="button"
                      className="lumina-canvas-export-item"
                      onClick={() => {
                        setIsSlimExportOpen(false)
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
                        setIsSlimExportOpen(false)
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
                        setIsSlimExportOpen(false)
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

SlimCanvasDock.displayName = 'SlimCanvasDock'
export default SlimCanvasDock
