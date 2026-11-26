/**
 * ============================================================================
 * Lumina Canvas Selection Actions Hook (`useCanvasSelectionActions.ts`)
 * ============================================================================
 * Derives selection metadata (bounding box, active color, shape/text state)
 * and provides alignment, distribution, color, font-size, shape-replace, and
 * deletion handlers for the current selection.
 * ============================================================================
 */

import type React from 'react'
import { useCallback, useMemo } from 'react'
import type { CanvasEdge, CanvasNode, CanvasNodeColor, CanvasShapeType } from '../types'
import {
  COLOR_CYCLE,
  computeAlignedNodePositions,
  computeDistributedNodePositions,
  getSelectionBoundingBox,
  type CanvasAlignmentType,
  type CanvasDistributionType
} from '../utils'
import { SHAPE_COLOR_OPTIONS } from '../components'

export interface UseCanvasSelectionActionsOptions {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  nodeMap: Map<string, CanvasNode>
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  selectedEdgeIds: string[]
  setEdges: React.Dispatch<React.SetStateAction<CanvasEdge[]>>
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedEdgeIds: React.Dispatch<React.SetStateAction<string[]>>
  updateNodesPositions: (updates: { id: string; x: number; y: number }[]) => void
  updateNodeColor: (id: string, color: CanvasNodeColor) => void
  updateEdgeColor: (id: string, color: CanvasNodeColor) => void
  updateNodesShapes: (ids: string[], shape: CanvasShapeType) => void
  updateNodesFontSize: (ids: string[], fontSize: number) => void
  deleteSelected: () => void
  pushHistory: () => void
}

export function useCanvasSelectionActions({
  nodes,
  edges,
  nodeMap,
  selectedNodeIds,
  selectedEdgeId,
  selectedEdgeIds,
  setEdges,
  setSelectedEdgeId,
  setSelectedEdgeIds,
  updateNodesPositions,
  updateNodeColor,
  updateEdgeColor,
  updateNodesShapes,
  updateNodesFontSize,
  deleteSelected,
  pushHistory
}: UseCanvasSelectionActionsOptions) {
  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedNodeIds.includes(n.id)),
    [nodes, selectedNodeIds]
  )

  const selectionBox = useMemo(() => getSelectionBoundingBox(selectedNodes), [selectedNodes])

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
    const firstColor = (selectedNodes[0].color || 'default') as CanvasNodeColor
    const currIdx = COLOR_CYCLE.indexOf(firstColor)
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
            selectedSet.has(e.fromNode) || selectedSet.has(e.toNode) ? { ...e, color } : e
          )
        )
      } else if (selectedEdgeIds.length > 0) {
        pushHistory()
        const edgeSet = new Set(selectedEdgeIds)
        setEdges((prev) => prev.map((e) => (edgeSet.has(e.id) ? { ...e, color } : e)))
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
      const currIdx = COLOR_CYCLE.indexOf((node.color || 'default') as CanvasNodeColor)
      const nextColor = COLOR_CYCLE[(currIdx + 1) % COLOR_CYCLE.length]
      updateNodeColor(id, nextColor)
      setEdges((prev) =>
        prev.map((e) =>
          e.fromNode === id || e.toNode === id ? { ...e, color: nextColor } : e
        )
      )
    },
    [nodeMap, updateNodeColor, setEdges, pushHistory]
  )

  const selectedShapeNodes = useMemo(
    () => selectedNodes.filter((n) => n.type === 'shape' || !!n.shape || !!(n as CanvasNode & { shapeType?: CanvasShapeType }).shapeType),
    [selectedNodes]
  )

  const canReplaceShape = selectedShapeNodes.length > 0

  const selectedShapeType = useMemo(() => {
    if (selectedShapeNodes.length === 0) return null
    const first = selectedShapeNodes[0] as CanvasNode & { shapeType?: CanvasShapeType }
    return (first.shape || first.shapeType || 'rectangle') as CanvasShapeType
  }, [selectedShapeNodes])

  const selectedColorHex = useMemo(() => {
    if (selectedNodes.length === 0) return undefined
    const colorId = selectedNodes[0].color || 'default'
    const found = SHAPE_COLOR_OPTIONS.find((c) => c.id === colorId)
    return found ? found.hex : undefined
  }, [selectedNodes])

  const selectedTextNodes = useMemo(
    () =>
      selectedNodes.filter(
        (n) => n.type === 'text' && !n.file && !n.shape && !(n as CanvasNode & { shapeType?: CanvasShapeType }).shapeType
      ),
    [selectedNodes]
  )

  const canAdjustFontSize = selectedTextNodes.length > 0
  const selectedFontSize = selectedTextNodes[0]?.fontSize || 15

  const handleAdjustFontSize = useCallback(
    (nextSize: number) => {
      const targetIds = selectedTextNodes.map((n) => n.id)
      if (targetIds.length === 0) return
      updateNodesFontSize(targetIds, nextSize)
    },
    [selectedTextNodes, updateNodesFontSize]
  )

  const handleReplaceShape = useCallback(
    (newShape: CanvasShapeType) => {
      const targetIds = selectedShapeNodes.map((n) => n.id)
      if (targetIds.length === 0) return
      updateNodesShapes(targetIds, newShape)
    },
    [selectedShapeNodes, updateNodesShapes]
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
  }, [selectedNodeIds.length, selectedEdgeIds, selectedEdgeId, deleteSelected, pushHistory, setEdges, setSelectedEdgeId, setSelectedEdgeIds])

  return {
    selectedNodes,
    selectionBox,
    selectedColor,
    canReplaceShape,
    selectedShapeType,
    selectedColorHex,
    canAdjustFontSize,
    selectedFontSize,
    handleAlignSelection,
    handleDistributeSelection,
    handleCycleSelectionColor,
    handleUpdateSelectionColor,
    handleCycleColor,
    handleAdjustFontSize,
    handleReplaceShape,
    handleDeleteSelected
  }
}
