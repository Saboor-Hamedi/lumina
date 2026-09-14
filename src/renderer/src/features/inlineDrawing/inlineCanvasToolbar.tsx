import React, { useState } from 'react'
import {
  Shapes,
  Copy,
  Download,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Palette,
  Camera
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { INLINE_SHAPES, INLINE_COLORS, renderInlineShapeSVG } from './inlineShapes'
import type { InlineShapeType, InlineColor } from './inlineTypes'

export interface InlineCanvasToolbarProps {
  onAddShape: (shape: InlineShapeType, color: InlineColor) => void
  onCopyImage: () => void
  onDownloadPng: () => void
  onDownloadSvg: () => void
  onClear: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  zoom: number
  onClose: () => void
}

export const InlineCanvasToolbar: React.FC<InlineCanvasToolbarProps> = ({
  onAddShape,
  onCopyImage,
  onDownloadPng,
  onDownloadSvg,
  onClear,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  zoom,
  onClose
}) => {
  const [showShapes, setShowShapes] = useState(false)
  const [selectedColor, setSelectedColor] = useState<InlineColor>('default')
  const [showExport, setShowExport] = useState(false)

  return (
    <div className="inline-canvas-toolbar-floating" onClick={(e) => e.stopPropagation()}>
      <div className="inline-canvas-toolbar-group">
        {/* Shapes Menu */}
        <div style={{ position: 'relative' }}>
          <ToolTip text="Rich Shapes & Diagrams" position="top">
            <button
              type="button"
              className={`inline-toolbar-btn ${showShapes ? 'active' : ''}`}
              onClick={() => {
                setShowShapes((v) => !v)
                setShowExport(false)
              }}
            >
              <Shapes size={14} />
              <span>Shapes</span>
            </button>
          </ToolTip>

          {showShapes && (
            <div className="inline-shapes-flyout">
              <div className="inline-shapes-header">
                <span>Select Shape</span>
                <div className="inline-palette-row">
                  {INLINE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`inline-palette-dot ${selectedColor === c.id ? 'active' : ''}`}
                      style={{ background: c.hex }}
                      onClick={() => setSelectedColor(c.id)}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="inline-shapes-grid">
                {INLINE_SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="inline-shape-card"
                    onClick={() => {
                      onAddShape(s.id, selectedColor)
                      setShowShapes(false)
                    }}
                    title={s.description}
                  >
                    <svg viewBox="0 0 100 100" className="inline-shape-preview-svg">
                      {renderInlineShapeSVG(
                        s.id,
                        INLINE_COLORS.find((c) => c.id === selectedColor)?.hex || '#38bdf8'
                      )}
                    </svg>
                    <span className="inline-shape-title">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="inline-toolbar-sep" />

        {/* Zoom Controls */}
        <ToolTip text="Zoom Out" position="top">
          <button type="button" className="inline-toolbar-btn icon-only" onClick={onZoomOut}>
            <ZoomOut size={13} />
          </button>
        </ToolTip>

        <span className="inline-toolbar-zoom-text">{Math.round(zoom * 100)}%</span>

        <ToolTip text="Zoom In" position="top">
          <button type="button" className="inline-toolbar-btn icon-only" onClick={onZoomIn}>
            <ZoomIn size={13} />
          </button>
        </ToolTip>

        <ToolTip text="Reset View" position="top">
          <button type="button" className="inline-toolbar-btn icon-only" onClick={onResetZoom}>
            <RotateCcw size={13} />
          </button>
        </ToolTip>

        <div className="inline-toolbar-sep" />

        {/* Copy as Image */}
        <ToolTip text="Copy as Image (Clipboard)" position="top">
          <button type="button" className="inline-toolbar-btn" onClick={onCopyImage}>
            <Copy size={13} />
            <span>Copy Image</span>
          </button>
        </ToolTip>

        {/* Export / Save Menu */}
        <div style={{ position: 'relative' }}>
          <ToolTip text="Save & Export" position="top">
            <button
              type="button"
              className={`inline-toolbar-btn ${showExport ? 'active' : ''}`}
              onClick={() => {
                setShowExport((v) => !v)
                setShowShapes(false)
              }}
            >
              <Camera size={13} />
              <span>Export</span>
            </button>
          </ToolTip>

          {showExport && (
            <div className="inline-export-dropdown">
              <button
                type="button"
                className="inline-export-item"
                onClick={() => {
                  setShowExport(false)
                  onDownloadPng()
                }}
              >
                <Download size={13} />
                <span>Download PNG Image</span>
              </button>
              <button
                type="button"
                className="inline-export-item"
                onClick={() => {
                  setShowExport(false)
                  onDownloadSvg()
                }}
              >
                <Download size={13} />
                <span>Export Vector SVG</span>
              </button>
            </div>
          )}
        </div>

        <ToolTip text="Clear Drawing" position="top">
          <button type="button" className="inline-toolbar-btn icon-only danger" onClick={onClear}>
            <Trash2 size={13} />
          </button>
        </ToolTip>

        <div className="inline-toolbar-sep" />

        {/* Close Button */}
        <ToolTip text="Close (Esc)" position="top">
          <button type="button" className="inline-toolbar-btn close-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </ToolTip>
      </div>
    </div>
  )
}
