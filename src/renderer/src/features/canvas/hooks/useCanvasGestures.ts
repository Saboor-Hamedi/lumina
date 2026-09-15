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
  CanvasEdgeSide,
  CanvasViewport
} from '../types'
import {
  findClosestPort,
  SnappedPortTarget,
  getNodePortCoord
} from '../utils/canvasUtils'
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
  viewport: CanvasViewport
  selectedNodeIds: string[]
  toolMode: 'select' | 'hand'
  isSpacePressed: boolean
  snapToGrid: boolean
  screenToCanvas: (screenX: number, screenY: number, containerRect?: DOMRect | null) => { x: number; y: number }
  panBy: (dx: number, dy: number) => void
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodesPositions: (updates: { id: string; x: number; y: number }[]) => void
  updateNodeSize: (id: string, width: number, height: number) => void
  completeConnection: (fromNodeId: string, fromSide: CanvasEdgeSide, toNodeId: string, toSide?: CanvasEdgeSide) => void
  addNode: (node: Partial<CanvasNode> & { id?: string }) => CanvasNode
  setEditingNodeId: (id: string | null) => void
  setEditingField: (field: 'title' | 'text' | null) => void
  pushHistory?: () => void
}

export function useCanvasGestures({
  containerRef,
  nodes,
  nodeMap,
  viewport,
  selectedNodeIds,
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
}: UseCanvasGesturesOptions) {
  // Wire connecting states
  const [connecting, setConnecting] = useState<ConnectingState | null>(null)
  const connectingRef = useRef<ConnectingState | null>(null)
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [snappedTarget, setSnappedTarget] = useState<SnappedPortTarget | null>(null)
  const snappedTargetRef = useRef<SnappedPortTarget | null>(null)
  const connectingScreenStartRef = useRef<{ x: number; y: number } | null>(null)

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
    selectedNodeIds,
    toolMode,
    isSpacePressed,
    snapToGrid
  })
  stateRef.current = {
    viewport,
    nodes,
    selectedNodeIds,
    toolMode,
    isSpacePressed,
    snapToGrid
  }

  /**
   * Resizing initiator
   */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, node: CanvasNode) => {
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
   * Background canvas panning initiator
   */
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
      const isInteractive = target?.closest?.(
        '.lumina-canvas-node, .lumina-canvas-toolbar, .lumina-canvas-port, .lumina-canvas-resize-handle, .lumina-canvas-minimap, .lumina-canvas-edge-group'
      )
      if (isInteractive) return

      if (e.button === 0 || e.button === 1 || toolMode === 'hand' || isSpacePressed) {
        e.preventDefault()
        isPanningRef.current = true
        setIsPanningState(true)
        panPrevRef.current = { x: e.clientX, y: e.clientY }

        if (e.button === 0 && toolMode !== 'hand' && !isSpacePressed) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          setSelectedNodeIds([])
          setEditingNodeId(null)
          setEditingField(null)
        }
      }
    },
    [toolMode, isSpacePressed, setSelectedNodeIds, setEditingNodeId, setEditingField]
  )

  /**
   * Node card dragging initiator
   */
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      // If in connecting mode, clicking node body cancels wire cleanly
      if (connectingRef.current) {
        setConnecting(null)
        connectingRef.current = null
        setSnappedTarget(null)
        snappedTargetRef.current = null
        connectingScreenStartRef.current = null
        return
      }

      if (e.button !== 0) return
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
    [toolMode, isSpacePressed, selectedNodeIds, nodeMap, setSelectedNodeIds]
  )

  /**
   * Initiates wire connecting from a specific port knob
   */
  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string, side: CanvasEdgeSide) => {
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
   * Window-level RAF pointer tracking
   */
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const currentZoom = stateRef.current.viewport.zoom || 1

        // 1. Live wire connecting & magnetic docking
        if (containerRef.current && connectingRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const canvasPos = screenToCanvas(e.clientX, e.clientY, rect)
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
          const dx = (e.clientX - resizingNodeRef.current.startX) / currentZoom
          const dy = (e.clientY - resizingNodeRef.current.startY) / currentZoom
          const initialW = resizingNodeRef.current.initialW
          const initialH = resizingNodeRef.current.initialH
          const isShape = resizingNodeRef.current.type === 'shape'

          let newW: number
          let newH: number

          if (isShape || e.shiftKey) {
            // Uniform proportional scaling: preserves aspect ratio so all sides shrink and expand uniformly
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
          // 3. Canvas background panning
          const dx = e.clientX - panPrevRef.current.x
          const dy = e.clientY - panPrevRef.current.y
          panPrevRef.current = { x: e.clientX, y: e.clientY }
          panBy(dx, dy)
        } else if (draggingNodeRef.current) {
          // 4. Node dragging
          if (!hasPushedDragHistoryRef.current) {
            pushHistory?.()
            hasPushedDragHistoryRef.current = true
          }
          const dx = (e.clientX - draggingNodeRef.current.startX) / currentZoom
          const dy = (e.clientY - draggingNodeRef.current.startY) / currentZoom
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
    window.addEventListener('mousemove', handleGlobalPointerMove as any, { passive: true })
    window.addEventListener('mouseup', handleGlobalPointerUp as any)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      window.removeEventListener('pointermove', handleGlobalPointerMove)
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      window.removeEventListener('mousemove', handleGlobalPointerMove as any)
      window.removeEventListener('mouseup', handleGlobalPointerUp as any)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    containerRef,
    screenToCanvas,
    updateNodeSize,
    panBy,
    updateNodesPositions,
    updateNodePosition,
    completeConnection,
    addNode,
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
