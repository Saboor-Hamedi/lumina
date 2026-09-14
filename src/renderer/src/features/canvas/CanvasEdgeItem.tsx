/**
 * ============================================================================
 * Lumina Canvas Edge Item (CanvasEdgeItem.tsx)
 * ============================================================================
 * High-performance memoized SVG connector edge between two canvas nodes.
 *
 * Highlights:
 * - Dynamic port selection via `getOptimalEdgePorts()`: Wire automatically routes
 *   between the closest, natural facing sides without looping or twisting.
 * - Multi-style path routing: Curved Bézier, Orthogonal Step, or Straight vector line.
 * - Expanded transparent hover hitbox for effortless click/hover interactions.
 * - Interactive hover action badge at midpoint:
 *     * Line style switcher (Curved <-> Step <-> Straight)
 *     * Edge color cycle (Palette)
 *     * Delete edge (X)
 * - React.memo comparison prevents re-renders when unrelated canvas nodes move.
 * ============================================================================
 */

import React, { useMemo } from 'react'
import { CanvasEdge, CanvasEdgeLineStyle, CanvasNode, CanvasNodeColor } from './types'
import { calculateEdgePath } from './canvasRouting'
import { COLOR_CYCLE } from './canvasUtils'
import { Spline, CornerDownRight, Minus, Palette, X } from 'lucide-react'

export interface CanvasEdgeItemProps {
  edge: CanvasEdge
  fromNode: CanvasNode | undefined
  toNode: CanvasNode | undefined
  onDeleteEdge: (e: React.MouseEvent, edgeId: string) => void
  onUpdateLineStyle?: (edgeId: string, lineStyle: CanvasEdgeLineStyle) => void
  onCycleColor?: (edgeId: string) => void
}

export const CanvasEdgeItem: React.FC<CanvasEdgeItemProps> = React.memo(
  ({ edge, fromNode, toNode, onDeleteEdge, onUpdateLineStyle, onCycleColor }) => {
    if (!fromNode || !toNode) return null

    const lineStyle: CanvasEdgeLineStyle = edge.lineStyle || 'curved'

    const { pathD, midX, midY } = useMemo(() => {
      return calculateEdgePath(
        fromNode,
        edge.fromSide,
        toNode,
        edge.toSide,
        lineStyle
      )
    }, [
      fromNode.x,
      fromNode.y,
      fromNode.width,
      fromNode.height,
      fromNode.type,
      fromNode.shape,
      toNode.x,
      toNode.y,
      toNode.width,
      toNode.height,
      toNode.type,
      toNode.shape,
      edge.fromSide,
      edge.toSide,
      lineStyle
    ])

    const targetColor = edge.color || toNode.color || 'default'

    const handleCycleLineStyle = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!onUpdateLineStyle) return
      const nextStyle: Record<CanvasEdgeLineStyle, CanvasEdgeLineStyle> = {
        curved: 'step',
        step: 'straight',
        straight: 'curved'
      }
      onUpdateLineStyle(edge.id, nextStyle[lineStyle] || 'curved')
    }

    const handleCycleColor = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!onCycleColor) return
      onCycleColor(edge.id)
    }

    return (
      <g className="lumina-canvas-edge-group">
        {/* Invisible wider hit area for easy hover / click */}
        <path
          d={pathD}
          className="lumina-canvas-edge-hitbox"
          onClick={(e) => onDeleteEdge(e, edge.id)}
        />
        {/* Rendered SVG connector path with arrow matching target note color */}
        <path
          d={pathD}
          className={`lumina-canvas-edge-line edge-${targetColor}`}
          markerEnd={`url(#arrow-${targetColor})`}
        />

        {/* Interactive hover controls badge at wire midpoint */}
        <foreignObject
          x={midX - 44}
          y={midY - 14}
          width={88}
          height={28}
          className="lumina-canvas-edge-controls-container"
        >
          <div
            className="lumina-canvas-edge-controls"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Line Style Toggle Button */}
            {onUpdateLineStyle && (
              <button
                type="button"
                className="lumina-canvas-edge-btn"
                title={`Line Style: ${lineStyle.toUpperCase()} (Click to toggle)`}
                aria-label="Toggle line style"
                onClick={handleCycleLineStyle}
              >
                {lineStyle === 'curved' ? (
                  <Spline size={11} />
                ) : lineStyle === 'step' ? (
                  <CornerDownRight size={11} />
                ) : (
                  <Minus size={11} />
                )}
              </button>
            )}

            {/* Edge Color Toggle Button */}
            {onCycleColor && (
              <button
                type="button"
                className="lumina-canvas-edge-btn"
                title="Change Edge Color"
                aria-label="Change Edge Color"
                onClick={handleCycleColor}
              >
                <Palette size={11} />
              </button>
            )}

            {/* Delete Edge Button */}
            <button
              type="button"
              className="lumina-canvas-edge-btn delete"
              title="Delete Wire"
              aria-label="Delete Wire"
              onClick={(e) => onDeleteEdge(e, edge.id)}
            >
              <X size={11} />
            </button>
          </div>
        </foreignObject>
      </g>
    )
  },
  (prev, next) => {
    // Only re-render if edge attributes or connected nodes change
    if (prev.edge !== next.edge) return false
    if (!prev.fromNode || !next.fromNode || !prev.toNode || !next.toNode) return false
    return (
      prev.fromNode.x === next.fromNode.x &&
      prev.fromNode.y === next.fromNode.y &&
      prev.fromNode.width === next.fromNode.width &&
      prev.fromNode.height === next.fromNode.height &&
      prev.fromNode.color === next.fromNode.color &&
      prev.fromNode.shape === next.fromNode.shape &&
      prev.toNode.x === next.toNode.x &&
      prev.toNode.y === next.toNode.y &&
      prev.toNode.width === next.toNode.width &&
      prev.toNode.height === next.toNode.height &&
      prev.toNode.color === next.toNode.color &&
      prev.toNode.shape === next.toNode.shape
    )
  }
)

CanvasEdgeItem.displayName = 'CanvasEdgeItem'

export default CanvasEdgeItem
