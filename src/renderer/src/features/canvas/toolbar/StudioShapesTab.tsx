import React, { useState, useCallback, useMemo } from 'react'
import { ChevronDown, Check, Search, X } from 'lucide-react'
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
    badge: 5,
    shapes: ['rectangle', 'rounded-rectangle', 'circle', 'pill', 'frame']
  },
  {
    id: 'flowchart',
    label: 'Flowchart & Process',
    badge: 10,
    shapes: ['diamond', 'parallelogram', 'predefined-process', 'delay', 'manual-input', 'document', 'step', 'arrow-right', 'arrow-left', 'note-fold']
  },
  {
    id: 'architecture',
    label: 'System & Architecture',
    badge: 6,
    shapes: ['cylinder', 'queue', 'cube', 'server', 'browser', 'terminal']
  },
  {
    id: 'polygons',
    label: 'Polygons & Angles',
    badge: 6,
    shapes: ['triangle', 'hexagon', 'octagon', 'pentagon', 'trapezoid', 'cross']
  },
  {
    id: 'symbols',
    label: 'Symbols & Badges',
    badge: 7,
    shapes: ['cloud', 'speech-bubble', 'star', 'shield', 'heart', 'actor', 'envelope']
  }
]

export const StudioShapesTab: React.FC<StudioShapesTabProps> = React.memo(
  ({ onAddShape, selectedColor, onUpdateSelectedColor, selectedCount = 0 }) => {
    const [activeColor, setActiveColor] = useState<CanvasNodeColor>(
      selectedColor || 'default'
    )
    const [searchQuery, setSearchQuery] = useState('')

    const normalizedQuery = searchQuery.trim().toLowerCase()
    const filteredShapes = useMemo(() => {
      if (!normalizedQuery) return null
      return CANVAS_SHAPES.filter(
        (s) =>
          s.label.toLowerCase().includes(normalizedQuery) ||
          s.description.toLowerCase().includes(normalizedQuery) ||
          s.id.toLowerCase().includes(normalizedQuery)
      )
    }, [normalizedQuery])

    // Accordion state for draw.io-style category dropdowns
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
      basic: true,
      flowchart: true,
      architecture: true,
      polygons: true,
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
        {/* Live Shape Search */}
        <div className="lumina-canvas-studio-search">
          <Search size={12} className="studio-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${CANVAS_SHAPES.length} shapes...`}
            className="studio-search-input"
            aria-label="Search shapes"
          />
          {searchQuery && (
            <button
              type="button"
              className="studio-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Clean Color Swatch Bar */}
        <div className="lumina-canvas-studio-card-box compact">
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
                    <span className="lumina-canvas-studio-color-selected-indicator">
                      <Check size={7} color="#ffffff" strokeWidth={3.5} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Search results or Collapsible Category Dropdowns */}
        {filteredShapes ? (
          <div className="lumina-canvas-studio-shapes-grid">
            {filteredShapes.length === 0 ? (
              <div className="studio-search-empty">No matching shapes</div>
            ) : (
              filteredShapes.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  className="lumina-canvas-studio-shape-card"
                  onClick={() => onAddShape?.(shape.id, shape.defaultWidth, shape.defaultHeight, activeColor)}
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
                  title={`${shape.label} — ${shape.description}`}
                >
                  <div className="shape-preview-svg" style={{ color: activeColorHex }}>
                    <svg viewBox="0 0 100 100" width="100%" height="100%">
                      {renderShapeSVG(shape.id, activeColorHex, activeColorHex, 0.08, 1.5)}
                    </svg>
                  </div>
                  <span className="shape-label">{shape.label}</span>
                </button>
              ))
            )}
          </div>
        ) : (
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
                            {renderShapeSVG(shape.id, activeColorHex, activeColorHex, 0.08, 1.5)}
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
        )}
      </div>
    )
  }
)

StudioShapesTab.displayName = 'StudioShapesTab'
export default StudioShapesTab
