import React, { useMemo, useEffect, useState, useRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Focus } from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useAIStore } from '../../core/store/useAIStore'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import { useTheme } from '../../core/hooks/useTheme'

/**
 * GraphView Component
 * Memoized for performance - expensive graph calculations and rendering.
 */
const GraphView = React.memo(({ onNodeClick }) => {
  const { snippets, selectedSnippet } = useVaultStore()
  const { embeddingsCache } = useAIStore()
  const { theme } = useTheme()
  const graphRef = useRef()
  const containerRef = useRef()

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Rebuild graph + semantic links
  const data = useMemo(() => {
    const rawData = buildGraphData(snippets)
    const semantic = buildSemanticLinks(rawData.nodes, rawData.links, snippets, embeddingsCache)

    return {
      nodes: rawData.nodes,
      links: [...rawData.links, ...semantic]
    }
  }, [snippets, embeddingsCache])

  // Responsive Sizing
  useEffect(() => {
    if (!containerRef.current) return

    const observeTarget = containerRef.current
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })

    resizeObserver.observe(observeTarget)
    return () => resizeObserver.disconnect()
  }, [])

  /* --- STATE & INTERACTION --- */
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())
  const [hoverNode, setHoverNode] = useState(null)

  const handleNodeHover = (node) => {
    if ((!node && !highlightNodes.size) || (node && hoverNode === node)) return

    if (node) {
      setHoverNode(node)
      const neighbors = new Set()
      const links = new Set()

      // Find neighbors
      data.links.forEach((link) => {
        if (link.source.id === node.id || link.target.id === node.id) {
          links.add(link)
          neighbors.add(link.source.id)
          neighbors.add(link.target.id)
        }
      })
      neighbors.add(node.id) // Include self
      setHighlightNodes(neighbors)
      setHighlightLinks(links)
    } else {
      setHoverNode(null)
      setHighlightNodes(new Set())
      setHighlightLinks(new Set())
    }
  }

  /* --- VISUAL CONFIG --- */
  const nodeColor = (node) => {
    if (selectedSnippet && node.snippetId === selectedSnippet.id) return '#ffaa00' // Gold for active
    if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) return 'rgba(100,100,100, 0.1)' // Dim others
    if (node.group === 'ghost') return '#374151' // Gray 700
    if (node.group === 'tag') return '#14b8a6' // Teal 500
    return '#40bafa' // Accent (Lumina)
  }

  const linkColor = (link) => {
    if (highlightLinks.size > 0 && !highlightLinks.has(link)) return 'rgba(150,150,150,0.05)'

    if (link.type === 'semantic') return 'rgba(64, 186, 250, 0.2)' // Subtle Purple
    return 'rgba(150, 150, 150, 0.2)'
  }

  const linkDash = (link) => (link.type === 'semantic' ? [4, 2] : null)

  /* --- CANVAS PAINTING (Premium "Google Maps" Logic) --- */
  const paintNode = React.useCallback(
    (node, ctx, globalScale) => {
      const isHover = node === hoverNode
      const isNeighbor = highlightNodes.has(node.id)
      const label = (node.label || node.id).replace(/[*"']/g, '')

      // NODE VISUALS
      const r = node.val ? Math.max(2, Math.sqrt(node.val) * 3) : 2

      // Glow effect for hubs/hover
      if (isHover || node.val > 5) {
        ctx.shadowColor = nodeColor(node)
        ctx.shadowBlur = isHover ? 15 : 5
      } else {
        ctx.shadowBlur = 0
      }

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
      ctx.fillStyle = nodeColor(node)
      ctx.fill()
      ctx.shadowBlur = 0 // Reset

      // TEXT LOGIC: Compensatory Scaling
      // We scale the font size inversely with zoom to prevent it from becoming 'huge'
      const baseFontSize = 14
      const fontSize = baseFontSize / globalScale
      ctx.font = `${fontSize}px Inter, sans-serif`

      // Visibility Thresholds
      // 1. Hover: Always show (Critical)
      // 2. Active Node: Always show (Critical)
      // 3. Hubs (val > 3): Show if scale > 0.4
      // 4. Small nodes: Show if scale > 1.5
      let shouldShow = false
      const isActive = selectedSnippet && node.snippetId === selectedSnippet.id

      if (isHover || isActive) shouldShow = true
      else if (node.val > 4 && globalScale > 0.3) shouldShow = true
      else if (globalScale > 0.8) shouldShow = true

      // Low priority label rendering for neighbors (optional: only if very zoomed in?)
      // if (isNeighbor && globalScale > 1.0) shouldShow = true

      if (shouldShow) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top' // Below circle

        // Fill
        ctx.fillStyle = isActive ? '#ffaa00' : 'rgba(255, 255, 255, 0.95)'
        ctx.fillText(label, node.x, node.y + r + 1)
      }
    },
    [hoverNode, highlightNodes, selectedSnippet]
  )

  /* --- INTERACTION HANDLERS --- */
  const handleNodeClick = (node) => {
    if (node.snippetId) {
      // Real note: Navigate
      const snippet = snippets.find((s) => s.id === node.snippetId)
      if (snippet && onNodeClick) {
        onNodeClick(snippet)
      }
    } else {
      // Ghost note or Tag
      // Future: Filter graph by this tag?
    }
  }

  const isFirstLoad = useRef(true)

  const handleRecenter = () => {
    graphRef.current?.zoomToFit(400, 50)
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: hoverNode ? 'pointer' : 'default'
      }}
    >
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeColor={nodeColor}
        linkColor={linkColor}
        linkLineDash={linkDash}
        backgroundColor="rgba(0,0,0,0)"
        // Interaction
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        nodeCanvasObject={paintNode}
        // Physics Optimization
        cooldownTicks={100}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.2}
        onEngineStop={() => {
          if (isFirstLoad.current) {
            if (selectedSnippet) {
              const node = data.nodes.find((n) => n.snippetId === selectedSnippet.id)
              if (node) {
                // Focus active node
                graphRef.current.centerAt(node.x, node.y, 400)
                graphRef.current.zoom(2.5, 400)
              } else {
                graphRef.current.zoomToFit(400, 50)
              }
            } else {
              graphRef.current.zoomToFit(400, 50)
            }
            isFirstLoad.current = false
          }
        }}
        // Disable particles unless hovering to save FPS during zoom
        linkDirectionalParticles={highlightLinks.size > 0 ? 3 : 0}
        linkDirectionalParticleWidth={3} // Thicker particles on hover
        linkDirectionalParticleSpeed={0.003} // Slower, mesmerizing flow
      />

      <button
        onClick={handleRecenter}
        style={{
          position: 'absolute',
          bottom: '15px',
          right: '15px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          padding: '6px',
          borderRadius: '6px',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Recenter Graph"
      >
        <Focus size={16} />
      </button>
    </div>
  )
})

GraphView.displayName = 'GraphView'

export default GraphView
