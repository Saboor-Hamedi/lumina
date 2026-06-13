import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { X, Square, Copy, Network, RefreshCw, Layers } from 'lucide-react'
import ForceGraph2D from 'react-force-graph-2d'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useAIStore } from '../../core/store/useAIStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import { forceRadial, forceManyBody, forceCollide, forceCenter, forceX, forceY } from 'd3-force'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
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
  const [isSpinning, setIsSpinning] = useState(false)
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

    // Calculate Age Gravity and Tags
    const now = Date.now()
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days is "old"

    // Count links per node for sizing and halo logic
    const linkCounts = {}
    links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source
      const tgt = typeof l.target === 'object' ? l.target.id : l.target
      linkCounts[src] = (linkCounts[src] || 0) + 1
      linkCounts[tgt] = (linkCounts[tgt] || 0) + 1
    })

    nodes.forEach((n) => {
      n.linkCount = linkCounts[n.id] || 0
      n.val = n.linkCount + 1 // Exponential scaling base

      if (n.snippetId) {
        const s = snippets.find((sn) => sn.id === n.snippetId)
        if (s && s.tags) {
          n.primaryTag = s.tags.split(',')[0].trim().toLowerCase()
        }
        
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

  // Physics Engine Setup
  useEffect(() => {
    if (!graphRef.current) return
    const fg = graphRef.current
    
    const sizeMult = settings.graphNodeSize || 1.5

    // Soft organic center force
    fg.d3Force('center', forceCenter(0, 0))
    
    // Galactic Core Gravity: Gently pull all nodes into a central mass
    fg.d3Force('x', forceX(0).strength(0.04))
    fg.d3Force('y', forceY(0).strength(0.04))
    
    // Galaxy Disc Structure: Forces nodes into a circular galaxy shape
    fg.d3Force('radial', forceRadial((d) => {
      if (d.linkCount === 0) return 400; // Bring unlinked stars much closer
      // Hubs (many links) get pulled to the dense black hole center (radius 0)
      // Normal notes (few links) orbit in the galactic disc (radius ~200)
      return Math.max(0, 250 - (d.linkCount * 40));
    }, 0, 0).strength(0.7))
    
    // High repulsion to separate distinct clusters clearly
    fg.d3Force('charge', forceManyBody().strength(-350))
    
    // Strict collisions that dynamically scale with the user's Node Size setting
    fg.d3Force('collide', forceCollide().radius(d => {
      const baseR = d.val ? Math.max(2, Math.sqrt(d.val) * 2.5) : 2
      return (baseR * sizeMult) + 6 // 6px physical gap
    }).strength(1))
    
    // Elastic links to hold the constellations together inside the disc
    if (fg.d3Force('link')) fg.d3Force('link').distance(50).strength(0.5)
    
    // Reheat to apply new physical sizes
    fg.d3ReheatSimulation()
  }, [settings.graphNodeSize])

  // Auto-Spin Logic
  useEffect(() => {
    if (!graphRef.current) return
    const fg = graphRef.current

    if (isSpinning) {
      const forceSpin = () => {
        let nodes;
        function force(alpha) {
          if (!nodes) return;
          for (let i = 0, n = nodes.length; i < n; ++i) {
            const node = nodes[i];
            const dx = node.x || 0;
            const dy = node.y || 0;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              // Apply tangential velocity for rotation
              node.vx += (-dy / dist) * 1.5 * alpha;
              node.vy += (dx / dist) * 1.5 * alpha;
            }
          }
        }
        force.initialize = function(_) { nodes = _; };
        return force;
      }

      fg.d3Force('spin', forceSpin())
      fg.d3ReheatSimulation()
    } else {
      fg.d3Force('spin', null)
      fg.d3ReheatSimulation()
    }
  }, [isSpinning])

  // Precompute line colors to save 60,000+ calculations per second
  const defaultLineColor = useMemo(() => {
    const isSelectedTheme = graphTheme === 'space' || graphTheme === 'nebula'
    return isSelectedTheme ? 'rgba(255, 255, 255, 0.04)' : 'rgba(150, 150, 150, 0.08)' // Extremely faint so it's not muddy
  }, [graphTheme])

  const dimmedLineColor = useMemo(() => {
    const isSelectedTheme = graphTheme === 'space' || graphTheme === 'nebula'
    return isSelectedTheme ? 'rgba(255, 255, 255, 0.01)' : 'rgba(150, 150, 150, 0.02)'
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

  // Deterministic color generation based on primary tag
  const stringToColor = (str) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash) % 360
    return `hsl(${h}, 70%, 55%)`
  }

  const nodeColor = (node) => {
    if (selectedSnippet && node.snippetId === selectedSnippet.id) return '#ffffff'
    if (node.group === 'ghost') return 'rgba(150,150,150,0.3)'
    if (node.group === 'tag') return '#14b8a6'
    
    // Dynamic color by category/tag
    if (node.primaryTag) return stringToColor(node.primaryTag)
    
    return settings.graphNodeColor || '#40bafa'
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
          d3AlphaDecay={isSpinning ? 0 : 0.05}
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
      <header className="nexus-header" style={{ WebkitAppRegion: 'drag' }}>
        <div className="nexus-title-stack">
          <Network size={16} strokeWidth={2} color="var(--text-accent)" />
          Graph Nexus
        </div>
        <div className="nexus-header-actions" style={{ WebkitAppRegion: 'no-drag' }}>
          <button 
            className="win-btn" 
            onClick={() => {
              const themes = ['default', 'space', 'nebula', 'frost', 'neural']
              const next = themes[(themes.indexOf(graphTheme) + 1) % themes.length]
              useSettingsStore.getState().updateSetting('graphTheme', next)
            }} 
            title="Cycle Space Theme"
          >
            <Layers size={14} />
          </button>
          <button 
            className={`win-btn ${isSpinning ? 'active' : ''}`} 
            onClick={() => setIsSpinning(!isSpinning)} 
            title={isSpinning ? 'Stop Rotation' : 'Auto Rotate'}
          >
            <RefreshCw size={14} className={isSpinning ? 'spin-icon' : ''} />
          </button>
          <button className="win-btn" onClick={handleToggleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
            {isMaximized ? <Copy size={12} strokeWidth={2} /> : <Square size={12} strokeWidth={2} />}
          </button>
          {onClose && (
            <button className="win-btn close-btn" onClick={onClose} title="Close">
              <X size={16} strokeWidth={1.5} />
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
          d3AlphaDecay={isSpinning ? 0 : 0.05}
          d3VelocityDecay={0.6} // High viscosity (honey-like) to prevent the whole graph from violently shaking on drag
          cooldownTicks={100}
        />
      </div>
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
