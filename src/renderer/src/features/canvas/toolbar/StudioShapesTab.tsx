import React, { useState, useMemo } from 'react'
import { CanvasShapeType, CanvasNodeColor } from '../types'
import { CANVAS_SHAPES, SHAPE_COLOR_OPTIONS, renderShapeSVG } from '../ConvasShapes'

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

export const StudioShapesTab: React.FC<StudioShapesTabProps> = React.memo(
  ({ onAddShape, selectedColor, onUpdateSelectedColor, selectedCount = 0 }) => {
    const [activeColor, setActiveColor] = useState<CanvasNodeColor>(
      selectedColor || 'default'
    )
    const [shapeSearch, setShapeSearch] = useState('')

    // Automatically sync activeColor with currently selected node's color
    React.useEffect(() => {
      if (selectedColor) {
        setActiveColor(selectedColor)
      }
    }, [selectedColor])

    const handleColorClick = (colorId: CanvasNodeColor) => {
      setActiveColor(colorId)
      onUpdateSelectedColor?.(colorId)
    }

    const filteredShapes = useMemo(() => {
      if (!shapeSearch.trim()) return CANVAS_SHAPES
      const q = shapeSearch.toLowerCase()
      return CANVAS_SHAPES.filter(
        (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      )
    }, [shapeSearch])

    return (
      <div className="lumina-canvas-studio-tab-pane">
        <div className="studio-section-banner">
          <span className="banner-title">
            {selectedCount > 0 ? 'Theme & Shapes' : 'Geometric Shapes'}
          </span>
          <span className="banner-sub">
            {selectedCount > 0
              ? `Select a theme to color ${selectedCount > 1 ? `${selectedCount} selected items` : 'selected item'}`
              : 'Click or drag directly into your diagram'}
          </span>
        </div>

        {/* Color Swatches */}
        <div className="lumina-canvas-studio-colors-row">
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

      {/* Shapes Search */}
      <div className="lumina-canvas-studio-input-wrap">
        <input
          type="text"
          className="lumina-canvas-studio-search"
          placeholder="Search 22 shapes..."
          value={shapeSearch}
          onChange={(e) => setShapeSearch(e.target.value)}
        />
      </div>

      {/* Shapes Grid */}
      <div className="lumina-canvas-studio-shapes-grid full-pane">
        {filteredShapes.map((shape) => {
          const colorHex =
            SHAPE_COLOR_OPTIONS.find((c) => c.id === activeColor)?.hex || 'currentColor'

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
                e.dataTransfer.setData('application/lumina-shape', shape.id)
                e.dataTransfer.setData(
                  'application/lumina-shape-meta',
                  JSON.stringify({
                    id: shape.id,
                    width: shape.defaultWidth,
                    height: shape.defaultHeight,
                    color: activeColor
                  })
                )
                e.dataTransfer.effectAllowed = 'copy'
              }}
              title={`Click to add ${shape.label} or drag directly to canvas`}
            >
              <div className="shape-preview-svg" style={{ color: colorHex }}>
                {renderShapeSVG(shape.id, colorHex, colorHex, 0.08, 1.4)}
              </div>
              <span className="shape-label">{shape.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})

StudioShapesTab.displayName = 'StudioShapesTab'
export default StudioShapesTab
