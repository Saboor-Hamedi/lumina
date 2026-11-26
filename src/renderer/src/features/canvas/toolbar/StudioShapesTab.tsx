import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search, X } from 'lucide-react'
import { CanvasShapeType, CanvasNodeColor } from '../types'
import {
  CANVAS_SHAPES,
  SHAPE_COLOR_OPTIONS,
  renderShapeSVG,
  type ShapeDefinition
} from '../components/controls/CanvasShapes'

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

    // Pointer-based drag-from-sidebar onto Canvas (portaled to document.body + GPU translate3d at 120Hz)
    const [draggingShape, setDraggingShape] = useState<{
      shape: ShapeDefinition
      x: number
      y: number
    } | null>(null)
    const ghostRef = useRef<HTMLDivElement | null>(null)
    const suppressNextClickRef = useRef(false)
    const dragSessionRef = useRef<{
      shape: ShapeDefinition
      startX: number
      startY: number
      isDragging: boolean
    } | null>(null)

    useEffect(() => {
      const onPointerMove = (e: PointerEvent) => {
        const session = dragSessionRef.current
        if (!session) return
        const dist = Math.hypot(e.clientX - session.startX, e.clientY - session.startY)
        if (!session.isDragging && dist > 5) {
          session.isDragging = true
          setDraggingShape({ shape: session.shape, x: e.clientX, y: e.clientY })
        }
        if (session.isDragging && ghostRef.current) {
          ghostRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`
        }
      }

      const onPointerUp = (e: PointerEvent) => {
        const session = dragSessionRef.current
        if (!session) return
        dragSessionRef.current = null
        if (session.isDragging) {
          suppressNextClickRef.current = true
          setTimeout(() => {
            suppressNextClickRef.current = false
          }, 120)
          setDraggingShape(null)
          window.dispatchEvent(
            new CustomEvent('lumina:canvas-drop-shape', {
              detail: {
                shapeType: session.shape.id,
                width: session.shape.defaultWidth,
                height: session.shape.defaultHeight,
                color: activeColor,
                clientX: e.clientX,
                clientY: e.clientY
              }
            })
          )
        }
      }

      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
      return () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
      }
    }, [activeColor])

    const handleShapePointerDown = useCallback((e: React.PointerEvent, shape: ShapeDefinition) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      e.preventDefault()
      dragSessionRef.current = {
        shape,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false
      }
    }, [])

    const handleShapeClick = useCallback(
      (shape: ShapeDefinition) => {
        if (suppressNextClickRef.current) return
        onAddShape?.(shape.id, shape.defaultWidth, shape.defaultHeight, activeColor)
      },
      [onAddShape, activeColor]
    )

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
                  onPointerDown={(e) => handleShapePointerDown(e, shape)}
                  onClick={() => handleShapeClick(shape)}
                  draggable={false}
                  title={`Drag onto canvas or click to add ${shape.label}`}
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
                        onPointerDown={(e) => handleShapePointerDown(e, shape)}
                        onClick={() => handleShapeClick(shape)}
                        draggable={false}
                        title={`Drag onto canvas or click to add ${shape.label}`}
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

        {/* Smooth Floating Ghost Preview portaled directly to document.body at 120Hz */}
        {draggingShape &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={ghostRef}
              className="lumina-canvas-shape-drag-ghost"
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                transform: `translate3d(${draggingShape.x}px, ${draggingShape.y}px, 0) translate(-50%, -50%)`,
                width: Math.min(130, Math.max(72, draggingShape.shape.defaultWidth * 0.75)),
                height: Math.min(100, Math.max(56, draggingShape.shape.defaultHeight * 0.75)),
                pointerEvents: 'none',
                zIndex: 999999,
                opacity: 0.92,
                willChange: 'transform',
                filter: 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.36))'
              }}
            >
              <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
                {renderShapeSVG(draggingShape.shape.id, activeColorHex, activeColorHex, 0.18, 2.2)}
              </svg>
            </div>,
            document.body
          )}
      </div>
    )
  }
)

StudioShapesTab.displayName = 'StudioShapesTab'
export default StudioShapesTab
