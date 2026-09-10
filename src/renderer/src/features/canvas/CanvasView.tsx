import React, { useRef, useCallback, useEffect, useState } from 'react'
import {
  Plus,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Palette,
  X,
  MousePointer,
  Hand,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react'
import { useCanvas } from './useCanvas'
import { CanvasData, CanvasNode, CanvasNodeColor, CanvasEdge } from './types'
import { useVaultStore } from '../../core/store/workspaceStore'
import ToolTip from '../../components/atoms/ToolTip'
import './canvas.css'

export interface CanvasViewProps {
  initialData?: CanvasData
  onChange?: (data: CanvasData) => void
}

const COLOR_CYCLE: CanvasNodeColor[] = [
  'default',
  'yellow',
  'purple',
  'cyan',
  'green',
  'orange',
  'red'
]

export const CanvasView: React.FC<CanvasViewProps> = ({ initialData, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'title' | 'text' | null>(null)
  const [toolMode, setToolMode] = useState<'select' | 'hand'>('select')
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanningState, setIsPanningState] = useState(false)

  const isPanningRef = useRef(false)
  const panPrevRef = useRef({ x: 0, y: 0 })
  const draggingNodeRef = useRef<{
    id: string
    startX: number
    startY: number
    initialX: number
    initialY: number
  } | null>(null)

  const {
    nodes,
    edges,
    viewport,
    selectedNodeIds,
    setSelectedNodeIds,
    screenToCanvas,
    zoomAt,
    resetViewport,
    panBy,
    addNode,
    updateNodePosition,
    updateNodeText,
    updateNodeTitle,
    updateNodeColor,
    deleteNode,
    deleteSelected
  } = useCanvas({ initialData, onChange })

  // Keyboard shortcut listener (Spacebar pan, Delete, Escape, Zoom reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase()
      const isInputActive = activeTag === 'input' || activeTag === 'textarea'

      if (e.code === 'Space' && !isInputActive && !e.repeat) {
        setIsSpacePressed(true)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          deleteSelected()
        }
      } else if (e.key === 'Escape') {
        setEditingNodeId(null)
        setEditingField(null)
        setSelectedNodeIds([])
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0' && !isInputActive) {
        e.preventDefault()
        resetViewport()
      } else if (e.key === 'v' && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setToolMode('select')
      } else if (e.key === 'h' && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setToolMode('hand')
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedNodeIds, deleteSelected, setSelectedNodeIds, resetViewport])

  // Global window pointermove and pointerup listeners for continuous panning and node dragging
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - panPrevRef.current.x
        const dy = e.clientY - panPrevRef.current.y
        panPrevRef.current = { x: e.clientX, y: e.clientY }
        panBy(dx, dy)
      } else if (draggingNodeRef.current) {
        const currentZoom = viewport.zoom || 1
        const dx = (e.clientX - draggingNodeRef.current.startX) / currentZoom
        const dy = (e.clientY - draggingNodeRef.current.startY) / currentZoom
        updateNodePosition(
          draggingNodeRef.current.id,
          draggingNodeRef.current.initialX + dx,
          draggingNodeRef.current.initialY + dy
        )
      }
    }

    const handleGlobalPointerUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false
        setIsPanningState(false)
      }
      if (draggingNodeRef.current) {
        draggingNodeRef.current = null
      }
    }

    window.addEventListener('pointermove', handleGlobalPointerMove)
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove)
      window.removeEventListener('pointerup', handleGlobalPointerUp)
    }
  }, [viewport.zoom, panBy, updateNodePosition])

  // Wheel zoom and infinite trackpad pan
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!containerRef.current) return
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = -e.deltaY * 0.0015
        zoomAt(zoomDelta, e.clientX, e.clientY, containerRef.current.getBoundingClientRect())
      } else {
        panBy(-e.deltaX, -e.deltaY)
      }
    },
    [zoomAt, panBy]
  )

  // Mouse pan initiation on container or background
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      const isNodeOrToolbar = target.closest('.lumina-canvas-node, .lumina-canvas-toolbar')

      // Pan if: hand mode active, space pressed, middle click (button 1), or clicking canvas background
      if (toolMode === 'hand' || isSpacePressed || e.button === 1 || (!isNodeOrToolbar && e.button === 0)) {
        e.preventDefault()
        isPanningRef.current = true
        setIsPanningState(true)
        panPrevRef.current = { x: e.clientX, y: e.clientY }
        if (!isNodeOrToolbar) {
          setSelectedNodeIds([])
          setEditingNodeId(null)
        }
      }
    },
    [toolMode, isSpacePressed, setSelectedNodeIds]
  )

  // Dragging individual node card
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      // In hand mode or when holding space, background pan takes precedence
      if (toolMode === 'hand' || isSpacePressed) return
      if (e.button !== 0 || !containerRef.current) return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('button')) {
        return
      }

      e.stopPropagation()
      draggingNodeRef.current = {
        id: node.id,
        startX: e.clientX,
        startY: e.clientY,
        initialX: node.x,
        initialY: node.y
      }
      setSelectedNodeIds([node.id])
    },
    [toolMode, isSpacePressed, setSelectedNodeIds]
  )

  // Double click background creates new sticky note at mouse location
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      const target = e.target as HTMLElement
      if (target.closest('.lumina-canvas-node, .lumina-canvas-toolbar')) return

      const rect = containerRef.current.getBoundingClientRect()
      const pt = screenToCanvas(e.clientX, e.clientY, rect)
      const newNode = addNode({
        type: 'text',
        title: 'Note',
        text: 'Type your thoughts here...',
        x: Math.round(pt.x - 120),
        y: Math.round(pt.y - 60),
        width: 240,
        height: 150,
        color: 'yellow'
      })
      setEditingNodeId(newNode.id)
      setEditingField('text')
    },
    [screenToCanvas, addNode]
  )

  // Dropping files or notes from FileExplorer via custom event
  useEffect(() => {
    const handleDroppedExplorerItem = (e: Event) => {
      const customEvent = e as CustomEvent
      const detail = customEvent.detail || (e as any).data || {}
      const { snippets, clientX = 0, clientY = 0 } = detail
      if (!containerRef.current || !Array.isArray(snippets) || snippets.length === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const hasDimensions = rect.width > 0 && rect.height > 0
      const isInside =
        !hasDimensions ||
        (clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom)

      if (isInside) {
        const pt = screenToCanvas(clientX, clientY, rect)
        snippets.forEach((snippet: any, idx: number) => {
          const offset = idx * 24
          const isImage =
            snippet.type === 'image' ||
            /\.(png|jpe?g|svg|webp|gif|bmp|ico)$/i.test(snippet.fileName || '')

          if (isImage) {
            const relPath =
              snippet.relativePath ||
              (snippet.folderId ? `${snippet.folderId}/${snippet.fileName}` : snippet.fileName)
            const clean = String(relPath || '').replace(/^[/\\]+/, '').replace(/\\/g, '/')
            const encoded = clean.split('/').map(encodeURIComponent).join('/')
            const assetUrl = `asset://local/${encoded}`

            addNode({
              type: 'image',
              title: snippet.title || snippet.fileName || 'Image',
              url: assetUrl,
              file: snippet.id,
              x: Math.round(pt.x + offset - 160),
              y: Math.round(pt.y + offset - 120),
              width: 320,
              height: 240,
              color: 'cyan'
            })
          } else {
            const textContent = snippet.content || snippet.code || ''
            addNode({
              type: 'note',
              title: snippet.title || snippet.fileName || 'Note',
              text: textContent,
              file: snippet.id,
              x: Math.round(pt.x + offset - 140),
              y: Math.round(pt.y + offset - 100),
              width: 280,
              height: 200,
              color: 'yellow'
            })
          }
        })
      }
    }

    window.addEventListener('lumina:canvas-drop-item', handleDroppedExplorerItem as EventListener)
    return () => {
      window.removeEventListener('lumina:canvas-drop-item', handleDroppedExplorerItem as EventListener)
    }
  }, [screenToCanvas, addNode])

  // Native HTML5 Drag and Drop for external files & images from Desktop / Explorer
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pt = screenToCanvas(e.clientX, e.clientY, rect)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        files.forEach((file, idx) => {
          const offset = idx * 24
          const isImg =
            file.type.startsWith('image/') ||
            /\.(png|jpe?g|svg|webp|gif|bmp|ico)$/i.test(file.name)

          if (isImg) {
            const filePath = (file as any).path
            const url = filePath
              ? `file://${filePath.replace(/\\/g, '/')}`
              : URL.createObjectURL(file)
            addNode({
              type: 'image',
              title: file.name,
              url,
              x: Math.round(pt.x + offset - 160),
              y: Math.round(pt.y + offset - 120),
              width: 320,
              height: 240,
              color: 'cyan'
            })
          } else {
            const reader = new FileReader()
            reader.onload = (re) => {
              addNode({
                type: 'text',
                title: file.name,
                text: (re.target?.result as string) || '',
                x: Math.round(pt.x + offset - 130),
                y: Math.round(pt.y + offset - 90),
                width: 260,
                height: 180,
                color: 'default'
              })
            }
            reader.readAsText(file)
          }
        })
      } else {
        const text = e.dataTransfer.getData('text/plain')
        if (text) {
          const isUrl = /^https?:\/\//i.test(text.trim())
          addNode({
            type: isUrl ? 'link' : 'text',
            title: isUrl ? 'Link' : 'Note',
            text,
            url: isUrl ? text.trim() : undefined,
            x: Math.round(pt.x - 130),
            y: Math.round(pt.y - 80),
            width: 260,
            height: 160,
            color: 'purple'
          })
        }
      }
    },
    [screenToCanvas, addNode]
  )

  const handleAddSticky = () => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const center = screenToCanvas(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      rect
    )
    const newNode = addNode({
      type: 'text',
      title: 'Quick Idea',
      text: 'Start typing thoughts here...',
      x: Math.round(center.x - 120),
      y: Math.round(center.y - 75),
      width: 240,
      height: 150,
      color: 'yellow'
    })
    setEditingNodeId(newNode.id)
    setEditingField('text')
  }

  const handleCycleColor = (e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation()
    const currentColor = node.color || 'default'
    const currentIndex = COLOR_CYCLE.indexOf(currentColor)
    const nextColor = COLOR_CYCLE[(currentIndex + 1) % COLOR_CYCLE.length]
    updateNodeColor(node.id, nextColor)
  }

  // Calculate SVG connector curve between two nodes
  const renderEdge = (edge: CanvasEdge) => {
    const from = nodes.find((n) => n.id === edge.fromNode)
    const to = nodes.find((n) => n.id === edge.toNode)
    if (!from || !to) return null

    const startX = from.x + from.width
    const startY = from.y + from.height / 2
    const endX = to.x
    const endY = to.y + to.height / 2

    const dx = Math.abs(endX - startX) * 0.5
    const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`

    return (
      <g key={edge.id} className="lumina-canvas-edge-group">
        <path d={pathD} className="lumina-canvas-edge-line" />
      </g>
    )
  }

  const cursorStyle = isPanningState
    ? 'grabbing'
    : toolMode === 'hand' || isSpacePressed
      ? 'grab'
      : 'default'

  return (
    <div
      ref={containerRef}
      className="lumina-canvas-container"
      style={{
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
        cursor: cursorStyle
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Infinite Transform Viewport */}
      <div
        className="lumina-canvas-viewport"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`
        }}
      >
        {/* SVG Edges Layer */}
        {edges.length > 0 && (
          <svg className="lumina-canvas-edges-layer">
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--text-accent, #38bdf8)" />
              </marker>
            </defs>
            {edges.map(renderEdge)}
          </svg>
        )}

        {/* Render Node Cards */}
        {nodes.map((node) => {
          const isSelected = selectedNodeIds.includes(node.id)
          const nodeColorClass = node.color ? `color-${node.color}` : 'color-default'

          return (
            <div
              key={node.id}
              className={`lumina-canvas-node ${nodeColorClass} ${isSelected ? 'selected' : ''}`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
            >
              {/* Card Header */}
              <div className="lumina-canvas-node-header">
                {editingNodeId === node.id && editingField === 'title' ? (
                  <input
                    autoFocus
                    className="lumina-canvas-title-input"
                    defaultValue={node.title || ''}
                    onBlur={(e) => {
                      updateNodeTitle(node.id, e.target.value.trim() || 'Untitled')
                      setEditingField(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateNodeTitle(node.id, e.currentTarget.value.trim() || 'Untitled')
                        setEditingField(null)
                      }
                      if (e.key === 'Escape') setEditingField(null)
                    }}
                  />
                ) : (
                  <span
                    className="lumina-canvas-node-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditingNodeId(node.id)
                      setEditingField('title')
                    }}
                    title="Double-click to edit title"
                  >
                    {node.title || (node.type === 'image' ? 'Image' : 'Note Card')}
                  </span>
                )}

                <div className="lumina-canvas-node-actions">
                  {/* Open note/image in tab if linked */}
                  {node.file && (
                    <ToolTip text="Open in Tab" position="top">
                      <button
                        className="lumina-canvas-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          useVaultStore.getState().setActiveTabId(node.file!)
                        }}
                      >
                        <ExternalLink size={12} />
                      </button>
                    </ToolTip>
                  )}

                  <ToolTip text="Change Color" position="top">
                    <button
                      className="lumina-canvas-action-btn"
                      onClick={(e) => handleCycleColor(e, node)}
                    >
                      <Palette size={12} />
                    </button>
                  </ToolTip>

                  <ToolTip text="Delete Node" position="top">
                    <button
                      className="lumina-canvas-action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNode(node.id)
                      }}
                    >
                      <X size={12} />
                    </button>
                  </ToolTip>
                </div>
              </div>

              {/* Card Body: Text or Image */}
              {node.type === 'image' && node.url ? (
                <div className="lumina-canvas-node-image-wrap">
                  <img src={node.url} alt={node.title || 'Canvas Image'} />
                </div>
              ) : (
                <div
                  className="lumina-canvas-node-body"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditingNodeId(node.id)
                    setEditingField('text')
                  }}
                >
                  {editingNodeId === node.id && editingField === 'text' ? (
                    <textarea
                      autoFocus
                      className="lumina-canvas-text-area"
                      defaultValue={node.text || ''}
                      onBlur={(e) => {
                        updateNodeText(node.id, e.target.value)
                        setEditingField(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          updateNodeText(node.id, e.currentTarget.value)
                          setEditingField(null)
                        }
                        if (e.key === 'Escape') setEditingField(null)
                      }}
                    />
                  ) : (
                    <p className="lumina-canvas-node-text">
                      {node.text || <span className="placeholder">Double-click to type...</span>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Floating Canvas Toolbar */}
      <div className="lumina-canvas-toolbar">
        {/* Tool Mode Toggles: Select vs Hand (Pan) */}
        <ToolTip text="Select Tool (V)" position="top">
          <button
            className={`lumina-canvas-tool-btn ${toolMode === 'select' ? 'active' : ''}`}
            onClick={() => setToolMode('select')}
          >
            <MousePointer size={15} />
          </button>
        </ToolTip>

        <ToolTip text="Hand / Pan Tool (H or hold Space)" position="top">
          <button
            className={`lumina-canvas-tool-btn ${toolMode === 'hand' ? 'active' : ''}`}
            onClick={() => setToolMode('hand')}
          >
            <Hand size={15} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider" />

        <ToolTip text="Add Sticky Note" position="top">
          <button className="lumina-canvas-tool-btn" onClick={handleAddSticky}>
            <StickyNote size={16} />
          </button>
        </ToolTip>

        <ToolTip text="Delete Selected (Del)" position="top">
          <button
            className="lumina-canvas-tool-btn"
            onClick={deleteSelected}
            disabled={selectedNodeIds.length === 0}
          >
            <Trash2 size={16} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider" />

        <ToolTip text="Zoom In (Ctrl + Scroll)" position="top">
          <button
            className="lumina-canvas-tool-btn"
            onClick={() => {
              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                zoomAt(0.15, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
              }
            }}
          >
            <ZoomIn size={16} />
          </button>
        </ToolTip>

        <span className="lumina-canvas-zoom-label">
          {Math.round(viewport.zoom * 100)}%
        </span>

        <ToolTip text="Zoom Out" position="top">
          <button
            className="lumina-canvas-tool-btn"
            onClick={() => {
              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                zoomAt(-0.15, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
              }
            }}
          >
            <ZoomOut size={16} />
          </button>
        </ToolTip>

        <ToolTip text="Reset View (Ctrl+0)" position="top">
          <button className="lumina-canvas-tool-btn" onClick={resetViewport}>
            <RotateCcw size={14} />
          </button>
        </ToolTip>
      </div>
    </div>
  )
}

export default CanvasView
