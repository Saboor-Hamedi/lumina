import React, { useState, useRef, useEffect, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { buildGraphData } from '../../../core/utils/graphBuilder'
import { forceManyBody, forceCollide, forceX, forceY } from 'd3-force'
import '../css/Graph.css'
import { getNodeColor, drawNode } from '../graphs'
import PerformancePanel from '../PerformancePanel'
import { usePerformanceStore } from '../usePerformanceStore'

export interface InlineGraphProps {
  focusNodeId?: string | number
  onNavigate?: (id: any) => void
  hideMiniMap?: boolean
}

const InlineGraph: React.FC<InlineGraphProps> = React.memo(({ focusNodeId, onNavigate }) => {
  const snippets = useWorkspaceStore((s) => s.notes) || []
  const graphTheme = useSettingsStore((s) => s.settings.graphTheme || 'default')

  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hasInitialized = useRef(false)
  const draggedNodeRef = useRef<any>(null)
  const focusNodeIdRef = useRef(focusNodeId)

  const [dimensions, setDimensions] = useState({ width: 0, height: 320 })
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] })

  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height > 100 ? entry.contentRect.height : 320
        })
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    hasInitialized.current = false
  }, [focusNodeId])

  useEffect(() => {
    focusNodeIdRef.current = focusNodeId
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

      const centralNode = rawData.nodes.find((n: any) => n.snippetId === focusNodeId)
      if (!centralNode) {
        setGraphData({ nodes: [], links: [] })
        return
      }

      const centralTitle = centralNode.id
      const neighbors = new Set([centralTitle])

      rawData.links.forEach((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source
        const targetId = typeof link.target === 'object' ? link.target.id : link.target
        if (sourceId === centralTitle) neighbors.add(targetId)
        if (targetId === centralTitle) neighbors.add(sourceId)
      })

      const filteredNodes = rawData.nodes.filter((n: any) => neighbors.has(n.id))
      const filteredLinks = rawData.links.filter((link: any) => {
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

        const nextNodes = filteredNodes.map((n: any, i: number) => {
          const isCenter = n.snippetId === focusNodeId
          const angle = (i / Math.max(1, filteredNodes.length - 1)) * 2 * Math.PI + Math.PI / 4
          const radius = 75

          const oldN = prevNodes.get(n.id)
          if (oldN) {
            oldN.val = n.val
            oldN.group = n.group
            oldN.primaryTag = n.primaryTag
            oldN.snippetId = n.snippetId
            if (isCenter) {
              oldN.fx = 0
              oldN.fy = 0
              oldN.x = 0
              oldN.y = 0
            } else {
              oldN.fx = undefined
              oldN.fy = undefined
              if (Math.hypot(oldN.x || 0, oldN.y || 0) < 20) {
                oldN.x = radius * Math.cos(angle)
                oldN.y = radius * Math.sin(angle)
                oldN.vx = Math.cos(angle) * 2
                oldN.vy = Math.sin(angle) * 2
              }
            }
            return oldN
          }

          if (isCenter) {
            n.fx = 0
            n.fy = 0
            n.x = 0
            n.y = 0
          } else {
            n.fx = undefined
            n.fy = undefined
            n.x = radius * Math.cos(angle)
            n.y = radius * Math.sin(angle)
            n.vx = Math.cos(angle) * 2
            n.vy = Math.sin(angle) * 2
          }
          return n
        })

        const nextLinks = filteredLinks.map((l: any) => {
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
    }, 150)

    return () => clearTimeout(timer)
  }, [snippets, focusNodeId])

  useEffect(() => {
    if (!graphRef.current) return
    graphRef.current.d3Force('charge', forceManyBody().strength(-300).distanceMax(600))
    graphRef.current.d3Force('radial', null)
    graphRef.current.d3Force('collide', forceCollide(25).strength(1))

    if (graphRef.current.d3Force('link')) {
      graphRef.current.d3Force('link').distance(80).strength(0.7)
    }

    graphRef.current.d3Force('orphanPullX', forceX(0).strength(0.02))
    graphRef.current.d3Force('orphanPullY', forceY(0).strength(0.02))
  }, [])

  useEffect(() => {
    if (graphData.nodes.length === 0) return

    graphData.nodes.forEach((node) => {
      if (node.snippetId === focusNodeId) {
        node.fx = 0
        node.fy = 0
      } else if (node !== draggedNodeRef.current) {
        node.fx = undefined
        node.fy = undefined
      }
    })

    if (graphRef.current) {
      graphRef.current.d3ReheatSimulation()
    }

    if (!hasInitialized.current) {
      hasInitialized.current = true
      setTimeout(() => {
        if (!graphRef.current) return
        if (graphData.nodes.length <= 2) {
          graphRef.current.centerAt(0, 0, 400)
          graphRef.current.zoom(1.8, 400)
        } else {
          graphRef.current.zoomToFit(400, 60)
          setTimeout(() => {
            if (graphRef.current && graphRef.current.zoom() > 2.5) {
              graphRef.current.zoom(2.0, 300)
            }
          }, 450)
        }
      }, 300)
    }
  }, [graphData, focusNodeId])

  const [hoverNode, setHoverNode] = useState<any>(null)

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

  const nodeColor = (node: any) => {
    if (node.snippetId === focusNodeId) return '#e8a825'
    return getNodeColor(node, focusNodeId as string)
  }

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isActive = node.snippetId === focusNodeId
      const isHovered = hoverNode === node
      const r = isActive ? 5 : node.val ? Math.min(4, Math.max(2, Math.sqrt(node.val) * 1.2)) : 2
      const isNeighborDimmed = hoverNode && hoverNode !== node && !hoverNeighbors.has(node.id)

      drawNode(
        ctx,
        node,
        r,
        nodeColor(node),
        isActive,
        isHovered,
        false,
        false,
        isNeighborDimmed,
        isActive || isHovered,
        globalScale
      )
    },
    [focusNodeId, hoverNode, hoverNeighbors]
  )

  const handleRecenter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (graphRef.current && graphRef.current.zoomToFit) {
      graphRef.current.zoomToFit(800, 50)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`inline-graph-container graph-theme-${graphTheme}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '320px',
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
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              const r =
                node.snippetId === focusNodeId
                  ? 7
                  : node.val
                    ? Math.min(5, Math.max(2, Math.sqrt(node.val) * 1.5))
                    : 2
              const hitRadius = Math.max(r + 5, 10)
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x, node.y, hitRadius, 0, 2 * Math.PI, false)
              ctx.fill()
            }}
            linkColor={(link: any) => {
              if (!hoverNode) return 'rgba(150,150,150,0.2)'
              return link.source === hoverNode || link.target === hoverNode
                ? '#40bafa'
                : 'rgba(150,150,150,0.05)'
            }}
            linkWidth={(link: any) => {
              if (!hoverNode) return 0.2
              return link.source === hoverNode || link.target === hoverNode ? 0.4 : 0.1
            }}
            onNodeHover={(node: any) => {
              document.body.style.cursor = node ? 'pointer' : 'default'
              setHoverNode(node)
            }}
            onNodeClick={(node: any, event: MouseEvent) => {
              if (!node || !node.snippetId || !onNavigate) return
              onNavigate(node.snippetId)

              if ((event.ctrlKey || event.metaKey) && graphRef.current) {
                graphRef.current.centerAt(node.x, node.y, 800)
                graphRef.current.zoom(10, 800)
              }
            }}
            onNodeDrag={(node: any) => {
              draggedNodeRef.current = node
            }}
            onNodeDragEnd={(node: any) => {
              node.fx = null
              node.fy = null
              draggedNodeRef.current = null
              if (graphRef.current) {
                graphRef.current.d3ReheatSimulation()
              }
            }}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            d3AlphaDecay={0.025}
            d3VelocityDecay={0.4}
            warmupTicks={80}
            backgroundColor="transparent"
            onRenderFramePre={() => {
              ;(window as any)._luminaInlineFrameStart = performance.now()
            }}
            onRenderFramePost={() => {
              const now = performance.now()
              const frameTime = now - ((window as any)._luminaInlineFrameStart || now)
              const fps = (window as any)._luminaInlineLastFrame
                ? 1000 / (now - (window as any)._luminaInlineLastFrame)
                : 60
              ;(window as any)._luminaInlineLastFrame = now
              if (
                !(window as any)._luminaInlineLastHud ||
                now - (window as any)._luminaInlineLastHud > 500
              ) {
                ;(window as any)._luminaInlineLastHud = now
                usePerformanceStore.getState().updateMetrics({
                  fps,
                  frameTime,
                  nodesRenderTime: 0,
                  linksRenderTime: 0,
                  nodeCount: graphData?.nodes?.length || 0,
                  linkCount: graphData?.links?.length || 0
                })
              }
            }}
          />
          <PerformancePanel compact={true} onRecenter={handleRecenter} />
        </>
      )}
    </div>
  )
})

InlineGraph.displayName = 'InlineGraph'
export default InlineGraph
