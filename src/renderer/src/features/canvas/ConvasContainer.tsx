/**
 * ============================================================================
 * Lumina Infinite Spatial Canvas Container (ConvasContainer.tsx)
 * ============================================================================
 * Main canvas component for visual thinking, research diagramming, mind-mapping,
 * and media organization.
 *
 * Modular Architecture:
 * - State Management: `useCanvas.ts`
 * - Pointer & Gesture Physics: `useCanvasGestures.ts`
 * - External & Explorer Drops: `useCanvasDrop.ts`
 * - SVG Connections Layer: `CanvasEdgesLayer.tsx`
 * - Cards & Shapes Layer: `CanvasNodesLayer.tsx`
 * - Mini-Map Navigator: `CanvasMiniMap.tsx`
 * - Modular Toolbars: `ConvasToolBarCenter.tsx`, `ConvasToolBarRight.tsx`
 * ============================================================================
 */

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { useCanvas, useCanvasGestures, useCanvasDrop } from './hooks'
import { CanvasData, CanvasNode, CanvasEdgeSide, CanvasShapeType, CanvasNodeColor, CanvasEdgeLineStyle } from './types'
import {
  COLOR_CYCLE,
  getNodePortCoord,
  computeAlignedNodePositions,
  computeDistributedNodePositions,
  getSelectionBoundingBox,
  CanvasAlignmentType,
  CanvasDistributionType,
  copyCanvasAsImage,
  downloadCanvasPng,
  downloadCanvasSvg
} from './utils'
import {
  CanvasEdgesLayer,
  CanvasNodesLayer,
  CanvasAlignmentGuidesLayer,
  ConvasToolBarCenter
} from './components'
import { ConvasToolBarRight } from './toolbar'
import { Notification, useToast } from '../../core/notification'
import './css/canvas-base.css'
import './css/canvas-toolbar.css'
import './css/canvas-studio.css'
import './css/canvas-dropdown.css'
import './css/canvas-nodes.css'
import './css/canvas-shapes.css'
import './css/canvas-drawer.css'
import './css/canvas-selection.css'
import './css/canvas-minimap.css'
import './css/canvas-toast.css'

export interface ConvasContainerProps {
  initialData?: CanvasData
  onChange?: (data: CanvasData) => void
  onOpenDrawer?: () => void
}

export const ConvasContainer: React.FC<ConvasContainerProps> = ({
  initialData,
  onChange,
  onOpenDrawer
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { toast, showToast, clearToast } = useToast()

  // Local editing & tool states
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'title' | 'text' | null>(null)
  const [toolMode, setToolMode] = useState<'select' | 'hand'>('select')
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(false)
  const [defaultLineStyle, setDefaultLineStyle] = useState<CanvasEdgeLineStyle>('curved')
  const [defaultEndpoints, setDefaultEndpoints] = useState<'directed' | 'bidirectional' | 'none'>('directed')

  // Central Canvas State Hook
  const {
    nodes,
    edges,
    viewport,
    selectedNodeIds,
    selectedEdgeId,
    setEdges,
    setViewport,
    setSelectedNodeIds,
    setSelectedEdgeId,
    screenToCanvas,
    zoomAt,
    resetViewport,
    zoomToFit,
    panBy,
    addNode,
    addNodes,
    updateNodePosition,
    updateNodesPositions,
    updateNodeSize,
    updateNodeText,
    updateNodeTitle,
    updateNodeColor,
    deleteNode,
    deleteSelected,
    duplicateNodes,
    snapNodesToGrid,
    updateEdgeLineStyle,
    updateEdgeColor,
    deleteEdge,
    updateEdgeLabel,
    updateEdgeEndpoints,
    undo,
    redo,
    canUndo,
    canRedo,
    pushHistory
  } = useCanvas({ initialData, onChange })

  // Fast O(1) node lookup map for dynamic edge routing & port queries
  const nodeMap = useMemo(() => {
    const map = new Map<string, CanvasNode>()
    for (let i = 0; i < nodes.length; i++) {
      map.set(nodes[i].id, nodes[i])
    }
    return map
  }, [nodes])

  /**
   * Completes creating a directional connection edge between two nodes.
   */
  const completeConnection = useCallback(
    (
      fromNodeId: string,
      fromSide: CanvasEdgeSide,
      toNodeId: string,
      toSide?: CanvasEdgeSide
    ) => {
      const fromNode = nodeMap.get(fromNodeId)
      const toNode = nodeMap.get(toNodeId)
      if (!fromNode || !toNode || fromNodeId === toNodeId) return

      pushHistory()

      let resolvedToSide = toSide
      if (!resolvedToSide) {
        const fromPt = getNodePortCoord(fromNode, fromSide)
        const sides: CanvasEdgeSide[] = ['left', 'right', 'top', 'bottom']
        let bestSide: CanvasEdgeSide = 'left'
        let minD = Infinity
        sides.forEach((s) => {
          const pt = getNodePortCoord(toNode, s)
          const d = Math.hypot(pt.x - fromPt.x, pt.y - fromPt.y)
          if (d < minD) {
            minD = d
            bestSide = s
          }
        })
        resolvedToSide = bestSide
      }

      setEdges((prev) => {
        // Check if an edge already connects these two nodes (in either direction)
        const existingIndex = prev.findIndex(
          (e) =>
            (e.fromNode === fromNodeId && e.toNode === toNodeId) ||
            (e.fromNode === toNodeId && e.toNode === fromNodeId)
        )

        if (existingIndex !== -1) {
          // Re-routing existing connection: update its ports, direction, and style without duplicating
          const updated = [...prev]
          const existing = updated[existingIndex]
          updated[existingIndex] = {
            ...existing,
            fromNode: fromNodeId,
            toNode: toNodeId,
            fromSide,
            toSide: resolvedToSide,
            lineStyle: defaultLineStyle,
            fromEnd: defaultEndpoints === 'bidirectional' ? 'arrow' : 'none',
            toEnd: defaultEndpoints === 'none' ? 'none' : 'arrow',
            routing: 'smart'
          }
          return updated
        }

        return [
          ...prev,
          {
            id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fromNode: fromNodeId,
            fromSide,
            fromEnd: defaultEndpoints === 'bidirectional' ? 'arrow' : 'none',
            toNode: toNodeId,
            toSide: resolvedToSide,
            toEnd: defaultEndpoints === 'none' ? 'none' : 'arrow',
            color: (toNode.color || 'default') as any,
            lineStyle: defaultLineStyle,
            routing: 'smart'
          }
        ]
      })
    },
    [nodeMap, setEdges, defaultLineStyle, defaultEndpoints]
  )

  const handleSelectEdge = useCallback(
    (e: React.MouseEvent, edgeId: string) => {
      e.stopPropagation()
      setSelectedEdgeId(edgeId)
      setSelectedNodeIds([])
    },
    [setSelectedEdgeId, setSelectedNodeIds]
  )

  const handleDeleteEdge = useCallback(
    (e: React.MouseEvent, edgeId: string) => {
      e.stopPropagation()
      deleteEdge(edgeId)
      if (selectedEdgeId === edgeId) {
        setSelectedEdgeId(null)
      }
    },
    [deleteEdge, selectedEdgeId, setSelectedEdgeId]
  )

  /**
   * Gesture & Pointer Interactions Engine
   */
  const {
    connecting,
    setConnecting,
    connectingRef,
    snappedTarget,
    setSnappedTarget,
    snappedTargetRef,
    mouseCanvasPos,
    isPanningState,
    handleCanvasMouseDown,
    handleResizeMouseDown,
    handleNodeMouseDown,
    handlePortMouseDown,
    alignmentGuides
  } = useCanvasGestures({
    containerRef,
    nodes,
    nodeMap,
    viewport,
    selectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    toolMode,
    isSpacePressed,
    snapToGrid,
    screenToCanvas,
    panBy,
    setSelectedNodeIds,
    updateNodePosition,
    updateNodesPositions,
    updateNodeSize,
    completeConnection,
    addNode,
    setEditingNodeId,
    setEditingField,
    pushHistory
  })

  /**
   * Drag and Drop Ingestion Engine
   */
  const { handleDragOver, handleDrop } = useCanvasDrop({
    containerRef,
    screenToCanvas,
    addNode,
    addNodes,
    snapToGrid,
    setEditingNodeId,
    setEditingField,
    onToast: showToast
  })

  /**
   * Grid snap toggle with immediate node alignment
   */
  const handleToggleSnapToGrid = useCallback(() => {
    setSnapToGrid((prev) => {
      const next = !prev
      if (next) {
        snapNodesToGrid(selectedNodeIds.length > 0 ? selectedNodeIds : undefined)
        showToast('Snap to Grid: ON', 'info')
      } else {
        showToast('Snap to Grid: OFF', 'info')
      }
      return next
    })
  }, [snapNodesToGrid, selectedNodeIds, showToast])

  /**
   * Camera pan-to helper (used by Mini-Map Navigator)
   */
  const handlePanTo = useCallback(
    (canvasCenterX: number, canvasCenterY: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setViewport((prev) => ({
        ...prev,
        x: Math.round(rect.width / 2 - canvasCenterX * prev.zoom),
        y: Math.round(rect.height / 2 - canvasCenterY * prev.zoom)
      }))
    },
    [setViewport]
  )

  /**
   * Global keyboard shortcut listener
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase()
      const isInputActive = activeTag === 'input' || activeTag === 'textarea'

      if (e.code === 'Space' && !isInputActive && !e.repeat) {
        setIsSpacePressed(true)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          deleteSelected(selectedNodeIds)
        } else if (selectedEdgeId) {
          e.preventDefault()
          e.stopPropagation()
          deleteEdge(selectedEdgeId)
          setSelectedEdgeId(null)
        }
      } else if (e.key === 'Escape') {
        setConnecting(null)
        if (connectingRef) connectingRef.current = null
        setSnappedTarget(null)
        if (snappedTargetRef) snappedTargetRef.current = null
        setEditingNodeId(null)
        setEditingField(null)
        setSelectedNodeIds([])
        setSelectedEdgeId(null)
      } else if (e.altKey && (e.key === 'd' || e.key === 'D') && !isInputActive) {
        // Alt+D duplicates selected nodes (Ctrl+D reserved for Documentation!)
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          duplicateNodes(selectedNodeIds)
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "'" || e.key === '"') && !isInputActive) {
        // Ctrl+' toggles 20px grid snapping
        e.preventDefault()
        e.stopPropagation()
        handleToggleSnapToGrid()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !isInputActive) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedEdgeId(null)
        setSelectedNodeIds(nodes.map((n) => n.id))
      } else if (((e.ctrlKey || e.metaKey) && e.key === '1') || (e.shiftKey && e.key === '!')) {
        if (!isInputActive) {
          e.preventDefault()
          zoomToFit(containerRef.current?.getBoundingClientRect())
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0' && !isInputActive) {
        e.preventDefault()
        resetViewport()
      } else if (e.key === 'v' && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setToolMode('select')
      } else if (e.key === 'h' && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setToolMode('hand')
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'z' || e.key === 'Z') &&
        !e.shiftKey &&
        !isInputActive
      ) {
        e.preventDefault()
        e.stopPropagation()
        undo()
        showToast('Undo', 'info')
      } else if (
        (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) &&
        !isInputActive
      ) {
        e.preventDefault()
        e.stopPropagation()
        redo()
        showToast('Redo', 'info')
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
  }, [
    deleteSelected,
    selectedNodeIds,
    selectedEdgeId,
    deleteEdge,
    setSelectedEdgeId,
    duplicateNodes,
    handleToggleSnapToGrid,
    setSelectedNodeIds,
    nodes,
    zoomToFit,
    resetViewport,
    setConnecting,
    connectingRef,
    setSnappedTarget,
    snappedTargetRef,
    undo,
    redo,
    showToast
  ])

  /**
   * Double clicking canvas background creates a new note at cursor
   */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      const target = e.target as HTMLElement
      if (
        target.closest(
          '.lumina-canvas-node, .lumina-canvas-toolbar, .lumina-canvas-port, .lumina-canvas-resize-handle, .lumina-canvas-minimap'
        )
      ) {
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      let pt = screenToCanvas(e.clientX, e.clientY, rect)
      let x = pt.x - 130
      let y = pt.y - 70
      if (snapToGrid) {
        x = Math.round(x / 20) * 20
        y = Math.round(y / 20) * 20
      }

      const newNode = addNode({
        type: 'text',
        title: 'Note',
        text: '',
        x: Math.round(x),
        y: Math.round(y),
        width: 260,
        height: 140,
        color: 'yellow'
      })

      setEditingNodeId(newNode.id)
      setEditingField('text')
    },
    [screenToCanvas, snapToGrid, addNode]
  )

  /**
   * Smooth mouse wheel zoom anchored at pointer
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const target = e.target as HTMLElement | null
      // Do not hijack scroll or pan if the user's cursor is over toolbars, sidebars, studio drawer, or menus!
      if (
        target?.closest?.(
          '.lumina-canvas-toolbar, .lumina-canvas-toolbar-right, .lumina-canvas-export-menu, .lumina-canvas-shapes-menu, .lumina-canvas-minimap, .lumina-sidebar, .right-sidebar'
        )
      ) {
        return
      }

      e.preventDefault()
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()

      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY < 0 ? 0.08 : -0.08
        zoomAt(delta, e.clientX, e.clientY, rect)
      } else {
        panBy(-e.deltaX, -e.deltaY)
      }
    },
    [zoomAt, panBy]
  )

  /**
   * Quick Add Sticky Note from center toolbar
   */
  const handleAddSticky = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerPt = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
    const newNode = addNode({
      type: 'sticky',
      title: 'Quick Idea',
      text: '',
      x: Math.round(centerPt.x - 130),
      y: Math.round(centerPt.y - 70),
      width: 260,
      height: 140,
      color: 'yellow'
    })
    setEditingNodeId(newNode.id)
    setEditingField('text')
  }, [screenToCanvas, addNode])

  /**
   * Quick Add Vector Shape from shapes palette
   */
  const handleAddShape = useCallback(
    (shapeType: CanvasShapeType, width: number = 140, height: number = 100, color = 'default') => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const centerPt = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
      let x = centerPt.x - width / 2
      let y = centerPt.y - height / 2
      if (snapToGrid) {
        x = Math.round(x / 20) * 20
        y = Math.round(y / 20) * 20
      }

      const newNode = addNode({
        type: 'shape',
        shape: shapeType,
        title: '',
        text: '',
        x: Math.round(x),
        y: Math.round(y),
        width,
        height,
        color: (color || 'default') as any
      })
      setEditingNodeId(newNode.id)
      setEditingField('text')
    },
    [screenToCanvas, snapToGrid, addNode]
  )

  /**
   * Multi-selection alignment & distribution handlers
   */
  const selectedNodes = useMemo(() => {
    return nodes.filter((n) => selectedNodeIds.includes(n.id))
  }, [nodes, selectedNodeIds])

  const selectionBox = useMemo(() => {
    return getSelectionBoundingBox(selectedNodes)
  }, [selectedNodes])

  const handleAlignSelection = useCallback(
    (alignment: CanvasAlignmentType) => {
      const updates = computeAlignedNodePositions(selectedNodes, alignment)
      if (updates.length > 0) {
        pushHistory()
        updateNodesPositions(updates)
        showToast(`Aligned ${selectedNodes.length} nodes to ${alignment}`, 'info')
      }
    },
    [selectedNodes, updateNodesPositions, showToast, pushHistory]
  )

  const handleDistributeSelection = useCallback(
    (direction: CanvasDistributionType) => {
      const updates = computeDistributedNodePositions(selectedNodes, direction)
      if (updates.length > 0) {
        pushHistory()
        updateNodesPositions(updates)
        showToast(`Distributed nodes ${direction}ly`, 'info')
      }
    },
    [selectedNodes, updateNodesPositions, showToast, pushHistory]
  )

  const handleCycleSelectionColor = useCallback(() => {
    if (selectedNodes.length === 0) return
    pushHistory()
    const firstColor = selectedNodes[0].color || 'default'
    const currIdx = COLOR_CYCLE.indexOf(firstColor as any)
    const nextColor = COLOR_CYCLE[(currIdx + 1) % COLOR_CYCLE.length]
    const selectedSet = new Set(selectedNodes.map((n) => n.id))
    selectedNodes.forEach((n) => updateNodeColor(n.id, nextColor))
    setEdges((prev) =>
      prev.map((e) =>
        selectedSet.has(e.fromNode) || selectedSet.has(e.toNode)
          ? { ...e, color: nextColor }
          : e
      )
    )
  }, [selectedNodes, updateNodeColor, setEdges, pushHistory])

  const selectedColor = useMemo(() => {
    if (selectedNodes.length > 0) {
      return (selectedNodes[0].color || 'default') as CanvasNodeColor
    }
    return undefined
  }, [selectedNodes])

  const handleUpdateSelectionColor = useCallback(
    (color: CanvasNodeColor) => {
      if (selectedNodes.length > 0) {
        pushHistory()
        const selectedSet = new Set(selectedNodes.map((n) => n.id))
        selectedNodes.forEach((n) => updateNodeColor(n.id, color))
        setEdges((prev) =>
          prev.map((e) =>
            selectedSet.has(e.fromNode) || selectedSet.has(e.toNode)
              ? { ...e, color }
              : e
          )
        )
      }
    },
    [selectedNodes, updateNodeColor, setEdges, pushHistory]
  )

  const handleCycleColor = useCallback(
    (id: string) => {
      const node = nodeMap.get(id)
      if (!node) return
      pushHistory()
      const currIdx = COLOR_CYCLE.indexOf((node.color || 'default') as any)
      const nextColor = COLOR_CYCLE[(currIdx + 1) % COLOR_CYCLE.length]
      updateNodeColor(id, nextColor)
      setEdges((prev) =>
        prev.map((e) =>
          e.fromNode === id || e.toNode === id
            ? { ...e, color: nextColor }
            : e
        )
      )
    },
    [nodeMap, updateNodeColor, setEdges, pushHistory]
  )

  /**
   * Export handlers
   */
  const handleCopyImage = useCallback(async () => {
    const success = await copyCanvasAsImage({
      nodes,
      edges,
      selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
    })
    if (success) {
      showToast('Canvas snapshot copied to clipboard', 'success')
    } else {
      showToast('Failed to copy canvas snapshot', 'error')
    }
  }, [nodes, edges, selectedNodeIds, showToast])

  const handleExportPNG = useCallback(() => {
    downloadCanvasPng({
      nodes,
      edges,
      selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
    })
    showToast('Exported canvas as PNG image', 'success')
  }, [nodes, edges, selectedNodeIds, showToast])

  const handleExportSVG = useCallback(() => {
    downloadCanvasSvg({
      nodes,
      edges,
      selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
    })
    showToast('Exported canvas as SVG vector', 'success')
  }, [nodes, edges, selectedNodeIds, showToast])

  const handleSetZoom = useCallback(
    (targetZoom: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const currentZoom = viewport.zoom || 1
      zoomAt(targetZoom - currentZoom, centerX, centerY, rect)
    },
    [viewport.zoom, zoomAt]
  )

  const handleSnapAllToGrid = useCallback(() => {
    if (nodes.length === 0) return
    const updates: { id: string; x: number; y: number }[] = []
    nodes.forEach((n) => {
      const snappedX = Math.round(n.x / 20) * 20
      const snappedY = Math.round(n.y / 20) * 20
      if (snappedX !== n.x || snappedY !== n.y) {
        updates.push({ id: n.id, x: snappedX, y: snappedY })
      }
    })
    if (updates.length > 0) {
      updateNodesPositions(updates)
      showToast(`Snapped ${updates.length} nodes to 20px grid`, 'info')
    } else {
      showToast('All nodes are already aligned to 20px grid', 'info')
    }
  }, [nodes, updateNodesPositions, showToast])

  const cursorStyle = isPanningState
    ? 'grabbing'
    : connecting
      ? 'crosshair'
      : toolMode === 'hand' || isSpacePressed
        ? 'grab'
        : 'default'

  return (
    <div
      ref={containerRef}
      className={`lumina-canvas-container ${connecting ? 'is-connecting' : ''} ${snapToGrid ? 'is-grid-snapping' : ''} ${selectedNodeIds.length > 1 ? 'is-multi-selecting' : ''}`}
      style={{
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        backgroundSize: `${(snapToGrid ? 20 : 24) * viewport.zoom}px ${(snapToGrid ? 20 : 24) * viewport.zoom}px`,
        cursor: cursorStyle
      }}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Infinite Transform Viewport */}
      <div
        className="lumina-canvas-viewport"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
        }}
      >
        {/* Layer 1: SVG Connection Wires */}
        <CanvasEdgesLayer
          edges={edges}
          nodeMap={nodeMap}
          connecting={connecting}
          snappedTarget={snappedTarget}
          mouseCanvasPos={mouseCanvasPos}
          selectedEdgeId={selectedEdgeId}
          isMultiSelectionActive={selectedNodeIds.length > 1}
          onSelectEdge={handleSelectEdge}
          onDeleteEdge={handleDeleteEdge}
          onUpdateEdgeLineStyle={updateEdgeLineStyle}
          onUpdateEdgeLabel={updateEdgeLabel}
          onUpdateEdgeEndpoints={updateEdgeEndpoints}
          onUpdateEdgeColor={updateEdgeColor}
          snapToGrid={snapToGrid}
        />

        {/* Layer 2: Interactive Cards, Shapes, and Multi-Selection Toolbar */}
        <CanvasNodesLayer
          nodes={nodes}
          selectedNodeIds={selectedNodeIds}
          editingNodeId={editingNodeId}
          editingField={editingField}
          snappedPortTargetNodeId={snappedTarget?.nodeId}
          snappedPortSide={snappedTarget?.side}
          selectionBox={selectionBox}
          onNodeMouseDown={handleNodeMouseDown}
          onPortMouseDown={handlePortMouseDown}
          onResizeMouseDown={handleResizeMouseDown}
          onStartEditing={(id, field) => {
            setEditingNodeId(id)
            setEditingField(field)
          }}
          onStopEditing={() => {
            setEditingNodeId(null)
            setEditingField(null)
          }}
          onUpdateTitle={updateNodeTitle}
          onUpdateText={updateNodeText}
          onCycleColor={handleCycleColor}
          onDuplicateNode={(id) => duplicateNodes([id])}
          onDeleteNode={deleteNode}
          onAlignSelection={handleAlignSelection}
          onDistributeSelection={handleDistributeSelection}
          onDuplicateSelection={() => duplicateNodes()}
          onCycleSelectionColor={handleCycleSelectionColor}
          onDeleteSelection={() => deleteSelected()}
          onSnapSelectionToGrid={handleSnapAllToGrid}
        />

        {/* Layer 2.5: Real-time Alignment Guides & Snapping Visualizer */}
        <CanvasAlignmentGuidesLayer guides={alignmentGuides} />
      </div>

      {/* Layer 3: Center Toolbar (Select, Hand, Sticky Note, Shapes) */}
      <ConvasToolBarCenter
        toolMode={toolMode}
        setToolMode={setToolMode}
        onAddSticky={handleAddSticky}
        onAddShape={handleAddShape}
      />

      {/* Layer 4: Right Toolbar / Expandable Canvas Studio */}
      <ConvasToolBarRight
        zoom={viewport.zoom}
        onZoomIn={() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            zoomAt(0.1, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
          }
        }}
        onZoomOut={() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            zoomAt(-0.1, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
          }
        }}
        onResetViewport={resetViewport}
        onZoomToFit={() => zoomToFit(containerRef.current?.getBoundingClientRect())}
        onSetZoom={handleSetZoom}
        onDeleteSelected={deleteSelected}
        canDelete={selectedNodeIds.length > 0 || !!selectedEdgeId}
        onAddShape={handleAddShape}
        onCopyImage={handleCopyImage}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onOpenDrawer={onOpenDrawer}
        hasSelectedNodes={selectedNodeIds.length > 0}
        selectedCount={selectedNodeIds.length + (selectedEdgeId ? 1 : 0)}
        selectedColor={selectedColor}
        onUpdateSelectedColor={handleUpdateSelectionColor}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={handleToggleSnapToGrid}
        onSnapAllToGrid={handleSnapAllToGrid}
        isMiniMapOpen={isMiniMapOpen}
        onToggleMiniMap={() => setIsMiniMapOpen((prev) => !prev)}
        nodes={nodes}
        edges={edges}
        defaultLineStyle={defaultLineStyle}
        onChangeDefaultLineStyle={setDefaultLineStyle}
        defaultEndpoints={defaultEndpoints}
        onChangeDefaultEndpoints={setDefaultEndpoints}
        onAlignSelection={handleAlignSelection}
        onDistributeSelection={handleDistributeSelection}
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        viewport={viewport}
        containerRect={
          containerRef.current
            ? { width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }
            : null
        }
        onPanTo={handlePanTo}
      />

      {/* Layer 5: Toast Notification */}
      <Notification toast={toast} onClose={clearToast} />
    </div>
  )
}

export const CanvasView = ConvasContainer
export default ConvasContainer
