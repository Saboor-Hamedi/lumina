/**
 * ============================================================================
 * Lumina Canvas Viewport & Creation Actions Hook (`useCanvasViewportActions.ts`)
 * ============================================================================
 * Encapsulates wheel pan/pinch-zoom, double-click text creation, quick-add
 * sticky/shape/template placement, zoom controls, and grid snapping.
 * ============================================================================
 */

import type React from 'react'
import { useCallback, useEffect } from 'react'
import type {
  CanvasEdge,
  CanvasNode,
  CanvasNodeColor,
  CanvasShapeType,
  CanvasToolMode,
  CanvasViewport
} from '../types'
import { buildCanvasTemplate, type CanvasTemplateType } from '../utils'
import type { ToastType } from '../../../core/notification'

export interface UseCanvasViewportActionsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  nodes: CanvasNode[]
  viewport: CanvasViewport
  selectedNodeIds: string[]
  toolMode: CanvasToolMode
  snapToGrid: boolean
  setSnapToGrid: React.Dispatch<React.SetStateAction<boolean>>
  setViewport: React.Dispatch<React.SetStateAction<CanvasViewport>>
  setEdges: React.Dispatch<React.SetStateAction<CanvasEdge[]>>
  setEditingNodeId: React.Dispatch<React.SetStateAction<string | null>>
  setEditingField: React.Dispatch<React.SetStateAction<'title' | 'text' | null>>
  screenToCanvas: (clientX: number, clientY: number, rect: DOMRect) => { x: number; y: number }
  zoomAt: (delta: number, clientX: number, clientY: number, rect: DOMRect) => void
  zoomToFit: (rect?: DOMRect) => void
  panBy: (dx: number, dy: number) => void
  addNode: (node: Partial<CanvasNode>) => CanvasNode
  addNodes: (nodes: Partial<CanvasNode>[]) => CanvasNode[]
  updateNodesPositions: (updates: { id: string; x: number; y: number }[]) => void
  snapNodesToGrid: (targetIds?: string[]) => void
  showToast: (message: string, type?: ToastType) => void
}

const DOUBLE_CLICK_IGNORE_SELECTOR =
  '.lumina-canvas-node, .lumina-canvas-toolbar, .lumina-canvas-toolbar-right, .lumina-canvas-selection-toolbar, .lumina-canvas-replace-shape-popover, .lumina-canvas-export-menu, .lumina-canvas-shapes-menu, .lumina-canvas-port, .lumina-canvas-resize-handle, .lumina-canvas-minimap'

const WHEEL_IGNORE_SELECTOR =
  '.lumina-canvas-toolbar, .lumina-canvas-toolbar-right, .lumina-canvas-export-menu, .lumina-canvas-shapes-menu, .lumina-canvas-minimap, .lumina-sidebar, .right-sidebar'

export function useCanvasViewportActions({
  containerRef,
  nodes,
  viewport,
  selectedNodeIds,
  toolMode,
  snapToGrid,
  setSnapToGrid,
  setViewport,
  setEdges,
  setEditingNodeId,
  setEditingField,
  screenToCanvas,
  zoomAt,
  zoomToFit,
  panBy,
  addNode,
  addNodes,
  updateNodesPositions,
  snapNodesToGrid,
  showToast
}: UseCanvasViewportActionsOptions) {
  const handleToggleSnapToGrid = useCallback(() => {
    setSnapToGrid((prev) => {
      const next = !prev
      if (next) {
        snapNodesToGrid(selectedNodeIds.length > 0 ? selectedNodeIds : undefined)
      }
      return next
    })
  }, [setSnapToGrid, snapNodesToGrid, selectedNodeIds])

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
    [containerRef, setViewport]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      if (toolMode === 'pencil' || toolMode === 'eraser') return
      const target = e.target as HTMLElement | null
      if (target?.closest?.(DOUBLE_CLICK_IGNORE_SELECTOR)) {
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const pt = screenToCanvas(e.clientX, e.clientY, rect)
      let x = pt.x - 100
      let y = pt.y - 24
      if (snapToGrid) {
        x = Math.round(x / 20) * 20
        y = Math.round(y / 20) * 20
      }

      const newNode = addNode({
        type: 'text',
        title: 'Label',
        text: '',
        x: Math.round(x),
        y: Math.round(y),
        width: 180,
        height: 36,
        color: 'default'
      })

      setEditingNodeId(newNode.id)
      setEditingField('text')
    },
    [containerRef, toolMode, screenToCanvas, snapToGrid, addNode, setEditingNodeId, setEditingField]
  )

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.(WHEEL_IGNORE_SELECTOR)) {
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
    [containerRef, zoomAt, panBy]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [containerRef, handleWheel])

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
  }, [containerRef, screenToCanvas, addNode, setEditingNodeId, setEditingField])

  const handleAddShape = useCallback(
    (
      shapeType: CanvasShapeType,
      width = 140,
      height = 100,
      color: CanvasNodeColor | string = 'default'
    ) => {
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
        color: (color || 'default') as CanvasNodeColor
      })
      setEditingNodeId(newNode.id)
      setEditingField('text')
    },
    [containerRef, screenToCanvas, snapToGrid, addNode, setEditingNodeId, setEditingField]
  )

  const handleInsertTemplate = useCallback(
    (template: CanvasTemplateType) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const c = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
      const built = buildCanvasTemplate(template, Math.round(c.x), Math.round(c.y))
      addNodes(built.nodes)
      setEdges((prev) => [...prev, ...built.edges])
      showToast(`Inserted ${template} template`, 'success')
    },
    [containerRef, screenToCanvas, addNodes, setEdges, showToast]
  )

  const handleSetZoom = useCallback(
    (targetZoom: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const currentZoom = viewport.zoom || 1
      zoomAt(targetZoom - currentZoom, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
    },
    [containerRef, viewport.zoom, zoomAt]
  )

  const handleZoomIn = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    zoomAt(0.1, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
  }, [containerRef, zoomAt])

  const handleZoomOut = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    zoomAt(-0.1, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
  }, [containerRef, zoomAt])

  const handleZoomToFit = useCallback(() => {
    zoomToFit(containerRef.current?.getBoundingClientRect())
  }, [containerRef, zoomToFit])

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

  return {
    handleToggleSnapToGrid,
    handlePanTo,
    handleDoubleClick,
    handleAddSticky,
    handleAddShape,
    handleInsertTemplate,
    handleSetZoom,
    handleZoomIn,
    handleZoomOut,
    handleZoomToFit,
    handleSnapAllToGrid
  }
}
