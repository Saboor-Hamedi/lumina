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
import { CanvasViewport, CanvasNode, CanvasEdge, CanvasData, CanvasNodeColor } from './types'
import { normalizeNode, safeNumber } from './canvasUtils'

export interface UseCanvasOptions {
  initialData?: CanvasData
  onChange?: (data: CanvasData) => void
}

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
  const [isPanning, setIsPanning] = useState(false)

  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const initialViewportRef = useRef<CanvasViewport>({ x: 0, y: 0, zoom: 1 })
  const isFirstRenderRef = useRef(true)
  const onChangeRef = useRef(options.onChange)
  onChangeRef.current = options.onChange

  // Notify parent component on state mutations (for auto-saving)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    onChangeRef.current?.({ nodes, edges, viewport })
  }, [nodes, edges, viewport])

  /**
   * Projects screen client coordinates (e.g. mouse event) into canvas coordinate space.
   */
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number, containerRect: DOMRect) => {
      const zoom = viewport.zoom || 1
      const relX = screenX - containerRect.left
      const relY = screenY - containerRect.top
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
    const newNode = normalizeNode(node)
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeIds([newNode.id])
    return newNode
  }, [])

  /**
   * Batch adds multiple nodes in a single state mutation.
   * Essential for high performance when dragging multiple files from the explorer.
   */
  const addNodes = useCallback((nodesList: (Partial<CanvasNode> & { id?: string })[]) => {
    if (!nodesList || nodesList.length === 0) return []
    const normalized = nodesList.map(normalizeNode)
    setNodes((prev) => [...prev, ...normalized])
    setSelectedNodeIds(normalized.map((n) => n.id))
    return normalized
  }, [])

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
    const clampedW = Math.max(Math.round(width), 150)
    const clampedH = Math.max(Math.round(height), 80)
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        if (n.width === clampedW && n.height === clampedH) return n
        return { ...n, width: clampedW, height: clampedH }
      })
    )
  }, [])

  /**
   * Deletes a node and cleans up any connected edges automatically.
   */
  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.fromNode !== id && e.toNode !== id))
    setSelectedNodeIds((prev) => prev.filter((nid) => nid !== id))
  }, [])

  /**
   * Deletes all currently selected nodes (or provided ids) and cleans up connected edges.
   */
  const deleteSelected = useCallback((targetIds?: string[]) => {
    const toDelete = targetIds && targetIds.length > 0 ? targetIds : selectedNodeIdsRef.current
    if (!toDelete || toDelete.length === 0) return
    const selectedSet = new Set(toDelete)
    setNodes((prev) => prev.filter((n) => !selectedSet.has(n.id)))
    setEdges((prev) => prev.filter((e) => !selectedSet.has(e.fromNode) && !selectedSet.has(e.toNode)))
    setSelectedNodeIds((prev) => prev.filter((id) => !selectedSet.has(id)))
  }, [])

  /**
   * Duplicates specific nodes with an offset (+32, +32) and clones internal connecting edges.
   */
  const duplicateNodes = useCallback((targetIds?: string[]) => {
    const toDup = targetIds && targetIds.length > 0 ? targetIds : selectedNodeIdsRef.current
    if (!toDup || toDup.length === 0) return []

    const dupSet = new Set(toDup)
    const idMap = new Map<string, string>()
    const duplicatedNodes: CanvasNode[] = []

    setNodes((prev) => {
      const existingToDup = prev.filter((n) => dupSet.has(n.id))
      if (existingToDup.length === 0) return prev

      existingToDup.forEach((n) => {
        const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        idMap.set(n.id, newId)
        duplicatedNodes.push({
          ...n,
          id: newId,
          x: n.x + 32,
          y: n.y + 32
        })
      })

      return [...prev, ...duplicatedNodes]
    })

    setEdges((prev) => {
      const clonedEdges: CanvasEdge[] = []
      prev.forEach((e) => {
        if (idMap.has(e.fromNode) && idMap.has(e.toNode)) {
          clonedEdges.push({
            ...e,
            id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fromNode: idMap.get(e.fromNode)!,
            toNode: idMap.get(e.toNode)!
          })
        }
      })
      return clonedEdges.length > 0 ? [...prev, ...clonedEdges] : prev
    })

    const newIds = duplicatedNodes.map((n) => n.id)
    setSelectedNodeIds(newIds)
    return newIds
  }, [])

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
    viewport,
    selectedNodeIds,
    isPanning,
    setNodes,
    setEdges,
    setViewport,
    setSelectedNodeIds,
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
    deleteNode,
    deleteSelected,
    duplicateNodes
  }
}
