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

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { CanvasEdge, CanvasEdgeEnd, CanvasEdgeLineStyle, CanvasNode, CanvasNodeColor } from '../../types'
import { calculateEdgePath } from '../../utils/canvasRouting'
import { COLOR_CYCLE } from '../../utils/canvasUtils'
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
  isSelected?: boolean
  isMultiSelectionActive?: boolean
  onSelectEdge?: (e: React.MouseEvent, edgeId: string) => void
  onDeleteEdge: (e: React.MouseEvent, edgeId: string) => void
  onUpdateLineStyle?: (edgeId: string, lineStyle: CanvasEdgeLineStyle) => void
  onCycleColor?: (edgeId: string) => void
  onUpdateLabel?: (edgeId: string, label: string) => void
  onUpdateEndpoints?: (edgeId: string, fromEnd?: CanvasEdgeEnd, toEnd?: CanvasEdgeEnd) => void
  snapToGrid?: boolean
  parallelIndex?: number
  totalParallel?: number
}

export const CanvasEdgeItem: React.FC<CanvasEdgeItemProps> = React.memo(
  ({
    edge,
    fromNode,
    toNode,
    isSelected = false,
    isMultiSelectionActive = false,
    onSelectEdge,
    onDeleteEdge,
    onUpdateLineStyle,
    onCycleColor,
    onUpdateLabel,
    onUpdateEndpoints,
    snapToGrid = false,
    parallelIndex = 0,
    totalParallel = 1
  }) => {
    if (!fromNode || !toNode) return null

    const [isEditingLabel, setIsEditingLabel] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const hoverTimerRef = useRef<number | null>(null)
    const labelInputRef = useRef<HTMLInputElement | null>(null)
    const isEscapedRef = useRef(false)

    // Ensure focus and handle Escape or outside clicks cleanly
    useEffect(() => {
      if (!isEditingLabel) return
      isEscapedRef.current = false

      // Explicitly focus and select input inside SVG foreignObject
      requestAnimationFrame(() => {
        labelInputRef.current?.focus()
        labelInputRef.current?.select()
      })

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          e.preventDefault()
          isEscapedRef.current = true
          setIsEditingLabel(false)
        }
      }

      const handlePointerDownOutside = (e: MouseEvent | PointerEvent) => {
        const target = e.target as HTMLElement | null
        if (!target?.closest('.lumina-canvas-edge-label-editor-container')) {
          setIsEditingLabel(false)
        }
      }

      window.addEventListener('keydown', handleGlobalKeyDown, true)
      window.addEventListener('pointerdown', handlePointerDownOutside, true)

      return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown, true)
        window.removeEventListener('pointerdown', handlePointerDownOutside, true)
      }
    }, [isEditingLabel])

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
        !edge.fromSide || !edge.toSide,
        snapToGrid,
        parallelIndex,
        totalParallel
      )
    }, [
      fromNode.x,
      fromNode.y,
      fromNode.width,
      fromNode.height,
      fromNode.type,
      fromNode.shape,
      (fromNode as any).shapeType,
      toNode.x,
      toNode.y,
      toNode.width,
      toNode.height,
      toNode.type,
      toNode.shape,
      (toNode as any).shapeType,
      edge.fromSide,
      edge.toSide,
      lineStyle,
      edge.routing,
      snapToGrid,
      parallelIndex,
      totalParallel
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
        data-edge-id={edge.id}
        className={`lumina-canvas-edge-group ${isSelected ? 'is-selected' : ''} ${isHovered ? 'is-hovered' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Invisible wider hit area (14px stroke) for easy hover / click / selection */}
        <path
          d={pathD}
          className="lumina-canvas-edge-hitbox"
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            onSelectEdge?.(e, edge.id)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setIsEditingLabel(true)
          }}
        />

        {/* Generous hover retention zone encompassing wire midpoint, label, and controls badge */}
        <rect
          x={midX - 60}
          y={edge.label ? midY - 36 : midY - 22}
          width={120}
          height={edge.label ? 58 : 44}
          rx={12}
          fill="transparent"
          style={{ pointerEvents: (isHovered || isSelected) && !isMultiSelectionActive ? 'all' : 'none' }}
        />

        {/* Rendered SVG connector path with consistent 1.6px stroke and round caps/joins */}
        <path
          d={pathD}
          className={`lumina-canvas-edge-line edge-${targetColor}`}
          fill="none"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerStart={edge.fromEnd === 'arrow' ? `url(#arrow-start-${targetColor})` : undefined}
          markerEnd={edge.toEnd === 'none' ? undefined : `url(#arrow-${targetColor})`}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            onSelectEdge?.(e, edge.id)
          }}
        />

        {/* Opaque Edge Text Label Badge (Never crossed by lines) */}
        {edge.label && !isEditingLabel && (
          <g
            className="lumina-canvas-edge-label-badge"
            transform={`translate(${midX}, ${midY})`}
            onClick={(e) => {
              e.stopPropagation()
              setIsEditingLabel(true)
            }}
          >
            {(() => {
              const halfW = Math.max(18, edge.label.length * 3.4 + 9)
              return (
                <>
                  <rect
                    x={-halfW}
                    y={-9}
                    width={halfW * 2}
                    height={18}
                    rx={9}
                    className={`lumina-canvas-edge-label-bg edge-${targetColor}`}
                  />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    alignmentBaseline="central"
                    className={`lumina-canvas-edge-label-text edge-${targetColor}`}
                  >
                    {edge.label}
                  </text>
                </>
              )
            })()}
          </g>
        )}

        {/* Inline Label Editor */}
        {isEditingLabel && (
          <foreignObject
            x={midX - 55}
            y={midY - 11}
            width={110}
            height={22}
            className="lumina-canvas-edge-label-editor-container"
          >
            <input
              ref={labelInputRef}
              autoFocus
              className="lumina-canvas-edge-label-input"
              defaultValue={edge.label || ''}
              placeholder="Label..."
              onBlur={(e) => {
                if (!isEscapedRef.current) {
                  onUpdateLabel?.(edge.id, e.target.value.trim())
                }
                setIsEditingLabel(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                  e.preventDefault()
                  onUpdateLabel?.(edge.id, e.currentTarget.value.trim())
                  setIsEditingLabel(false)
                } else if (e.key === 'Escape') {
                  e.stopPropagation()
                  e.preventDefault()
                  isEscapedRef.current = true
                  setIsEditingLabel(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </foreignObject>
        )}

        {/* Interactive hover / selection controls badge at wire midpoint (hidden during multi-selection) */}
        {!isEditingLabel && !isMultiSelectionActive && (
          <foreignObject
            x={midX - 48}
            y={edge.label ? midY - 28 : midY - 11}
            width={96}
            height={22}
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
                    <Spline size={10} />
                  ) : lineStyle === 'step' ? (
                    <CornerDownRight size={10} />
                  ) : (
                    <Minus size={10} />
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
                    <ArrowRight size={10} />
                  ) : endpointMode === 'bidirectional' ? (
                    <ArrowLeftRight size={10} />
                  ) : (
                    <Minus size={10} />
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
                  <Tag size={10} />
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
                  <Palette size={10} />
                </button>
              )}

              {/* Delete Edge Button */}
              <button
                type="button"
                className="lumina-canvas-edge-btn delete"
                title="Delete Wire"
                aria-label="Delete Wire"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteEdge(e, edge.id)
                }}
              >
                <X size={10} />
              </button>
            </div>
          </foreignObject>
        )}
      </g>
    )
  },
  (prev, next) => {
    // Re-render when edge attributes, selection, or attached node geometries change
    if (prev.isSelected !== next.isSelected) return false
    if (prev.isMultiSelectionActive !== next.isMultiSelectionActive) return false
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
