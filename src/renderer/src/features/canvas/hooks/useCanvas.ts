/**
 * ============================================================================
 * Lumina Spatial Canvas Hook (useCanvas)
 * ============================================================================
 * Central state management hook for spatial canvas operations:
 * - Nodes and edges data structures with defensive validation
 * - Viewport transformations (zoom with screen anchoring, smooth panning)
 * - Screen-to-canvas coordinate projections
 * - Single & batch node creations, multi-selection drags, and deletions
 * - Auto-persistence change notifications
 * ============================================================================
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  CanvasViewport,
  CanvasNode,
  CanvasEdge,
  CanvasStroke,
  CanvasData,
  CanvasNodeColor,
  CanvasEdgeLineStyle,
  CanvasEdgeStrokeDash,
  CanvasEdgeEnd,
  CanvasShapeType
} from '../types'
import { normalizeNode, safeNumber } from '../utils/canvasUtils'

export interface UseCanvasOptions {
  initialData?: CanvasData
  onChange?: (data: CanvasData) => void
  snapToGrid?: boolean
}

interface CanvasHistorySnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  strokes: CanvasStroke[]
}

/**
 * Module-level shared clipboard so copying nodes/edges in one Canvas tab
 * (Ctrl+C) pastes cleanly into any other open Canvas tab (Ctrl+V).
 */
let sharedCanvasClipboard: {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  pasteCount: number
} | null = null

export function useCanvas(options: UseCanvasOptions = {}) {
  // Normalize initial nodes safely
  const [nodes, setNodes] = useState<CanvasNode[]>(() => {
    const rawNodes = options.initialData?.nodes || []
    return rawNodes.map(normalizeNode)
  })

  // Sanitize initial edges (filter out empty or invalid edges)
  const [edges, setEdges] = useState<CanvasEdge[]>(() => {
    const rawEdges = options.initialData?.edges || []
    return rawEdges.filter((e) => e && e.id && e.fromNode && e.toNode)
  })

  // Sanitize initial freehand strokes
  const [strokes, setStrokes] = useState<CanvasStroke[]>(() => {
    const rawStrokes = options.initialData?.strokes || []
    return rawStrokes.filter((s) => s && s.id && Array.isArray(s.points) && s.points.length > 0)
  })

  // Initialize viewport with zoom clamped between 0.1 and 2.5
  const [viewport, setViewport] = useState<CanvasViewport>(() => {
    const vp = options.initialData?.viewport
    return {
      x: safeNumber(vp?.x, 0),
      y: safeNumber(vp?.y, 0),
      zoom: Math.min(Math.max(safeNumber(vp?.zoom, 1), 0.1), 2.5)
    }
  })

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const selectedNodeIdsRef = useRef<string[]>([])
  selectedNodeIdsRef.current = selectedNodeIds
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const selectedEdgeIdRef = useRef<string | null>(null)
  selectedEdgeIdRef.current = selectedEdgeId
  const [isPanning, setIsPanning] = useState(false)

  const nodesRef = useRef<CanvasNode[]>(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef<CanvasEdge[]>(edges)
  edgesRef.current = edges
  const strokesRef = useRef<CanvasStroke[]>(strokes)
  strokesRef.current = strokes

  // Undo / Redo History Stacks (100-step deep snapshots including freehand strokes)
  const undoStackRef = useRef<CanvasHistorySnapshot[]>([])
  const redoStackRef = useRef<CanvasHistorySnapshot[]>([])
  const [, setHistoryCount] = useState(0)

  const captureSnapshot = (): CanvasHistorySnapshot => ({
    nodes: nodesRef.current.map((n) => ({ ...n })),
    edges: edgesRef.current.map((e) => ({ ...e })),
    strokes: strokesRef.current.map((s) => ({
      ...s,
      points: s.points.map((pt) => ({ ...pt }))
    }))
  })

  const pushHistory = useCallback(() => {
    undoStackRef.current.push(captureSnapshot())
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift()
    }
    redoStackRef.current = []
    setHistoryCount((c) => c + 1)
  }, [])

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const prevSnapshot = undoStackRef.current.pop()!
    redoStackRef.current.push(captureSnapshot())
    if (redoStackRef.current.length > 100) {
      redoStackRef.current.shift()
    }
    setNodes(prevSnapshot.nodes)
    setEdges(prevSnapshot.edges)
    setStrokes(prevSnapshot.strokes)
    setSelectedNodeIds([])
    setSelectedEdgeId(null)
    setHistoryCount((c) => c + 1)
  }, [])

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    const nextSnapshot = redoStackRef.current.pop()!
    undoStackRef.current.push(captureSnapshot())
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift()
    }
    setNodes(nextSnapshot.nodes)
    setEdges(nextSnapshot.edges)
    setStrokes(nextSnapshot.strokes)
    setSelectedNodeIds([])
    setSelectedEdgeId(null)
    setHistoryCount((c) => c + 1)
  }, [])

  const canUndo = undoStackRef.current.length > 0
  const canRedo = redoStackRef.current.length > 0

  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const initialViewportRef = useRef<CanvasViewport>({ x: 0, y: 0, zoom: 1 })
  const isFirstRenderRef = useRef(true)
  const skipNextEmitRef = useRef(false)
  const onChangeRef = useRef(options.onChange)
  onChangeRef.current = options.onChange

  // Hydrate canvas if initialData arrives asynchronously after mount (e.g. workspace load on refresh)
  const hasHydratedContentRef = useRef(
    (options.initialData?.nodes?.length || 0) > 0 ||
      (options.initialData?.edges?.length || 0) > 0 ||
      (options.initialData?.strokes?.length || 0) > 0
  )

  useEffect(() => {
    const incoming = options.initialData
    if (!incoming) return
    const incomingHasContent =
      (incoming.nodes?.length || 0) > 0 ||
      (incoming.edges?.length || 0) > 0 ||
      (incoming.strokes?.length || 0) > 0
    const localIsEmpty =
      nodesRef.current.length === 0 &&
      edgesRef.current.length === 0 &&
      strokesRef.current.length === 0

    if (incomingHasContent && localIsEmpty && !hasHydratedContentRef.current) {
      hasHydratedContentRef.current = true
      skipNextEmitRef.current = true
      setNodes((incoming.nodes || []).map(normalizeNode))
      setEdges((incoming.edges || []).filter((e) => e && e.id && e.fromNode && e.toNode))
      setStrokes(
        (incoming.strokes || []).filter(
          (s) => s && s.id && Array.isArray(s.points) && s.points.length > 0
        )
      )
      if (incoming.viewport) {
        setViewport({
          x: safeNumber(incoming.viewport.x, 0),
          y: safeNumber(incoming.viewport.y, 0),
          zoom: Math.min(Math.max(safeNumber(incoming.viewport.zoom, 1), 0.1), 2.5)
        })
      }
    }
  }, [options.initialData])

  // Notify parent component on state mutations (for auto-saving)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    if (skipNextEmitRef.current) {
      skipNextEmitRef.current = false
      return
    }
    hasHydratedContentRef.current = true
    onChangeRef.current?.({
      nodes,
      edges,
      strokes,
      viewport,
      ...(typeof options.snapToGrid === 'boolean' ? { snapToGrid: options.snapToGrid } : {})
    })
  }, [nodes, edges, strokes, viewport, options.snapToGrid])

  /**
   * Projects screen client coordinates (e.g. mouse event) into canvas coordinate space.
   */
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number, containerRect?: DOMRect | null) => {
      const zoom = viewport.zoom || 1
      const left = containerRect ? containerRect.left : 0
      const top = containerRect ? containerRect.top : 0
      const relX = screenX - left
      const relY = screenY - top
      return {
        x: (relX - viewport.x) / zoom,
        y: (relY - viewport.y) / zoom
      }
    },
    [viewport]
  )

  /**
   * Zooms smoothly into/out of a specific anchor point on the screen (e.g. cursor position).
   */
  const zoomAt = useCallback((deltaZoom: number, anchorX: number, anchorY: number, containerRect: DOMRect) => {
    setViewport((prev) => {
      const nextZoom = Math.min(Math.max(Number((prev.zoom + deltaZoom).toFixed(2)), 0.1), 2.5)
      if (nextZoom === prev.zoom) return prev

      const relX = anchorX - containerRect.left
      const relY = anchorY - containerRect.top

      const canvasX = (relX - prev.x) / prev.zoom
      const canvasY = (relY - prev.y) / prev.zoom

      return {
        zoom: nextZoom,
        x: Math.round(relX - canvasX * nextZoom),
        y: Math.round(relY - canvasY * nextZoom)
      }
    })
  }, [])

  /**
   * Resets viewport translation and zoom back to default origin (0, 0) at 100%.
   */
  const resetViewport = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 })
  }, [])

  /**
   * Panning event starters and relative panBy helper.
   */
  const startPan = useCallback((screenX: number, screenY: number) => {
    setIsPanning(true)
    panStartRef.current = { x: screenX, y: screenY }
    initialViewportRef.current = { ...viewport }
  }, [viewport])

  const updatePan = useCallback((screenX: number, screenY: number) => {
    if (!isPanning) return
    const dx = screenX - panStartRef.current.x
    const dy = screenY - panStartRef.current.y
    setViewport({
      ...initialViewportRef.current,
      x: initialViewportRef.current.x + dx,
      y: initialViewportRef.current.y + dy
    })
  }, [isPanning])

  const endPan = useCallback(() => {
    setIsPanning(false)
  }, [])

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }))
  }, [])

  /**
   * Adds a single node to the canvas and selects it.
   */
  const addNode = useCallback((node: Partial<CanvasNode> & { id?: string }) => {
    pushHistory()
    const newNode = normalizeNode(node)
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeIds([newNode.id])
    return newNode
  }, [pushHistory])

  /**
   * Batch adds multiple nodes in a single state mutation.
   * Essential for high performance when dragging multiple files from the explorer.
   */
  const addNodes = useCallback((nodesList: (Partial<CanvasNode> & { id?: string })[]) => {
    if (!nodesList || nodesList.length === 0) return []
    pushHistory()
    const normalized = nodesList.map(normalizeNode)
    setNodes((prev) => [...prev, ...normalized])
    setSelectedNodeIds(normalized.map((n) => n.id))
    return normalized
  }, [pushHistory])

  /**
   * Updates position of a single node (with reference stability check).
   */
  const updateNodePosition = useCallback((id: string, x: number, y: number) => {
    const rx = Math.round(x)
    const ry = Math.round(y)
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        if (n.x === rx && n.y === ry) return n
        return { ...n, x: rx, y: ry }
      })
    )
  }, [])

  /**
   * Updates positions of multiple nodes simultaneously (for multi-selection drags).
   */
  const updateNodesPositions = useCallback(
    (updates: { id: string; x: number; y: number }[]) => {
      if (updates.length === 0) return
      const updateMap = new Map(updates.map((u) => [u.id, { x: Math.round(u.x), y: Math.round(u.y) }]))
      setNodes((prev) =>
        prev.map((n) => {
          const u = updateMap.get(n.id)
          if (!u) return n
          if (n.x === u.x && n.y === u.y) return n
          return { ...n, x: u.x, y: u.y }
        })
      )
    },
    []
  )

  /**
   * Updates note text content.
   */
  const updateNodeText = useCallback((id: string, text: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        if (n.text === text) return n
        return { ...n, text }
      })
    )
  }, [])

  /**
   * Updates node header title.
   */
  const updateNodeTitle = useCallback((id: string, title: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        if (n.title === title) return n
        return { ...n, title }
      })
    )
  }, [])

  /**
   * Updates card color theme.
   */
  const updateNodeColor = useCallback((id: string, color: CanvasNodeColor) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        if (n.color === color) return n
        return { ...n, color }
      })
    )
  }, [])

  /**
   * Updates card dimensions with minimum size clamping.
   */
  const updateNodeSize = useCallback((id: string, width: number, height: number) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        const isShape = n.type === 'shape'
        const isFramelessText = n.type === 'text' && !n.file && !n.shape
        const textFontSize = n.fontSize || 15
        const minW = isShape ? 36 : isFramelessText ? 60 : 120
        const minH = isShape
          ? 36
          : isFramelessText
            ? Math.max(32, Math.ceil(textFontSize * (textFontSize >= 24 ? 1.25 : 1.45) + 12))
            : 60
        const clampedW = Math.max(Math.round(width), minW)
        const clampedH = Math.max(Math.round(height), minH)
        if (n.width === clampedW && n.height === clampedH) return n
        return { ...n, width: clampedW, height: clampedH }
      })
    )
  }, [])

  /**
   * Updates a shape node's geometry without disconnecting wires or resetting theme/size.
   */
  const updateNodeShape = useCallback(
    (id: string, shape: CanvasShapeType) => {
      pushHistory()
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n
          return { ...n, type: 'shape', shape, shapeType: shape }
        })
      )
    },
    [pushHistory]
  )

  /**
   * Updates shape geometry for multiple nodes in batch.
   */
  const updateNodesShapes = useCallback(
    (ids: string[], shape: CanvasShapeType) => {
      if (ids.length === 0) return
      pushHistory()
      const idSet = new Set(ids)
      setNodes((prev) =>
        prev.map((n) => {
          if (!idSet.has(n.id)) return n
          return { ...n, type: 'shape', shape, shapeType: shape }
        })
      )
    },
    [pushHistory]
  )

  /**
   * Deletes a node and cleans up any connected edges automatically.
   */
  const deleteNode = useCallback((id: string) => {
    pushHistory()
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.fromNode !== id && e.toNode !== id))
    setSelectedNodeIds((prev) => prev.filter((nid) => nid !== id))
    if (selectedEdgeIdRef.current) {
      const edge = edgesRef.current.find((e) => e.id === selectedEdgeIdRef.current)
      if (edge && (edge.fromNode === id || edge.toNode === id)) {
        setSelectedEdgeId(null)
      }
    }
  }, [pushHistory])

  /**
   * Deletes all currently selected nodes (or provided ids) and cleans up connected edges.
   * If no nodes are selected but an edge is selected, deletes the selected edge.
   */
  const deleteSelected = useCallback((targetIds?: string[]) => {
    const toDelete = targetIds && targetIds.length > 0 ? targetIds : selectedNodeIdsRef.current
    if (toDelete && toDelete.length > 0) {
      pushHistory()
      const selectedSet = new Set(toDelete)
      setNodes((prev) => prev.filter((n) => !selectedSet.has(n.id)))
      setEdges((prev) => prev.filter((e) => !selectedSet.has(e.fromNode) && !selectedSet.has(e.toNode)))
      setSelectedNodeIds((prev) => prev.filter((id) => !selectedSet.has(id)))
      if (selectedEdgeIdRef.current) {
        setSelectedEdgeId(null)
      }
    } else if (selectedEdgeIdRef.current) {
      pushHistory()
      const edgeToDelete = selectedEdgeIdRef.current
      setEdges((prev) => prev.filter((e) => e.id !== edgeToDelete))
      setSelectedEdgeId(null)
    }
  }, [pushHistory])

  /**
   * Duplicates specific nodes with an offset (+32, +32) and clones internal connecting edges.
   */
  const duplicateNodes = useCallback((targetIds?: string[]) => {
    const toDup = targetIds && targetIds.length > 0 ? targetIds : selectedNodeIdsRef.current
    if (!toDup || toDup.length === 0) return []

    pushHistory()

    const dupSet = new Set(toDup)
    const idMap = new Map<string, string>()
    const currentNodes = nodesRef.current
    const nodesToDuplicate = currentNodes.filter((n) => dupSet.has(n.id))
    if (nodesToDuplicate.length === 0) return []

    const duplicatedNodes: CanvasNode[] = nodesToDuplicate.map((n) => {
      const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      idMap.set(n.id, newId)
      return {
        ...n,
        id: newId,
        x: n.x + 32,
        y: n.y + 32
      }
    })

    const currentEdges = edgesRef.current
    const clonedEdges: CanvasEdge[] = []
    currentEdges.forEach((e) => {
      if (idMap.has(e.fromNode) && idMap.has(e.toNode)) {
        clonedEdges.push({
          ...e,
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fromNode: idMap.get(e.fromNode)!,
          toNode: idMap.get(e.toNode)!
        })
      }
    })

    setNodes((prev) => [...prev, ...duplicatedNodes])
    if (clonedEdges.length > 0) {
      setEdges((prev) => [...prev, ...clonedEdges])
    }

    const newIds = duplicatedNodes.map((n) => n.id)
    setSelectedNodeIds(newIds)
    return newIds
  }, [pushHistory])

  /**
   * Copies selected nodes and their internal connecting edges to the internal canvas clipboard.
   */
  const copyNodes = useCallback((targetIds?: string[]) => {
    const toCopy = targetIds && targetIds.length > 0 ? targetIds : selectedNodeIdsRef.current
    if (!toCopy || toCopy.length === 0) return 0

    const copySet = new Set(toCopy)
    const nodesToCopy = nodesRef.current.filter((n) => copySet.has(n.id)).map((n) => ({ ...n }))
    const edgesToCopy = edgesRef.current
      .filter((e) => copySet.has(e.fromNode) && copySet.has(e.toNode))
      .map((e) => ({ ...e }))

    sharedCanvasClipboard = { nodes: nodesToCopy, edges: edgesToCopy, pasteCount: 0 }
    return nodesToCopy.length
  }, [])

  /**
   * Pastes previously copied nodes and edges with incremental offset (+32px, +32px).
   */
  const pasteNodes = useCallback(() => {
    if (!sharedCanvasClipboard || sharedCanvasClipboard.nodes.length === 0) return []

    pushHistory()

    sharedCanvasClipboard.pasteCount += 1
    const offset = 32 * sharedCanvasClipboard.pasteCount
    const idMap = new Map<string, string>()

    const pastedNodes: CanvasNode[] = sharedCanvasClipboard.nodes.map((n) => {
      const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      idMap.set(n.id, newId)
      return {
        ...n,
        id: newId,
        x: n.x + offset,
        y: n.y + offset
      }
    })

    const pastedEdges: CanvasEdge[] = sharedCanvasClipboard.edges.map((e) => ({
      ...e,
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fromNode: idMap.get(e.fromNode) || e.fromNode,
      toNode: idMap.get(e.toNode) || e.toNode
    }))

    setNodes((prev) => [...prev, ...pastedNodes])
    if (pastedEdges.length > 0) {
      setEdges((prev) => [...prev, ...pastedEdges])
    }

    const newIds = pastedNodes.map((n) => n.id)
    setSelectedNodeIds(newIds)
    return newIds
  }, [pushHistory])

  /**
   * Checks whether the shared canvas clipboard currently contains copied nodes.
   */
  const hasCopiedNodes = useCallback(() => {
    return Boolean(sharedCanvasClipboard && sharedCanvasClipboard.nodes.length > 0)
  }, [])

  /**
   * Updates font size on one or more nodes (for sleek text boxes, titles, and shapes).
   */
  const updateNodesFontSize = useCallback(
    (nodeIds: string[], fontSize: number) => {
      if (!nodeIds.length) return
      const clamped = Math.max(11, Math.min(72, Math.round(fontSize)))
      const idSet = new Set(nodeIds)
      pushHistory()
      setNodes((prev) =>
        prev.map((n) => (idSet.has(n.id) ? { ...n, fontSize: clamped } : n))
      )
    },
    [pushHistory]
  )

  /**
   * Snaps selected nodes (or all nodes) to the nearest 20px grid.
   */
  const snapNodesToGrid = useCallback((targetIds?: string[]) => {
    pushHistory()
    setNodes((prev) => {
      const targetSet = targetIds && targetIds.length > 0 ? new Set(targetIds) : null
      return prev.map((n) => {
        if (targetSet && !targetSet.has(n.id)) return n
        const snappedX = Math.round(n.x / 20) * 20
        const snappedY = Math.round(n.y / 20) * 20
        const snappedW = Math.round(n.width / 20) * 20
        const snappedH = Math.round(n.height / 20) * 20
        if (n.x === snappedX && n.y === snappedY && n.width === snappedW && n.height === snappedH) return n
        return {
          ...n,
          x: snappedX,
          y: snappedY,
          width: Math.max(snappedW, 60),
          height: Math.max(snappedH, 40)
        }
      })
    })
  }, [pushHistory])

  /**
   * Updates connector line style (curved, step, straight).
   */
  const updateEdgeLineStyle = useCallback((edgeId: string, lineStyle: CanvasEdgeLineStyle) => {
    pushHistory()
    setEdges((prev) =>
      prev.map((e) => (e.id === edgeId ? { ...e, lineStyle } : e))
    )
  }, [pushHistory])

  /**
   * Updates connector dash pattern (solid, dashed, dotted).
   */
  const updateEdgeStrokeDash = useCallback((edgeId: string, strokeDash: CanvasEdgeStrokeDash) => {
    pushHistory()
    setEdges((prev) =>
      prev.map((e) => (e.id === edgeId ? { ...e, strokeDash } : e))
    )
  }, [pushHistory])

  /**
   * Updates edge color theme.
   */
  const updateEdgeColor = useCallback((edgeId: string, color: CanvasNodeColor) => {
    pushHistory()
    setEdges((prev) =>
      prev.map((e) => (e.id === edgeId ? { ...e, color } : e))
    )
  }, [pushHistory])

  /**
   * Deletes a single edge by ID.
   */
  const deleteEdge = useCallback((edgeId: string) => {
    pushHistory()
    setEdges((prev) => prev.filter((e) => e.id !== edgeId))
    if (selectedEdgeIdRef.current === edgeId) {
      setSelectedEdgeId(null)
    }
  }, [pushHistory])

  /**
   * Updates connector edge text label (for research annotations).
   */
  const updateEdgeLabel = useCallback((edgeId: string, label: string) => {
    pushHistory()
    setEdges((prev) =>
      prev.map((e) => (e.id === edgeId ? { ...e, label } : e))
    )
  }, [pushHistory])

  /**
   * Updates connector endpoints (directed, bidirectional, or plain line).
   */
  const updateEdgeEndpoints = useCallback(
    (edgeId: string, fromEnd?: CanvasEdgeEnd, toEnd?: CanvasEdgeEnd) => {
      pushHistory()
      setEdges((prev) =>
        prev.map((e) => (e.id === edgeId ? { ...e, fromEnd, toEnd } : e))
      )
    },
    [pushHistory]
  )

  /**
   * Adds a completed freehand pencil/highlighter stroke to the canvas.
   */
  const addStroke = useCallback((stroke: CanvasStroke) => {
    if (!stroke.points || stroke.points.length === 0) return
    pushHistory()
    setStrokes((prev) => [...prev, stroke])
  }, [pushHistory])

  /**
   * Deletes one or more strokes by ID. Optionally skips pushing history
   * when part of a continuous eraser drag that already pushed history.
   */
  const deleteStrokes = useCallback((strokeIds: string[], recordHistory: boolean = true) => {
    if (!strokeIds || strokeIds.length === 0) return
    const idSet = new Set(strokeIds)
    const hasMatch = strokesRef.current.some((s) => idSet.has(s.id))
    if (!hasMatch) return
    if (recordHistory) pushHistory()
    setStrokes((prev) => prev.filter((s) => !idSet.has(s.id)))
  }, [pushHistory])

  /**
   * Clears all freehand ink strokes while preserving nodes & edges (undoable).
   */
  const clearStrokes = useCallback(() => {
    if (strokesRef.current.length === 0) return false
    pushHistory()
    setStrokes([])
    return true
  }, [pushHistory])

  /**
   * Clears the entire canvas (nodes, edges, and freehand strokes) in a single undoable step.
   */
  const clearCanvas = useCallback(() => {
    if (
      nodesRef.current.length === 0 &&
      edgesRef.current.length === 0 &&
      strokesRef.current.length === 0
    ) {
      return false
    }
    pushHistory()
    setNodes([])
    setEdges([])
    setStrokes([])
    setSelectedNodeIds([])
    setSelectedEdgeId(null)
    return true
  }, [pushHistory])

  /**
   * Automatically calculates bounding box of all nodes and centers/zooms canvas to fit container.
   */
  const zoomToFit = useCallback((containerRect?: DOMRect | null) => {
    setNodes((currentNodes) => {
      if (currentNodes.length === 0) {
        resetViewport()
        return currentNodes
      }

      const rect = containerRect || { width: window.innerWidth, height: window.innerHeight }
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      currentNodes.forEach((n) => {
        minX = Math.min(minX, n.x)
        minY = Math.min(minY, n.y)
        maxX = Math.max(maxX, n.x + (n.width || 160))
        maxY = Math.max(maxY, n.y + (n.height || 100))
      })

      const contentW = maxX - minX + 160
      const contentH = maxY - minY + 160
      const scaleX = rect.width / contentW
      const scaleY = rect.height / contentH
      const targetZoom = Math.max(0.2, Math.min(1.4, Math.min(scaleX, scaleY)))

      const midX = (minX + maxX) / 2
      const midY = (minY + maxY) / 2
      const targetX = rect.width / 2 - midX * targetZoom
      const targetY = rect.height / 2 - midY * targetZoom

      setViewport({
        x: Math.round(targetX),
        y: Math.round(targetY),
        zoom: Math.round(targetZoom * 100) / 100
      })

      return currentNodes
    })
  }, [resetViewport])

  return {
    nodes,
    edges,
    strokes,
    viewport,
    selectedNodeIds,
    selectedEdgeId,
    isPanning,
    setNodes,
    setEdges,
    setStrokes,
    setViewport,
    setSelectedNodeIds,
    setSelectedEdgeId,
    screenToCanvas,
    zoomAt,
    resetViewport,
    zoomToFit,
    startPan,
    updatePan,
    endPan,
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
    updateNodesFontSize,
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
  }
}
