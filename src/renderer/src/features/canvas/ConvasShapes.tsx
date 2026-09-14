/**
 * ============================================================================
 * Lumina Canvas Shapes (ConvasShapes)
 * ============================================================================
 * Visual shapes palette and interactive flyout menu for diagramming, flowcharting,
 * mind-mapping, and spatial thinking.
 *
 * Supports:
 * - 11 distinct vector geometric shapes
 * - Click-to-add (centered in viewport)
 * - Drag-and-drop onto arbitrary canvas coordinates
 * - Precision SVG rendering with non-scaling strokes and theme-adaptive fills
 * ============================================================================
 */

import React, { useRef, useEffect } from 'react'
import { CanvasShapeType } from './types'

export interface ShapeDefinition {
  id: CanvasShapeType
  label: string
  defaultWidth: number
  defaultHeight: number
  description: string
}

export const CANVAS_SHAPES: ShapeDefinition[] = [
  { id: 'rectangle', label: 'Rectangle', defaultWidth: 160, defaultHeight: 100, description: 'Process / Box' },
  { id: 'rounded-rectangle', label: 'Rounded', defaultWidth: 160, defaultHeight: 100, description: 'Card / State' },
  { id: 'circle', label: 'Circle', defaultWidth: 120, defaultHeight: 120, description: 'Terminal / Event' },
  { id: 'diamond', label: 'Diamond', defaultWidth: 130, defaultHeight: 130, description: 'Decision / Condition' },
  { id: 'triangle', label: 'Triangle', defaultWidth: 130, defaultHeight: 110, description: 'Hierarchy / Alert' },
  { id: 'hexagon', label: 'Hexagon', defaultWidth: 150, defaultHeight: 110, description: 'Module / Preparation' },
  { id: 'cylinder', label: 'Cylinder', defaultWidth: 120, defaultHeight: 130, description: 'Database / Storage' },
  { id: 'cloud', label: 'Cloud', defaultWidth: 160, defaultHeight: 110, description: 'Cloud / External' },
  { id: 'star', label: 'Star', defaultWidth: 120, defaultHeight: 120, description: 'Goal / Priority' },
  { id: 'parallelogram', label: 'Parallel', defaultWidth: 160, defaultHeight: 100, description: 'Input / Output' },
  { id: 'speech-bubble', label: 'Callout', defaultWidth: 150, defaultHeight: 110, description: 'Speech / Comment' }
]

/**
 * Pure SVG vector path renderer for all 11 canvas shapes.
 * ViewBox 0 0 100 100 ensures responsive scaling with non-scaling-stroke.
 */
export function renderShapeSVG(
  shape: CanvasShapeType,
  stroke: string = 'currentColor',
  fill: string = 'currentColor',
  fillOpacity: number = 0.12,
  strokeWidth: number = 1.6
): React.ReactNode {
  switch (shape) {
    case 'rectangle':
      return (
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="3"
          ry="3"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'rounded-rectangle':
      return (
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="18"
          ry="18"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'circle':
      return (
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="46"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'diamond':
      return (
        <polygon
          points="50,4 96,50 50,96 4,50"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'triangle':
      return (
        <polygon
          points="50,5 96,95 4,95"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'hexagon':
      return (
        <polygon
          points="25,4 75,4 96,50 75,96 25,96 4,50"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'cylinder':
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">
          {/* Cylinder Body */}
          <path
            d="M 5 22 L 5 78 C 5 91, 95 91, 95 78 L 95 22 Z"
            fill={fill}
            fillOpacity={fillOpacity}
          />
          {/* Top Cap */}
          <ellipse
            cx="50"
            cy="22"
            rx="45"
            ry="14"
            fill={fill}
            fillOpacity={fillOpacity}
          />
          {/* Bottom Rim */}
          <path
            d="M 5 78 C 5 91, 95 91, 95 78"
            fill="none"
          />
        </g>
      )

    case 'cloud':
      return (
        <path
          d="M 24 74 C 12 74, 5 63, 9 49 C 5 36, 19 23, 33 29 C 41 15, 65 15, 73 29 C 87 24, 96 37, 92 51 C 97 61, 91 74, 77 74 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'star':
      return (
        <polygon
          points="50,4 62,35 96,38 70,60 78,94 50,75 22,94 30,60 4,38 38,35"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'parallelogram':
      return (
        <polygon
          points="22,5 96,5 78,95 4,95"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'speech-bubble':
      return (
        <path
          d="M 12 6 C 6 6, 4 10, 4 17 L 4 66 C 4 73, 10 77, 18 77 L 22 77 L 16 94 L 38 77 L 84 77 C 92 77, 96 73, 96 66 L 96 17 C 96 10, 92 6, 84 6 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    default:
      return (
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="4"
          ry="4"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )
  }
}

export interface ConvasShapesProps {
  isOpen: boolean
  onClose: () => void
  onSelectShape: (shapeType: CanvasShapeType, width: number, height: number) => void
}

export const ConvasShapes: React.FC<ConvasShapesProps> = ({
  isOpen,
  onClose,
  onSelectShape
}) => {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className="lumina-canvas-shapes-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="lumina-canvas-shapes-header">
        <span className="lumina-canvas-shapes-title">Shapes</span>
        <span className="lumina-canvas-shapes-hint">Click or drag</span>
      </div>

      <div className="lumina-canvas-shapes-grid">
        {CANVAS_SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="lumina-canvas-shape-item"
            title={`${s.label} (${s.description}) - Click to insert or drag onto canvas`}
            draggable={true}
            onDragStart={(e) => {
              e.stopPropagation()
              e.dataTransfer.setData(
                'application/lumina-shape',
                JSON.stringify({
                  shapeType: s.id,
                  width: s.defaultWidth,
                  height: s.defaultHeight
                })
              )
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => {
              onSelectShape(s.id, s.defaultWidth, s.defaultHeight)
              onClose()
            }}
          >
            <div className="lumina-canvas-shape-preview">
              <svg
                viewBox="0 0 100 100"
                width="24"
                height="24"
                preserveAspectRatio="none"
              >
                {renderShapeSVG(s.id, 'currentColor', 'currentColor', 0.16, 2)}
              </svg>
            </div>
            <span className="lumina-canvas-shape-label">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ConvasShapes
