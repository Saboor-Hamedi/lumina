/**
 * ============================================================================
 * Lumina Canvas Freehand Strokes Layer (CanvasStrokesLayer.tsx)
 * ============================================================================
 * High-performance SVG vector ink layer for freehand pencil & highlighter
 * drawings on the infinite canvas. Supports:
 * - Smooth quadratic midpoint Bézier paths
 * - Live in-progress stroke rendering at 60/120Hz without re-rendering existing strokes
 * - Direct tap/click-to-erase when the Eraser tool is active
 * ============================================================================
 */

import React from 'react'
import { CanvasStroke, CanvasToolMode } from '../../types'
import { CANVAS_NODE_COLOR_HEX } from '../../utils/canvasUtils'
import { buildSmoothStrokePath } from '../../utils/canvasStroke'

interface CanvasStrokeItemProps {
  stroke: CanvasStroke
  isEraser: boolean
  onEraseStroke?: (strokeId: string) => void
}

const CanvasStrokeItem: React.FC<CanvasStrokeItemProps> = React.memo(
  ({ stroke, isEraser, onEraseStroke }) => {
    const d = React.useMemo(() => buildSmoothStrokePath(stroke.points), [stroke.points])
    if (!d) return null

    const colorHex =
      CANVAS_NODE_COLOR_HEX[stroke.color as keyof typeof CANVAS_NODE_COLOR_HEX] ||
      'var(--text-accent, #38bdf8)'
    const opacity = stroke.opacity ?? (stroke.tool === 'highlighter' ? 0.34 : 0.95)
    const width = stroke.strokeWidth || 3

    return (
      <g className={`lumina-canvas-stroke-group ${isEraser ? 'is-erasable' : ''}`}>
        {isEraser && (
          <path
            d={d}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(18, width + 14)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'stroke', cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onEraseStroke?.(stroke.id)
            }}
          />
        )}
        <path
          d={d}
          className="lumina-canvas-stroke-path"
          fill="none"
          stroke={colorHex}
          strokeWidth={width}
          strokeOpacity={opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        />
      </g>
    )
  }
)
CanvasStrokeItem.displayName = 'CanvasStrokeItem'

interface SavedStrokesListProps {
  strokes: CanvasStroke[]
  isEraser: boolean
  onEraseStroke?: (strokeId: string) => void
}

const SavedStrokesList: React.FC<SavedStrokesListProps> = React.memo(
  ({ strokes, isEraser, onEraseStroke }) => (
    <>
      {strokes.map((stroke) => (
        <CanvasStrokeItem
          key={stroke.id}
          stroke={stroke}
          isEraser={isEraser}
          onEraseStroke={onEraseStroke}
        />
      ))}
    </>
  )
)
SavedStrokesList.displayName = 'SavedStrokesList'

export interface CanvasStrokesLayerProps {
  strokes: CanvasStroke[]
  activeStroke: CanvasStroke | null
  toolMode: CanvasToolMode
  onEraseStroke?: (strokeId: string) => void
}

export const CanvasStrokesLayer: React.FC<CanvasStrokesLayerProps> = React.memo(
  ({ strokes, activeStroke, toolMode, onEraseStroke }) => {
    const isEraser = toolMode === 'eraser'

    const activePathD = React.useMemo(
      () => (activeStroke ? buildSmoothStrokePath(activeStroke.points) : ''),
      [activeStroke]
    )

    const activeColorHex = activeStroke
      ? CANVAS_NODE_COLOR_HEX[activeStroke.color as keyof typeof CANVAS_NODE_COLOR_HEX] ||
        'var(--text-accent, #38bdf8)'
      : '#38bdf8'

    if (strokes.length === 0 && !activeStroke) return null

    return (
      <svg className="lumina-canvas-strokes-layer" aria-label="Canvas drawings">
        <SavedStrokesList strokes={strokes} isEraser={isEraser} onEraseStroke={onEraseStroke} />
        {activeStroke && activePathD && (
          <path
            d={activePathD}
            className="lumina-canvas-stroke-path is-drawing"
            fill="none"
            stroke={activeColorHex}
            strokeWidth={activeStroke.strokeWidth || 3}
            strokeOpacity={activeStroke.opacity ?? (activeStroke.tool === 'highlighter' ? 0.34 : 0.95)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
    )
  }
)

CanvasStrokesLayer.displayName = 'CanvasStrokesLayer'
export default CanvasStrokesLayer
