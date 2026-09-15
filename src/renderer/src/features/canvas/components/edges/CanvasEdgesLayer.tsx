/**
 * ============================================================================
 * Lumina Canvas Edges Layer (CanvasEdgesLayer.tsx)
 * ============================================================================
 * SVG Layer managing wire connections, directional arrow markers,
 * and live interactive connection projections:
 * - Directional arrowheads & bidirectional `<marker>` defs
 * - Multi-style connector items (`CanvasEdgeItem`)
 * - Live dragging connection spline with magnetic docking styling
 * ============================================================================
 */

import React, { useMemo } from 'react'
import { CanvasEdge, CanvasEdgeEnd, CanvasEdgeLineStyle, CanvasNode, CanvasNodeColor } from '../../types'
import { CANVAS_NODE_COLOR_HEX, COLOR_CYCLE, getDragBezierCurve, SnappedPortTarget } from '../../utils/canvasUtils'
import { CanvasEdgeItem } from './CanvasEdgeItem'
import { ConnectingState } from '../../hooks/useCanvasGestures'

export interface CanvasEdgesLayerProps {
  edges: CanvasEdge[]
  nodeMap: Map<string, CanvasNode>
  connecting: ConnectingState | null
  snappedTarget: SnappedPortTarget | null
  mouseCanvasPos: { x: number; y: number }
  onDeleteEdge: (e: React.MouseEvent, edgeId: string) => void
  onUpdateEdgeLineStyle: (edgeId: string, lineStyle: CanvasEdgeLineStyle) => void
  onUpdateEdgeLabel: (edgeId: string, label: string) => void
  onUpdateEdgeEndpoints: (edgeId: string, fromEnd?: CanvasEdgeEnd, toEnd?: CanvasEdgeEnd) => void
  onUpdateEdgeColor: (edgeId: string, color: CanvasNodeColor) => void
}

export const CanvasEdgesLayer: React.FC<CanvasEdgesLayerProps> = React.memo(
  ({
    edges,
    nodeMap,
    connecting,
    snappedTarget,
    mouseCanvasPos,
    onDeleteEdge,
    onUpdateEdgeLineStyle,
    onUpdateEdgeLabel,
    onUpdateEdgeEndpoints,
    onUpdateEdgeColor
  }) => {
    // Dynamic live wire preview while dragging
    const liveConnectingLine = useMemo(() => {
      if (!connecting) return null

      let targetColor = connecting.color || 'default'
      let targetHex = CANVAS_NODE_COLOR_HEX[targetColor as keyof typeof CANVAS_NODE_COLOR_HEX] || '#38bdf8'
      let pathD = ''

      if (snappedTarget) {
        targetColor = snappedTarget.color
        targetHex = CANVAS_NODE_COLOR_HEX[targetColor as keyof typeof CANVAS_NODE_COLOR_HEX] || '#38bdf8'
        pathD = getDragBezierCurve(
          { x: connecting.startX, y: connecting.startY },
          connecting.fromSide,
          { x: snappedTarget.x, y: snappedTarget.y }
        ).pathD
      } else {
        pathD = getDragBezierCurve(
          { x: connecting.startX, y: connecting.startY },
          connecting.fromSide,
          mouseCanvasPos
        ).pathD
      }

      return (
        <path
          d={pathD}
          className={`lumina-canvas-connecting-line ${snappedTarget ? 'snapped' : ''}`}
          style={
            {
              stroke: targetHex,
              '--snap-color': targetHex
            } as React.CSSProperties
          }
          markerEnd={`url(#arrow-${targetColor})`}
        />
      )
    }, [connecting, mouseCanvasPos, snappedTarget])

    return (
      <svg className="lumina-canvas-edges-layer">
        <defs>
          {/* Default Forward Arrowhead */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 7 5 L 0 8 z" fill="var(--text-accent, #38bdf8)" />
          </marker>

          {/* Default Backward Arrowhead for Bidirectional Links */}
          <marker
            id="arrow-start"
            viewBox="0 0 10 10"
            refX="3"
            refY="5"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto"
          >
            <path d="M 7 2 L 0 5 L 7 8 z" fill="var(--text-accent, #38bdf8)" />
          </marker>

          {/* Palette-specific Forward and Backward Arrow Markers */}
          {(Object.keys(CANVAS_NODE_COLOR_HEX) as (keyof typeof CANVAS_NODE_COLOR_HEX)[]).map((cKey) => (
            <React.Fragment key={cKey}>
              <marker
                id={`arrow-${cKey}`}
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 7 5 L 0 8 z" fill={CANVAS_NODE_COLOR_HEX[cKey]} />
              </marker>
              <marker
                id={`arrow-start-${cKey}`}
                viewBox="0 0 10 10"
                refX="3"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto"
              >
                <path d="M 7 2 L 0 5 L 7 8 z" fill={CANVAS_NODE_COLOR_HEX[cKey]} />
              </marker>
            </React.Fragment>
          ))}
        </defs>

        {/* Render Connection Edges */}
        {edges.map((edge) => (
          <CanvasEdgeItem
            key={edge.id}
            edge={edge}
            fromNode={nodeMap.get(edge.fromNode)}
            toNode={nodeMap.get(edge.toNode)}
            onDeleteEdge={onDeleteEdge}
            onUpdateLineStyle={onUpdateEdgeLineStyle}
            onUpdateLabel={onUpdateEdgeLabel}
            onUpdateEndpoints={onUpdateEdgeEndpoints}
            onCycleColor={(edgeId) => {
              const targetEdge = edges.find((e) => e.id === edgeId)
              if (targetEdge) {
                const currIdx = COLOR_CYCLE.indexOf((targetEdge.color || 'default') as any)
                const nextColor = COLOR_CYCLE[(currIdx + 1) % COLOR_CYCLE.length]
                onUpdateEdgeColor(edgeId, nextColor)
              }
            }}
          />
        ))}

        {/* Live Connecting Projection Spline */}
        {liveConnectingLine}
      </svg>
    )
  }
)

CanvasEdgesLayer.displayName = 'CanvasEdgesLayer'
export default CanvasEdgesLayer
