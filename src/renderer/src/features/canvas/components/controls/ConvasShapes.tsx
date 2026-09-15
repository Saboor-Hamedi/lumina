/**
 * ============================================================================
 * Lumina Canvas Shapes (ConvasShapes)
 * ============================================================================
 * Visual shapes palette and interactive flyout menu for diagramming, flowcharting,
 * mind-mapping, and spatial thinking.
 *
 * Supports:
 * - 16 distinct lightweight vector geometric shapes
 * - Interactive color palette picker right inside the menu
 * - Click-to-add (centered in viewport)
 * - Drag-and-drop onto arbitrary canvas coordinates
 * - Precision SVG rendering with non-scaling strokes and airy translucent fills
 * - Full scroll and pointer isolation so canvas never intercepts menu interaction
 * ============================================================================
 */

import React, { useRef, useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { CanvasShapeType, CanvasNodeColor } from '../../types'

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
  { id: 'speech-bubble', label: 'Callout', defaultWidth: 150, defaultHeight: 110, description: 'Speech / Comment' },
  { id: 'pill', label: 'Capsule', defaultWidth: 150, defaultHeight: 80, description: 'State / Terminal' },
  { id: 'document', label: 'Document', defaultWidth: 140, defaultHeight: 110, description: 'File / Report' },
  { id: 'step', label: 'Step Arrow', defaultWidth: 150, defaultHeight: 90, description: 'Process / Next' },
  { id: 'shield', label: 'Shield', defaultWidth: 130, defaultHeight: 130, description: 'Security / Protect' },
  { id: 'heart', label: 'Heart', defaultWidth: 130, defaultHeight: 120, description: 'Favorite / Priority' },
  { id: 'octagon', label: 'Octagon', defaultWidth: 130, defaultHeight: 130, description: 'Stop / Critical / Halt' },
  { id: 'trapezoid', label: 'Trapezoid', defaultWidth: 160, defaultHeight: 100, description: 'Manual / Operation' },
  { id: 'cross', label: 'Cross', defaultWidth: 130, defaultHeight: 130, description: 'Plus / Health / Critical' },
  { id: 'pentagon', label: 'Pentagon', defaultWidth: 140, defaultHeight: 130, description: 'Milestone / Stage' },
  { id: 'actor', label: 'Actor', defaultWidth: 120, defaultHeight: 150, description: 'User / Person / Client' },
  { id: 'envelope', label: 'Envelope', defaultWidth: 150, defaultHeight: 100, description: 'Message / Event / Mail' }
]

export const SHAPE_COLOR_OPTIONS: { id: CanvasNodeColor; label: string; hex: string }[] = [
  { id: 'default', label: 'Default Accent', hex: '#38bdf8' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'red', label: 'Red', hex: '#ef4444' }
]

/**
 * Pure SVG vector path renderer for all 16 canvas shapes.
 * ViewBox 0 0 100 100 ensures responsive scaling with non-scaling-stroke.
 * Designed with modern lightweight architectural line weights and soft fills.
 */
export function renderShapeSVG(
  shape: CanvasShapeType,
  stroke: string = 'currentColor',
  fill: string = 'currentColor',
  fillOpacity: number = 0.04,
  strokeWidth: number = 1.25
): React.ReactNode {
  switch (shape) {
    case 'rectangle':
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

    case 'rounded-rectangle':
      return (
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="16"
          ry="16"
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
          points="50,6 95,94 5,94"
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
            d="M 6 22 L 6 78 C 6 90, 94 90, 94 78 L 94 22 Z"
            fill={fill}
            fillOpacity={fillOpacity}
          />
          {/* Top Cap */}
          <ellipse
            cx="50"
            cy="22"
            rx="44"
            ry="14"
            fill={fill}
            fillOpacity={fillOpacity}
          />
          {/* Bottom Rim Arc */}
          <path
            d="M 6 78 C 6 90, 94 90, 94 78"
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

    case 'pill':
      return (
        <rect
          x="4"
          y="12"
          width="92"
          height="76"
          rx="38"
          ry="38"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'document':
      return (
        <path
          d="M 6 6 L 94 6 L 94 80 C 72 72, 50 94, 6 82 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'step':
      return (
        <polygon
          points="4,6 74,6 96,50 74,94 4,94 22,50"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'shield':
      return (
        <path
          d="M 50 4 L 92 18 L 92 56 C 92 78, 50 96, 50 96 C 50 96, 8 78, 8 56 L 8 18 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'heart':
      return (
        <path
          d="M 50 88 C 22 62, 6 44, 6 26 C 6 12, 16 4, 30 4 C 39 4, 46 9, 50 16 C 54 9, 61 4, 70 4 C 84 4, 94 12, 94 26 C 94 44, 78 62, 50 88 Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'octagon':
      return (
        <polygon
          points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'trapezoid':
      return (
        <polygon
          points="20,6 80,6 96,94 4,94"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'cross':
      return (
        <polygon
          points="35,4 65,4 65,35 96,35 96,65 65,65 65,96 35,96 35,65 4,65 4,35 35,35"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'pentagon':
      return (
        <polygon
          points="50,4 96,38 78,94 22,94 4,38"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )

    case 'actor':
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
          {/* Head */}
          <circle cx="50" cy="20" r="14" fill={fill} fillOpacity={fillOpacity} />
          {/* Spine */}
          <line x1="50" y1="34" x2="50" y2="68" />
          {/* Arms */}
          <line x1="16" y1="46" x2="84" y2="46" />
          {/* Left Leg */}
          <line x1="50" y1="68" x2="24" y2="95" />
          {/* Right Leg */}
          <line x1="50" y1="68" x2="76" y2="95" />
        </g>
      )

    case 'envelope':
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <rect x="4" y="14" width="92" height="72" rx="6" ry="6" fill={fill} fillOpacity={fillOpacity} />
          {/* Flap fold lines */}
          <path d="M 6 18 L 50 56 L 94 18" fill="none" />
          <path d="M 6 82 L 38 48" fill="none" opacity={0.6} />
          <path d="M 94 82 L 62 48" fill="none" opacity={0.6} />
        </g>
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
  position?: 'left' | 'top'
  onClose: () => void
  onSelectShape: (shapeType: CanvasShapeType, width: number, height: number, color?: CanvasNodeColor) => void
}

export const ConvasShapes: React.FC<ConvasShapesProps> = ({
  isOpen,
  position = 'left',
  onClose,
  onSelectShape
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const [selectedColor, setSelectedColor] = useState<CanvasNodeColor>('default')
  const isDraggingRef = useRef(false)

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
      // Don't close if currently in a drag operation
      if (isDraggingRef.current) return
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

  const activeColorObj = SHAPE_COLOR_OPTIONS.find((c) => c.id === selectedColor)
  const activeColorHex = activeColorObj ? activeColorObj.hex : 'var(--text-accent, #38bdf8)'

  return (
    <div
      ref={panelRef}
      className={`lumina-canvas-shapes-menu pos-${position}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="lumina-canvas-shapes-header">
        <span className="lumina-canvas-shapes-title">Shapes</span>
        <span className="lumina-canvas-shapes-hint">Click or drag</span>
      </div>

      {/* Color Selection Palette Row inside Shapes Panel */}
      <div className="lumina-canvas-shapes-color-row" title="Pick Shape Color">
        <div className="lumina-canvas-shapes-color-label">
          <Palette size={11} />
          <span>Color</span>
        </div>
        <div className="lumina-canvas-shapes-colors">
          {SHAPE_COLOR_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`lumina-canvas-shape-color-dot ${selectedColor === c.id ? 'active' : ''}`}
              style={{ backgroundColor: c.hex }}
              title={`Color: ${c.label}`}
              aria-label={`Color: ${c.label}`}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedColor(c.id)
              }}
            />
          ))}
        </div>
      </div>

      <div
        className="lumina-canvas-shapes-grid"
        onWheel={(e) => e.stopPropagation()}
      >
        {CANVAS_SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="lumina-canvas-shape-item"
            title={`${s.label} (${s.description}) - Click to insert or drag onto canvas`}
            draggable={true}
            onDragStart={(e) => {
              e.stopPropagation()
              isDraggingRef.current = true
              e.dataTransfer.setData(
                'application/lumina-shape',
                JSON.stringify({
                  shapeType: s.id,
                  width: s.defaultWidth,
                  height: s.defaultHeight,
                  color: selectedColor
                })
              )
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onDragEnd={() => {
              isDraggingRef.current = false
              onClose()
            }}
            onClick={() => {
              onSelectShape(s.id, s.defaultWidth, s.defaultHeight, selectedColor)
              onClose()
            }}
          >
            <div className="lumina-canvas-shape-preview">
              <svg
                viewBox="0 0 100 100"
                width="22"
                height="22"
                preserveAspectRatio="none"
              >
                {renderShapeSVG(s.id, activeColorHex, activeColorHex, 0.08, 1.25)}
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
