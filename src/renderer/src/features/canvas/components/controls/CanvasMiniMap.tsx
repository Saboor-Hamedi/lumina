/**
 * ============================================================================
 * Lumina Canvas Mini-Map Navigator (CanvasMiniMap.tsx)
 * ============================================================================
 * Interactive bird's-eye spatial navigator for the infinite canvas:
 * - Real-time spatial preview of all canvas nodes, sticky notes, and shapes.
 * - Dynamic viewport rectangle showing current camera position and zoom area.
 * - Click-to-pan & interactive drag navigation across extensive diagrams.
 * - Supports embedded 'footer-card' variant for studio sidebar footer
 *   and collapsible card dropdown without disturbing the canvas workspace.
 * ============================================================================
 */

import React, { useMemo, useRef, useCallback } from 'react'
import { CanvasNode, CanvasViewport } from '../../types'
import { CANVAS_NODE_COLOR_HEX } from '../../utils/canvasUtils'
import { ChevronDown, ChevronUp, MapPin, Compass } from 'lucide-react'

export interface CanvasMiniMapProps {
  nodes: CanvasNode[]
  viewport: CanvasViewport
  containerRect: { width: number; height: number } | null
  onPanTo: (canvasCenterX: number, canvasCenterY: number) => void
  isOpen: boolean
  onToggleOpen: () => void
  variant?: 'footer-card' | 'floating'
  className?: string
}

export const CanvasMiniMap: React.FC<CanvasMiniMapProps> = React.memo(
  ({
    nodes,
    viewport,
    containerRect,
    onPanTo,
    isOpen,
    onToggleOpen,
    variant = 'footer-card',
    className = ''
  }) => {
    const mapRef = useRef<SVGSVGElement>(null)
    const isDraggingRef = useRef(false)

    // Dynamic resolution based on variant
    const MAP_WIDTH = variant === 'footer-card' ? 260 : 180
    const MAP_HEIGHT = variant === 'footer-card' ? 125 : 120
    const MAP_PADDING = 300 // Virtual margin around nodes in canvas space

    // Compute bounding box encompassing all nodes + current viewport
    const bounds = useMemo(() => {
      const containerW = containerRect?.width || 800
      const containerH = containerRect?.height || 600

      // Viewport bounds in canvas coordinates
      const vpLeft = -viewport.x / viewport.zoom
      const vpTop = -viewport.y / viewport.zoom
      const vpRight = vpLeft + containerW / viewport.zoom
      const vpBottom = vpTop + containerH / viewport.zoom

      let minX = vpLeft
      let minY = vpTop
      let maxX = vpRight
      let maxY = vpBottom

      for (const node of nodes) {
        minX = Math.min(minX, node.x)
        minY = Math.min(minY, node.y)
        maxX = Math.max(maxX, node.x + (node.width || 140))
        maxY = Math.max(maxY, node.y + (node.height || 100))
      }

      minX -= MAP_PADDING
      minY -= MAP_PADDING
      maxX += MAP_PADDING
      maxY += MAP_PADDING

      const totalW = Math.max(maxX - minX, 1000)
      const totalH = Math.max(maxY - minY, 700)

      return {
        minX,
        minY,
        maxX,
        maxY,
        totalW,
        totalH,
        scaleX: MAP_WIDTH / totalW,
        scaleY: MAP_HEIGHT / totalH,
        scale: Math.min(MAP_WIDTH / totalW, MAP_HEIGHT / totalH),
        vpLeft,
        vpTop,
        vpWidth: containerW / viewport.zoom,
        vpHeight: containerH / viewport.zoom
      }
    }, [nodes, viewport, containerRect, MAP_WIDTH, MAP_HEIGHT])

    /**
     * Converts mini-map click coordinates to canvas center and triggers pan.
     */
    const handleMapPointer = useCallback(
      (clientX: number, clientY: number) => {
        if (!mapRef.current) return
        const rect = mapRef.current.getBoundingClientRect()
        const clickMapX = Math.max(0, Math.min(clientX - rect.left, rect.width))
        const clickMapY = Math.max(0, Math.min(clientY - rect.top, rect.height))

        const normX = clickMapX / rect.width
        const normY = clickMapY / rect.height

        const targetCanvasX = bounds.minX + normX * bounds.totalW
        const targetCanvasY = bounds.minY + normY * bounds.totalH

        onPanTo(targetCanvasX, targetCanvasY)
      },
      [bounds, onPanTo]
    )

    const handlePointerDown = (e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      isDraggingRef.current = true
      ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
      handleMapPointer(e.clientX, e.clientY)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return
      e.stopPropagation()
      e.preventDefault()
      handleMapPointer(e.clientX, e.clientY)
    }

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      ;(e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId)
    }

    // Viewport box coordinates mapped onto mini-map
    const vpBoxX = (bounds.vpLeft - bounds.minX) * bounds.scaleX
    const vpBoxY = (bounds.vpTop - bounds.minY) * bounds.scaleY
    const vpBoxW = bounds.vpWidth * bounds.scaleX
    const vpBoxH = bounds.vpHeight * bounds.scaleY

    const isFooter = variant === 'footer-card'

    return (
      <div
        className={`lumina-canvas-minimap ${isFooter ? 'card-footer-variant' : 'floating-variant'} ${
          isOpen ? 'is-open' : 'is-collapsed'
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="lumina-canvas-minimap-header" onClick={onToggleOpen}>
          <div className="lumina-canvas-minimap-title">
            <MapPin size={12} className="lumina-canvas-minimap-icon" />
            <span>Overview</span>
            <span className="lumina-canvas-minimap-badge">
              {nodes.length} {nodes.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            type="button"
            className="lumina-canvas-minimap-toggle"
            aria-label={isOpen ? 'Collapse Mini-Map' : 'Expand Mini-Map'}
          >
            {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>

        {isOpen && (
          <div className="lumina-canvas-minimap-body">
            <svg
              ref={mapRef}
              className="lumina-canvas-minimap-svg"
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* Nodes preview */}
              {nodes.map((node) => {
                const nx = (node.x - bounds.minX) * bounds.scaleX
                const ny = (node.y - bounds.minY) * bounds.scaleY
                const nw = Math.max((node.width || 140) * bounds.scaleX, 3)
                const nh = Math.max((node.height || 100) * bounds.scaleY, 2.5)
                const colorHex = CANVAS_NODE_COLOR_HEX[node.color || 'default'] || '#38bdf8'

                return (
                  <rect
                    key={node.id}
                    x={nx}
                    y={ny}
                    width={nw}
                    height={nh}
                    rx={1.5}
                    ry={1.5}
                    fill={colorHex}
                    opacity={0.75}
                  />
                )
              })}

              {/* Viewport indicator camera box */}
              <rect
                x={vpBoxX}
                y={vpBoxY}
                width={vpBoxW}
                height={vpBoxH}
                fill="rgba(56, 189, 248, 0.12)"
                stroke="var(--text-accent, #38bdf8)"
                strokeWidth="1.3"
                strokeDasharray="3 2"
                rx={2}
                ry={2}
                className="lumina-canvas-minimap-viewport"
              />
            </svg>

            {/* Helper footer bar for quick navigation */}
            {isFooter && (
              <div className="lumina-canvas-minimap-subbar">
                <button
                  type="button"
                  className="lumina-canvas-minimap-quick-btn"
                  onClick={() => onPanTo(0, 0)}
                  title="Pan camera to origin (0, 0)"
                >
                  <Compass size={11} />
                  <span>Center (0,0)</span>
                </button>
                <span className="lumina-canvas-minimap-zoom-tag">
                  {Math.round(viewport.zoom * 100)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

CanvasMiniMap.displayName = 'CanvasMiniMap'
export default CanvasMiniMap
