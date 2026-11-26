/**
 * ============================================================================
 * Lumina Canvas Edge Actions Hook (`useCanvasEdgeActions.ts`)
 * ============================================================================
 * Encapsulates edge selection, connection creation/re-routing, connected port
 * tracking, and edge line-style/endpoint mutations.
 * ============================================================================
 */

import type React from 'react'
import { useCallback, useMemo, useState } from 'react'
import type {
  CanvasEdge,
  CanvasEdgeEnd,
  CanvasEdgeLineStyle,
  CanvasEdgeSide,
  CanvasNode,
  CanvasNodeColor
} from '../types'
import { getNodePortCoord, getOptimalPortPair } from '../utils'

export type CanvasEdgeEndpointsPreset = 'directed' | 'bidirectional' | 'none'

export interface UseCanvasEdgeActionsOptions {
  edges: CanvasEdge[]
  nodeMap: Map<string, CanvasNode>
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  setEdges: React.Dispatch<React.SetStateAction<CanvasEdge[]>>
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>
  deleteEdge: (edgeId: string) => void
  updateEdgeLineStyle: (edgeId: string, lineStyle: CanvasEdgeLineStyle) => void
  updateEdgeEndpoints: (edgeId: string, fromEnd: CanvasEdgeEnd, toEnd: CanvasEdgeEnd) => void
  pushHistory: () => void
}

export function useCanvasEdgeActions({
  edges,
  nodeMap,
  selectedNodeIds,
  selectedEdgeId,
  setEdges,
  setSelectedEdgeId,
  setSelectedNodeIds,
  deleteEdge,
  updateEdgeLineStyle,
  updateEdgeEndpoints,
  pushHistory
}: UseCanvasEdgeActionsOptions) {
  const [defaultLineStyle, setDefaultLineStyle] = useState<CanvasEdgeLineStyle>('curved')
  const [defaultEndpoints, setDefaultEndpoints] = useState<CanvasEdgeEndpointsPreset>('directed')
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])

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
        const existingIndex = prev.findIndex(
          (e) =>
            (e.fromNode === fromNodeId && e.toNode === toNodeId) ||
            (e.fromNode === toNodeId && e.toNode === fromNodeId)
        )

        if (existingIndex !== -1) {
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
            color: (toNode.color || 'default') as CanvasNodeColor,
            lineStyle: defaultLineStyle,
            routing: 'smart'
          }
        ]
      })
    },
    [nodeMap, setEdges, defaultLineStyle, defaultEndpoints, pushHistory]
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

  const connectedPortsMap = useMemo(() => {
    const map = new Map<
      string,
      Partial<Record<CanvasEdgeSide, { hasArrow: boolean; color?: CanvasNodeColor }>>
    >()
    for (const edge of edges) {
      const fromNode = nodeMap.get(edge.fromNode)
      const toNode = nodeMap.get(edge.toNode)
      if (!fromNode || !toNode) continue

      const dynamicPortDirection = edge.routing !== 'manual'
      const { fromSide, toSide } = getOptimalPortPair(
        fromNode,
        toNode,
        dynamicPortDirection ? undefined : edge.fromSide,
        dynamicPortDirection ? undefined : edge.toSide
      )
      const edgeColor = (edge.color || toNode.color || 'default') as CanvasNodeColor

      const fromPorts = map.get(edge.fromNode) || {}
      fromPorts[fromSide] = {
        hasArrow: edge.fromEnd === 'arrow',
        color: edgeColor
      }
      map.set(edge.fromNode, fromPorts)

      const toPorts = map.get(edge.toNode) || {}
      toPorts[toSide] = {
        hasArrow: edge.toEnd !== 'none',
        color: edgeColor
      }
      map.set(edge.toNode, toPorts)
    }
    return map
  }, [edges, nodeMap])

  const activeLineStyle = useMemo(() => {
    const edgeId = selectedEdgeIds[0] || selectedEdgeId
    if (edgeId) {
      const edge = edges.find((e) => e.id === edgeId)
      if (edge?.lineStyle) return edge.lineStyle
    }
    return defaultLineStyle
  }, [selectedEdgeIds, selectedEdgeId, edges, defaultLineStyle])

  const activeEndpoints = useMemo<CanvasEdgeEndpointsPreset>(() => {
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
        setEdges((prev) => prev.map((e) => (edgeSet.has(e.id) ? { ...e, lineStyle: style } : e)))
      } else if (selectedEdgeId) {
        updateEdgeLineStyle(selectedEdgeId, style)
      } else if (selectedNodeIds.length > 0) {
        const nodeSet = new Set(selectedNodeIds)
        setEdges((prev) =>
          prev.map((e) =>
            nodeSet.has(e.fromNode) || nodeSet.has(e.toNode) ? { ...e, lineStyle: style } : e
          )
        )
      } else if (edges.length > 0) {
        setEdges((prev) => prev.map((e) => ({ ...e, lineStyle: style })))
      }
    },
    [selectedEdgeIds, selectedEdgeId, selectedNodeIds, edges.length, updateEdgeLineStyle, setEdges, pushHistory]
  )

  const handleChangeEndpoints = useCallback(
    (endpoints: CanvasEdgeEndpointsPreset) => {
      setDefaultEndpoints(endpoints)
      const fromEnd: CanvasEdgeEnd = endpoints === 'bidirectional' ? 'arrow' : 'none'
      const toEnd: CanvasEdgeEnd = endpoints === 'none' ? 'none' : 'arrow'
      pushHistory()
      if (selectedEdgeIds.length > 0) {
        const edgeSet = new Set(selectedEdgeIds)
        setEdges((prev) =>
          prev.map((e) => (edgeSet.has(e.id) ? { ...e, fromEnd, toEnd } : e))
        )
      } else if (selectedEdgeId) {
        updateEdgeEndpoints(selectedEdgeId, fromEnd, toEnd)
      } else if (selectedNodeIds.length > 0) {
        const nodeSet = new Set(selectedNodeIds)
        setEdges((prev) =>
          prev.map((e) =>
            nodeSet.has(e.fromNode) || nodeSet.has(e.toNode) ? { ...e, fromEnd, toEnd } : e
          )
        )
      } else if (edges.length > 0) {
        setEdges((prev) => prev.map((e) => ({ ...e, fromEnd, toEnd })))
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

  return {
    selectedEdgeIds,
    setSelectedEdgeIds,
    connectedPortsMap,
    activeLineStyle,
    activeEndpoints,
    completeConnection,
    handleSelectEdge,
    handleDeleteEdge,
    handleChangeLineStyle,
    handleChangeEndpoints,
    handleApplyToAllEdges
  }
}
