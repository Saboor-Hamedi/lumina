/**
 * ============================================================================
 * Lumina Canvas Selection Floating Toolbar (CanvasSelectionToolbar.tsx)
 * ============================================================================
 * Contextual action bar that docks right above multi-card selections:
 * - Multi-node alignment: Left, Center, Right, Top, Middle, Bottom
 * - Multi-node distribution: Horizontal Spacing, Vertical Spacing
 * - Multi-node actions: Duplicate (Alt+D), Change Color, Delete (Del)
 * - Prevents event bubbling to canvas background
 * ============================================================================
 */

import React from 'react'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Copy,
  Palette,
  Trash2,
  Grid
} from 'lucide-react'
import ToolTip from '../../../../components/atoms/ToolTip'
import { CanvasAlignmentType, CanvasDistributionType } from '../../utils/canvasAlignment'

export interface CanvasSelectionToolbarProps {
  selectionBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }
  selectedCount: number
  onAlign: (alignment: CanvasAlignmentType) => void
  onDistribute: (direction: CanvasDistributionType) => void
  onDuplicate: () => void
  onCycleColor: () => void
  onDelete: () => void
  onSnapToGrid?: () => void
}

export const CanvasSelectionToolbar: React.FC<CanvasSelectionToolbarProps> = React.memo(
  ({
    selectionBox,
    selectedCount,
    onAlign,
    onDistribute,
    onDuplicate,
    onCycleColor,
    onDelete,
    onSnapToGrid
  }) => {
    // Dock 44px above the top-center of the selection bounding box
    const toolbarX = selectionBox.minX + selectionBox.width / 2
    const toolbarY = selectionBox.minY - 44

    return (
      <div
        className="lumina-canvas-selection-toolbar"
        style={{
          left: `${toolbarX}px`,
          top: `${toolbarY}px`,
          transform: 'translateX(-50%)'
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <span className="lumina-canvas-selection-count">
          {selectedCount} selected
        </span>

        <div className="lumina-canvas-divider vertical" />

        {/* Horizontal Alignment */}
        <ToolTip text="Align Left" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={() => onAlign('left')}
            aria-label="Align Left"
          >
            <AlignLeft size={13} />
          </button>
        </ToolTip>

        <ToolTip text="Align Center Horizontally" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={() => onAlign('center')}
            aria-label="Align Center"
          >
            <AlignCenter size={13} />
          </button>
        </ToolTip>

        <ToolTip text="Align Right" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={() => onAlign('right')}
            aria-label="Align Right"
          >
            <AlignRight size={13} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider vertical" />

        {/* Vertical Alignment */}
        <ToolTip text="Align Top" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={() => onAlign('top')}
            aria-label="Align Top"
          >
            <AlignStartVertical size={13} />
          </button>
        </ToolTip>

        <ToolTip text="Align Middle Vertically" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={() => onAlign('middle')}
            aria-label="Align Middle"
          >
            <AlignCenterVertical size={13} />
          </button>
        </ToolTip>

        <ToolTip text="Align Bottom" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={() => onAlign('bottom')}
            aria-label="Align Bottom"
          >
            <AlignEndVertical size={13} />
          </button>
        </ToolTip>

        {/* Distribution (enabled for 3+ nodes) */}
        {selectedCount >= 3 && (
          <>
            <div className="lumina-canvas-divider vertical" />

            <ToolTip text="Distribute Horizontally" position="top">
              <button
                type="button"
                className="lumina-canvas-tool-btn"
                onClick={() => onDistribute('horizontal')}
                aria-label="Distribute Horizontally"
              >
                <AlignHorizontalDistributeCenter size={13} />
              </button>
            </ToolTip>

            <ToolTip text="Distribute Vertically" position="top">
              <button
                type="button"
                className="lumina-canvas-tool-btn"
                onClick={() => onDistribute('vertical')}
                aria-label="Distribute Vertically"
              >
                <AlignVerticalDistributeCenter size={13} />
              </button>
            </ToolTip>
          </>
        )}

        <div className="lumina-canvas-divider vertical" />

        {/* Multi-Node Duplicate */}
        <ToolTip text="Duplicate Selection (Alt+D)" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={onDuplicate}
            aria-label="Duplicate Selection (Alt+D)"
          >
            <Copy size={13} />
          </button>
        </ToolTip>

        {/* Multi-Node Cycle Color */}
        <ToolTip text="Change Color" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={onCycleColor}
            aria-label="Change Color"
          >
            <Palette size={13} />
          </button>
        </ToolTip>

        {/* Snap Selection to Grid */}
        {onSnapToGrid && (
          <ToolTip text="Snap to Grid" position="top">
            <button
              type="button"
              className="lumina-canvas-tool-btn"
              onClick={onSnapToGrid}
              aria-label="Snap to Grid"
            >
              <Grid size={13} />
            </button>
          </ToolTip>
        )}

        {/* Multi-Node Delete */}
        <ToolTip text="Delete Selection (Del)" position="top">
          <button
            type="button"
            className="lumina-canvas-tool-btn delete"
            onClick={onDelete}
            aria-label="Delete Selection (Del)"
          >
            <Trash2 size={13} />
          </button>
        </ToolTip>
      </div>
    )
  }
)

CanvasSelectionToolbar.displayName = 'CanvasSelectionToolbar'

export default CanvasSelectionToolbar
