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
  selectedEdgeId?: string | null
  isMultiSelectionActive?: boolean
  onSelectEdge?: (e: React.MouseEvent, edgeId: string) => void
  onDeleteEdge: (e: React.MouseEvent, edgeId: string) => void
  onUpdateEdgeLineStyle: (edgeId: string, lineStyle: CanvasEdgeLineStyle) => void
  onUpdateEdgeLabel: (edgeId: string, label: string) => void
  onUpdateEdgeEndpoints: (edgeId: string, fromEnd?: CanvasEdgeEnd, toEnd?: CanvasEdgeEnd) => void
  onUpdateEdgeColor: (edgeId: string, color: CanvasNodeColor) => void
  snapToGrid?: boolean
}

export const CanvasEdgesLayer: React.FC<CanvasEdgesLayerProps> = React.memo(
  ({
    edges,
    nodeMap,
    connecting,
    snappedTarget,
    mouseCanvasPos,
    selectedEdgeId = null,
    isMultiSelectionActive = false,
    onSelectEdge,
    onDeleteEdge,
    onUpdateEdgeLineStyle,
    onUpdateEdgeLabel,
    onUpdateEdgeEndpoints,
    onUpdateEdgeColor,
    snapToGrid = false
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

    // Map parallel edges between the same node pair to calculate fanning offsets
    const parallelEdgeMap = useMemo(() => {
      const map = new Map<string, { index: number; total: number }>()
      const pairGroups = new Map<string, string[]>()

      for (const edge of edges) {
        const pairKey = [edge.fromNode, edge.toNode].sort().join('::')
        const list = pairGroups.get(pairKey) || []
        list.push(edge.id)
        pairGroups.set(pairKey, list)
      }

      pairGroups.forEach((edgeIds) => {
        const total = edgeIds.length
        edgeIds.forEach((id, index) => {
          map.set(id, { index, total })
        })
      })

      return map
    }, [edges])

    return (
      <svg className="lumina-canvas-edges-layer">
        <defs>
          {/* Default Forward Filled Round Knob Head */}
          <marker
            id="arrow"
            viewBox="0 0 12 12"
            refX="6"
            refY="6"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <circle
              cx="6"
              cy="6"
              r="4.2"
              fill="var(--text-accent, #38bdf8)"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
          </marker>

          {/* Default Backward Filled Round Knob Head for Bidirectional Links */}
          <marker
            id="arrow-start"
            viewBox="0 0 12 12"
            refX="6"
            refY="6"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <circle
              cx="6"
              cy="6"
              r="4.2"
              fill="var(--text-accent, #38bdf8)"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
          </marker>

          {/* Per-Color Styled Filled Round Knob Markers */}
          {COLOR_CYCLE.map((cKey) => (
            <React.Fragment key={cKey}>
              <marker
                id={`arrow-${cKey}`}
                viewBox="0 0 12 12"
                refX="6"
                refY="6"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <circle
                  cx="6"
                  cy="6"
                  r="4.2"
                  fill={CANVAS_NODE_COLOR_HEX[cKey]}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
              </marker>

              <marker
                id={`arrow-start-${cKey}`}
                viewBox="0 0 12 12"
                refX="6"
                refY="6"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <circle
                  cx="6"
                  cy="6"
                  r="4.2"
                  fill={CANVAS_NODE_COLOR_HEX[cKey]}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
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
            snapToGrid={snapToGrid}
            isSelected={selectedEdgeId === edge.id}
            isMultiSelectionActive={isMultiSelectionActive}
            onSelectEdge={onSelectEdge}
            parallelIndex={parallelEdgeMap.get(edge.id)?.index ?? 0}
            totalParallel={parallelEdgeMap.get(edge.id)?.total ?? 1}
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
