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
import { CanvasEdge, CanvasEdgeEnd, CanvasEdgeLineStyle, CanvasEdgeStrokeDash, CanvasNode } from '../../types'
import { calculateEdgePath } from '../../utils/canvasRouting'
import {
  Spline,
  CornerDownRight,
  Minus,
  MoreHorizontal,
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
  onSelectEdge?: (e: React.MouseEvent | React.PointerEvent, edgeId: string) => void
  onDeleteEdge: (e: React.MouseEvent, edgeId: string) => void
  onUpdateLineStyle?: (edgeId: string, lineStyle: CanvasEdgeLineStyle) => void
  onUpdateStrokeDash?: (edgeId: string, strokeDash: CanvasEdgeStrokeDash) => void
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
    onUpdateStrokeDash,
    onCycleColor,
    onUpdateLabel,
    onUpdateEndpoints,
    snapToGrid = false,
    parallelIndex = 0,
    totalParallel = 1
  }) => {
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
      if (!fromNode || !toNode) {
        return { pathD: '', midX: 0, midY: 0 }
      }
      return calculateEdgePath(
        fromNode,
        edge.fromSide,
        toNode,
        edge.toSide,
        lineStyle,
        edge.routing !== 'manual',
        snapToGrid,
        parallelIndex,
        totalParallel
      )
    }, [
      fromNode?.x,
      fromNode?.y,
      fromNode?.width,
      fromNode?.height,
      fromNode?.type,
      fromNode?.shape,
      (fromNode as any)?.shapeType,
      toNode?.x,
      toNode?.y,
      toNode?.width,
      toNode?.height,
      toNode?.type,
      toNode?.shape,
      (toNode as any)?.shapeType,
      edge.fromSide,
      edge.toSide,
      lineStyle,
      edge.routing,
      snapToGrid,
      parallelIndex,
      totalParallel
    ])

    if (!fromNode || !toNode) return null

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
      setIsHovered(true)
      onSelectEdge?.(e, edge.id)
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
      setIsHovered(true)
      onSelectEdge?.(e, edge.id)
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

    const strokeDash: CanvasEdgeStrokeDash = edge.strokeDash || 'solid'
    const strokeDashArray =
      strokeDash === 'dashed' ? '7 5' : strokeDash === 'dotted' ? '2 4' : undefined

    const handleCycleStrokeDash = (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsHovered(true)
      onSelectEdge?.(e, edge.id)
      if (!onUpdateStrokeDash) return
      const nextDash: Record<CanvasEdgeStrokeDash, CanvasEdgeStrokeDash> = {
        solid: 'dashed',
        dashed: 'dotted',
        dotted: 'solid'
      }
      onUpdateStrokeDash(edge.id, nextDash[strokeDash] || 'solid')
    }

    const handleCycleColor = (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsHovered(true)
      onSelectEdge?.(e, edge.id)
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
        {/* Invisible wider hit area (18px stroke) for easy mouse & touch selection */}
        <path
          d={pathD}
          className="lumina-canvas-edge-hitbox"
          fill="none"
          stroke="transparent"
          strokeWidth={18}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelectEdge?.(e, edge.id)
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSelectEdge?.(e, edge.id)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setIsEditingLabel(true)
          }}
        />

        {/* Generous hover retention zone encompassing wire midpoint, label, and controls badge above it */}
        <rect
          x={midX - 68}
          y={edge.label ? midY - 46 : midY - 38}
          width={136}
          height={edge.label ? 66 : 56}
          rx={12}
          fill="transparent"
          style={{ pointerEvents: (isHovered || isSelected) && !isMultiSelectionActive ? 'all' : 'none' }}
        />

        {/* Rendered SVG connector path with crisp 1.8px stroke, optional dash pattern, and round caps/joins */}
        <path
          d={pathD}
          className={`lumina-canvas-edge-line edge-${targetColor}`}
          fill="none"
          strokeWidth={1.8}
          strokeDasharray={strokeDashArray}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerStart={edge.fromEnd === 'arrow' ? `url(#arrow-start-${targetColor})` : undefined}
          markerEnd={edge.toEnd === 'none' ? undefined : `url(#arrow-${targetColor})`}
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelectEdge?.(e, edge.id)
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            onSelectEdge?.(e, edge.id)
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSelectEdge?.(e, edge.id)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setIsEditingLabel(true)
          }}
        />

        {/* Edge Text Label (No background box; crisp paint-order halo for legibility + 1-click rename) */}
        {edge.label && !isEditingLabel && (
          <g
            className="lumina-canvas-edge-label-badge"
            transform={`translate(${midX}, ${midY})`}
            style={{ cursor: 'text', pointerEvents: 'all' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setIsEditingLabel(true)
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setIsEditingLabel(true)
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsEditingLabel(true)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setIsEditingLabel(true)
            }}
          >
            {/* Transparent click target around text so clicking anywhere on the label renames effortlessly */}
            <rect
              x={-Math.max(28, edge.label.length * 4 + 10)}
              y={-12}
              width={Math.max(56, edge.label.length * 8 + 20)}
              height={24}
              fill="transparent"
              stroke="none"
            />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              alignmentBaseline="central"
              className={`lumina-canvas-edge-label-text edge-${targetColor}`}
              style={{
                paintOrder: 'stroke',
                stroke: 'var(--bg-app, #0c0d10)',
                strokeWidth: 4.5,
                strokeLinejoin: 'round'
              }}
            >
              {edge.label}
            </text>
          </g>
        )}

        {/* Inline Label Editor */}
        {isEditingLabel && (
          <foreignObject
            x={midX - 70}
            y={midY - 13}
            width={140}
            height={26}
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
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onUpdateLabel?.(edge.id, e.currentTarget.value.trim())
                  setIsEditingLabel(false)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  isEscapedRef.current = true
                  setIsEditingLabel(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </foreignObject>
        )}

        {/* Interactive hover / selection controls badge positioned cleanly ABOVE the label so it never blocks renaming */}
        {!isEditingLabel && !isMultiSelectionActive && (
          <foreignObject
            x={midX - 58}
            y={edge.label ? midY - 40 : midY - 32}
            width={116}
            height={24}
            className="lumina-canvas-edge-controls-container"
          >
            <div
              className="lumina-canvas-edge-controls"
              onClick={(e) => {
                e.stopPropagation()
                onSelectEdge?.(e, edge.id)
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
                onSelectEdge?.(e, edge.id)
              }}
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

              {/* Dash Pattern Toggle Button (Solid / Dashed / Dotted) */}
              {onUpdateStrokeDash && (
                <button
                  type="button"
                  className="lumina-canvas-edge-btn"
                  title={`Pattern: ${strokeDash.toUpperCase()} (Click to toggle)`}
                  aria-label="Toggle dash pattern"
                  onClick={handleCycleStrokeDash}
                >
                  <MoreHorizontal size={10} />
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
