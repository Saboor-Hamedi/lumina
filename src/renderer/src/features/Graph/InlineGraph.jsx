import React, { useState, useRef, useEffect, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { buildGraphData } from '../../core/utils/graphBuilder'
import { forceManyBody, forceCollide } from 'd3-force'
import './Graph.css'
import { getNodeColor, drawNode } from './graphs'
import PerformancePanel from './PerformancePanel'
import GraphMiniMap from './GraphMiniMap'
import { usePerformanceStore } from './usePerformanceStore'

const InlineGraph = React.memo(({ focusNodeId, onNavigate }) => {
  const snippets = useVaultStore((s) => s.snippets)
  const graphTheme = useSettingsStore((s) => s.settings.graphTheme || 'default')

  const graphRef = useRef()
  const containerRef = useRef()

  const [dimensions, setDimensions] = useState({ width: 0, height: 320 })

  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
          setDimensions({ width: entry.contentRect.width, height: 320 })
        }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const [graphData, setGraphData] = useState({ nodes: [], links: [] })

  // Reset zoom guard whenever the user switches to a different note
  useEffect(() => {
    hasInitialized.current = false
  }, [focusNodeId])

  useEffect(() => {
    const timer = setTimeout(() => {
      const rawData = buildGraphData(snippets, {
        graphHideTags: true,
        graphHideGhosts: true,
        graphHideOrphans: true
      })

      if (!focusNodeId) {
        setGraphData(rawData)
        return
      }

      const centralNode = rawData.nodes.find((n) => n.snippetId === focusNodeId)
      if (!centralNode) {
        setGraphData({ nodes: [], links: [] })
        return
      }

      const centralTitle = centralNode.id
      const neighbors = new Set([centralTitle])

      rawData.links.forEach((link) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source
        const targetId = typeof link.target === 'object' ? link.target.id : link.target
        if (sourceId === centralTitle) neighbors.add(targetId)
        if (targetId === centralTitle) neighbors.add(sourceId)
      })

      const filteredNodes = rawData.nodes.filter((n) => neighbors.has(n.id))
      const filteredLinks = rawData.links.filter((link) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source
        const targetId = typeof link.target === 'object' ? link.target.id : link.target
        return neighbors.has(sourceId) && neighbors.has(targetId)
      })

      setGraphData((prev) => {
        const prevNodes = new Map(prev.nodes.map((n) => [n.id, n]))
        const prevLinks = new Map(
          prev.links.map((l) => {
            const s = typeof l.source === 'object' ? l.source.id : l.source
            const t = typeof l.target === 'object' ? l.target.id : l.target
            return [`${s}|${t}`, l]
          })
        )

        const nextNodes = filteredNodes.map((n) => {
          const oldN = prevNodes.get(n.id)
          if (oldN) {
            oldN.val = n.val
            oldN.group = n.group
            oldN.primaryTag = n.primaryTag
            oldN.snippetId = n.snippetId // Ensure snippetId is always up to date
            return oldN
          }
          if (n.snippetId !== focusNodeId) {
            n.x = (Math.random() - 0.5) * 40
            n.y = (Math.random() - 0.5) * 40
          }
          return n
        })

        const nextLinks = filteredLinks.map((l) => {
          const s = typeof l.source === 'object' ? l.source.id : l.source
          const t = typeof l.target === 'object' ? l.target.id : l.target
          const oldL = prevLinks.get(`${s}|${t}`)
          if (oldL) { oldL.value = l.value; return oldL }
          return l
        })

        return { nodes: nextNodes, links: nextLinks }
      })
    }, 50)

    return () => clearTimeout(timer)
  }, [snippets, focusNodeId])

  const hasInitialized = useRef(false)
  const draggedNodeRef = useRef(null)

  // Setup forces ONCE when the graph mounts — never again
  useEffect(() => {
    if (!graphRef.current) return
    graphRef.current.d3Force('charge', forceManyBody().strength(-150))
    graphRef.current.d3Force('radial', null)
    graphRef.current.d3Force('collide', forceCollide((node) => {
      return (node.snippetId === focusNodeId ? 7 : node.val ? Math.min(5, Math.max(2, Math.sqrt(node.val) * 1.5)) : 2) + 4
    }).strength(0.8))
  }, []) // empty deps = runs once only

  // Pin center node and auto-fit when data or focus changes
  useEffect(() => {
    if (graphData.nodes.length === 0) return

    // Pin center node at origin, release all others (unless currently being dragged)
    graphData.nodes.forEach((node) => {
      if (node.snippetId === focusNodeId) {
        node.fx = 0
        node.fy = 0
      } else if (node !== draggedNodeRef.current) {
        // Don't reset fx/fy on the node the user is currently dragging
        node.fx = undefined
        node.fy = undefined
      }
    })

    // Auto-fit only the first time this focus node's data appears
    if (!hasInitialized.current) {
      hasInitialized.current = true
      setTimeout(() => {
        if (!graphRef.current) return
        graphRef.current.zoomToFit(400, 20)
      }, 300)
    }
  }, [graphData, focusNodeId])

  const [hoverNode, setHoverNode] = useState(null)

  const hoverNeighbors = React.useMemo(() => {
    if (!hoverNode) return new Set()
    const neighbors = new Set()
    graphData.links.forEach((l) => {
      const sourceId = l.source.id || l.source
      const targetId = l.target.id || l.target
      if (sourceId === hoverNode.id) neighbors.add(targetId)
      if (targetId === hoverNode.id) neighbors.add(sourceId)
    })
    return neighbors
  }, [hoverNode, graphData.links])

  const nodeColor = (node) => {
    if (node.snippetId === focusNodeId) return '#e8a825'
    return getNodeColor(node, focusNodeId)
  }

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const isActive = node.snippetId === focusNodeId
      const isHovered = hoverNode === node
      const r = isActive ? 7 : node.val ? Math.min(5, Math.max(2, Math.sqrt(node.val) * 1.5)) : 2
      const isNeighborDimmed = hoverNode && hoverNode !== node && !hoverNeighbors.has(node.id)

      drawNode(ctx, node, r, nodeColor(node), isActive, isHovered,
        false, false, isNeighborDimmed, isActive || isHovered, globalScale)
    },
    [focusNodeId, hoverNode, hoverNeighbors]
  )

  const handleNodeClick = useCallback(
    (node) => {
      if (onNavigate && node.snippetId) onNavigate(node.snippetId)
    },
    [onNavigate]
  )

  return (
    <div
      ref={containerRef}
      className={`inline-graph-container graph-theme-${graphTheme}`}
      style={{
        width: '100%',
        height: `${dimensions.height}px`,
        borderRadius: '8px',
        background: 'var(--bg-panel, #111)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {dimensions.width > 0 && (
        <>
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node, color, ctx) => {
              const r = node.snippetId === focusNodeId ? 7
                : node.val ? Math.min(5, Math.max(2, Math.sqrt(node.val) * 1.5)) : 2
              const hitRadius = Math.max(r + 5, 10) // Minimum 10px hit radius (20px diameter) for easy clicking
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x, node.y, hitRadius, 0, 2 * Math.PI, false)
              ctx.fill()
            }}
            linkColor={(link) => {
              if (!hoverNode) return 'rgba(150,150,150,0.2)'
              return link.source === hoverNode || link.target === hoverNode
                ? '#40bafa' : 'rgba(150,150,150,0.05)'
            }}
            linkWidth={(link) => {
              if (!hoverNode) return 0.2
              return link.source === hoverNode || link.target === hoverNode ? 0.4 : 0.1
            }}
            onNodeHover={(node) => {
              document.body.style.cursor = node ? 'pointer' : 'default'
              setHoverNode(node)
            }}
            onNodeClick={(node) => {
              if (graphRef.current) {
                graphRef.current.centerAt(node.x, node.y, 800)
                graphRef.current.zoom(10, 800)
              }
              setTimeout(() => {
                if (onNavigate && node.snippetId) {
                  onNavigate(node.snippetId)
                }
              }, 150)
            }}
            onNodeDrag={(node) => {
              draggedNodeRef.current = node
            }}
            onNodeDragEnd={(node) => {
              node.fx = null
              node.fy = null
              draggedNodeRef.current = null
            }}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            d3AlphaDecay={0.1}
            d3VelocityDecay={0.6}
            warmupTicks={50}
            backgroundColor="transparent"
            onRenderFramePre={() => {
              window._luminaInlineFrameStart = performance.now()
            }}
            onRenderFramePost={() => {
              const now = performance.now()
              const frameTime = now - (window._luminaInlineFrameStart || now)
              const fps = window._luminaInlineLastFrame ? 1000 / (now - window._luminaInlineLastFrame) : 60
              window._luminaInlineLastFrame = now
              if (!window._luminaInlineLastHud || now - window._luminaInlineLastHud > 500) {
                window._luminaInlineLastHud = now
                usePerformanceStore.getState().updateMetrics({
                  fps, frameTime,
                  nodesRenderTime: 0, linksRenderTime: 0,
                  nodeCount: graphData?.nodes?.length || 0,
                  linkCount: graphData?.links?.length || 0
                })
              }
            }}
          />
          <PerformancePanel compact={true} />
          <GraphMiniMap
            graphRef={graphRef}
            graphData={graphData}
            mainWidth={dimensions.width}
            mainHeight={dimensions.height}
            is3DMode={false}
          />
        </>
      )}
    </div>
  )
})

InlineGraph.displayName = 'InlineGraph'
export default InlineGraph
