/**
 * ============================================================================
 * Lumina Canvas Gestures & Interactions Hook (useCanvasGestures.ts)
 * ============================================================================
 * High-performance pointer tracking and gesture recognition engine:
 * - RAF-throttled window-level pointer tracking for 120Hz/144Hz monitors
 * - Magnetic port proximity docking with adaptive thresholds
 * - Smart Link Quick-Spawn: releasing wires in open space auto-spawns connected nodes
 * - Multi-card selection drag coordination
 * - Uniform proportional shape resizing preserving aspect ratios
 * - Canvas viewport panning
 * ============================================================================
 */

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  CanvasNode,
  CanvasNodeColor,
  CanvasEdgeSide,
  CanvasViewport,
  CanvasStroke,
  CanvasStrokePoint,
  CanvasToolMode
} from '../types'
import {
  findClosestPort,
  SnappedPortTarget,
  getNodePortCoord
} from '../utils/canvasUtils'
import {
  simplifyStrokePoints,
  isPointNearStroke
} from '../utils/canvasStroke'
import {
  computeAlignmentGuides,
  AlignmentGuide
} from '../utils/canvasAlignmentGuides'

export interface ConnectingState {
  fromNodeId: string
  fromSide: CanvasEdgeSide
  startX: number
  startY: number
  color: string
}

export interface DraggingNodeInfo {
  id: string
  startX: number
  startY: number
  initialPositions: Map<string, { x: number; y: number }>
}

export interface ResizingNodeInfo {
  id: string
  startX: number
  startY: number
  initialW: number
  initialH: number
  type?: string
}

export interface UseCanvasGesturesOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  nodes: CanvasNode[]
  nodeMap: Map<string, CanvasNode>
  strokes?: CanvasStroke[]
  viewport: CanvasViewport
  selectedNodeIds: string[]
  toolMode: CanvasToolMode
  setToolMode?: (mode: CanvasToolMode) => void
  pencilColor?: CanvasNodeColor
  pencilWidth?: number
  pencilHighlighter?: boolean
  isSpacePressed: boolean
  snapToGrid: boolean
  screenToCanvas: (screenX: number, screenY: number, containerRect?: DOMRect | null) => { x: number; y: number }
  zoomAt?: (deltaZoom: number, anchorX: number, anchorY: number, containerRect: DOMRect) => void
  panBy: (dx: number, dy: number) => void
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>
  selectedEdgeId?: string | null
  setSelectedEdgeId?: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedEdgeIds?: React.Dispatch<React.SetStateAction<string[]>>
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodesPositions: (updates: { id: string; x: number; y: number }[]) => void
  updateNodeSize: (id: string, width: number, height: number) => void
  completeConnection: (fromNodeId: string, fromSide: CanvasEdgeSide, toNodeId: string, toSide?: CanvasEdgeSide) => void
  addNode: (node: Partial<CanvasNode> & { id?: string }) => CanvasNode
  addStroke?: (stroke: CanvasStroke) => void
  deleteStrokes?: (ids: string[], recordHistory?: boolean) => void
  setEditingNodeId: (id: string | null) => void
  setEditingField: (field: 'title' | 'text' | null) => void
  pushHistory?: () => void
}

export function useCanvasGestures({
  containerRef,
  nodes,
  nodeMap,
  strokes = [],
  viewport,
  selectedNodeIds,
  toolMode,
  setToolMode,
  pencilColor = 'default',
  pencilWidth = 3,
  pencilHighlighter = false,
  isSpacePressed,
  snapToGrid,
  screenToCanvas,
  zoomAt,
  panBy,
  setSelectedNodeIds,
  selectedEdgeId,
  setSelectedEdgeId,
  setSelectedEdgeIds,
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
}: UseCanvasGesturesOptions) {
  // Wire connecting states
  const [connecting, setConnecting] = useState<ConnectingState | null>(null)
  const connectingRef = useRef<ConnectingState | null>(null)
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [snappedTarget, setSnappedTarget] = useState<SnappedPortTarget | null>(null)
  const snappedTargetRef = useRef<SnappedPortTarget | null>(null)
  const connectingScreenStartRef = useRef<{ x: number; y: number } | null>(null)

  // Freehand pencil & eraser states
  const [activeStroke, setActiveStroke] = useState<CanvasStroke | null>(null)
  const activeStrokeRef = useRef<CanvasStroke | null>(null)
  const isDrawingRef = useRef(false)
  const isErasingRef = useRef(false)
  const hasPushedEraseHistoryRef = useRef(false)

  // Multi-touch pinch-to-zoom & 2-finger pan tracking
  const activeTouchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStateRef = useRef<{ lastDist: number; lastMidX: number; lastMidY: number } | null>(null)
  const latestPointerRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean }>({
    clientX: 0,
    clientY: 0,
    shiftKey: false
  })
  // Deduplicate mouseDown immediately following pointerDown in browsers (while keeping JSDOM fireEvent.mouseDown working)
  const lastPointerDownTsRef = useRef<number>(0)
  const shouldIgnoreDuplicateMouseDown = (e: React.MouseEvent | React.PointerEvent): boolean => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (e.type === 'pointerdown') {
      lastPointerDownTsRef.current = now
      return false
    }
    if (e.type === 'mousedown' && now - lastPointerDownTsRef.current < 80) {
      return true
    }
    return false
  }

  // Marquee box selection (Shift + Drag on empty canvas)
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)

  // Drag & pan tracking
  const [isPanningState, setIsPanningState] = useState(false)
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([])
  const isPanningRef = useRef(false)
  const panPrevRef = useRef({ x: 0, y: 0 })
  const draggingNodeRef = useRef<DraggingNodeInfo | null>(null)
  const resizingNodeRef = useRef<ResizingNodeInfo | null>(null)
  const hasPushedDragHistoryRef = useRef(false)
  const hasPushedResizeHistoryRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)

  // Synchronous state ref for window event listeners
  const stateRef = useRef({
    viewport,
    nodes,
    strokes,
    selectedNodeIds,
    toolMode,
    pencilColor,
    pencilWidth,
    pencilHighlighter,
    isSpacePressed,
    snapToGrid
  })
  stateRef.current = {
    viewport,
    nodes,
    strokes,
    selectedNodeIds,
    toolMode,
    pencilColor,
    pencilWidth,
    pencilHighlighter,
    isSpacePressed,
    snapToGrid
  }

  const cancelSinglePointerInteractions = useCallback(() => {
    isPanningRef.current = false
    setIsPanningState(false)
    draggingNodeRef.current = null
    resizingNodeRef.current = null
    isDrawingRef.current = false
    activeStrokeRef.current = null
    setActiveStroke(null)
    isErasingRef.current = false
    hasPushedEraseHistoryRef.current = false
    setAlignmentGuides([])
  }, [])

  /**
   * Resizing initiator (mouse, touch, stylus)
   */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent | React.PointerEvent, node: CanvasNode) => {
    if (shouldIgnoreDuplicateMouseDown(e)) return
    e.stopPropagation()
    e.preventDefault()
    resizingNodeRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      initialW: node.width,
      initialH: node.height,
      type: node.type
    }
  }, [])

  /**
   * Background canvas pointer initiator (pan, pinch-zoom, pencil, eraser, text)
   */
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      if (shouldIgnoreDuplicateMouseDown(e)) return
      const pointerEvt = e as React.PointerEvent
      const isTouch = pointerEvt.pointerType === 'touch'

      // Track active touch pointers for 2-finger pinch-to-zoom & pan
      if (isTouch && typeof pointerEvt.pointerId === 'number') {
        activeTouchPointersRef.current.set(pointerEvt.pointerId, {
          x: pointerEvt.clientX,
          y: pointerEvt.clientY
        })

        if (activeTouchPointersRef.current.size === 2) {
          cancelSinglePointerInteractions()
          const pts = Array.from(activeTouchPointersRef.current.values())
          pinchStateRef.current = {
            lastDist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1,
            lastMidX: (pts[0].x + pts[1].x) / 2,
            lastMidY: (pts[0].y + pts[1].y) / 2
          }
          return
        }
      }

      // If in connecting mode, clicking the background cancels the wire cleanly
      if (connectingRef.current) {
        setConnecting(null)
        connectingRef.current = null
        setSnappedTarget(null)
        snappedTargetRef.current = null
        connectingScreenStartRef.current = null
        return
      }

      const target = e.target as HTMLElement | null
      const isToolbarOrControl = target?.closest?.(
        '.lumina-canvas-toolbar, .lumina-canvas-minimap, .lumina-canvas-pencil-bar'
      )
      if (isToolbarOrControl) return

      // Pencil freehand drawing works anywhere on the canvas (even over shapes!)
      if (toolMode === 'pencil' && !isSpacePressed && (e.button === 0 || isTouch)) {
        if (!containerRef.current) return
        e.preventDefault()
        const rect = containerRef.current.getBoundingClientRect()
        const pt = screenToCanvas(e.clientX, e.clientY, rect)
        const strokePt: CanvasStrokePoint = {
          x: Math.round(pt.x * 10) / 10,
          y: Math.round(pt.y * 10) / 10,
          ...(typeof pointerEvt.pressure === 'number' && pointerEvt.pressure > 0
            ? { pressure: Math.round(pointerEvt.pressure * 100) / 100 }
            : {})
        }
        const newStroke: CanvasStroke = {
          id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          points: [strokePt],
          color: pencilColor,
          strokeWidth: pencilHighlighter ? Math.max(12, pencilWidth) : pencilWidth,
          opacity: pencilHighlighter ? 0.34 : 0.95,
          tool: pencilHighlighter ? 'highlighter' : 'pencil'
        }
        isDrawingRef.current = true
        activeStrokeRef.current = newStroke
        setActiveStroke(newStroke)
        setSelectedNodeIds([])
        setSelectedEdgeId?.(null)
        setSelectedEdgeIds?.([])
        setEditingNodeId(null)
        setEditingField(null)
        return
      }

      // Eraser drag works anywhere on the canvas
      if (toolMode === 'eraser' && !isSpacePressed && (e.button === 0 || isTouch)) {
        if (!containerRef.current) return
        e.preventDefault()
        isErasingRef.current = true
        hasPushedEraseHistoryRef.current = false
        const rect = containerRef.current.getBoundingClientRect()
        const pt = screenToCanvas(e.clientX, e.clientY, rect)
        const hitIds = stateRef.current.strokes
          .filter((s) => isPointNearStroke(s, pt.x, pt.y, 16 / (stateRef.current.viewport.zoom || 1)))
          .map((s) => s.id)
        if (hitIds.length > 0 && deleteStrokes) {
          pushHistory?.()
          hasPushedEraseHistoryRef.current = true
          deleteStrokes(hitIds, false)
        }
        return
      }

      const isInteractive = target?.closest?.(
        '.lumina-canvas-node, .lumina-canvas-port, .lumina-canvas-resize-handle, .lumina-canvas-edge-group'
      )
      if (isInteractive) return

      // Text tool: click anywhere on empty canvas to drop a sleek frameless text box & start typing immediately
      if (toolMode === 'text' && !isSpacePressed && (e.button === 0 || isTouch)) {
        if (!containerRef.current) return
        e.preventDefault()
        const rect = containerRef.current.getBoundingClientRect()
        const pt = screenToCanvas(e.clientX, e.clientY, rect)
        let x = pt.x - 100
        let y = pt.y - 22
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
          height: 44,
          color: 'default'
        })
        setEditingNodeId(newNode.id)
        setEditingField('text')
        setToolMode?.('select')
        return
      }

      // Select tool (V) on empty canvas: click clears selection, drag draws Marquee Box Selection
      // (Hand tool H, Space+Drag, middle-mouse drag, or touch drag pans the canvas)
      if (toolMode === 'select' && !isSpacePressed && e.button === 0 && !isTouch && containerRef.current) {
        e.preventDefault()
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        const rect = containerRef.current.getBoundingClientRect()
        const pt = screenToCanvas(e.clientX, e.clientY, rect)
        marqueeStartRef.current = pt
        setMarqueeBox({ x: pt.x, y: pt.y, width: 0, height: 0 })
        if (!e.shiftKey) {
          setSelectedNodeIds([])
        }
        setSelectedEdgeId?.(null)
        setSelectedEdgeIds?.([])
        setEditingNodeId(null)
        setEditingField(null)
        return
      }

      if (e.button === 1 || isTouch || toolMode === 'hand' || isSpacePressed) {
        e.preventDefault()
        isPanningRef.current = true
        setIsPanningState(true)
        panPrevRef.current = { x: e.clientX, y: e.clientY }

        if (isTouch && toolMode !== 'hand' && !isSpacePressed) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          setSelectedNodeIds([])
          setSelectedEdgeId?.(null)
          setSelectedEdgeIds?.([])
          setEditingNodeId(null)
          setEditingField(null)
        }
      }
    },
    [
      toolMode,
      setToolMode,
      pencilColor,
      pencilWidth,
      pencilHighlighter,
      isSpacePressed,
      snapToGrid,
      containerRef,
      screenToCanvas,
      addNode,
      deleteStrokes,
      pushHistory,
      cancelSinglePointerInteractions,
      setSelectedNodeIds,
      setSelectedEdgeId,
      setSelectedEdgeIds,
      setEditingNodeId,
      setEditingField
    ]
  )

  /**
   * Node card dragging initiator (mouse, touch, stylus)
   */
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent | React.PointerEvent, node: CanvasNode) => {
      if (shouldIgnoreDuplicateMouseDown(e)) return
      // Allow pencil / eraser to draw or erase right over nodes without grabbing them
      if (toolMode === 'pencil' || toolMode === 'eraser') return

      // If in connecting mode, clicking node body cancels wire cleanly
      if (connectingRef.current) {
        setConnecting(null)
        connectingRef.current = null
        setSnappedTarget(null)
        snappedTargetRef.current = null
        connectingScreenStartRef.current = null
        return
      }

      const pointerEvt = e as React.PointerEvent
      const isTouch = pointerEvt.pointerType === 'touch'
      if (!isTouch && e.button !== 0) return
      if (toolMode === 'hand' || isSpacePressed) return

      // Don't drag if clicking buttons, inputs, ports, or handles
      const target = e.target as HTMLElement | null
      if (
        target?.closest?.(
          '.lumina-canvas-port, .lumina-canvas-resize-handle, .lumina-canvas-action-btn, button, input, textarea'
        )
      ) {
        return
      }

      e.stopPropagation()
      e.preventDefault()

      setSelectedEdgeId?.(null)
      setSelectedEdgeIds?.([])

      const isMulti = e.shiftKey || e.ctrlKey || e.metaKey
      const isAlreadySelected = selectedNodeIds.includes(node.id)

      let currentSelection: string[]
      if (isMulti) {
        currentSelection = isAlreadySelected
          ? selectedNodeIds.filter((id) => id !== node.id)
          : [...selectedNodeIds, node.id]
        setSelectedNodeIds(currentSelection)
      } else if (!isAlreadySelected) {
        currentSelection = [node.id]
        setSelectedNodeIds(currentSelection)
      } else {
        currentSelection = selectedNodeIds
      }

      const initialPositions = new Map<string, { x: number; y: number }>()
      currentSelection.forEach((selectedId) => {
        const found = nodeMap.get(selectedId)
        if (found) {
          initialPositions.set(selectedId, { x: found.x, y: found.y })
        }
      })
      // Ensure the dragged node is always present in initialPositions
      initialPositions.set(node.id, { x: node.x, y: node.y })

      draggingNodeRef.current = {
        id: node.id,
        startX: e.clientX,
        startY: e.clientY,
        initialPositions
      }
    },
    [toolMode, isSpacePressed, selectedNodeIds, nodeMap, setSelectedNodeIds, setSelectedEdgeId, setSelectedEdgeIds]
  )

  /**
   * Initiates wire connecting from a specific port knob (mouse, touch, stylus)
   */
  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent | React.PointerEvent, nodeId: string, side: CanvasEdgeSide) => {
      if (shouldIgnoreDuplicateMouseDown(e)) return
      if (toolMode === 'pencil' || toolMode === 'eraser') return
      e.stopPropagation()
      e.preventDefault()
      if (toolMode === 'hand' || isSpacePressed) return

      // If already in connecting mode, clicking this port completes the connection or cancels
      if (connectingRef.current) {
        if (connectingRef.current.fromNodeId !== nodeId) {
          completeConnection(
            connectingRef.current.fromNodeId,
            connectingRef.current.fromSide,
            nodeId,
            side
          )
        }
        setConnecting(null)
        connectingRef.current = null
        setSnappedTarget(null)
        snappedTargetRef.current = null
        connectingScreenStartRef.current = null
        return
      }

      const sourceNode = nodeMap.get(nodeId)
      if (!sourceNode) return

      const portPt = getNodePortCoord(sourceNode, side)
      const color = sourceNode.color || 'default'

      connectingScreenStartRef.current = { x: e.clientX, y: e.clientY }
      const newConn: ConnectingState = {
        fromNodeId: nodeId,
        fromSide: side,
        startX: portPt.x,
        startY: portPt.y,
        color
      }
      setConnecting(newConn)
      connectingRef.current = newConn
      setMouseCanvasPos(portPt)
    },
    [toolMode, isSpacePressed, nodeMap, completeConnection]
  )

  /**
   * Window-level RAF pointer tracking (mouse, touch, stylus, pinch-to-zoom, pencil, eraser)
   */
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      // Multi-touch 2-finger pinch-to-zoom & pan
      if (e.pointerType === 'touch' && activeTouchPointersRef.current.has(e.pointerId)) {
        activeTouchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (activeTouchPointersRef.current.size === 2 && pinchStateRef.current && containerRef.current) {
          const pts = Array.from(activeTouchPointersRef.current.values())
          const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1
          const midX = (pts[0].x + pts[1].x) / 2
          const midY = (pts[0].y + pts[1].y) / 2

          const dx = midX - pinchStateRef.current.lastMidX
          const dy = midY - pinchStateRef.current.lastMidY
          const ratio = dist / (pinchStateRef.current.lastDist || 1)
          const currentZoom = stateRef.current.viewport.zoom || 1
          const deltaZoom = currentZoom * (ratio - 1)

          pinchStateRef.current = { lastDist: dist, lastMidX: midX, lastMidY: midY }

          if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
            panBy(dx, dy)
          }
          if (zoomAt && Math.abs(deltaZoom) > 0.004) {
            const rect = containerRef.current.getBoundingClientRect()
            zoomAt(deltaZoom, midX, midY, rect)
          }
          return
        }
      }

      // Immediate high-frequency sampling for Pencil drawing (Shift snaps straight 0°/45°/90° lines!)
      if (isDrawingRef.current && activeStrokeRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const canvasPos = screenToCanvas(e.clientX, e.clientY, rect)
        const pts = activeStrokeRef.current.points

        if (e.shiftKey && pts.length >= 1) {
          const origin = pts[0]
          const dx = canvasPos.x - origin.x
          const dy = canvasPos.y - origin.y
          const dist = Math.hypot(dx, dy)
          // Snap angle to nearest 15° increment for architectural straight lines
          const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12)
          const endPt: CanvasStrokePoint = {
            x: Math.round((origin.x + Math.cos(angle) * dist) * 10) / 10,
            y: Math.round((origin.y + Math.sin(angle) * dist) * 10) / 10
          }
          const updated: CanvasStroke = {
            ...activeStrokeRef.current,
            points: [origin, endPt]
          }
          activeStrokeRef.current = updated
          setActiveStroke(updated)
          return
        }

        const prev = pts[pts.length - 1]
        const minStep = 1.6 / (stateRef.current.viewport.zoom || 1)
        if (!prev || Math.hypot(canvasPos.x - prev.x, canvasPos.y - prev.y) >= minStep) {
          const nextPt: CanvasStrokePoint = {
            x: Math.round(canvasPos.x * 10) / 10,
            y: Math.round(canvasPos.y * 10) / 10,
            ...(typeof e.pressure === 'number' && e.pressure > 0
              ? { pressure: Math.round(e.pressure * 100) / 100 }
              : {})
          }
          const updated: CanvasStroke = {
            ...activeStrokeRef.current,
            points: [...pts, nextPt]
          }
          activeStrokeRef.current = updated
          setActiveStroke(updated)
        }
        return
      }

      // Smooth drag-to-erase across freehand strokes
      if (isErasingRef.current && containerRef.current && deleteStrokes) {
        const rect = containerRef.current.getBoundingClientRect()
        const canvasPos = screenToCanvas(e.clientX, e.clientY, rect)
        const hitIds = stateRef.current.strokes
          .filter((s) => isPointNearStroke(s, canvasPos.x, canvasPos.y, 16 / (stateRef.current.viewport.zoom || 1)))
          .map((s) => s.id)
        if (hitIds.length > 0) {
          if (!hasPushedEraseHistoryRef.current) {
            pushHistory?.()
            hasPushedEraseHistoryRef.current = true
          }
          deleteStrokes(hitIds, false)
        }
        return
      }

      // Always record latest pointer coordinates and let a single vsync-aligned rAF consume them
      // (never cancelling an in-flight rAF avoids frame starvation on high-polling mice & trackpads)
      latestPointerRef.current.clientX = e.clientX
      latestPointerRef.current.clientY = e.clientY
      latestPointerRef.current.shiftKey = e.shiftKey

      if (rafIdRef.current !== null) return

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const { clientX, clientY, shiftKey } = latestPointerRef.current
        const currentZoom = stateRef.current.viewport.zoom || 1

        // 0. Marquee selection box live update (rAF-throttled for 120Hz smoothness)
        if (marqueeStartRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const pt = screenToCanvas(clientX, clientY, rect)
          const start = marqueeStartRef.current
          const x = Math.min(start.x, pt.x)
          const y = Math.min(start.y, pt.y)
          const width = Math.abs(pt.x - start.x)
          const height = Math.abs(pt.y - start.y)
          setMarqueeBox({ x, y, width, height })
          if (width > 3 || height > 3) {
            const matched = stateRef.current.nodes
              .filter(
                (n) =>
                  n.x < x + width &&
                  n.x + (n.width || 140) > x &&
                  n.y < y + height &&
                  n.y + (n.height || 100) > y
              )
              .map((n) => n.id)
            setSelectedNodeIds(matched)
          }
          return
        }

        // 1. Live wire connecting & magnetic docking
        if (containerRef.current && connectingRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const canvasPos = screenToCanvas(clientX, clientY, rect)
          const magneticThreshold = Math.max(28, Math.min(65, 40 / (currentZoom || 1)))
          const snap = findClosestPort(
            canvasPos,
            stateRef.current.nodes,
            connectingRef.current.fromNodeId,
            magneticThreshold
          )

          if (snap) {
            snappedTargetRef.current = snap
            setSnappedTarget(snap)
            setMouseCanvasPos({ x: snap.x, y: snap.y })
          } else {
            snappedTargetRef.current = null
            setSnappedTarget(null)
            setMouseCanvasPos(canvasPos)
          }
        }

        // 2. Card / Shape resizing
        if (resizingNodeRef.current) {
          if (!hasPushedResizeHistoryRef.current) {
            pushHistory?.()
            hasPushedResizeHistoryRef.current = true
          }
          const dx = (clientX - resizingNodeRef.current.startX) / currentZoom
          const dy = (clientY - resizingNodeRef.current.startY) / currentZoom
          const initialW = resizingNodeRef.current.initialW
          const initialH = resizingNodeRef.current.initialH
          const activeShape = nodeMap.get(resizingNodeRef.current.id)?.shape
          const isFreeResizeShape =
            activeShape === 'frame' ||
            activeShape === 'rectangle' ||
            activeShape === 'rounded-rectangle' ||
            activeShape === 'pill'
          const isProportionalShape =
            resizingNodeRef.current.type === 'shape' && !isFreeResizeShape

          let newW: number
          let newH: number

          if (isProportionalShape || shiftKey) {
            // Uniform proportional scaling for geometric icons (or when holding Shift)
            const diag = Math.hypot(initialW, initialH) || 1
            const projDelta = (dx * initialW + dy * initialH) / diag
            const scale = Math.max(0.2, (diag + projDelta) / diag)
            newW = Math.round(initialW * scale)
            newH = Math.round(initialH * scale)
          } else {
            newW = Math.round(initialW + dx)
            newH = Math.round(initialH + dy)
          }

          if (stateRef.current.snapToGrid) {
            newW = Math.round(newW / 20) * 20
            newH = Math.round(newH / 20) * 20
          }
          updateNodeSize(resizingNodeRef.current.id, newW, newH)
        } else if (isPanningRef.current) {
          // 3. Canvas background panning (1:1 instant tracking, zero frame starvation)
          const dx = clientX - panPrevRef.current.x
          const dy = clientY - panPrevRef.current.y
          panPrevRef.current = { x: clientX, y: clientY }
          if (dx !== 0 || dy !== 0) {
            panBy(dx, dy)
          }
        } else if (draggingNodeRef.current) {
          // 4. Node dragging
          if (!hasPushedDragHistoryRef.current) {
            pushHistory?.()
            hasPushedDragHistoryRef.current = true
          }
          const dx = (clientX - draggingNodeRef.current.startX) / currentZoom
          const dy = (clientY - draggingNodeRef.current.startY) / currentZoom
          const shouldSnap = stateRef.current.snapToGrid

          if (draggingNodeRef.current.initialPositions.size > 1) {
            setAlignmentGuides([])
            const updates: { id: string; x: number; y: number }[] = []
            draggingNodeRef.current.initialPositions.forEach((pos, id) => {
              let targetX = pos.x + dx
              let targetY = pos.y + dy
              if (shouldSnap) {
                targetX = Math.round(targetX / 20) * 20
                targetY = Math.round(targetY / 20) * 20
              }
              updates.push({ id, x: targetX, y: targetY })
            })
            updateNodesPositions(updates)
          } else {
            const initialPos = draggingNodeRef.current.initialPositions.get(
              draggingNodeRef.current.id
            )
            if (initialPos) {
              let targetX = initialPos.x + dx
              let targetY = initialPos.y + dy

              const activeNode = nodeMap.get(draggingNodeRef.current.id)
              const w = activeNode?.width || 240
              const h = activeNode?.height || 150

              const alignment = computeAlignmentGuides(
                draggingNodeRef.current.id,
                targetX,
                targetY,
                w,
                h,
                stateRef.current.nodes
              )

              targetX = alignment.snappedX
              targetY = alignment.snappedY
              setAlignmentGuides(alignment.guides)

              if (shouldSnap && alignment.guides.length === 0) {
                targetX = Math.round(targetX / 20) * 20
                targetY = Math.round(targetY / 20) * 20
              }
              updateNodePosition(draggingNodeRef.current.id, targetX, targetY)
            }
          }
        }
      })
    }

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && typeof e.pointerId === 'number') {
        activeTouchPointersRef.current.delete(e.pointerId)
        if (activeTouchPointersRef.current.size < 2) {
          pinchStateRef.current = null
        }
      }

      // Commit freehand pencil stroke cleanly
      if (isDrawingRef.current) {
        isDrawingRef.current = false
        const finished = activeStrokeRef.current
        activeStrokeRef.current = null
        setActiveStroke(null)
        if (finished && finished.points.length > 0 && addStroke) {
          const simplified: CanvasStroke = {
            ...finished,
            points: simplifyStrokePoints(finished.points, 1.6)
          }
          addStroke(simplified)
        }
        return
      }

      if (marqueeStartRef.current) {
        marqueeStartRef.current = null
        setMarqueeBox(null)
        return
      }

      if (isErasingRef.current) {
        isErasingRef.current = false
        hasPushedEraseHistoryRef.current = false
        return
      }

      if (connectingRef.current) {
        let dragDist = 0
        if (connectingScreenStartRef.current) {
          dragDist = Math.hypot(
            e.clientX - connectingScreenStartRef.current.x,
            e.clientY - connectingScreenStartRef.current.y
          )
        }

        // 1. Magnetic port snap connection
        if (snappedTargetRef.current) {
          completeConnection(
            connectingRef.current.fromNodeId,
            connectingRef.current.fromSide,
            snappedTargetRef.current.nodeId,
            snappedTargetRef.current.side
          )
          setConnecting(null)
          connectingRef.current = null
          setSnappedTarget(null)
          snappedTargetRef.current = null
          connectingScreenStartRef.current = null
          return
        }

        // 2. Direct port DOM element connection
        const targetEl = document.elementFromPoint(e.clientX, e.clientY)
        const targetPort = targetEl?.closest('.lumina-canvas-port') as HTMLElement | null
        if (targetPort) {
          const targetNodeId = targetPort.getAttribute('data-node-id')
          const targetSide = (targetPort.getAttribute('data-port-side') || 'left') as CanvasEdgeSide
          if (targetNodeId && targetNodeId !== connectingRef.current.fromNodeId) {
            completeConnection(
              connectingRef.current.fromNodeId,
              connectingRef.current.fromSide,
              targetNodeId,
              targetSide
            )
            setConnecting(null)
            connectingRef.current = null
            setSnappedTarget(null)
            snappedTargetRef.current = null
            connectingScreenStartRef.current = null
            return
          }
        }

        // 3. Smart Link Quick-Spawn: releasing wire in open space auto-spawns a connected node!
        if (dragDist > 35 && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const canvasPt = screenToCanvas(e.clientX, e.clientY, rect)
          const sourceNode = nodeMap.get(connectingRef.current.fromNodeId)
          const sourceColor = sourceNode?.color || 'default'
          const sourceIsShape = sourceNode?.type === 'shape'

          const spawnW = sourceIsShape ? (sourceNode?.width || 140) : 260
          const spawnH = sourceIsShape ? (sourceNode?.height || 100) : 140
          let spawnX = canvasPt.x - spawnW / 2
          let spawnY = canvasPt.y - spawnH / 2
          if (stateRef.current.snapToGrid) {
            spawnX = Math.round(spawnX / 20) * 20
            spawnY = Math.round(spawnY / 20) * 20
          }

          const newNode = addNode({
            type: sourceIsShape ? 'shape' : 'note',
            shape: sourceIsShape ? (sourceNode?.shape || 'rectangle') : undefined,
            x: Math.round(spawnX),
            y: Math.round(spawnY),
            width: spawnW,
            height: spawnH,
            color: sourceColor,
            title: sourceIsShape ? '' : 'New Thought',
            text: ''
          })

          completeConnection(
            connectingRef.current.fromNodeId,
            connectingRef.current.fromSide,
            newNode.id,
            undefined
          )

          setEditingNodeId(newNode.id)
          setEditingField('text')

          setConnecting(null)
          connectingRef.current = null
          setSnappedTarget(null)
          snappedTargetRef.current = null
          connectingScreenStartRef.current = null
          return
        }

        // Cancel connection if small drag
        if (dragDist > 10) {
          setConnecting(null)
          connectingRef.current = null
          setSnappedTarget(null)
          snappedTargetRef.current = null
          connectingScreenStartRef.current = null
        }
      }

      if (isPanningRef.current) {
        isPanningRef.current = false
        setIsPanningState(false)
      }
      if (draggingNodeRef.current) {
        setAlignmentGuides([])
        draggingNodeRef.current = null
      }
      if (resizingNodeRef.current) {
        resizingNodeRef.current = null
      }
      hasPushedDragHistoryRef.current = false
      hasPushedResizeHistoryRef.current = false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectingRef.current) {
        setConnecting(null)
        connectingRef.current = null
        setSnappedTarget(null)
        snappedTargetRef.current = null
        connectingScreenStartRef.current = null
      }
    }

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true })
    window.addEventListener('pointerup', handleGlobalPointerUp)
    window.addEventListener('pointercancel', handleGlobalPointerUp)
    window.addEventListener('mousemove', handleGlobalPointerMove as any, { passive: true })
    window.addEventListener('mouseup', handleGlobalPointerUp as any)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      window.removeEventListener('pointermove', handleGlobalPointerMove)
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      window.removeEventListener('pointercancel', handleGlobalPointerUp)
      window.removeEventListener('mousemove', handleGlobalPointerMove as any)
      window.removeEventListener('mouseup', handleGlobalPointerUp as any)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    containerRef,
    screenToCanvas,
    zoomAt,
    updateNodeSize,
    panBy,
    updateNodesPositions,
    updateNodePosition,
    completeConnection,
    addNode,
    addStroke,
    deleteStrokes,
    pushHistory,
    setEditingNodeId,
    setEditingField,
    nodeMap
  ])

  return {
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
    isPanningRef,
    panPrevRef,
    alignmentGuides,
    handleCanvasMouseDown,
    handleResizeMouseDown,
    handleNodeMouseDown,
    handlePortMouseDown
  }
}
