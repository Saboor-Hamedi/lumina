import React, { useState, useRef, useEffect, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { buildGraphData } from '../../core/utils/graphBuilder'
import { forceRadial, forceManyBody, forceCollide, forceCenter } from 'd3-force'
import './Graph.css'
import { getNodeColor, drawNode } from './graphs'

// Static theme colors to avoid runtime function calls during render
const THEME_COLORS = {
  default: { center: '#e8a825', node: '#666', link: 'rgba(150,150,150,0.2)' },
  dark: { center: '#fbbf24', node: '#4b5563', link: 'rgba(75,85,99,0.3)' },
  light: { center: '#d97706', node: '#9ca3af', link: 'rgba(156,163,175,0.4)' }
}

const InlineGraph = React.memo(({ focusNodeId, onNavigate }) => {
  const snippets = useVaultStore((s) => s.snippets)
  const graphTheme = useSettingsStore((s) => s.settings.graphTheme || 'default')

  const graphRef = useRef()
  const containerRef = useRef()

  const [dimensions, setDimensions] = useState({ width: 0, height: 250 }) // Default height

  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: 250
        })
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const [graphData, setGraphData] = useState({ nodes: [], links: [] })

  useEffect(() => {
    // Defer heavy calculation so the dropdown UI opens instantly without freezing
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

      // Pin central node exactly at the center for a clean layout
      centralNode.fx = 0
      centralNode.fy = 0

      const centralTitle = centralNode.id
      const neighbors = new Set()
      neighbors.add(centralTitle)

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
          if (oldL) {
            oldL.value = l.value
            return oldL
          }
          return l
        })

        return { nodes: nextNodes, links: nextLinks }
      })
    }, 50)

    return () => clearTimeout(timer)
  }, [snippets, focusNodeId])

  useEffect(() => {
    if (graphRef.current) {
      // Gentle physics for small inline graph
      graphRef.current.d3Force('charge', forceManyBody().strength(-120))
      graphRef.current.d3Force('center', forceCenter())
      // Add a stronger collision force so they don't touch/overlap each other
      graphRef.current.d3Force('collide', forceCollide((node) => {
        return (node.snippetId === focusNodeId ? 8 : node.val ? Math.min(6, Math.max(2, Math.sqrt(node.val) * 2)) : 3) + 2
      }).strength(1))

      setTimeout(() => {
        graphRef.current?.zoomToFit(0, 20)
        graphRef.current?.d3ReheatSimulation()
      }, 50)
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
    // Override default node color if it's the focus node
    if (node.snippetId === focusNodeId) return '#e8a825'
    return getNodeColor(node, focusNodeId)
  }

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const isActive = node.snippetId === focusNodeId
      const isHovered = hoverNode === node
      
      // Central node is 8. Secondary nodes are capped at 6 to ensure they never overpower the central node.
      const r = isActive ? 8 : node.val ? Math.min(6, Math.max(2, Math.sqrt(node.val) * 2)) : 3
      
      const isNeighborDimmed = hoverNode && hoverNode !== node && !hoverNeighbors.has(node.id)

      drawNode(
        ctx,
        node,
        r,
        nodeColor(node),
        isActive,
        isHovered,
        false, // isSearchMatch
        false, // isSearchDimmed
        isNeighborDimmed, // Dim nodes that are not neighbors of the hovered node
        isActive || isHovered,
        globalScale
      )
    },
    [focusNodeId, hoverNode, hoverNeighbors]
  )

  const handleNodeClick = useCallback(
    (node) => {
      if (onNavigate && node.snippetId) {
        onNavigate(node.snippetId)
      }
    },
    [onNavigate]
  )

  return (
    <div
      ref={containerRef}
      className={`inline-graph-container graph-theme-${graphTheme}`}
      style={{
        width: '100%',
        height: '250px',
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
              const r =
                node.snippetId === focusNodeId
                  ? 8
                  : node.val
                    ? Math.min(6, Math.max(2, Math.sqrt(node.val) * 2))
                    : 3
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
              ctx.fill()
            }}
            linkColor={(link) => {
              const hNode = hoverNode
              if (!hNode) return 'rgba(150,150,150,0.2)'
              const sourceId = link.source.id || link.source
              const targetId = link.target.id || link.target
              return sourceId === hNode.id || targetId === hNode.id
                ? 'rgba(255, 255, 255, 0.5)' // Lighter highlight instead of bright gold
                : 'rgba(150,150,150,0.05)' // Dim the links of non-neighbors
            }}
            linkWidth={(link) => {
              const hNode = hoverNode
              if (!hNode) return 1
              const sourceId = link.source.id || link.source
              const targetId = link.target.id || link.target
              return sourceId === hNode.id || targetId === hNode.id ? 2 : 1
            }}
            onNodeHover={(node) => {
              document.body.style.cursor = node ? 'pointer' : 'default'
              setHoverNode(node)
            }}
            onNodeClick={handleNodeClick}
            // Z-index trick: Draw the dragged/hovered node after everything else
            nodeCanvasObjectMode={(node) => (node === hoverNode ? 'after' : 'replace')}
            onNodeDragEnd={(node) => {
              // Same exact behavior as Graph.jsx - let physics take over after drop!
              if (node.snippetId !== focusNodeId) {
                node.fx = null
                node.fy = null
              }
            }}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            // Handle velocity decay - higher value means it settles much faster and doesn't drift
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.8}
            backgroundColor="transparent"
          />
        </>
      )}
    </div>
  )
})

InlineGraph.displayName = 'InlineGraph'
export default InlineGraph
