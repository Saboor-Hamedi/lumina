/**
 * ============================================================================
 * Lumina Canvas Edge Item
 * ============================================================================
 * High-performance memoized SVG connector edge between two canvas nodes.
 *
 * Highlights:
 * - Dynamic port selection via `getOptimalEdgePorts()`: Wire automatically routes
 *   between the closest, natural facing sides without looping or twisting.
 * - Directional cubic Bézier spline with smooth curvature.
 * - Expanded transparent hover hitbox for effortless click/hover interactions.
 * - Interactive midpoint delete button on hover.
 * - React.memo comparison prevents re-renders when unrelated canvas nodes move.
 * ============================================================================
 */

import React, { useMemo } from 'react'
import { CanvasEdge, CanvasNode } from './types'
import { getNodePortCoord, getBezierCurve, getOptimalEdgePorts } from './canvasUtils'

export interface CanvasEdgeItemProps {
  edge: CanvasEdge
  fromNode: CanvasNode | undefined
  toNode: CanvasNode | undefined
  onDeleteEdge: (e: React.MouseEvent, edgeId: string) => void
}

export const CanvasEdgeItem: React.FC<CanvasEdgeItemProps> = React.memo(
  ({ edge, fromNode, toNode, onDeleteEdge }) => {
    if (!fromNode || !toNode) return null

    const { pathD, midX, midY } = useMemo(() => {
      // Dynamically select the best facing ports based on the current relative positions
      const optimal = getOptimalEdgePorts(fromNode, toNode)
      const fromSide = optimal.fromSide
      const toSide = optimal.toSide

      const fromPt = getNodePortCoord(fromNode, fromSide)
      const toPt = getNodePortCoord(toNode, toSide)
      return getBezierCurve(fromPt, fromSide, toPt, toSide)
    }, [
      fromNode.x,
      fromNode.y,
      fromNode.width,
      fromNode.height,
      toNode.x,
      toNode.y,
      toNode.width,
      toNode.height
    ])

    return (
      <g className="lumina-canvas-edge-group">
        {/* Invisible wider hit area for easy hover / click */}
        <path
          d={pathD}
          className="lumina-canvas-edge-hitbox"
          onClick={(e) => onDeleteEdge(e, edge.id)}
        />
        {/* Rendered curved SVG connector path */}
        <path d={pathD} className="lumina-canvas-edge-line" />
        {/* Delete Edge Button on hover */}
        <g
          className="lumina-canvas-edge-delete"
          transform={`translate(${midX}, ${midY})`}
          onClick={(e) => onDeleteEdge(e, edge.id)}
        >
          <circle r="10" fill="var(--bg-panel, #18181b)" stroke="#ef4444" strokeWidth="1.5" />
          <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke="#ef4444" strokeWidth="1.5" />
          <line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke="#ef4444" strokeWidth="1.5" />
        </g>
      </g>
    )
  },
  (prev, next) => {
    // Only re-render if the edge definition or the connected nodes' bounding boxes changed
    if (prev.edge !== next.edge) return false
    if (!prev.fromNode || !next.fromNode || !prev.toNode || !next.toNode) return false
    return (
      prev.fromNode.x === next.fromNode.x &&
      prev.fromNode.y === next.fromNode.y &&
      prev.fromNode.width === next.fromNode.width &&
      prev.fromNode.height === next.fromNode.height &&
      prev.toNode.x === next.toNode.x &&
      prev.toNode.y === next.toNode.y &&
      prev.toNode.width === next.toNode.width &&
      prev.toNode.height === next.toNode.height
    )
  }
)

CanvasEdgeItem.displayName = 'CanvasEdgeItem'

export default CanvasEdgeItem
