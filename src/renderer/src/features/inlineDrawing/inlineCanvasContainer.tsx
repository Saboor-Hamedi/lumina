import React, { useState, useEffect, useCallback } from 'react'
import { InlineCanvasToolbar } from './inlineCanvasToolbar'
import { InlineCanvasView } from './inlineCanvasView'
import type { InlineNode, InlineShapeType, InlineColor, InlineViewport } from './inlineTypes'
import { INLINE_SHAPES } from './inlineShapes'
import { copyInlineAsImage, downloadInlinePng, downloadInlineSvg } from './inlineDrawingExport'
import './css/inlineDrawing.css'

export interface InlineCanvasContainerProps {
  isOpen: boolean
  onClose: () => void
}

const STORAGE_KEY = 'lumina_inline_drawing_nodes'

export const InlineCanvasContainer: React.FC<InlineCanvasContainerProps> = ({ isOpen, onClose }) => {
  const [nodes, setNodes] = useState<InlineNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return [
      {
        id: 'init-1',
        shape: 'rounded-rectangle',
        x: 180,
        y: 120,
        width: 160,
        height: 100,
        color: 'default',
        title: 'Start Drawing'
      },
      {
        id: 'init-2',
        shape: 'cloud',
        x: 420,
        y: 110,
        width: 170,
        height: 110,
        color: 'purple',
        title: 'Idea Space'
      }
    ]
  })

  const [viewport, setViewport] = useState<InlineViewport>({ x: 0, y: 0, zoom: 1 })

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
    } catch {}
  }, [nodes])

  // Handle Ctrl+Shift+/ or Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose])

  const handleAddShape = (shapeType: InlineShapeType, color: InlineColor) => {
    const def = INLINE_SHAPES.find((s) => s.id === shapeType)
    const w = def?.defaultWidth || 150
    const h = def?.defaultHeight || 90

    // Place near center of viewport
    const centerX = Math.round((-viewport.x + window.innerWidth / 2) / viewport.zoom - w / 2)
    const centerY = Math.round((-viewport.y + (window.innerHeight - 150) / 2) / viewport.zoom - h / 2)

    const newNode: InlineNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      shape: shapeType,
      x: centerX,
      y: centerY,
      width: w,
      height: h,
      color,
      title: def?.label || 'Shape'
    }

    setNodes((prev) => [...prev, newNode])
  }

  const handleCopyImage = async () => {
    const success = await copyInlineAsImage(nodes)
    if (success) {
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: { message: 'Drawing copied as Image to clipboard', type: 'success' }
        })
      )
    } else {
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: { message: 'Failed to copy image', type: 'error' }
        })
      )
    }
  }

  const handleDownloadPng = async () => {
    await downloadInlinePng(nodes, `drawing-${Date.now()}.png`)
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: { message: 'Exported drawing to PNG', type: 'success' }
      })
    )
  }

  const handleDownloadSvg = () => {
    downloadInlineSvg(nodes, `drawing-${Date.now()}.svg`)
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: { message: 'Exported drawing to SVG', type: 'success' }
      })
    )
  }

  const handleClear = () => {
    setNodes([])
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: { message: 'Drawing cleared', type: 'info' }
      })
    )
  }

  const handleZoomIn = () => setViewport((v) => ({ ...v, zoom: Math.min(v.zoom * 1.2, 3.0) }))
  const handleZoomOut = () => setViewport((v) => ({ ...v, zoom: Math.max(v.zoom * 0.8, 0.2) }))
  const handleResetZoom = () => setViewport({ x: 0, y: 0, zoom: 1 })

  if (!isOpen) return null

  return (
    <div className="inline-canvas-overlay" onClick={onClose}>
      <div
        className="inline-canvas-container"
        onClick={(e) => e.stopPropagation()}
      >
        <InlineCanvasToolbar
          onAddShape={handleAddShape}
          onCopyImage={handleCopyImage}
          onDownloadPng={handleDownloadPng}
          onDownloadSvg={handleDownloadSvg}
          onClear={handleClear}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          zoom={viewport.zoom}
          onClose={onClose}
        />

        <InlineCanvasView
          nodes={nodes}
          setNodes={setNodes}
          viewport={viewport}
          setViewport={setViewport}
        />
      </div>
    </div>
  )
}

export default InlineCanvasContainer
