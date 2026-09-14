/**
 * ============================================================================
 * Lumina Canvas Edge Item (CanvasEdgeItem.tsx)
 * ============================================================================
 * High-performance memoized SVG connector edge between two canvas nodes.
 *
 * Super Smart Capabilities:
 * - Dynamic port selection via `getOptimalEdgePorts()`: Auto-routes between
 *   the closest facing sides without looping backwards or cutting through cards.
 * - Multi-style path routing: Curved Bézier, Orthogonal Step, or Straight vector line.
 * - Multi-directional endpoints: Directed (->), Bidirectional (<->), or Plain line (--).
 * - Annotated Links (Edge Labels): Double-click or click Tag button to label
 *   relationships (e.g. "causes", "inhibits", "confirms", "leads to").
 * - Interactive hover action badge at midpoint:
 *     * Line style switcher (Curved <-> Step <-> Straight)
 *     * Arrowhead direction (Directed <-> Mutual <-> Undirected)
 *     * Edge label editor (Tag)
 *     * Edge color cycle (Palette)
 *     * Delete edge (X)
 * - React.memo comparison prevents re-renders when unrelated canvas nodes move.
 * ============================================================================
 */

import React, { useMemo, useState } from 'react'
import { CanvasEdge, CanvasEdgeEnd, CanvasEdgeLineStyle, CanvasNode, CanvasNodeColor } from './types'
import { calculateEdgePath } from './canvasRouting'
import { COLOR_CYCLE } from './canvasUtils'
import {
  Spline,
  CornerDownRight,
  Minus,
  Palette,
  X,
  ArrowRight,
  ArrowLeftRight,
  Tag
} from 'lucide-react'

export interface CanvasEdgeItemProps {
  edge: CanvasEdge
  fromNode: CanvasNode | undefined
  toNode: CanvasNode | undefined
  onDeleteEdge: (e: React.MouseEvent, edgeId: string) => void
  onUpdateLineStyle?: (edgeId: string, lineStyle: CanvasEdgeLineStyle) => void
  onCycleColor?: (edgeId: string) => void
  onUpdateLabel?: (edgeId: string, label: string) => void
  onUpdateEndpoints?: (edgeId: string, fromEnd?: CanvasEdgeEnd, toEnd?: CanvasEdgeEnd) => void
}

export const CanvasEdgeItem: React.FC<CanvasEdgeItemProps> = React.memo(
  ({
    edge,
    fromNode,
    toNode,
    onDeleteEdge,
    onUpdateLineStyle,
    onCycleColor,
    onUpdateLabel,
    onUpdateEndpoints
  }) => {
    if (!fromNode || !toNode) return null

    const [isEditingLabel, setIsEditingLabel] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const hoverTimerRef = React.useRef<number | null>(null)

    const handleMouseEnter = () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      setIsHovered(true)
    }

    const handleMouseLeave = () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = window.setTimeout(() => {
        setIsHovered(false)
      }, 450)
    }

    const lineStyle: CanvasEdgeLineStyle = edge.lineStyle || 'curved'

    const { pathD, midX, midY } = useMemo(() => {
      return calculateEdgePath(
        fromNode,
        edge.fromSide,
        toNode,
        edge.toSide,
        lineStyle,
        edge.routing !== 'manual'
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
      lineStyle,
      edge.routing
    ])

    const targetColor = edge.color || toNode.color || 'default'

    // Endpoint mode resolution: 'directed' (->), 'bidirectional' (<->), 'none' (--)
    const endpointMode: 'directed' | 'bidirectional' | 'none' =
      edge.toEnd === 'none'
        ? 'none'
        : edge.fromEnd === 'arrow'
          ? 'bidirectional'
          : 'directed'

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

    const handleCycleEndpoints = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!onUpdateEndpoints) return
      if (endpointMode === 'directed') {
        // Switch to bidirectional
        onUpdateEndpoints(edge.id, 'arrow', 'arrow')
      } else if (endpointMode === 'bidirectional') {
        // Switch to undirected
        onUpdateEndpoints(edge.id, 'none', 'none')
      } else {
        // Switch back to directed
        onUpdateEndpoints(edge.id, 'none', 'arrow')
      }
    }

    const handleCycleColor = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!onCycleColor) return
      onCycleColor(edge.id)
    }

    return (
      <g
        className={`lumina-canvas-edge-group ${isHovered ? 'is-hovered' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Invisible wider hit area for easy hover / click */}
        <path
          d={pathD}
          className="lumina-canvas-edge-hitbox"
          onClick={(e) => onDeleteEdge(e, edge.id)}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setIsEditingLabel(true)
          }}
        />

        {/* Generous hover retention bridge connecting midpoint to controls badge */}
        <circle
          cx={midX}
          cy={edge.label ? midY - 20 : midY}
          r={45}
          fill="transparent"
          style={{ pointerEvents: isHovered ? 'all' : 'none' }}
        />

        {/* Rendered SVG connector path with arrows matching target node color */}
        <path
          d={pathD}
          className={`lumina-canvas-edge-line edge-${targetColor}`}
          markerStart={edge.fromEnd === 'arrow' ? `url(#arrow-start-${targetColor})` : undefined}
          markerEnd={edge.toEnd === 'none' ? undefined : `url(#arrow-${targetColor})`}
        />

        {/* Edge Text Label Badge (Click/Double-click to edit) */}
        {edge.label && !isEditingLabel && (
          <g
            className="lumina-canvas-edge-label-badge"
            transform={`translate(${midX}, ${midY})`}
            onClick={(e) => {
              e.stopPropagation()
              setIsEditingLabel(true)
            }}
          >
            <rect
              x={-Math.max(24, edge.label.length * 4.2 + 10)}
              y={-10}
              width={Math.max(48, edge.label.length * 8.4 + 20)}
              height={20}
              rx={10}
              className={`lumina-canvas-edge-label-bg edge-${targetColor}`}
            />
            <text x={0} y={3.5} textAnchor="middle" className="lumina-canvas-edge-label-text">
              {edge.label}
            </text>
          </g>
        )}

        {/* Inline Label Editor */}
        {isEditingLabel && (
          <foreignObject
            x={midX - 70}
            y={midY - 14}
            width={140}
            height={28}
            className="lumina-canvas-edge-label-editor-container"
          >
            <input
              autoFocus
              className="lumina-canvas-edge-label-input"
              defaultValue={edge.label || ''}
              placeholder="Label relationship..."
              onBlur={(e) => {
                onUpdateLabel?.(edge.id, e.target.value.trim())
                setIsEditingLabel(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateLabel?.(edge.id, e.currentTarget.value.trim())
                  setIsEditingLabel(false)
                }
                if (e.key === 'Escape') {
                  setIsEditingLabel(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </foreignObject>
        )}

        {/* Interactive hover controls badge at wire midpoint */}
        {!isEditingLabel && (
          <foreignObject
            x={midX - 60}
            y={edge.label ? midY - 36 : midY - 14}
            width={120}
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

              {/* Endpoint Direction Toggle Button (Directed, Bidirectional, Plain) */}
              {onUpdateEndpoints && (
                <button
                  type="button"
                  className="lumina-canvas-edge-btn"
                  title={`Arrow Style: ${endpointMode.toUpperCase()} (Click to toggle)`}
                  aria-label="Toggle arrowhead style"
                  onClick={handleCycleEndpoints}
                >
                  {endpointMode === 'directed' ? (
                    <ArrowRight size={11} />
                  ) : endpointMode === 'bidirectional' ? (
                    <ArrowLeftRight size={11} />
                  ) : (
                    <Minus size={11} />
                  )}
                </button>
              )}

              {/* Edit Label Button */}
              {onUpdateLabel && (
                <button
                  type="button"
                  className="lumina-canvas-edge-btn"
                  title="Add / Edit Relationship Label"
                  aria-label="Edit Edge Label"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditingLabel(true)
                  }}
                >
                  <Tag size={11} />
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
        )}
      </g>
    )
  },
  (prev, next) => {
    // Re-render when edge attributes or attached node geometries change
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
