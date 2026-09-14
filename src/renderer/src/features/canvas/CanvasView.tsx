/**
 * ============================================================================
 * Lumina Spatial Canvas View (CanvasView)
 * ============================================================================
 * Infinite 2D interactive canvas for spatial thinking, note organizing,
 * visual mind-mapping, and document interconnection.
 *
 * Key Capabilities:
 * 1. Infinite Viewport: Hardware-accelerated zoom (0.1x - 2.5x) and smooth pan
 * 2. Mixed Media Cards: Markdown notes, PDF documents, and image assets
 * 3. Reactive Linking: Dynamic cubic Bézier wire connections between cards
 * 4. Modular Toolbars:
 *    - ConvasToolBarCenter (Bottom Center: Select, Hand, Sticky Note)
 *    - ConvasToolBarRight (Right Edge: Vertical Zoom & Delete dock)
 * 5. High-Performance Dragging:
 *    - RAF-throttled pointer tracking
 *    - Memoized markdown previews to prevent re-parsing large documents
 *    - Batch addition for multi-file explorer drops
 * ============================================================================
 */

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { useCanvas } from './useCanvas'
import { CanvasData, CanvasNode, CanvasEdge, CanvasEdgeSide, CanvasShapeType } from './types'
import {
  COLOR_CYCLE,
  CANVAS_NODE_COLOR_HEX,
  getNodePortCoord,
  getBezierCurve,
  getDragBezierCurve,
  normalizeNode,
  findClosestPort,
  SnappedPortTarget
} from './canvasUtils'
import { CanvasNodeCard } from './CanvasNodeCard'
import { CanvasEdgeItem } from './CanvasEdgeItem'
import { ConvasToolBarCenter } from './ConvasToolBarCenter'
import { ConvasToolBarRight } from './ConvasToolBarRight'
import './canvas.css'

export interface CanvasViewProps {
  initialData?: CanvasData
  onChange?: (data: CanvasData) => void
}

interface ConnectingState {
  fromNodeId: string
  fromSide: CanvasEdgeSide
  startX: number
  startY: number
}

interface DraggingNodeInfo {
  id: string
  startX: number
  startY: number
  initialPositions: Map<string, { x: number; y: number }>
}

interface ResizingNodeInfo {
  id: string
  startX: number
  startY: number
  initialW: number
  initialH: number
}

export const CanvasView: React.FC<CanvasViewProps> = ({ initialData, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Local editing states
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'title' | 'text' | null>(null)
  const [toolMode, setToolMode] = useState<'select' | 'hand'>('select')
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanningState, setIsPanningState] = useState(false)

  // Interactive Linking / Wire connection state
  const [connecting, setConnecting] = useState<ConnectingState | null>(null)
  const connectingRef = useRef<ConnectingState | null>(null)
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [snappedTarget, setSnappedTarget] = useState<SnappedPortTarget | null>(null)
  const snappedTargetRef = useRef<SnappedPortTarget | null>(null)

  // Drag and resize operation tracking refs
  const isPanningRef = useRef(false)
  const panPrevRef = useRef({ x: 0, y: 0 })
  const draggingNodeRef = useRef<DraggingNodeInfo | null>(null)
  const resizingNodeRef = useRef<ResizingNodeInfo | null>(null)
  const rafIdRef = useRef<number | null>(null)

  // Central Canvas State Hook
  const {
    nodes,
    edges,
    viewport,
    selectedNodeIds,
    setEdges,
    setSelectedNodeIds,
    screenToCanvas,
    zoomAt,
    resetViewport,
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
    deleteSelected
  } = useCanvas({ initialData, onChange })

  // Synchronous state ref for stable event listeners
  const stateRef = useRef({
    viewport,
    nodes,
    selectedNodeIds,
    toolMode,
    isSpacePressed,
    connecting
  })
  useEffect(() => {
    stateRef.current = {
      viewport,
      nodes,
      selectedNodeIds,
      toolMode,
      isSpacePressed,
      connecting
    }
  }, [viewport, nodes, selectedNodeIds, toolMode, isSpacePressed, connecting])

  // Fast O(1) node lookup map for instant edge & port resolution
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
      toSide: CanvasEdgeSide = 'left'
    ) => {
      // Prevent self-connection
      if (fromNodeId === toNodeId) {
        setConnecting(null)
        connectingRef.current = null
        return
      }

      const newEdge: CanvasEdge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromNode: fromNodeId,
        fromSide: fromSide,
        toNode: toNodeId,
        toSide: toSide,
        lineStyle: 'curved'
      }

      setEdges((prev) => {
        // Prevent duplicate edges between the exact same pair
        const exists = prev.some(
          (e) =>
            (e.fromNode === fromNodeId && e.toNode === toNodeId) ||
            (e.fromNode === toNodeId && e.toNode === fromNodeId)
        )
        if (exists) return prev
        return [...prev, newEdge]
      })

      setConnecting(null)
      connectingRef.current = null
      setSnappedTarget(null)
      snappedTargetRef.current = null
    },
    [setEdges]
  )

  /**
   * Global keyboard shortcut listener:
   * - Spacebar (hold): activates temporary hand / pan tool
   * - Delete / Backspace: deletes selected card(s)
   * - Escape: cancels wire connecting, closes open inline editor, clears selection
   * - Ctrl+0: resets viewport to 100% origin
   * - V / H: switches tool mode
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase()
      const isInputActive = activeTag === 'input' || activeTag === 'textarea'

      if (e.code === 'Space' && !isInputActive && !e.repeat) {
        setIsSpacePressed(true)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (stateRef.current.selectedNodeIds.length > 0) {
          e.preventDefault()
          deleteSelected()
        }
      } else if (e.key === 'Escape') {
        setConnecting(null)
        connectingRef.current = null
        setSnappedTarget(null)
        snappedTargetRef.current = null
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
  }, [deleteSelected, setSelectedNodeIds, resetViewport])

  /**
   * High performance window-level pointermove and pointerup listeners.
   * Throttled using requestAnimationFrame to match the monitor refresh rate
   * without choking on high-polling gaming mice.
   */
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const currentZoom = stateRef.current.viewport.zoom || 1

        // 1. Live wire connecting line projection & magnetic proximity docking
        if (containerRef.current && connectingRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const canvasPos = screenToCanvas(e.clientX, e.clientY, rect)

          // Adaptive magnetic threshold based on zoom level (feels like ~38-45 screen px)
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

        // 2. Card resizing
        if (resizingNodeRef.current) {
          const dx = (e.clientX - resizingNodeRef.current.startX) / currentZoom
          const dy = (e.clientY - resizingNodeRef.current.startY) / currentZoom
          updateNodeSize(
            resizingNodeRef.current.id,
            resizingNodeRef.current.initialW + dx,
            resizingNodeRef.current.initialH + dy
          )
        } else if (isPanningRef.current) {
          // 3. Canvas background panning
          const dx = e.clientX - panPrevRef.current.x
          const dy = e.clientY - panPrevRef.current.y
          panPrevRef.current = { x: e.clientX, y: e.clientY }
          panBy(dx, dy)
        } else if (draggingNodeRef.current) {
          // 4. Node dragging (supports multi-card selection drag)
          const dx = (e.clientX - draggingNodeRef.current.startX) / currentZoom
          const dy = (e.clientY - draggingNodeRef.current.startY) / currentZoom

          if (draggingNodeRef.current.initialPositions.size > 1) {
            const updates: { id: string; x: number; y: number }[] = []
            draggingNodeRef.current.initialPositions.forEach((pos, id) => {
              updates.push({ id, x: pos.x + dx, y: pos.y + dy })
            })
            updateNodesPositions(updates)
          } else {
            const initialPos = draggingNodeRef.current.initialPositions.get(
              draggingNodeRef.current.id
            )
            if (initialPos) {
              updateNodePosition(
                draggingNodeRef.current.id,
                initialPos.x + dx,
                initialPos.y + dy
              )
            }
          }
        }
      })
    }

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      if (resizingNodeRef.current) {
        resizingNodeRef.current = null
      }

      // If user was dragging a wire from a port, resolve drop destination
      if (connectingRef.current) {
        // Priority 1: If magnetically snapped to a port socket, immediately dock & connect!
        if (snappedTargetRef.current) {
          completeConnection(
            connectingRef.current.fromNodeId,
            connectingRef.current.fromSide,
            snappedTargetRef.current.nodeId,
            snappedTargetRef.current.side
          )
          snappedTargetRef.current = null
          setSnappedTarget(null)
          return
        }

        const targetEl = document.elementFromPoint(e.clientX, e.clientY)
        const targetPort = targetEl?.closest('.lumina-canvas-port') as HTMLElement | null
        const targetNode = targetEl?.closest('.lumina-canvas-node') as HTMLElement | null

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
            return
          }
        } else if (targetNode) {
          const targetNodeId = targetNode.getAttribute('data-node-id')
          if (targetNodeId && targetNodeId !== connectingRef.current.fromNodeId) {
            completeConnection(
              connectingRef.current.fromNodeId,
              connectingRef.current.fromSide,
              targetNodeId,
              'left'
            )
            return
          }
        }

        // Released in empty space - cancel connection
        setConnecting(null)
        connectingRef.current = null
        setSnappedTarget(null)
        snappedTargetRef.current = null
      }

      if (isPanningRef.current) {
        isPanningRef.current = false
        setIsPanningState(false)
      }
      if (draggingNodeRef.current) {
        draggingNodeRef.current = null
      }
    }

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true })
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      window.removeEventListener('pointermove', handleGlobalPointerMove)
      window.removeEventListener('pointerup', handleGlobalPointerUp)
    }
  }, [
    panBy,
    updateNodePosition,
    updateNodesPositions,
    updateNodeSize,
    screenToCanvas,
    completeConnection
  ])

  /**
   * Wheel event listener for canvas zoom & pan.
   * Features intelligent passthrough: scrolling inside a note or PDF card
   * scrolls the card body naturally rather than panning the entire canvas.
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const target = e.target as HTMLElement
      const nodeBody = target.closest('.lumina-canvas-node-body') as HTMLElement | null
      if (nodeBody && !e.ctrlKey && !e.metaKey) {
        const isScrollable = nodeBody.scrollHeight > nodeBody.clientHeight
        if (isScrollable) {
          const scrollingUp = e.deltaY < 0
          const scrollingDown = e.deltaY > 0
          const canScrollUp = scrollingUp && nodeBody.scrollTop > 0
          const canScrollDown =
            scrollingDown && nodeBody.scrollTop + nodeBody.clientHeight < nodeBody.scrollHeight - 1

          if (canScrollUp || canScrollDown) {
            return
          }
        }
      }

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

  /**
   * Starts or completes a wire connection from a card port.
   */
  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string, side: CanvasEdgeSide) => {
      e.stopPropagation()
      e.preventDefault()
      if (!containerRef.current) return

      // If already connecting, complete to this port
      if (connectingRef.current) {
        if (connectingRef.current.fromNodeId !== nodeId) {
          completeConnection(connectingRef.current.fromNodeId, connectingRef.current.fromSide, nodeId, side)
        } else {
          setConnecting(null)
          connectingRef.current = null
          setSnappedTarget(null)
          snappedTargetRef.current = null
        }
        return
      }

      const node = nodeMap.get(nodeId)
      const portCoord = node ? getNodePortCoord(node, side) : { x: 0, y: 0 }
      const rect = containerRef.current.getBoundingClientRect()
      const canvasMouse = screenToCanvas(e.clientX, e.clientY, rect)

      const connState: ConnectingState = {
        fromNodeId: nodeId,
        fromSide: side,
        startX: portCoord.x,
        startY: portCoord.y
      }
      setConnecting(connState)
      connectingRef.current = connState
      setSnappedTarget(null)
      snappedTargetRef.current = null
      setMouseCanvasPos(canvasMouse)
    },
    [nodeMap, screenToCanvas, completeConnection]
  )

  /**
   * Deletes a connector edge.
   */
  const handleDeleteEdge = useCallback(
    (e: React.MouseEvent, edgeId: string) => {
      e.stopPropagation()
      setEdges((prev) => prev.filter((edge) => edge.id !== edgeId))
    },
    [setEdges]
  )

  /**
   * Handles canvas background mouse down (initiates pan).
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      const isNodeOrToolbar = target.closest(
        '.lumina-canvas-node, .lumina-canvas-toolbar, .lumina-canvas-port, .lumina-canvas-resize-handle'
      )

      if (connectingRef.current && !isNodeOrToolbar) {
        setConnecting(null)
        connectingRef.current = null
        setSnappedTarget(null)
        snappedTargetRef.current = null
        return
      }

      if (
        toolMode === 'hand' ||
        isSpacePressed ||
        e.button === 1 ||
        (!isNodeOrToolbar && e.button === 0)
      ) {
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

  /**
   * Handles mouse down on a node card (initiates drag or connects on click).
   */
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      if (connectingRef.current) {
        e.stopPropagation()
        e.preventDefault()
        completeConnection(connectingRef.current.fromNodeId, connectingRef.current.fromSide, node.id, 'left')
        return
      }

      if (toolMode === 'hand' || isSpacePressed) return
      if (e.button !== 0 || !containerRef.current) return

      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('button') ||
        target.closest('.lumina-canvas-port') ||
        target.closest('.lumina-canvas-resize-handle')
      ) {
        return
      }

      e.stopPropagation()

      // Shift-click supports multi-card selection
      const isCurrentlySelected = selectedNodeIds.includes(node.id)
      let currentSelected = selectedNodeIds
      if (e.shiftKey) {
        if (isCurrentlySelected) {
          currentSelected = selectedNodeIds.filter((id) => id !== node.id)
        } else {
          currentSelected = [...selectedNodeIds, node.id]
        }
        setSelectedNodeIds(currentSelected)
      } else if (!isCurrentlySelected) {
        currentSelected = [node.id]
        setSelectedNodeIds([node.id])
      }

      const initialPositions = new Map<string, { x: number; y: number }>()
      currentSelected.forEach((id) => {
        const n = nodeMap.get(id)
        if (n) initialPositions.set(id, { x: n.x, y: n.y })
      })

      if (!initialPositions.has(node.id)) {
        initialPositions.set(node.id, { x: node.x, y: node.y })
      }

      draggingNodeRef.current = {
        id: node.id,
        startX: e.clientX,
        startY: e.clientY,
        initialPositions
      }
    },
    [toolMode, isSpacePressed, completeConnection, selectedNodeIds, setSelectedNodeIds, nodeMap]
  )

  /**
   * Initiates card resizing from the bottom-right corner handle.
   */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation()
    e.preventDefault()
    resizingNodeRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      initialW: node.width,
      initialH: node.height
    }
  }, [])

  /**
   * Double clicking the canvas background creates a new sticky note at cursor.
   */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      const target = e.target as HTMLElement
      if (
        target.closest(
          '.lumina-canvas-node, .lumina-canvas-toolbar, .lumina-canvas-port, .lumina-canvas-resize-handle'
        )
      ) {
        return
      }

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

  /**
   * Unified parser to convert dropped workspace snippets into CanvasNode objects.
   */
  const buildNodeFromSnippet = useCallback((snippet: any, dropPt: { x: number; y: number }, offset: number = 0): CanvasNode => {
    const fileName = String(snippet.fileName || snippet.title || '')
    const isPdf =
      snippet.type === 'pdf' ||
      /\.pdf$/i.test(fileName) ||
      String(snippet.relativePath || '').toLowerCase().endsWith('.pdf')

    const isImage =
      snippet.type === 'image' ||
      /\.(png|jpe?g|svg|webp|gif|bmp|ico)$/i.test(fileName)

    if (isPdf) {
      return normalizeNode({
        type: 'pdf',
        title: snippet.title || fileName || 'Document.pdf',
        text: snippet.relativePath || snippet.path || fileName,
        file: snippet.id,
        x: dropPt.x + offset - 140,
        y: dropPt.y + offset - 80,
        width: 280,
        height: 160,
        color: 'red'
      })
    } else if (isImage) {
      const relPath =
        snippet.relativePath ||
        (snippet.folderId ? `${snippet.folderId}/${snippet.fileName}` : snippet.fileName)
      const clean = String(relPath || '').replace(/^[/\\]+/, '').replace(/\\/g, '/')
      const encoded = clean.split('/').map(encodeURIComponent).join('/')
      const assetUrl = `asset://local/${encoded}`

      return normalizeNode({
        type: 'image',
        title: snippet.title || fileName || 'Image',
        url: assetUrl,
        text: clean,
        file: snippet.id,
        x: dropPt.x + offset - 160,
        y: dropPt.y + offset - 120,
        width: 320,
        height: 240,
        color: 'cyan'
      })
    } else {
      const textContent = snippet.content || snippet.code || ''
      return normalizeNode({
        type: 'note',
        title: snippet.title || fileName || 'Note',
        text: textContent,
        file: snippet.id,
        x: dropPt.x + offset - 140,
        y: dropPt.y + offset - 100,
        width: 280,
        height: 200,
        color: 'yellow'
      })
    }
  }, [])

  /**
   * Listener for FileExplorer items dropped via Lumina internal DnD events.
   * Uses batch addNodes for maximum performance.
   */
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
        const batchNodes = snippets.map((s: any, idx: number) => buildNodeFromSnippet(s, pt, idx * 24))
        addNodes(batchNodes)
      }
    }

    window.addEventListener('lumina:canvas-drop-item', handleDroppedExplorerItem as EventListener)
    return () => {
      window.removeEventListener('lumina:canvas-drop-item', handleDroppedExplorerItem as EventListener)
    }
  }, [screenToCanvas, buildNodeFromSnippet, addNodes])

  /**
   * Native HTML5 dragover & drop listeners for external desktop files.
   */
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

      // 1. Check if dropped from ConvasShapes palette
      const luminaShapeData = e.dataTransfer.getData('application/lumina-shape')
      if (luminaShapeData) {
        try {
          const { shapeType, width = 140, height = 100 } = JSON.parse(luminaShapeData)
          const newNode = addNode({
            type: 'shape',
            shape: shapeType,
            title: '',
            text: '',
            x: Math.round(pt.x - width / 2),
            y: Math.round(pt.y - height / 2),
            width,
            height,
            color: 'default'
          })
          setEditingNodeId(newNode.id)
          setEditingField('text')
          return
        } catch (err) {}
      }

      // 2. Check if dropped from Lumina FileExplorer (HTML5 dataTransfer)
      const luminaSnippetData = e.dataTransfer.getData('application/lumina-snippet')
      if (luminaSnippetData) {
        try {
          const snippet = JSON.parse(luminaSnippetData)
          const node = buildNodeFromSnippet(snippet, pt)
          addNode(node)
          return
        } catch (err) {}
      }

      // 2. Check if dropped from external OS filesystem (Windows Explorer, Desktop)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        Promise.all(
          files.map(async (file, idx) => {
            const offset = idx * 24
            const fileName = file.name || ''
            const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(fileName)
            const isImg =
              file.type.startsWith('image/') ||
              /\.(png|jpe?g|svg|webp|gif|bmp|ico)$/i.test(fileName)

            if (isPdf) {
              const filePath = (file as any).path
              return normalizeNode({
                type: 'pdf',
                title: fileName,
                text: filePath || fileName,
                url: filePath ? `file://${filePath.replace(/\\/g, '/')}` : undefined,
                x: pt.x + offset - 140,
                y: pt.y + offset - 80,
                width: 280,
                height: 160,
                color: 'red'
              })
            }

            if (isImg) {
              // Read image as Data URL so it loads 100% reliably with zero broken links
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onload = (re) => resolve((re.target?.result as string) || '')
                reader.onerror = () => resolve('')
                reader.readAsDataURL(file)
              })

              return normalizeNode({
                type: 'image',
                title: fileName,
                url: dataUrl,
                x: pt.x + offset - 160,
                y: pt.y + offset - 120,
                width: 320,
                height: 240,
                color: 'cyan'
              })
            }

            // Plain text or markdown file
            const textContent = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = (re) => resolve((re.target?.result as string) || '')
              reader.onerror = () => resolve('')
              reader.readAsText(file)
            })

            return normalizeNode({
              type: 'text',
              title: fileName,
              text: textContent,
              x: pt.x + offset - 130,
              y: pt.y + offset - 90,
              width: 260,
              height: 180,
              color: 'default'
            })
          })
        ).then((newNodes) => {
          if (newNodes.length > 0) {
            addNodes(newNodes)
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
    [screenToCanvas, buildNodeFromSnippet, addNode, addNodes]
  )

  /**
   * Adds a new sticky note centered in the visible viewport.
   */
  const handleAddSticky = useCallback(() => {
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
  }, [screenToCanvas, addNode])

  /**
   * Adds a new diagramming shape centered in the visible viewport.
   */
  const handleAddShape = useCallback(
    (shapeType: CanvasShapeType, width: number, height: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const center = screenToCanvas(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect
      )
      const newNode = addNode({
        type: 'shape',
        shape: shapeType,
        title: '',
        text: '',
        x: Math.round(center.x - width / 2),
        y: Math.round(center.y - height / 2),
        width,
        height,
        color: 'default'
      })
      setEditingNodeId(newNode.id)
      setEditingField('text')
    },
    [screenToCanvas, addNode]
  )

  /**
   * Cycles card colors on palette button click.
   */
  const handleCycleColor = useCallback(
    (nodeId: string) => {
      const node = nodeMap.get(nodeId)
      if (!node) return
      const currentColor = node.color || 'default'
      const currentIndex = COLOR_CYCLE.indexOf(currentColor)
      const nextColor = COLOR_CYCLE[(currentIndex + 1) % COLOR_CYCLE.length]
      updateNodeColor(nodeId, nextColor)
    },
    [nodeMap, updateNodeColor]
  )

  const handleStartEditing = useCallback((nodeId: string, field: 'title' | 'text') => {
    setEditingNodeId(nodeId)
    setEditingField(field)
  }, [])

  const handleStopEditing = useCallback(() => {
    setEditingNodeId(null)
    setEditingField(null)
  }, [])

  // Live connecting Bézier spline while dragging from a port
  const liveConnectingLine = useMemo(() => {
    if (!connecting) return null
    const targetColor = snappedTarget ? (snappedTarget.color || 'default') : 'default'
    const targetHex = CANVAS_NODE_COLOR_HEX[targetColor] || CANVAS_NODE_COLOR_HEX.default

    let pathD: string
    if (snappedTarget) {
      // Snapped to a port socket: route cleanly into the socket port
      pathD = getBezierCurve(
        { x: connecting.startX, y: connecting.startY },
        connecting.fromSide,
        { x: snappedTarget.x, y: snappedTarget.y },
        snappedTarget.side
      ).pathD
    } else {
      // Free dragging: head of line arrives straight into the cursor with zero unnatural curve
      pathD = getDragBezierCurve(
        { x: connecting.startX, y: connecting.startY },
        connecting.fromSide,
        mouseCanvasPos
      ).pathD
    }

    return (
      <path
        d={pathD}
        className={`lumina-canvas-connecting-line ${snappedTarget ? 'snapped' : ''}`}
        style={
          {
            stroke: targetHex,
            '--snap-color': targetHex
          } as React.CSSProperties
        }
        markerEnd={`url(#arrow-${targetColor})`}
      />
    )
  }, [connecting, mouseCanvasPos, snappedTarget])

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
      className={`lumina-canvas-container ${connecting ? 'is-connecting' : ''}`}
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
        <svg className="lumina-canvas-edges-layer">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 7 5 L 0 8 z" fill="var(--text-accent, #38bdf8)" />
            </marker>
            {(Object.keys(CANVAS_NODE_COLOR_HEX) as (keyof typeof CANVAS_NODE_COLOR_HEX)[]).map((cKey) => (
              <marker
                key={cKey}
                id={`arrow-${cKey}`}
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 7 5 L 0 8 z" fill={CANVAS_NODE_COLOR_HEX[cKey]} />
              </marker>
            ))}
          </defs>
          {edges.map((edge) => (
            <CanvasEdgeItem
              key={edge.id}
              edge={edge}
              fromNode={nodeMap.get(edge.fromNode)}
              toNode={nodeMap.get(edge.toNode)}
              onDeleteEdge={handleDeleteEdge}
            />
          ))}
          {liveConnectingLine}
        </svg>

        {/* Render Node Cards (Memoized CanvasNodeCard components) */}
        {nodes.map((node) => (
          <CanvasNodeCard
            key={node.id}
            node={node}
            isSelected={selectedNodeIds.includes(node.id)}
            isEditing={editingNodeId === node.id}
            editingField={editingNodeId === node.id ? editingField : null}
            snappedPortSide={snappedTarget?.nodeId === node.id ? snappedTarget.side : null}
            onNodeMouseDown={handleNodeMouseDown}
            onPortMouseDown={handlePortMouseDown}
            onResizeMouseDown={handleResizeMouseDown}
            onStartEditing={handleStartEditing}
            onStopEditing={handleStopEditing}
            onUpdateTitle={updateNodeTitle}
            onUpdateText={updateNodeText}
            onCycleColor={handleCycleColor}
            onDeleteNode={deleteNode}
          />
        ))}
      </div>

      {/* Center Canvas Toolbar: Tool Mode (Select / Hand) & Sticky Note */}
      <ConvasToolBarCenter
        toolMode={toolMode}
        setToolMode={setToolMode}
        onAddSticky={handleAddSticky}
      />

      {/* Right Canvas Toolbar: Zoom & Delete Selected (vertical, parallel to RightSidebar) */}
      <ConvasToolBarRight
        zoom={viewport.zoom}
        onZoomIn={() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            zoomAt(0.10, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
          }
        }}
        onZoomOut={() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            zoomAt(-0.10, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
          }
        }}
        onResetViewport={resetViewport}
        onDeleteSelected={deleteSelected}
        canDelete={selectedNodeIds.length > 0}
        onAddShape={handleAddShape}
      />
    </div>
  )
}

export default CanvasView
