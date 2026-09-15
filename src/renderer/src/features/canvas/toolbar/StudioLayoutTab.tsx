import React from 'react'
import {
  Grid,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2
} from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { CanvasAlignmentType, CanvasDistributionType } from '../canvasAlignment'

export interface StudioLayoutTabProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetViewport: () => void
  onZoomToFit?: () => void
  onSetZoom?: (targetZoom: number) => void
  selectedCount?: number
  snapToGrid?: boolean
  onToggleSnapToGrid?: () => void
  onSnapAllToGrid?: () => void
  isMiniMapOpen?: boolean
  onToggleMiniMap?: () => void
  onAlignSelection?: (alignment: CanvasAlignmentType) => void
  onDistributeSelection?: (direction: CanvasDistributionType) => void
}

export const StudioLayoutTab: React.FC<StudioLayoutTabProps> = React.memo(
  ({
    zoom,
    onZoomIn,
    onZoomOut,
    onResetViewport,
    onZoomToFit,
    onSetZoom,
    selectedCount = 0,
    snapToGrid = false,
    onToggleSnapToGrid,
    onSnapAllToGrid,
    isMiniMapOpen = false,
    onToggleMiniMap,
    onAlignSelection,
    onDistributeSelection
  }) => {
    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">Layout & Grid</span>
          <span className="banner-sub">Precision alignment and spatial alignment</span>
        </div>

        {/* Snap to Grid Toggle */}
        <div className="lumina-canvas-studio-card-box">
          <div className="lumina-canvas-studio-row-switch">
            <div className="switch-text">
              <span className="switch-title">20px Grid Snapping</span>
              <span className="switch-hint">Hold Shift or toggle (Ctrl+')</span>
            </div>
            <button
              type="button"
              className={`lumina-canvas-studio-switch-pill ${snapToGrid ? 'active' : ''}`}
              onClick={onToggleSnapToGrid}
            >
              <div className="switch-thumb" />
            </button>
          </div>

          {onSnapAllToGrid && (
            <button
              type="button"
              className="lumina-canvas-studio-action-btn"
              style={{ marginTop: 6 }}
              onClick={onSnapAllToGrid}
            >
              <Grid size={12} />
              <span>Snap All Nodes to 20px Grid</span>
            </button>
          )}
        </div>

        {/* Align Selected Nodes (when 2+ nodes selected) */}
        {onAlignSelection && (
          <div className="lumina-canvas-studio-card-box">
            <div className="card-box-header">
              <span className="card-box-label">Multi-Card Alignment</span>
              <span className="card-box-sub">
                {selectedCount > 1 ? `${selectedCount} selected` : 'Select 2+ cards'}
              </span>
            </div>
            <div className="lumina-canvas-studio-icon-group">
              <ToolTip text="Align Left" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  disabled={selectedCount < 2}
                  onClick={() => onAlignSelection('left')}
                >
                  <AlignLeft size={13} />
                </button>
              </ToolTip>
              <ToolTip text="Align Center (H)" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  disabled={selectedCount < 2}
                  onClick={() => onAlignSelection('center')}
                >
                  <AlignCenter size={13} />
                </button>
              </ToolTip>
              <ToolTip text="Align Right" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  disabled={selectedCount < 2}
                  onClick={() => onAlignSelection('right')}
                >
                  <AlignRight size={13} />
                </button>
              </ToolTip>
              <ToolTip text="Align Top" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  disabled={selectedCount < 2}
                  onClick={() => onAlignSelection('top')}
                >
                  <AlignStartVertical size={13} />
                </button>
              </ToolTip>
              <ToolTip text="Align Middle (V)" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  disabled={selectedCount < 2}
                  onClick={() => onAlignSelection('middle')}
                >
                  <AlignCenterVertical size={13} />
                </button>
              </ToolTip>
              <ToolTip text="Align Bottom" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  disabled={selectedCount < 2}
                  onClick={() => onAlignSelection('bottom')}
                >
                  <AlignEndVertical size={13} />
                </button>
              </ToolTip>
            </div>
          </div>
        )}

        {/* Distribute Spacing (when 3+ nodes selected) */}
        {onDistributeSelection && (
          <div className="lumina-canvas-studio-card-box">
            <div className="card-box-header">
              <span className="card-box-label">Spacing Distribution</span>
              <span className="card-box-sub">
                {selectedCount > 2 ? `${selectedCount} selected` : 'Select 3+ cards'}
              </span>
            </div>
            <div className="lumina-canvas-studio-icon-group">
              <ToolTip text="Distribute Horizontally" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  disabled={selectedCount < 3}
                  onClick={() => onDistributeSelection('horizontal')}
                >
                  <AlignHorizontalDistributeCenter size={13} />
                </button>
              </ToolTip>
              <ToolTip text="Distribute Vertically" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  disabled={selectedCount < 3}
                  onClick={() => onDistributeSelection('vertical')}
                >
                  <AlignVerticalDistributeCenter size={13} />
                </button>
              </ToolTip>
            </div>
          </div>
        )}

        {/* Navigation & Zoom */}
        <div className="lumina-canvas-studio-card-box">
          <span className="card-box-label">Viewport & Zoom</span>
          <div className="lumina-canvas-studio-zoom-bar">
            <button
              type="button"
              className="studio-icon-btn"
              onClick={onZoomOut}
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="studio-icon-btn"
              onClick={onZoomIn}
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <div className="lumina-canvas-studio-presets-row" style={{ marginTop: 6 }}>
            {[0.5, 1.0, 1.5, 2.0].map((preset) => (
              <button
                key={preset}
                type="button"
                className={`preset-btn ${Math.abs(zoom - preset) < 0.05 ? 'active' : ''}`}
                onClick={() => onSetZoom && onSetZoom(preset)}
              >
                {Math.round(preset * 100)}%
              </button>
            ))}
          </div>

          <div className="lumina-canvas-studio-presets-row" style={{ marginTop: 6 }}>
            <button
              type="button"
              className="preset-btn secondary"
              onClick={onResetViewport}
              title="Reset Viewport to Origin (Ctrl+0)"
            >
              <RotateCcw size={11} />
              <span>100% Reset</span>
            </button>

            {onZoomToFit && (
              <button
                type="button"
                className="preset-btn secondary"
                onClick={onZoomToFit}
                title="Zoom to Fit All Cards (Shift+1)"
              >
                <Maximize2 size={11} />
                <span>Fit All</span>
              </button>
            )}
          </div>

          {onToggleMiniMap && (
            <div className="lumina-canvas-studio-row-switch" style={{ marginTop: 8 }}>
              <div className="switch-text">
                <span className="switch-title">Mini-Map Navigator</span>
                <span className="switch-hint">Spatial radar preview</span>
              </div>
              <button
                type="button"
                className={`lumina-canvas-studio-switch-pill ${isMiniMapOpen ? 'active' : ''}`}
                onClick={onToggleMiniMap}
              >
                <div className="switch-thumb" />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
)

StudioLayoutTab.displayName = 'StudioLayoutTab'
export default StudioLayoutTab
