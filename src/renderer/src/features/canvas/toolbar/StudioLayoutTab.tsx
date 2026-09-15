import React, { useMemo } from 'react'
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
  Maximize2,
  Map as MapIcon
} from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { CanvasAlignmentType, CanvasDistributionType } from '../utils/canvasAlignment'
import { StudioDropdown, StudioDropdownOption } from './StudioDropdown'

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

const ALIGNMENT_OPTIONS: StudioDropdownOption<CanvasAlignmentType>[] = [
  { id: 'left', label: 'Align Left', icon: <AlignLeft size={13} />, description: 'Align cards to leftmost edge' },
  { id: 'center', label: 'Align Center (H)', icon: <AlignCenter size={13} />, description: 'Align horizontal centers' },
  { id: 'right', label: 'Align Right', icon: <AlignRight size={13} />, description: 'Align cards to rightmost edge' },
  { id: 'top', label: 'Align Top', icon: <AlignStartVertical size={13} />, description: 'Align cards to topmost edge' },
  { id: 'middle', label: 'Align Middle (V)', icon: <AlignCenterVertical size={13} />, description: 'Align vertical centers' },
  { id: 'bottom', label: 'Align Bottom', icon: <AlignEndVertical size={13} />, description: 'Align cards to bottom edge' }
]

const DISTRIBUTION_OPTIONS: StudioDropdownOption<CanvasDistributionType>[] = [
  {
    id: 'horizontal',
    label: 'Distribute Horizontally',
    icon: <AlignHorizontalDistributeCenter size={13} />,
    description: 'Equal horizontal gap between cards'
  },
  {
    id: 'vertical',
    label: 'Distribute Vertically',
    icon: <AlignVerticalDistributeCenter size={13} />,
    description: 'Equal vertical gap between cards'
  }
]

const ZOOM_PRESET_OPTIONS: StudioDropdownOption<string>[] = [
  { id: '0.25', label: '25% — Overview', badge: '0.25x' },
  { id: '0.5', label: '50% — Bird’s Eye', badge: '0.5x' },
  { id: '0.75', label: '75% — Compact', badge: '0.75x' },
  { id: '1', label: '100% — Default', badge: '1.0x' },
  { id: '1.25', label: '125% — Expanded', badge: '1.25x' },
  { id: '1.5', label: '150% — Focus', badge: '1.5x' },
  { id: '2', label: '200% — Close-up', badge: '2.0x' },
  { id: 'fit', label: 'Zoom to Fit Diagram', badge: 'Fit', icon: <Maximize2 size={13} /> }
]

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
    // Current zoom label matching preset
    const currentZoomKey = useMemo(() => {
      const rounded = Math.round(zoom * 100) / 100
      const exact = ZOOM_PRESET_OPTIONS.find((opt) => opt.id === String(rounded))
      return exact ? exact.id : `${Math.round(zoom * 100)}%`
    }, [zoom])

    const handleSelectZoom = (val: string) => {
      if (val === 'fit') {
        onZoomToFit?.()
      } else {
        const num = parseFloat(val)
        if (!isNaN(num) && onSetZoom) {
          onSetZoom(num)
        }
      }
    }

    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">Layout & Precision</span>
          <span className="banner-sub">Snapping, alignment, distribution & viewport zoom</span>
        </div>

        {/* Feature 1: Grid Snapping Controls */}
        <div className="lumina-canvas-studio-card-box">
          <div className="lumina-canvas-studio-row-switch">
            <div className="switch-text">
              <span className="switch-title">20px Grid Snapping</span>
              <span className="switch-hint">Hold Shift or toggle (Ctrl+&apos;)</span>
            </div>
            <button
              type="button"
              className={`lumina-canvas-studio-switch-pill ${snapToGrid ? 'active' : ''}`}
              onClick={onToggleSnapToGrid}
              aria-label="Toggle Grid Snapping"
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

        {/* Feature 2: Multi-Card Alignment Dropdown & Quick Buttons */}
        {onAlignSelection && (
          <div className="lumina-canvas-studio-card-box">
            <StudioDropdown<CanvasAlignmentType>
              label="Align Selected Cards"
              description={selectedCount > 1 ? `${selectedCount} selected` : 'Select 2+ cards'}
              disabled={selectedCount < 2}
              value=""
              placeholder={selectedCount < 2 ? 'Select 2+ cards to align' : 'Choose alignment...'}
              options={ALIGNMENT_OPTIONS}
              onChange={(align) => onAlignSelection(align)}
            />

            {/* Quick Alignment Button Bar */}
            <div className="lumina-canvas-studio-icon-group" style={{ marginTop: 6 }}>
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

        {/* Feature 3: Spacing Distribution Dropdown & Quick Buttons */}
        {onDistributeSelection && (
          <div className="lumina-canvas-studio-card-box">
            <StudioDropdown<CanvasDistributionType>
              label="Distribute Spacing"
              description={selectedCount > 2 ? `${selectedCount} selected` : 'Select 3+ cards'}
              disabled={selectedCount < 3}
              value=""
              placeholder={selectedCount < 3 ? 'Select 3+ cards to distribute' : 'Choose distribution...'}
              options={DISTRIBUTION_OPTIONS}
              onChange={(dist) => onDistributeSelection(dist)}
            />

            {/* Quick Distribution Button Bar */}
            <div className="lumina-canvas-studio-icon-group" style={{ marginTop: 6 }}>
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

        {/* Feature 4: Viewport Zoom Dropdown & Navigator Controls */}
        <div className="lumina-canvas-studio-card-box">
          <StudioDropdown<string>
            label="Viewport Zoom Level"
            description={`${Math.round(zoom * 100)}% active`}
            value={currentZoomKey}
            options={ZOOM_PRESET_OPTIONS}
            onChange={handleSelectZoom}
          />

          {/* Quick Zoom Buttons */}
          <div className="lumina-canvas-studio-btn-row" style={{ marginTop: 6 }}>
            <ToolTip text="Zoom Out" position="top">
              <button
                type="button"
                className="studio-icon-btn"
                onClick={onZoomOut}
                aria-label="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
            </ToolTip>

            <span className="studio-zoom-display">{Math.round(zoom * 100)}%</span>

            <ToolTip text="Zoom In" position="top">
              <button
                type="button"
                className="studio-icon-btn"
                onClick={onZoomIn}
                aria-label="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </ToolTip>

            <ToolTip text="Reset Zoom (Ctrl+0)" position="top">
              <button
                type="button"
                className="studio-icon-btn"
                onClick={onResetViewport}
                aria-label="Reset Viewport"
              >
                <RotateCcw size={12} />
              </button>
            </ToolTip>

            {onZoomToFit && (
              <ToolTip text="Fit to View (Shift+1)" position="top">
                <button
                  type="button"
                  className="studio-icon-btn"
                  onClick={onZoomToFit}
                  aria-label="Zoom to Fit"
                >
                  <Maximize2 size={12} />
                </button>
              </ToolTip>
            )}
          </div>

          {/* Mini-Map Navigator Toggle */}
          {onToggleMiniMap && (
            <div className="lumina-canvas-studio-row-switch" style={{ marginTop: 6 }}>
              <div className="switch-text">
                <span className="switch-title">Mini-Map Radar</span>
                <span className="switch-hint">Spatial canvas navigator</span>
              </div>
              <button
                type="button"
                className={`lumina-canvas-studio-switch-pill ${isMiniMapOpen ? 'active' : ''}`}
                onClick={onToggleMiniMap}
                aria-label="Toggle Mini-Map"
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
