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
  AlignVerticalDistributeCenter
} from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import Toggle from '../../../components/toggle/Toggle'
import { CanvasAlignmentType, CanvasDistributionType } from '../utils/canvasAlignment'
import { StudioDropdown, StudioDropdownOption } from './StudioDropdown'

export interface StudioLayoutTabProps {
  zoom?: number
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetViewport?: () => void
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

export const StudioLayoutTab: React.FC<StudioLayoutTabProps> = React.memo(
  ({
    selectedCount = 0,
    snapToGrid = false,
    onToggleSnapToGrid,
    onSnapAllToGrid,
    onAlignSelection,
    onDistributeSelection
  }) => {
    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">Layout & Precision</span>
          <span className="banner-sub">Snapping, alignment, and distribution</span>
        </div>

        {/* Feature 1: Grid Snapping Controls */}
        <div className="lumina-canvas-studio-card-box">
          <div className="lumina-canvas-studio-row-switch">
            <div className="switch-text">
              <span className="switch-title">20px Grid Snapping</span>
              <span className="switch-hint">Hold Shift or toggle (Ctrl+&apos;)</span>
            </div>
            <Toggle
              checked={snapToGrid}
              onChange={() => onToggleSnapToGrid?.()}
              ariaLabel="Toggle Grid Snapping"
            />
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
      </div>
    )
  }
)

StudioLayoutTab.displayName = 'StudioLayoutTab'
export default StudioLayoutTab
