/**
 * ============================================================================
 * Lumina Canvas Center Toolbar (ConvasToolBarCenter)
 * ============================================================================
 * Floating bottom-center toolbar dock housing primary interaction controls:
 * - Mouse cursor / select tool (V)
 * - Hand / pan canvas tool (H / Space)
 * - Freehand Pencil & Highlighter tool (P) + color/width sub-bar
 * - Eraser tool (E) + Clear Ink action
 * - Quick Text tool (T)
 * - Quick sticky note creation
 * - Shapes & diagramming menu (34 draw.io shapes)
 * - Undo / Redo & Clear Canvas (fully undoable)
 * ============================================================================
 */

import React, { useState } from 'react'
import {
  MousePointer,
  Hand,
  Pencil,
  Eraser,
  Type,
  StickyNote,
  Shapes,
  ChevronDown,
  Undo2,
  Redo2,
  Trash2,
  Highlighter
} from 'lucide-react'
import ToolTip from '../../../../components/atoms/ToolTip'
import { CanvasShapeType, CanvasNodeColor, CanvasToolMode } from '../../types'
import ConvasShapes, { SHAPE_COLOR_OPTIONS } from './ConvasShapes'

export interface ConvasToolBarCenterProps {
  toolMode: CanvasToolMode
  setToolMode: (mode: CanvasToolMode) => void
  onAddSticky: () => void
  onAddShape?: (shapeType: CanvasShapeType, width: number, height: number, color?: CanvasNodeColor) => void
  pencilColor?: CanvasNodeColor
  onChangePencilColor?: (color: CanvasNodeColor) => void
  pencilWidth?: number
  onChangePencilWidth?: (width: number) => void
  pencilHighlighter?: boolean
  onTogglePencilHighlighter?: () => void
  onUndo?: () => void
  canUndo?: boolean
  onRedo?: () => void
  canRedo?: boolean
  onClearStrokes?: () => void
  hasStrokes?: boolean
  onClearCanvas?: () => void
  hasContent?: boolean
}

const STROKE_WIDTH_PRESETS = [
  { label: 'Fine', value: 2, dot: 4 },
  { label: 'Medium', value: 4, dot: 7 },
  { label: 'Bold', value: 7, dot: 10 }
]

export const ConvasToolBarCenter: React.FC<ConvasToolBarCenterProps> = React.memo(
  ({
    toolMode,
    setToolMode,
    onAddSticky,
    onAddShape,
    pencilColor = 'default',
    onChangePencilColor,
    pencilWidth = 4,
    onChangePencilWidth,
    pencilHighlighter = false,
    onTogglePencilHighlighter,
    onUndo,
    canUndo = false,
    onRedo,
    canRedo = false,
    onClearStrokes,
    hasStrokes = false,
    onClearCanvas,
    hasContent = false
  }) => {
    const [isShapesOpen, setIsShapesOpen] = useState(false)
    const showDrawBar = toolMode === 'pencil' || toolMode === 'eraser'

    return (
      <div
        className="lumina-canvas-center-dock-wrap"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Contextual Floating Sub-Bar for Pencil / Highlighter / Eraser */}
        {showDrawBar && (
          <div className="lumina-canvas-pencil-bar" role="toolbar" aria-label="Drawing options">
            {toolMode === 'pencil' && (
              <>
                <div className="lumina-canvas-pencil-colors">
                  {SHAPE_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`lumina-canvas-pencil-dot ${pencilColor === c.id ? 'active' : ''}`}
                      style={{ backgroundColor: c.hex }}
                      title={`Ink color: ${c.label}`}
                      aria-label={`Ink color: ${c.label}`}
                      onClick={() => onChangePencilColor?.(c.id)}
                    />
                  ))}
                </div>

                <div className="lumina-canvas-divider" />

                <div className="lumina-canvas-pencil-widths">
                  {STROKE_WIDTH_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`lumina-canvas-tool-btn ${!pencilHighlighter && pencilWidth === preset.value ? 'active' : ''}`}
                      title={`${preset.label} stroke (${preset.value}px)`}
                      aria-label={`${preset.label} stroke`}
                      onClick={() => {
                        if (pencilHighlighter) onTogglePencilHighlighter?.()
                        onChangePencilWidth?.(preset.value)
                      }}
                    >
                      <span
                        className="lumina-canvas-width-dot"
                        style={{ width: preset.dot, height: preset.dot }}
                      />
                    </button>
                  ))}

                  <ToolTip text="Highlighter Mode" position="top">
                    <button
                      type="button"
                      className={`lumina-canvas-tool-btn ${pencilHighlighter ? 'active' : ''}`}
                      onClick={() => onTogglePencilHighlighter?.()}
                      aria-label="Highlighter Mode"
                    >
                      <Highlighter size={12} />
                    </button>
                  </ToolTip>
                </div>
              </>
            )}

            {toolMode === 'eraser' && (
              <span className="lumina-canvas-eraser-hint">
                Drag across strokes to erase
              </span>
            )}

            {hasStrokes && onClearStrokes && (
              <>
                <div className="lumina-canvas-divider" />
                <button
                  type="button"
                  className="lumina-canvas-pencil-clear-btn"
                  onClick={onClearStrokes}
                  title="Clear all freehand drawings (Ctrl+Z to undo)"
                >
                  Clear ink
                </button>
              </>
            )}
          </div>
        )}

        <div className="lumina-canvas-toolbar lumina-canvas-toolbar-center">
          {/* Tool Mode: Select (Mouse Cursor) */}
          <ToolTip text="Select Tool (V)" position="top">
            <button
              type="button"
              className={`lumina-canvas-tool-btn ${toolMode === 'select' ? 'active' : ''}`}
              onClick={() => setToolMode('select')}
              aria-label="Select Tool (V)"
            >
              <MousePointer size={13} />
            </button>
          </ToolTip>

          {/* Tool Mode: Hand / Pan */}
          <ToolTip text="Hand / Pan Tool (H or hold Space)" position="top">
            <button
              type="button"
              className={`lumina-canvas-tool-btn ${toolMode === 'hand' ? 'active' : ''}`}
              onClick={() => setToolMode('hand')}
              aria-label="Hand / Pan Tool (H or hold Space)"
            >
              <Hand size={13} />
            </button>
          </ToolTip>

          <div className="lumina-canvas-divider" />

          {/* Tool Mode: Freehand Pencil */}
          <ToolTip text="Pencil Draw (P)" position="top">
            <button
              type="button"
              className={`lumina-canvas-tool-btn ${toolMode === 'pencil' ? 'active' : ''}`}
              onClick={() => setToolMode(toolMode === 'pencil' ? 'select' : 'pencil')}
              aria-label="Pencil Draw (P)"
            >
              <Pencil size={13} />
            </button>
          </ToolTip>

          {/* Tool Mode: Stroke Eraser */}
          <ToolTip text="Eraser (E)" position="top">
            <button
              type="button"
              className={`lumina-canvas-tool-btn ${toolMode === 'eraser' ? 'active' : ''}`}
              onClick={() => setToolMode(toolMode === 'eraser' ? 'select' : 'eraser')}
              aria-label="Eraser (E)"
            >
              <Eraser size={13} />
            </button>
          </ToolTip>

          {/* Tool Mode: Text */}
          <ToolTip text="Text Box (T)" position="top">
            <button
              type="button"
              className={`lumina-canvas-tool-btn ${toolMode === 'text' ? 'active' : ''}`}
              onClick={() => setToolMode(toolMode === 'text' ? 'select' : 'text')}
              aria-label="Text Box (T)"
            >
              <Type size={13} />
            </button>
          </ToolTip>

          <div className="lumina-canvas-divider" />

          {/* Quick Sticky Note Creator */}
          <ToolTip text="Add Sticky Note" position="top">
            <button
              type="button"
              className="lumina-canvas-tool-btn"
              onClick={onAddSticky}
              aria-label="Add Sticky Note"
            >
              <StickyNote size={14} />
            </button>
          </ToolTip>

          {/* Shapes Menu Tool in Center Dock */}
          {onAddShape && (
            <div style={{ position: 'relative' }}>
              <ToolTip text="Shapes & Diagrams" position="top">
                <button
                  type="button"
                  className={`lumina-canvas-tool-btn has-dropdown ${isShapesOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsShapesOpen((prev) => !prev)
                  }}
                  aria-label="Shapes & Diagrams"
                >
                  <Shapes size={13} />
                  <ChevronDown size={9} className="lumina-canvas-dropdown-caret" />
                </button>
              </ToolTip>

              <ConvasShapes
                isOpen={isShapesOpen}
                position="top"
                onClose={() => setIsShapesOpen(false)}
                onSelectShape={(shapeType, w, h, color) => {
                  onAddShape(shapeType, w, h, color)
                }}
              />
            </div>
          )}

          {/* Undo / Redo / Clear Canvas */}
          {(onUndo || onRedo || onClearCanvas) && (
            <>
              <div className="lumina-canvas-divider" />

              {onUndo && (
                <ToolTip text="Undo (Ctrl+Z)" position="top">
                  <button
                    type="button"
                    className="lumina-canvas-tool-btn"
                    onClick={onUndo}
                    disabled={!canUndo}
                    aria-label="Undo"
                  >
                    <Undo2 size={13} />
                  </button>
                </ToolTip>
              )}

              {onRedo && (
                <ToolTip text="Redo (Ctrl+Y)" position="top">
                  <button
                    type="button"
                    className="lumina-canvas-tool-btn"
                    onClick={onRedo}
                    disabled={!canRedo}
                    aria-label="Redo"
                  >
                    <Redo2 size={13} />
                  </button>
                </ToolTip>
              )}

              {onClearCanvas && (
                <ToolTip text="Clear Canvas (Undoable)" position="top">
                  <button
                    type="button"
                    className="lumina-canvas-tool-btn danger"
                    onClick={onClearCanvas}
                    disabled={!hasContent}
                    aria-label="Clear Canvas"
                  >
                    <Trash2 size={13} />
                  </button>
                </ToolTip>
              )}
            </>
          )}
        </div>
      </div>
    )
  }
)

ConvasToolBarCenter.displayName = 'ConvasToolBarCenter'

export default ConvasToolBarCenter
