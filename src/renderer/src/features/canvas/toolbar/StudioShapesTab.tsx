import React, { useState, useMemo, useCallback } from 'react'
import { Search, X, Layers, Palette, PlusCircle } from 'lucide-react'
import { CanvasShapeType, CanvasNodeColor } from '../types'
import { CANVAS_SHAPES, SHAPE_COLOR_OPTIONS, renderShapeSVG } from '../components/controls/ConvasShapes'
import { StudioDropdown, StudioDropdownOption } from './StudioDropdown'

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

type ShapeCategory = 'all' | 'basic' | 'polygons' | 'flowchart' | 'symbols'

const CATEGORY_MAP: Record<ShapeCategory, CanvasShapeType[]> = {
  all: CANVAS_SHAPES.map((s) => s.id),
  basic: ['rectangle', 'rounded-rectangle', 'circle', 'pill'],
  polygons: ['diamond', 'triangle', 'hexagon', 'octagon', 'pentagon', 'trapezoid', 'parallelogram'],
  flowchart: ['cylinder', 'document', 'step', 'cross', 'cloud'],
  symbols: ['speech-bubble', 'star', 'shield', 'heart', 'actor', 'envelope']
}

const CATEGORY_OPTIONS: StudioDropdownOption<ShapeCategory>[] = [
  { id: 'all', label: 'All Shapes', badge: '22', description: 'Complete vector geometry library' },
  { id: 'basic', label: 'Basic Geometries', badge: '4', description: 'Boxes, cards, circles, pills' },
  { id: 'polygons', label: 'Polygons & Angles', badge: '7', description: 'Diamonds, triangles, polygons' },
  { id: 'flowchart', label: 'Flowchart & Data', badge: '5', description: 'Databases, steps, documents' },
  { id: 'symbols', label: 'Symbols & Badges', badge: '6', description: 'Callouts, stars, shields, actors' }
]

export const StudioShapesTab: React.FC<StudioShapesTabProps> = React.memo(
  ({ onAddShape, selectedColor, onUpdateSelectedColor, selectedCount = 0 }) => {
    const [activeColor, setActiveColor] = useState<CanvasNodeColor>(
      selectedColor || 'default'
    )
    const [shapeCategory, setShapeCategory] = useState<ShapeCategory>('all')
    const [shapeSearch, setShapeSearch] = useState('')

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

    // Build color dropdown options
    const colorDropdownOptions = useMemo<StudioDropdownOption<CanvasNodeColor>[]>(() => {
      return SHAPE_COLOR_OPTIONS.map((c) => ({
        id: c.id,
        label: c.label,
        colorHex: c.hex,
        description: c.hex
      }))
    }, [])

    // Build quick insert shape dropdown options
    const shapeDropdownOptions = useMemo<StudioDropdownOption<string>[]>(() => {
      const activeHex = SHAPE_COLOR_OPTIONS.find((c) => c.id === activeColor)?.hex || '#38bdf8'
      return CANVAS_SHAPES.map((s) => ({
        id: s.id,
        label: s.label,
        description: s.description,
        icon: (
          <span style={{ display: 'inline-flex', width: 15, height: 15, color: activeHex }}>
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              {renderShapeSVG(s.id, activeHex, activeHex, 0.08, 1.3)}
            </svg>
          </span>
        )
      }))
    }, [activeColor])

    const filteredShapes = useMemo(() => {
      const allowed = new Set(CATEGORY_MAP[shapeCategory] || CATEGORY_MAP.all)
      let list = CANVAS_SHAPES.filter((s) => allowed.has(s.id))

      if (shapeSearch.trim()) {
        const q = shapeSearch.toLowerCase()
        list = list.filter(
          (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        )
      }
      return list
    }, [shapeCategory, shapeSearch])

    const handleQuickInsert = useCallback(
      (shapeId: string) => {
        const s = CANVAS_SHAPES.find((item) => item.id === shapeId)
        if (s && onAddShape) {
          onAddShape(s.id, s.defaultWidth, s.defaultHeight, activeColor)
        }
      },
      [onAddShape, activeColor]
    )

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

        {/* Feature 1: Theme Color Dropdown & Swatches */}
        <div className="lumina-canvas-studio-card-box">
          <StudioDropdown<CanvasNodeColor>
            label="Theme Color"
            description={selectedCount > 0 ? 'Recolors selection' : 'Default color'}
            value={activeColor}
            options={colorDropdownOptions}
            onChange={handleColorClick}
          />

          {/* Quick Swatches Row */}
          <div className="lumina-canvas-studio-colors-row" style={{ marginTop: 4 }}>
            {SHAPE_COLOR_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`lumina-canvas-studio-color-dot ${activeColor === c.id ? 'active' : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => handleColorClick(c.id)}
                title={`${c.label}${selectedCount > 0 ? ' (Apply to selection)' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Feature 2: Quick Insert Shape Dropdown */}
        <div className="lumina-canvas-studio-card-box">
          <StudioDropdown<string>
            label="Quick Insert Shape"
            description="Select to place"
            value=""
            placeholder="Choose shape to insert..."
            options={shapeDropdownOptions}
            onChange={handleQuickInsert}
          />
        </div>

        {/* Feature 3: Category Filter Dropdown */}
        <div className="lumina-canvas-studio-card-box">
          <StudioDropdown<ShapeCategory>
            label="Shape Category"
            value={shapeCategory}
            options={CATEGORY_OPTIONS}
            onChange={setShapeCategory}
          />

          {/* Search Input with Clear Button & Icon */}
          <div className="lumina-canvas-studio-input-wrap" style={{ marginTop: 6 }}>
            <Search size={13} className="lumina-canvas-studio-search-icon" />
            <input
              type="text"
              className="lumina-canvas-studio-search"
              placeholder={`Search ${filteredShapes.length} shapes...`}
              value={shapeSearch}
              onChange={(e) => setShapeSearch(e.target.value)}
            />
            {shapeSearch && (
              <button
                type="button"
                className="lumina-canvas-studio-search-clear"
                onClick={() => setShapeSearch('')}
                title="Clear search"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Shapes Grid (Never hidden under input) */}
        <div className="lumina-canvas-studio-shapes-grid full-pane">
          {filteredShapes.map((shape) => {
            const colorHex =
              SHAPE_COLOR_OPTIONS.find((c) => c.id === activeColor)?.hex || '#38bdf8'

            return (
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
                <div className="shape-preview-svg" style={{ color: colorHex }}>
                  <svg viewBox="0 0 100 100" width="100%" height="100%">
                    {renderShapeSVG(shape.id, colorHex, colorHex, 0.08, 1.35)}
                  </svg>
                </div>
                <span className="shape-label">{shape.label}</span>
              </button>
            )
          })}

          {filteredShapes.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '24px 8px',
                textAlign: 'center',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: 11
              }}
            >
              No shapes matching &ldquo;{shapeSearch}&rdquo;
            </div>
          )}
        </div>
      </div>
    )
  }
)

StudioShapesTab.displayName = 'StudioShapesTab'
export default StudioShapesTab
