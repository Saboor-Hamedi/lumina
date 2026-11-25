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
import { useCanvas, useCanvasGestures, useCanvasDrop, useCanvasShortcuts, useCanvasPaste } from './hooks'
import { CanvasData, CanvasNode, CanvasEdgeSide, CanvasEdgeEnd, CanvasShapeType, CanvasNodeColor, CanvasEdgeLineStyle, CanvasToolMode } from './types'
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
  CanvasStrokesLayer,
  CanvasNodesLayer,
  CanvasAlignmentGuidesLayer,
  ConvasToolBarCenter,
  SHAPE_COLOR_OPTIONS
} from './components'
import { ConvasToolBarRight } from './toolbar'
import { Notification, useToast } from '../../core/notification'
import './css/canvas-base.css'
import './css/canvas-toolbar.css'
import './css/canvas-studio.css'
import './css/canvas-dropdown.css'
import './css/canvas-nodes.css'
import './css/canvas-shapes.css'
import './css/canvas-selection.css'
import './css/canvas-minimap.css'
import './css/canvas-toast.css'

export interface ConvasContainerProps {
  initialData?: CanvasData
  onChange?: (data: CanvasData) => void
  isSelected?: boolean
}

export const ConvasContainer: React.FC<ConvasContainerProps> = ({
  initialData,
  onChange,
  isSelected = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { toast, showToast, clearToast } = useToast()

  // Local editing & tool states
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'title' | 'text' | null>(null)
  const [toolMode, setToolMode] = useState<CanvasToolMode>('select')
  const [pencilColor, setPencilColor] = useState<CanvasNodeColor>('default')
  const [pencilWidth, setPencilWidth] = useState<number>(4)
  const [pencilHighlighter, setPencilHighlighter] = useState<boolean>(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(false)
  const [defaultLineStyle, setDefaultLineStyle] = useState<CanvasEdgeLineStyle>('curved')
  const [defaultEndpoints, setDefaultEndpoints] = useState<'directed' | 'bidirectional' | 'none'>('directed')
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])

  // Central Canvas State Hook
  const {
    nodes,
    edges,
    strokes,
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
    updateNodeShape,
    updateNodesShapes,
    deleteNode,
    deleteSelected,
    duplicateNodes,
    copyNodes,
    pasteNodes,
    hasCopiedNodes,
    snapNodesToGrid,
    updateEdgeLineStyle,
    updateEdgeStrokeDash,
    updateEdgeColor,
    deleteEdge,
    updateEdgeLabel,
    updateEdgeEndpoints,
    addStroke,
    deleteStrokes,
    clearStrokes,
    clearCanvas,
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
    (e: React.MouseEvent | React.PointerEvent, edgeId: string) => {
      e.stopPropagation()
      const isMulti = e.shiftKey || e.ctrlKey || e.metaKey
      if (isMulti) {
        setSelectedEdgeIds((prev) => {
          const next = prev.includes(edgeId)
            ? prev.filter((id) => id !== edgeId)
            : [...prev, edgeId]
          setSelectedEdgeId(next[next.length - 1] || null)
          return next
        })
      } else {
        setSelectedEdgeIds([edgeId])
        setSelectedEdgeId(edgeId)
        setSelectedNodeIds([])
      }
    },
    [setSelectedEdgeId, setSelectedNodeIds]
  )

  const handleDeleteEdge = useCallback(
    (e: React.MouseEvent, edgeId: string) => {
      e.stopPropagation()
      deleteEdge(edgeId)
      setSelectedEdgeIds((prev) => prev.filter((id) => id !== edgeId))
      if (selectedEdgeId === edgeId) {
        setSelectedEdgeId(null)
      }
    },
    [deleteEdge, selectedEdgeId, setSelectedEdgeId]
  )

  /**
   * Gesture & Pointer Interactions Engine (Mouse, Touch, Stylus, Pinch-Zoom, Pencil, Eraser)
   */
  const {
    connecting,
    setConnecting,
    connectingRef,
    snappedTarget,
    setSnappedTarget,
    snappedTargetRef,
    mouseCanvasPos,
    activeStroke,
    marqueeBox,
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
    strokes,
    viewport,
    selectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    toolMode,
    setToolMode,
    pencilColor,
    pencilWidth,
    pencilHighlighter,
    isSpacePressed,
    snapToGrid,
    screenToCanvas,
    zoomAt,
    panBy,
    setSelectedNodeIds,
    updateNodePosition,
    updateNodesPositions,
    updateNodeSize,
    completeConnection,
    addNode,
    addStroke,
    deleteStrokes,
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
   * Clipboard Paste Engine (Image and Node Ingestion)
   */
  useCanvasPaste({
    containerRef,
    screenToCanvas,
    viewport,
    mouseCanvasPos,
    snapToGrid,
    addNode,
    hasCopiedNodes,
    pasteNodes,
    onToast: showToast,
    isActive: isSelected ?? true
  })

  /**
   * Grid snap toggle with immediate node alignment
   */
  const handleToggleSnapToGrid = useCallback(() => {
    setSnapToGrid((prev) => {
      const next = !prev
      if (next) {
        snapNodesToGrid(selectedNodeIds.length > 0 ? selectedNodeIds : undefined)
      }
      return next
    })
  }, [snapNodesToGrid, selectedNodeIds])

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
   * Central Keyboard Shortcuts Hook (encapsulated, protected, and clean)
   */
  useCanvasShortcuts({
    containerRef,
    nodes,
    edges,
    selectedNodeIds,
    selectedEdgeId,
    snapToGrid,
    deleteSelected,
    deleteEdge,
    setSelectedEdgeId,
    setSelectedNodeIds,
    duplicateNodes,
    copyNodes,
    pasteNodes,
    hasCopiedNodes,
    updateNodesPositions,
    updateEdgeLineStyle,
    updateEdgeColor,
    updateEdgeEndpoints,
    handleToggleSnapToGrid,
    zoomToFit,
    resetViewport,
    setToolMode,
    setIsSpacePressed,
    setConnecting,
    connectingRef,
    setSnappedTarget,
    snappedTargetRef,
    setEditingNodeId,
    setEditingField,
    undo,
    redo,
    pushHistory
  })

  /**
   * Double clicking canvas background creates a new note at cursor
   */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      if (toolMode === 'pencil' || toolMode === 'eraser') return
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
      let x = pt.x - 100
      let y = pt.y - 24
      if (snapToGrid) {
        x = Math.round(x / 20) * 20
        y = Math.round(y / 20) * 20
      }

      const newNode = addNode({
        type: 'text',
        title: 'Text',
        text: '',
        x: Math.round(x),
        y: Math.round(y),
        width: 200,
        height: 48,
        color: 'default'
      })

      setEditingNodeId(newNode.id)
      setEditingField('text')
    },
    [toolMode, screenToCanvas, snapToGrid, addNode]
  )

  /**
   * Smooth mouse wheel & trackpad pinch zoom anchored at pointer
   */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const target = e.target as HTMLElement | null
      // Do not hijack scroll or pan if the user's cursor is over toolbars, sidebars, studio panel, or menus!
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
        const isTrackpadPinch = e.deltaMode === 0 && Math.abs(e.deltaY) < 40
        const delta = isTrackpadPinch
          ? Math.max(-0.15, Math.min(0.15, -e.deltaY * 0.01))
          : e.deltaY < 0
            ? 0.08
            : -0.08
        zoomAt(delta, e.clientX, e.clientY, rect)
      } else {
        panBy(-e.deltaX, -e.deltaY)
      }
    },
    [zoomAt, panBy]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

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
   * Tracks connected ports to render sleek docking heads and fill socket gaps
   */
  const connectedPortsMap = useMemo(() => {
    const map = new Map<string, Partial<Record<CanvasEdgeSide, { hasArrow: boolean; color?: CanvasNodeColor }>>>()
    for (const edge of edges) {
      if (edge.fromNode && edge.fromSide) {
        const ports = map.get(edge.fromNode) || {}
        ports[edge.fromSide] = {
          hasArrow: edge.fromEnd === 'arrow',
          color: edge.color
        }
        map.set(edge.fromNode, ports)
      }
      if (edge.toNode && edge.toSide) {
        const ports = map.get(edge.toNode) || {}
        ports[edge.toSide] = {
          hasArrow: edge.toEnd !== 'none',
          color: edge.color
        }
        map.set(edge.toNode, ports)
      }
    }
    return map
  }, [edges])

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
      }
    },
    [selectedNodes, updateNodesPositions, pushHistory]
  )

  const handleDistributeSelection = useCallback(
    (direction: CanvasDistributionType) => {
      const updates = computeDistributedNodePositions(selectedNodes, direction)
      if (updates.length > 0) {
        pushHistory()
        updateNodesPositions(updates)
      }
    },
    [selectedNodes, updateNodesPositions, pushHistory]
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
    const edgeId = selectedEdgeIds[0] || selectedEdgeId
    if (edgeId) {
      const edge = edges.find((e) => e.id === edgeId)
      if (edge) return (edge.color || 'default') as CanvasNodeColor
    }
    return undefined
  }, [selectedNodes, selectedEdgeIds, selectedEdgeId, edges])

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
      } else if (selectedEdgeIds.length > 0) {
        pushHistory()
        const edgeSet = new Set(selectedEdgeIds)
        setEdges((prev) =>
          prev.map((e) => (edgeSet.has(e.id) ? { ...e, color } : e))
        )
      } else if (selectedEdgeId) {
        pushHistory()
        updateEdgeColor(selectedEdgeId, color)
      }
    },
    [selectedNodes, selectedEdgeIds, selectedEdgeId, updateNodeColor, updateEdgeColor, setEdges, pushHistory]
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

  const selectedShapeNodes = useMemo(
    () => selectedNodes.filter((n) => n.type === 'shape' || !!n.shape || !!(n as any).shapeType),
    [selectedNodes]
  )

  const canReplaceShape = selectedShapeNodes.length > 0

  const selectedShapeType = useMemo(() => {
    if (selectedShapeNodes.length === 0) return null
    return (selectedShapeNodes[0].shape || (selectedShapeNodes[0] as any).shapeType || 'rectangle') as CanvasShapeType
  }, [selectedShapeNodes])

  const selectedColorHex = useMemo(() => {
    if (selectedNodes.length === 0) return undefined
    const colorId = selectedNodes[0].color || 'default'
    const found = SHAPE_COLOR_OPTIONS.find((c) => c.id === colorId)
    return found ? found.hex : undefined
  }, [selectedNodes])

  const handleReplaceShape = useCallback(
    (newShape: CanvasShapeType) => {
      const targetIds = selectedNodes
        .filter((n) => n.type === 'shape' || !!n.shape || !!(n as any).shapeType)
        .map((n) => n.id)
      if (targetIds.length === 0) return
      updateNodesShapes(targetIds, newShape)
    },
    [selectedNodes, updateNodesShapes]
  )

  /**
   * Export handlers
   */
  const handleCopyImage = useCallback(async () => {
    const success = await copyCanvasAsImage({
      nodes,
      edges,
      strokes,
      selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
    })
    if (success) {
      showToast('Canvas snapshot copied to clipboard', 'success')
    } else {
      showToast('Failed to copy canvas snapshot', 'error')
    }
  }, [nodes, edges, strokes, selectedNodeIds, showToast])

  const handleExportPNG = useCallback(async () => {
    try {
      const result = await downloadCanvasPng({
        nodes,
        edges,
        strokes,
        selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
      })
      if (result.saved) {
        showToast('Exported canvas as PNG image', 'success')
      }
    } catch (err) {
      console.error('[Canvas] Failed to export PNG:', err)
      showToast('Failed to export PNG image', 'error')
    }
  }, [nodes, edges, strokes, selectedNodeIds, showToast])

  const handleExportSVG = useCallback(async () => {
    try {
      const result = await downloadCanvasSvg({
        nodes,
        edges,
        strokes,
        selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
      })
      if (result.saved) {
        showToast('Exported canvas as SVG vector', 'success')
      }
    } catch (err) {
      console.error('[Canvas] Failed to export SVG:', err)
      showToast('Failed to export SVG vector', 'error')
    }
  }, [nodes, edges, strokes, selectedNodeIds, showToast])

  const handleClearStrokes = useCallback(() => {
    clearStrokes()
  }, [clearStrokes])

  const handleClearCanvas = useCallback(() => {
    if (clearCanvas()) {
      setSelectedEdgeIds([])
      setEditingNodeId(null)
      setEditingField(null)
    }
  }, [clearCanvas])

  const handleInsertTemplate = useCallback(
    (template: 'flowchart' | 'architecture' | 'mindmap') => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const c = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
      const cx = Math.round(c.x)
      const cy = Math.round(c.y)
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      if (template === 'flowchart') {
        const startId = `tpl-start-${uid}`
        const decId = `tpl-dec-${uid}`
        const yesId = `tpl-yes-${uid}`
        const noId = `tpl-no-${uid}`
        addNodes([
          { id: startId, type: 'shape', shape: 'pill', text: 'Start', x: cx - 75, y: cy - 200, width: 150, height: 64, color: 'blue' },
          { id: decId, type: 'shape', shape: 'diamond', text: 'Condition?', x: cx - 70, y: cy - 80, width: 140, height: 120, color: 'yellow' },
          { id: yesId, type: 'shape', shape: 'rounded-rectangle', text: 'Approve', x: cx - 230, y: cy + 95, width: 150, height: 80, color: 'green' },
          { id: noId, type: 'shape', shape: 'rounded-rectangle', text: 'Revise', x: cx + 80, y: cy + 95, width: 150, height: 80, color: 'orange' }
        ])
        setEdges((prev) => [
          ...prev,
          { id: `edge-${uid}-1`, fromNode: startId, fromSide: 'bottom', toNode: decId, toSide: 'top', toEnd: 'arrow', lineStyle: 'step', color: 'blue' },
          { id: `edge-${uid}-2`, fromNode: decId, fromSide: 'left', toNode: yesId, toSide: 'top', toEnd: 'arrow', label: 'Yes', lineStyle: 'step', color: 'green' },
          { id: `edge-${uid}-3`, fromNode: decId, fromSide: 'right', toNode: noId, toSide: 'top', toEnd: 'arrow', label: 'No', lineStyle: 'step', color: 'orange' }
        ])
      } else if (template === 'architecture') {
        const clientId = `tpl-client-${uid}`
        const apiId = `tpl-api-${uid}`
        const queueId = `tpl-queue-${uid}`
        const dbId = `tpl-db-${uid}`
        addNodes([
          { id: clientId, type: 'shape', shape: 'browser', text: 'Web App', x: cx - 320, y: cy - 55, width: 150, height: 110, color: 'cyan' },
          { id: apiId, type: 'shape', shape: 'server', text: 'API Server', x: cx - 90, y: cy - 65, width: 140, height: 130, color: 'blue' },
          { id: queueId, type: 'shape', shape: 'queue', text: 'Queue', x: cx + 130, y: cy - 125, width: 145, height: 80, color: 'purple' },
          { id: dbId, type: 'shape', shape: 'cylinder', text: 'Database', x: cx + 140, y: cy + 15, width: 125, height: 120, color: 'green' }
        ])
        setEdges((prev) => [
          ...prev,
          { id: `edge-${uid}-1`, fromNode: clientId, fromSide: 'right', toNode: apiId, toSide: 'left', toEnd: 'arrow', label: 'HTTPS', lineStyle: 'curved', color: 'cyan' },
          { id: `edge-${uid}-2`, fromNode: apiId, fromSide: 'right', toNode: queueId, toSide: 'left', toEnd: 'arrow', label: 'Jobs', lineStyle: 'curved', color: 'purple' },
          { id: `edge-${uid}-3`, fromNode: apiId, fromSide: 'right', toNode: dbId, toSide: 'left', toEnd: 'arrow', label: 'SQL', lineStyle: 'curved', color: 'green' }
        ])
      } else {
        const centerId = `tpl-hub-${uid}`
        const b1 = `tpl-b1-${uid}`
        const b2 = `tpl-b2-${uid}`
        const b3 = `tpl-b3-${uid}`
        const b4 = `tpl-b4-${uid}`
        addNodes([
          { id: centerId, type: 'shape', shape: 'pill', text: 'Core Idea', x: cx - 80, y: cy - 40, width: 160, height: 80, color: 'purple' },
          { id: b1, type: 'shape', shape: 'rounded-rectangle', text: 'Goals', x: cx - 290, y: cy - 120, width: 140, height: 74, color: 'blue' },
          { id: b2, type: 'shape', shape: 'rounded-rectangle', text: 'Research', x: cx + 150, y: cy - 120, width: 140, height: 74, color: 'cyan' },
          { id: b3, type: 'shape', shape: 'rounded-rectangle', text: 'Actions', x: cx - 290, y: cy + 50, width: 140, height: 74, color: 'green' },
          { id: b4, type: 'shape', shape: 'rounded-rectangle', text: 'Risks', x: cx + 150, y: cy + 50, width: 140, height: 74, color: 'orange' }
        ])
        setEdges((prev) => [
          ...prev,
          { id: `edge-${uid}-1`, fromNode: centerId, fromSide: 'left', toNode: b1, toSide: 'right', toEnd: 'none', lineStyle: 'curved', color: 'blue' },
          { id: `edge-${uid}-2`, fromNode: centerId, fromSide: 'right', toNode: b2, toSide: 'left', toEnd: 'none', lineStyle: 'curved', color: 'cyan' },
          { id: `edge-${uid}-3`, fromNode: centerId, fromSide: 'left', toNode: b3, toSide: 'right', toEnd: 'none', lineStyle: 'curved', color: 'green' },
          { id: `edge-${uid}-4`, fromNode: centerId, fromSide: 'right', toNode: b4, toSide: 'left', toEnd: 'none', lineStyle: 'curved', color: 'orange' }
        ])
      }
      showToast(`Inserted ${template} template`, 'success')
    },
    [screenToCanvas, addNodes, setEdges, showToast]
  )

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
    }
  }, [nodes, updateNodesPositions])

  const activeLineStyle = useMemo(() => {
    const edgeId = selectedEdgeIds[0] || selectedEdgeId
    if (edgeId) {
      const edge = edges.find((e) => e.id === edgeId)
      if (edge?.lineStyle) return edge.lineStyle
    }
    return defaultLineStyle
  }, [selectedEdgeIds, selectedEdgeId, edges, defaultLineStyle])

  const activeEndpoints = useMemo(() => {
    const edgeId = selectedEdgeIds[0] || selectedEdgeId
    if (edgeId) {
      const edge = edges.find((e) => e.id === edgeId)
      if (edge) {
        if (edge.fromEnd === 'arrow' && edge.toEnd === 'arrow') return 'bidirectional'
        if (edge.toEnd === 'none' && edge.fromEnd !== 'arrow') return 'none'
        return 'directed'
      }
    }
    return defaultEndpoints
  }, [selectedEdgeIds, selectedEdgeId, edges, defaultEndpoints])

  const handleChangeLineStyle = useCallback(
    (style: CanvasEdgeLineStyle) => {
      setDefaultLineStyle(style)
      pushHistory()
      if (selectedEdgeIds.length > 0) {
        const edgeSet = new Set(selectedEdgeIds)
        setEdges((prev) =>
          prev.map((e) => (edgeSet.has(e.id) ? { ...e, lineStyle: style } : e))
        )
      } else if (selectedEdgeId) {
        updateEdgeLineStyle(selectedEdgeId, style)
      } else if (selectedNodeIds.length > 0) {
        const nodeSet = new Set(selectedNodeIds)
        setEdges((prev) =>
          prev.map((e) =>
            nodeSet.has(e.fromNode) || nodeSet.has(e.toNode)
              ? { ...e, lineStyle: style }
              : e
          )
        )
      } else if (edges.length > 0) {
        setEdges((prev) =>
          prev.map((e) => ({ ...e, lineStyle: style }))
        )
      }
    },
    [selectedEdgeIds, selectedEdgeId, selectedNodeIds, edges.length, updateEdgeLineStyle, setEdges, pushHistory]
  )

  const handleChangeEndpoints = useCallback(
    (endpoints: 'directed' | 'bidirectional' | 'none') => {
      setDefaultEndpoints(endpoints)
      const fromEnd: CanvasEdgeEnd = endpoints === 'bidirectional' ? 'arrow' : 'none'
      const toEnd: CanvasEdgeEnd = endpoints === 'none' ? 'none' : 'arrow'
      pushHistory()
      if (selectedEdgeIds.length > 0) {
        const edgeSet = new Set(selectedEdgeIds)
        setEdges((prev) =>
          prev.map((e) =>
            edgeSet.has(e.id) ? { ...e, fromEnd, toEnd } : e
          )
        )
      } else if (selectedEdgeId) {
        updateEdgeEndpoints(selectedEdgeId, fromEnd, toEnd)
      } else if (selectedNodeIds.length > 0) {
        const nodeSet = new Set(selectedNodeIds)
        setEdges((prev) =>
          prev.map((e) =>
            nodeSet.has(e.fromNode) || nodeSet.has(e.toNode)
              ? { ...e, fromEnd, toEnd }
              : e
          )
        )
      } else if (edges.length > 0) {
        setEdges((prev) =>
          prev.map((e) => ({ ...e, fromEnd, toEnd }))
        )
      }
    },
    [selectedEdgeIds, selectedEdgeId, selectedNodeIds, edges.length, updateEdgeEndpoints, setEdges, pushHistory]
  )

  const handleApplyToAllEdges = useCallback(
    (style: CanvasEdgeLineStyle) => {
      if (edges.length === 0) return
      pushHistory()
      setDefaultLineStyle(style)
      setEdges((prev) => prev.map((e) => ({ ...e, lineStyle: style })))
    },
    [edges.length, pushHistory, setEdges]
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      deleteSelected()
      setSelectedEdgeIds([])
    } else if (selectedEdgeIds.length > 0) {
      pushHistory()
      const toDelete = new Set(selectedEdgeIds)
      setEdges((prev) => prev.filter((e) => !toDelete.has(e.id)))
      setSelectedEdgeIds([])
      setSelectedEdgeId(null)
    } else if (selectedEdgeId) {
      deleteSelected()
      setSelectedEdgeIds([])
    }
  }, [selectedNodeIds.length, selectedEdgeIds, selectedEdgeId, deleteSelected, pushHistory, setEdges, setSelectedEdgeId])

  const handleStartEditing = useCallback((id: string, field: 'title' | 'text') => {
    setEditingNodeId(id)
    setEditingField(field)
  }, [])

  const handleStopEditing = useCallback(() => {
    setEditingNodeId(null)
    setEditingField(null)
  }, [])

  const handleDuplicateSingleNode = useCallback(
    (id: string) => duplicateNodes([id]),
    [duplicateNodes]
  )

  const handleDuplicateSelection = useCallback(() => duplicateNodes(), [duplicateNodes])

  const handleDeleteSelectionNodes = useCallback(() => deleteSelected(), [deleteSelected])

  const handleEraseSingleStroke = useCallback(
    (strokeId: string) => deleteStrokes([strokeId], true),
    [deleteStrokes]
  )

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest?.('input, textarea')) return
    e.preventDefault()
  }, [])

  const cursorStyle = isPanningState
    ? 'grabbing'
    : connecting || toolMode === 'pencil' || toolMode === 'eraser'
      ? 'crosshair'
      : toolMode === 'text'
        ? 'text'
        : toolMode === 'hand' || isSpacePressed
          ? 'grab'
          : 'default'

  return (
    <div
      ref={containerRef}
      className={`lumina-canvas-container tool-${toolMode} ${connecting ? 'is-connecting' : ''} ${snapToGrid ? 'is-grid-snapping' : ''} ${selectedNodeIds.length > 1 ? 'is-multi-selecting' : ''}`}
      style={{
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        backgroundSize: `${(snapToGrid ? 20 : 24) * viewport.zoom}px ${(snapToGrid ? 20 : 24) * viewport.zoom}px`,
        cursor: cursorStyle
      }}
      onPointerDown={handleCanvasMouseDown}
      onMouseDown={handleCanvasMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleCanvasContextMenu}
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
          selectedEdgeIds={selectedEdgeIds}
          isMultiSelectionActive={selectedNodeIds.length > 1}
          onSelectEdge={handleSelectEdge}
          onDeleteEdge={handleDeleteEdge}
          onUpdateEdgeLineStyle={updateEdgeLineStyle}
          onUpdateEdgeStrokeDash={updateEdgeStrokeDash}
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
          connectedPortsMap={connectedPortsMap}
          selectionBox={selectionBox}
          selectedShapeType={selectedShapeType}
          canReplaceShape={canReplaceShape}
          selectedColorHex={selectedColorHex}
          onNodeMouseDown={handleNodeMouseDown}
          onPortMouseDown={handlePortMouseDown}
          onResizeMouseDown={handleResizeMouseDown}
          onStartEditing={handleStartEditing}
          onStopEditing={handleStopEditing}
          onUpdateTitle={updateNodeTitle}
          onUpdateText={updateNodeText}
          onCycleColor={handleCycleColor}
          onDuplicateNode={handleDuplicateSingleNode}
          onDeleteNode={deleteNode}
          onReplaceShape={handleReplaceShape}
          onAlignSelection={handleAlignSelection}
          onDistributeSelection={handleDistributeSelection}
          onDuplicateSelection={handleDuplicateSelection}
          onCycleSelectionColor={handleCycleSelectionColor}
          onDeleteSelection={handleDeleteSelectionNodes}
          onSnapSelectionToGrid={handleSnapAllToGrid}
        />

        {/* Layer 2.2: Freehand Pencil & Highlighter Ink Strokes */}
        <CanvasStrokesLayer
          strokes={strokes}
          activeStroke={activeStroke}
          toolMode={toolMode}
          onEraseStroke={handleEraseSingleStroke}
        />

        {/* Layer 2.5: Real-time Alignment Guides & Snapping Visualizer */}
        <CanvasAlignmentGuidesLayer guides={alignmentGuides} />

        {/* Layer 2.8: Marquee Selection Box (Shift + Drag) */}
        {marqueeBox && marqueeBox.width > 2 && marqueeBox.height > 2 && (
          <div
            className="lumina-canvas-marquee-box"
            style={{
              left: `${marqueeBox.x}px`,
              top: `${marqueeBox.y}px`,
              width: `${marqueeBox.width}px`,
              height: `${marqueeBox.height}px`
            }}
          />
        )}
      </div>

      {/* Layer 3: Center Toolbar (Select, Hand, Pencil, Eraser, Text, Sticky, Shapes, Undo/Redo, Clear) */}
      <ConvasToolBarCenter
        toolMode={toolMode}
        setToolMode={setToolMode}
        onAddSticky={handleAddSticky}
        onAddShape={handleAddShape}
        pencilColor={pencilColor}
        onChangePencilColor={setPencilColor}
        pencilWidth={pencilWidth}
        onChangePencilWidth={setPencilWidth}
        pencilHighlighter={pencilHighlighter}
        onTogglePencilHighlighter={() => setPencilHighlighter((prev) => !prev)}
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        onClearStrokes={handleClearStrokes}
        hasStrokes={strokes.length > 0}
        onClearCanvas={handleClearCanvas}
        hasContent={nodes.length > 0 || edges.length > 0 || strokes.length > 0}
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
        onDeleteSelected={handleDeleteSelected}
        canDelete={selectedNodeIds.length > 0 || !!selectedEdgeId || selectedEdgeIds.length > 0}
        onAddShape={handleAddShape}
        onCopyImage={handleCopyImage}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        hasSelectedNodes={selectedNodeIds.length > 0}
        selectedCount={selectedNodeIds.length + Math.max(selectedEdgeIds.length, selectedEdgeId ? 1 : 0)}
        selectedColor={selectedColor}
        onUpdateSelectedColor={handleUpdateSelectionColor}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={handleToggleSnapToGrid}
        onSnapAllToGrid={handleSnapAllToGrid}
        isMiniMapOpen={isMiniMapOpen}
        onToggleMiniMap={() => setIsMiniMapOpen((prev) => !prev)}
        nodes={nodes}
        edges={edges}
        selectedEdgeId={selectedEdgeId}
        selectedEdgeIds={selectedEdgeIds}
        defaultLineStyle={activeLineStyle}
        onChangeDefaultLineStyle={handleChangeLineStyle}
        defaultEndpoints={activeEndpoints}
        onChangeDefaultEndpoints={handleChangeEndpoints}
        onApplyToAllEdges={handleApplyToAllEdges}
        onAlignSelection={handleAlignSelection}
        onDistributeSelection={handleDistributeSelection}
        onInsertTemplate={handleInsertTemplate}
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
