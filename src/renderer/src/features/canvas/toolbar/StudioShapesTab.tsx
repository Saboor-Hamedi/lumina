import React, { useState, useCallback } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { CanvasShapeType, CanvasNodeColor } from '../types'
import {
  CANVAS_SHAPES,
  SHAPE_COLOR_OPTIONS,
  renderShapeSVG
} from '../components/controls/ConvasShapes'

export interface StudioShapesTabProps {
  onAddShape?: (
    shapeType: CanvasShapeType,
    width: number,
    height: number,
    color?: CanvasNodeColor
  ) => void
  selectedColor?: CanvasNodeColor
  onUpdateSelectedColor?: (color: CanvasNodeColor) => void
  selectedCount?: number
}

interface ShapeCategoryGroup {
  id: string
  label: string
  badge: number
  shapes: CanvasShapeType[]
}

const SHAPE_CATEGORIES: ShapeCategoryGroup[] = [
  {
    id: 'basic',
    label: 'Basic Geometries',
    badge: 4,
    shapes: ['rectangle', 'rounded-rectangle', 'circle', 'pill']
  },
  {
    id: 'polygons',
    label: 'Polygons & Angles',
    badge: 7,
    shapes: ['diamond', 'triangle', 'hexagon', 'octagon', 'pentagon', 'trapezoid', 'parallelogram']
  },
  {
    id: 'flowchart',
    label: 'Flowchart & Data',
    badge: 5,
    shapes: ['cylinder', 'document', 'step', 'cross', 'cloud']
  },
  {
    id: 'symbols',
    label: 'Symbols & Badges',
    badge: 6,
    shapes: ['speech-bubble', 'star', 'shield', 'heart', 'actor', 'envelope']
  }
]

export const StudioShapesTab: React.FC<StudioShapesTabProps> = React.memo(
  ({ onAddShape, selectedColor, onUpdateSelectedColor, selectedCount = 0 }) => {
    const [activeColor, setActiveColor] = useState<CanvasNodeColor>(
      selectedColor || 'default'
    )

    // Accordion state for draw.io-style category dropdowns
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
      basic: true,
      polygons: true,
      flowchart: true,
      symbols: true
    })

    // Automatically sync activeColor with currently selected node's color
    React.useEffect(() => {
      if (selectedColor) {
        setActiveColor(selectedColor)
      }
    }, [selectedColor])

    const handleColorClick = useCallback(
      (colorId: CanvasNodeColor) => {
        setActiveColor(colorId)
        onUpdateSelectedColor?.(colorId)
      },
      [onUpdateSelectedColor]
    )

    const toggleCategory = useCallback((catId: string) => {
      setOpenCategories((prev) => ({
        ...prev,
        [catId]: !prev[catId]
      }))
    }, [])

    const activeColorHex =
      SHAPE_COLOR_OPTIONS.find((c) => c.id === activeColor)?.hex || '#38bdf8'

    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">
            {selectedCount > 0 ? 'Theme & Shapes' : 'Geometric Shapes'}
          </span>
          <span className="banner-sub">
            {selectedCount > 0
              ? `Apply theme to ${selectedCount > 1 ? `${selectedCount} selected items` : 'selected item'}`
              : 'Click or drag directly into your diagram'}
          </span>
        </div>

        {/* Feature 1: Theme Color Swatch Panels (Select Option Removed) */}
        <div className="lumina-canvas-studio-card-box">
          <div className="studio-field-header">
            <span className="studio-field-label">Theme Color</span>
            {selectedCount > 0 && (
              <span className="studio-field-sub">Recolors selection</span>
            )}
          </div>

          {/* Quick Swatches Row - Robust color panel matching AccentColor.jsx (no border, no shadow) */}
          <div className="lumina-canvas-studio-colors-row">
            {SHAPE_COLOR_OPTIONS.map((c) => {
              const isSelected = activeColor === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`lumina-canvas-studio-color-dot ${isSelected ? 'selected' : ''}`}
                  style={{
                    backgroundColor: c.hex,
                    border: 'none',
                    boxShadow: 'none',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  onClick={() => handleColorClick(c.id)}
                  title={`${c.label}${selectedCount > 0 ? ' (Apply to selection)' : ''}`}
                  aria-label={`Color ${c.label}`}
                >
                  {isSelected && (
                    <span
                      style={{
                        width: '11px',
                        height: '11px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Check size={7} color="#ffffff" strokeWidth={3.5} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Feature 2: draw.io style Collapsible Category Dropdowns with Dropdown Icon */}
        <div className="lumina-canvas-studio-categories-list">
          {SHAPE_CATEGORIES.map((cat) => {
            const isOpen = !!openCategories[cat.id]
            const shapesInCat = CANVAS_SHAPES.filter((s) => cat.shapes.includes(s.id))

            return (
              <div key={cat.id} className="lumina-canvas-studio-category-section">
                <button
                  type="button"
                  className={`lumina-canvas-studio-category-header ${isOpen ? 'open' : ''}`}
                  onClick={() => toggleCategory(cat.id)}
                  aria-expanded={isOpen}
                >
                  <div className="lumina-canvas-studio-category-header-left">
                    <ChevronDown
                      size={13}
                      className={`lumina-canvas-studio-category-caret ${isOpen ? 'rotate' : ''}`}
                    />
                    <span className="lumina-canvas-studio-category-title">{cat.label}</span>
                  </div>
                  <span className="lumina-canvas-studio-category-badge">{cat.badge}</span>
                </button>

                {isOpen && (
                  <div className="lumina-canvas-studio-shapes-grid">
                    {shapesInCat.map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        className="lumina-canvas-studio-shape-card"
                        onClick={() => {
                          if (onAddShape) {
                            onAddShape(shape.id, shape.defaultWidth, shape.defaultHeight, activeColor)
                          }
                        }}
                        draggable
                        onDragStart={(e) => {
                          const shapePayload = JSON.stringify({
                            shapeType: shape.id,
                            width: shape.defaultWidth,
                            height: shape.defaultHeight,
                            color: activeColor
                          })
                          e.dataTransfer.setData('application/lumina-shape', shapePayload)
                          e.dataTransfer.setData('application/lumina-shape-meta', shapePayload)
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        title={`Click to add ${shape.label} or drag directly to canvas`}
                      >
                        <div className="shape-preview-svg" style={{ color: activeColorHex }}>
                          <svg viewBox="0 0 100 100" width="100%" height="100%">
                            {renderShapeSVG(shape.id, activeColorHex, activeColorHex, 0.08, 1.35)}
                          </svg>
                        </div>
                        <span className="shape-label">{shape.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)

StudioShapesTab.displayName = 'StudioShapesTab'
export default StudioShapesTab
