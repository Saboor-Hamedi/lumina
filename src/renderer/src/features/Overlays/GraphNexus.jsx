import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import ForceGraph2D from 'react-force-graph-2d'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useAIStore } from '../../core/store/useAIStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import { forceRadial, forceManyBody, forceCollide } from 'd3-force'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import GraphThemeSelector from './components/GraphThemeSelector'
import './GraphNexus.css'
import './components/GraphControls.css'

/**
 * GraphNexus Component
 * Beautiful knowledge graph visualization with multiple modes and themes.
 * 
 * Can be used as:
 * - Modal overlay (default): Shows with backdrop and close button
 * - Tab view: Set `embedded={true}` to use without overlay in tab
 * 
 * Memoized for performance - expensive graph calculations.
 */
const GraphNexus = React.memo(({ isOpen = true, onClose, onNavigate, embedded = false }) => {
  const { snippets, selectedSnippet, dirtySnippetIds } = useVaultStore()
  const { settings } = useSettingsStore()
  const { embeddingsCache } = useAIStore()
  const graphTheme = settings.graphTheme || 'default'
  const [hoverNode, setHoverNode] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [isMaximized, setIsMaximized] = useState(false)
  const graphRef = useRef()
  const containerRef = useRef()
  const [dimensions, setDimensions] = useState({
    width: embedded ? 800 : window.innerWidth * 0.95,
    height: embedded ? 600 : window.innerHeight * 0.92
  })

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized(prev => !prev)
  }, [])

  // Localized Escape Handler (only for modal mode)
  useKeyboardShortcuts({
    onEscape: embedded ? null : () => {
      if (isOpen && onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  // Handle Resize - different logic for embedded vs modal
  useEffect(() => {
    if (embedded) {
      // For embedded mode, use container dimensions
      const updateDimensions = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setDimensions({
            width: rect.width,
            height: rect.height
          })
        }
      }
      updateDimensions()
      const resizeObserver = new ResizeObserver(updateDimensions)
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current)
      }
      return () => resizeObserver.disconnect()
    } else {
      const handleResize = () => {
        setDimensions({
          width: isMaximized ? window.innerWidth : window.innerWidth * 0.95,
          height: isMaximized ? window.innerHeight : window.innerHeight * 0.92
        })
      }
      handleResize()
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [embedded, isMaximized])

  // Graph Data Construction
  const graphData = useMemo(() => {
    const rawData = buildGraphData(snippets)
    const semantic = buildSemanticLinks(rawData.nodes, rawData.links, snippets, embeddingsCache)
    let nodes = rawData.nodes
    let links = [...rawData.links, ...semantic]

    // Calculate Age Gravity
    const now = Date.now()
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days is "old"

    nodes.forEach((n) => {
      if (n.snippetId) {
        const s = snippets.find((sn) => sn.id === n.snippetId)
        const age = now - (s?.timestamp || now)
        // Normalized age: 0 (new) to 1 (old)
        n.ageFactor = Math.min(1, age / maxAge)
      } else {
        n.ageFactor = 0.5 // Standard for ghost/tags
      }
    })

    return { nodes, links }
  }, [snippets, selectedSnippet, embeddingsCache])

  // Center on mount
  useEffect(() => {
    if (graphRef.current) {
      setTimeout(() => {
        if (selectedSnippet) {
          const node = graphData.nodes.find((n) => n.snippetId === selectedSnippet.id)
          if (node) {
            graphRef.current.centerAt(node.x, node.y, 400)
            graphRef.current.zoom(1.5, 400)
          }
        } else {
          graphRef.current.zoomToFit(400, 150)
        }
      }, 100)
    }
  }, [graphData.nodes.length, isMaximized])

  // D3 Forces Polish
  useEffect(() => {
    if (!graphRef.current) return
    const fg = graphRef.current

    // Universe Mode: Chronological Rings
    fg.d3Force('center', null)
    // Widen the universe rings significantly to spread out 200+ nodes
    fg.d3Force('radial', forceRadial((d) => (d.ageFactor || 0.5) * 800, 0, 0).strength(0.5))
    // Huge repulsion to keep them untangled
    fg.d3Force('charge', forceManyBody().strength(-600))
    // Hard collision based on their radius to guarantee no overlap
    fg.d3Force('collide', forceCollide().radius(d => (d.val ? Math.max(4, Math.sqrt(d.val) * 5) : 4)).strength(1))
    // Increase link distance so connected nodes don't pull into a tiny ball
    if (fg.d3Force('link')) fg.d3Force('link').distance(150)
  }, [])

  // Precompute line colors to save 60,000+ calculations per second
  const defaultLineColor = useMemo(() => {
    const isSelectedTheme = graphTheme === 'space' || graphTheme === 'nebula'
    return isSelectedTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(150, 150, 150, 0.25)'
  }, [graphTheme])

  const dimmedLineColor = useMemo(() => {
    const isSelectedTheme = graphTheme === 'space' || graphTheme === 'nebula'
    return isSelectedTheme ? 'rgba(255, 255, 255, 0.03)' : 'rgba(150, 150, 150, 0.05)'
  }, [graphTheme])

  if (!isOpen && !embedded) return null

  // Pre-compute neighbors for hover highlighting to prevent O(N^2) canvas lag
  const hoverNeighbors = useMemo(() => {
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
    const accent = settings.graphNodeColor || '#40bafa'
    if (selectedSnippet && node.snippetId === selectedSnippet.id) return '#ffaa00'
    if (node.group === 'ghost') return `${accent}66`
    if (node.group === 'tag') return '#14b8a6'
    return accent
  }

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const isActive = selectedSnippet && node.snippetId === selectedSnippet.id
      const isHovered = hoverNode === node
      const label = (node.id || '').replace(/[*"']/g, '')
      const sizeMult = settings.graphNodeSize || 1.5
      const r = (node.val ? Math.max(2, Math.sqrt(node.val) * 2.5) : 2) * sizeMult

      // High-Performance Node Circle Glow (Replaces expensive shadowBlur)
      if (isActive || isHovered) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false)
        ctx.fillStyle = isActive ? 'rgba(255, 170, 0, 0.3)' : 'rgba(64, 186, 250, 0.3)'
        ctx.fill()
      }

      // Draw Neighbor Lines (Dim non-neighbors)
      if (hoverNode && hoverNode !== node) {
        if (!hoverNeighbors.has(node.id)) ctx.globalAlpha = 0.15
      }

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
      ctx.fillStyle = nodeColor(node)
      ctx.fill()
      ctx.globalAlpha = 1.0

      // Text Logic: Compensatory Scaling
      const baseFontSize = 10
      const fontSize = baseFontSize / globalScale
      ctx.font = `${fontSize}px Inter, sans-serif`

      let shouldShow = false
      const showTextsSetting = settings.graphShowTexts !== false && settings.graphShowTexts !== 'false'
      
      if (showTextsSetting) {
        if (isActive || isHovered) shouldShow = true
        else if (globalScale > 1.8) shouldShow = true
        else if (node.val > 5 && globalScale > 1.2) shouldShow = true
      }

      if (shouldShow) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        // Fill
        ctx.fillStyle = isActive ? '#ffaa00' : isHovered ? '#fff' : 'rgba(255, 255, 255, 0.9)'
        ctx.fillText(label, node.x, node.y + r + 2)
      }
    },
    [selectedSnippet, hoverNode, hoverNeighbors, settings.graphNodeSize, settings.graphShowTexts, settings.graphNodeColor]
  )

  // Reheat physics slightly when settings change to force redraw
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3ReheatSimulation()
    }
  }, [settings.graphNodeSize, settings.graphShowTexts, settings.graphNodeColor])

  // Render as embedded (tab) or modal
  // When embedded, show only the graph visualization with controls overlay
  if (embedded) {
    return (
      <div
        ref={containerRef}
        className="nexus-embedded-graph"
        data-graph-theme={graphTheme}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Embedded Controls Overlay */}
        <div className="graph-embedded-controls">
          <div className="graph-embedded-controls-right">
            <GraphThemeSelector
              variant="button"
              size="small"
            />
          </div>
        </div>

        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={paintNode}
          onZoom={() => {
            // Trackpad zoom can be jittery, zooming works best when not interfering
          }}
          onNodeHover={(node, prev) => {
            setHoverNode(node)
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const sizeMult = settings.graphNodeSize || 1.5
            const r = (node.val ? Math.max(2, Math.sqrt(node.val) * 2.5) : 2) * sizeMult
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
            ctx.fill()
          }}
          linkColor={(link) => {
            if (!hoverNode) return defaultLineColor
            const sourceId = link.source.id || link.source
            const targetId = link.target.id || link.target
            return (sourceId === hoverNode.id || targetId === hoverNode.id)
              ? 'rgba(64, 186, 250, 0.8)'
              : dimmedLineColor
          }}
          linkDirectionalParticles={0}
          onNodeClick={(node) => {
            if (node.snippetId) {
              const s = snippets.find((sn) => sn.id === node.snippetId)
              if (s) onNavigate(s)
            }
          }}
          backgroundColor="transparent"
          d3AlphaDecay={0.1}
          cooldownTicks={50}
        />
      </div>
    )
  }

  // Modal mode - show full UI with header and footer
  const container = (
    <div
      ref={containerRef}
      className={`nexus-container modal-container${isMaximized ? ' maximized' : ''}`}
      onClick={(e) => e.stopPropagation()}
      data-graph-theme={graphTheme}
    >
      <header className="nexus-header">
        <div className="nexus-header-actions" style={{ marginLeft: 'auto' }}>
          <GraphThemeSelector variant="button" size="large" />
          <button className="nexus-maximize-btn" onClick={handleToggleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
            {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          {onClose && (
            <button className="nexus-close-btn" onClick={onClose} title="Close">
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      <div className="nexus-body">
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height - 60}
          graphData={graphData}
          nodeCanvasObject={paintNode}
          onNodeHover={(node, prev) => {
            setHoverNode(node)
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const sizeMult = settings.graphNodeSize || 1.5
            const r = (node.val ? Math.max(2, Math.sqrt(node.val) * 2.5) : 2) * sizeMult
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
            ctx.fill()
          }}
          linkColor={(link) => {
            if (!hoverNode) return defaultLineColor
            const sourceId = link.source.id || link.source
            const targetId = link.target.id || link.target
            return (sourceId === hoverNode.id || targetId === hoverNode.id)
              ? 'rgba(64, 186, 250, 0.8)'
              : dimmedLineColor
          }}
          linkWidth={0.5}
          linkDirectionalParticles={0}
          onNodeClick={(node) => {
            if (node.snippetId) {
              const s = snippets.find((sn) => sn.id === node.snippetId)
              if (s) onNavigate(s)
            }
          }}
          backgroundColor="transparent"
          d3AlphaDecay={0.1}
          cooldownTicks={50}
        />
      </div>

      <footer className="nexus-footer">
        <span className="nexus-footer-title">Graph Nexus</span>
      </footer>
    </div>
  )

  // Modal mode - wrap in overlay
  return (
    <div className="nexus-overlay" onClick={onClose}>
      {container}
    </div>
  )
})

GraphNexus.displayName = 'GraphNexus'

export default GraphNexus
