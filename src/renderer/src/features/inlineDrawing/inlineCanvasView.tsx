import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { InlineNode, InlineShapeType, InlineColor, InlineViewport } from './inlineTypes'
import { INLINE_SHAPES, INLINE_COLORS, renderInlineShapeSVG } from './inlineShapes'

export interface InlineCanvasViewProps {
  nodes: InlineNode[]
  setNodes: React.Dispatch<React.SetStateAction<InlineNode[]>>
  viewport: InlineViewport
  setViewport: React.Dispatch<React.SetStateAction<InlineViewport>>
  onSelectNode?: (nodeId: string | null) => void
}

export const InlineCanvasView: React.FC<InlineCanvasViewProps> = ({
  nodes,
  setNodes,
  viewport,
  setViewport
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, vpX: 0, vpY: 0 })
  const dragNodeRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89
    setViewport((prev) => {
      const nextZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.2), 3.0)
      const nextX = mouseX - (mouseX - prev.x) * (nextZoom / prev.zoom)
      const nextY = mouseY - (mouseY - prev.y) * (nextZoom / prev.zoom)
      return { x: nextX, y: nextY, zoom: nextZoom }
    })
  }

  // Pan canvas background
  const handleMouseDown = (e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('.inline-node-item')) return
    setSelectedId(null)
    setEditingId(null)
    setIsPanning(true)
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      vpX: viewport.x,
      vpY: viewport.y
    }
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setViewport((prev) => ({
        ...prev,
        x: panStartRef.current.vpX + dx,
        y: panStartRef.current.vpY + dy
      }))
      return
    }

    if (dragNodeRef.current) {
      const { id, startX, startY, nodeX, nodeY } = dragNodeRef.current
      const dx = (e.clientX - startX) / viewport.zoom
      const dy = (e.clientY - startY) / viewport.zoom
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, x: Math.round(nodeX + dx), y: Math.round(nodeY + dy) } : n))
      )
    }
  }

  const handleMouseUp = (): void => {
    setIsPanning(false)
    dragNodeRef.current = null
  }

  return (
    <div
      ref={containerRef}
      className={`inline-canvas-surface ${isPanning ? 'is-panning' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        className="inline-canvas-content"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {nodes.map((node) => {
          const isSelected = selectedId === node.id
          const isEditing = editingId === node.id
          const colorHex = INLINE_COLORS.find((c) => c.id === node.color)?.hex || '#38bdf8'

          return (
            <div
              key={node.id}
              className={`inline-node-item ${isSelected ? 'selected' : ''}`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                setSelectedId(node.id)
                dragNodeRef.current = {
                  id: node.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  nodeX: node.x,
                  nodeY: node.y
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditingId(node.id)
              }}
            >
              <svg viewBox="0 0 100 100" className="inline-node-svg-bg">
                {renderInlineShapeSVG(node.shape, colorHex)}
              </svg>

              <div className="inline-node-label-wrap">
                {isEditing ? (
                  <input
                    type="text"
                    className="inline-node-edit-input"
                    defaultValue={node.title}
                    autoFocus
                    onBlur={(e) => {
                      const val = e.target.value
                      setNodes((prev) =>
                        prev.map((n) => (n.id === node.id ? { ...n, title: val } : n))
                      )
                      setEditingId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      }
                    }}
                  />
                ) : (
                  <span className="inline-node-text">{node.title}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
