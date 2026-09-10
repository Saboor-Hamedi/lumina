import { useState, useCallback, useRef, useEffect } from 'react'
import { CanvasViewport, CanvasNode, CanvasEdge, CanvasData, CanvasNodeColor } from './types'

export interface UseCanvasOptions {
  initialData?: CanvasData
  onChange?: (data: CanvasData) => void
}

export function useCanvas(options: UseCanvasOptions = {}) {
  const [nodes, setNodes] = useState<CanvasNode[]>(options.initialData?.nodes || [])
  const [edges, setEdges] = useState<CanvasEdge[]>(options.initialData?.edges || [])
  const [viewport, setViewport] = useState<CanvasViewport>(
    options.initialData?.viewport || { x: 0, y: 0, zoom: 1 }
  )
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [isPanning, setIsPanning] = useState(false)

  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const initialViewportRef = useRef<CanvasViewport>({ x: 0, y: 0, zoom: 1 })
  const isFirstRenderRef = useRef(true)
  const onChangeRef = useRef(options.onChange)
  onChangeRef.current = options.onChange

  // Notify parent on state mutations
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    onChangeRef.current?.({ nodes, edges, viewport })
  }, [nodes, edges, viewport])

  // Screen to Canvas coordinate projection
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number, containerRect: DOMRect) => {
      const relX = screenX - containerRect.left
      const relY = screenY - containerRect.top
      return {
        x: (relX - viewport.x) / viewport.zoom,
        y: (relY - viewport.y) / viewport.zoom
      }
    },
    [viewport]
  )

  // Zoom at specific screen anchor point
  const zoomAt = useCallback((deltaZoom: number, anchorX: number, anchorY: number, containerRect: DOMRect) => {
    setViewport((prev) => {
      const nextZoom = Math.min(Math.max(Number((prev.zoom + deltaZoom).toFixed(3)), 0.1), 2.5)
      if (nextZoom === prev.zoom) return prev

      const relX = anchorX - containerRect.left
      const relY = anchorY - containerRect.top

      const canvasX = (relX - prev.x) / prev.zoom
      const canvasY = (relY - prev.y) / prev.zoom

      return {
        zoom: nextZoom,
        x: relX - canvasX * nextZoom,
        y: relY - canvasY * nextZoom
      }
    })
  }, [])

  const resetViewport = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 })
  }, [])

  // Pan handlers
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

  // Node operations
  const addNode = useCallback((node: Omit<CanvasNode, 'id'> & { id?: string }) => {
    const newNode: CanvasNode = {
      ...node,
      id: node.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    }
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeIds([newNode.id])
    return newNode
  }, [])

  const updateNodePosition = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x: Math.round(x), y: Math.round(y) } : n))
    )
  }, [])

  const updateNodeText = useCallback((id: string, text: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)))
  }, [])

  const updateNodeTitle = useCallback((id: string, title: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)))
  }, [])

  const updateNodeColor = useCallback((id: string, color: CanvasNodeColor) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, color } : n)))
  }, [])

  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.fromNode !== id && e.toNode !== id))
    setSelectedNodeIds((prev) => prev.filter((nid) => nid !== id))
  }, [])

  const deleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return
    setNodes((prev) => prev.filter((n) => !selectedNodeIds.includes(n.id)))
    setEdges((prev) =>
      prev.filter(
        (e) =>
          !selectedNodeIds.includes(e.fromNode) &&
          !selectedNodeIds.includes(e.toNode)
      )
    )
    setSelectedNodeIds([])
  }, [selectedNodeIds])

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
    startPan,
    updatePan,
    endPan,
    panBy,
    addNode,
    updateNodePosition,
    updateNodeText,
    updateNodeTitle,
    updateNodeColor,
    deleteNode,
    deleteSelected
  }
}
