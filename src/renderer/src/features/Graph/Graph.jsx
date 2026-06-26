import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { X, Square, Copy, Network, RefreshCw, Layers, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import ForceGraph2D from 'react-force-graph-2d'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useAIStore } from '../../core/store/useAIStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import { forceRadial, forceManyBody, forceCollide, forceCenter, forceX, forceY } from 'd3-force'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../Overlays/ModalHeader'
import GraphThemeSelector from './GraphThemeSelector'
import GraphSidebar from './GraphSidebar'
import GraphMiniMap from './GraphMiniMap'
import './Graph.css'

/**
 * Graph Component
 * Beautiful knowledge graph visualization with multiple modes and themes.
 *
 * Can be used as:
 * - Modal overlay (default): Shows with backdrop and close button
 * - Tab view: Set `embedded={true}` to use without overlay in tab
 *
 * Memoized for performance - expensive graph calculations.
 */
const Graph = React.memo(({ isOpen = true, onClose, onNavigate, embedded = false }) => {
  const { snippets, selectedSnippet, dirtySnippetIds } = useVaultStore()
  const { embeddingsCache } = useAIStore()
  
  // Granular subscriptions so physics sliders do not cause React re-renders!
  const graphTheme = useSettingsStore(s => s.settings.graphTheme || 'default')
  const graphHideTags = useSettingsStore(s => s.settings.graphHideTags)
  const graphHideGhosts = useSettingsStore(s => s.settings.graphHideGhosts)
  const graphHideOrphans = useSettingsStore(s => s.settings.graphHideOrphans)
  const graphSidebarOpen = useSettingsStore(s => s.settings.graphSidebarOpen ?? true)

  const [hoverNode, setHoverNode] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const isMaximized = useSettingsStore(s => s.settings.graphModalMaximized ?? false)
  
  const isSpinning = useSettingsStore(s => s.settings.graphAnimate ?? true)
  const graphRef = useRef()
  const containerRef = useRef()
  const [dimensions, setDimensions] = useState({
    width: embedded ? 800 : window.innerWidth * 0.95,
    height: embedded ? 600 : window.innerHeight * 0.92
  })

  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ graphModalMaximized: !(settings.graphModalMaximized ?? false) })
  }, [])

  const handleToggleSidebar = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ graphSidebarOpen: !(settings.graphSidebarOpen ?? true) })
  }, [])

  const modalPos = useRef(
    JSON.parse(localStorage.getItem('graph-modal-pos') || '{"x":0,"y":0}')
  )
  const isDraggingModal = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const rafId = useRef(null)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingModal.current || isMaximized) return
      
      const newX = e.clientX - dragStart.current.x
      const newY = e.clientY - dragStart.current.y
      modalPos.current = { x: newX, y: newY }
      
      if (rafId.current) cancelAnimationFrame(rafId.current)
      
      rafId.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
        }
      })
    }
    
    const handleMouseUp = () => {
      isDraggingModal.current = false
      if (rafId.current) cancelAnimationFrame(rafId.current)
      if (containerRef.current && !isMaximized) {
        containerRef.current.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        localStorage.setItem('graph-modal-pos', JSON.stringify(modalPos.current))
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isMaximized])

  const handleModalHeaderMouseDown = useCallback((e) => {
    if (isMaximized) return
    isDraggingModal.current = true
    
    if (containerRef.current) {
      containerRef.current.style.transition = 'none'
    }

    dragStart.current = {
      x: e.clientX - modalPos.current.x,
      y: e.clientY - modalPos.current.y
    }
  }, [isMaximized])

  // Localized Escape Handler (only for modal mode)
  useKeyboardShortcuts({
    onEscape: embedded
      ? null
      : () => {
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

  const [rawGraphData, setRawGraphData] = useState({ nodes: [], links: [] })
  const [isBuildingGraph, setIsBuildingGraph] = useState(true)

  useEffect(() => {
    setIsBuildingGraph(true)

    // Defer the heavy calculation so the modal can instantly animate in
    const timer = setTimeout(() => {
      const rawData = buildGraphData(snippets)
      const semantic = buildSemanticLinks(rawData.nodes, rawData.links, snippets, embeddingsCache)
      let nodes = rawData.nodes
      let links = [...rawData.links, ...semantic]

      // Calculate Age Gravity and Tags
      const now = Date.now()
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days is "old"

      // Count links per node for sizing and halo logic
      const linkCounts = {}
      links.forEach((l) => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        linkCounts[src] = (linkCounts[src] || 0) + 1
        linkCounts[tgt] = (linkCounts[tgt] || 0) + 1
      })

      nodes.forEach((n) => {
        // Break exact center symmetry so radial force works instantly
        if (n.x === undefined) n.x = (Math.random() - 0.5) * 200
        if (n.y === undefined) n.y = (Math.random() - 0.5) * 200

        n.linkCount = linkCounts[n.id] || 0
        n.val = n.linkCount + 1 // Exponential scaling base

        if (n.snippetId) {
          const s = snippets.find((sn) => sn.id === n.snippetId)
          if (s && s.tags) {
            const rawTags = Array.isArray(s.tags)
              ? s.tags
              : typeof s.tags === 'string'
                ? s.tags.split(',')
                : []
            if (rawTags.length > 0) {
              n.primaryTag = String(rawTags[0]).trim().toLowerCase()
            }
          }

          const age = now - (s?.timestamp || now)
          // Normalized age: 0 (new) to 1 (old)
          n.ageFactor = Math.min(1, age / maxAge)
        } else {
          n.ageFactor = 0.5 // Standard for ghost/tags
        }
      })

      setRawGraphData({ nodes, links })
      setIsBuildingGraph(false)
    }, 250) // Wait 250ms to allow the modal CSS open animation to finish perfectly smoothly

    return () => clearTimeout(timer)
  }, [snippets, selectedSnippet, embeddingsCache])

  const graphData = useMemo(() => {
    let { nodes, links } = rawGraphData
    if (graphHideTags) {
      nodes = nodes.filter((n) => n.group !== 'tag')
    }
    if (graphHideGhosts) {
      nodes = nodes.filter((n) => n.group !== 'ghost')
    }
    
    // Filter links to only keep those whose nodes still exist
    const validNodeIds = new Set(nodes.map((n) => n.id))
    links = links.filter((l) => {
      const src = typeof l.source === 'object' ? l.source.id : l.source
      const tgt = typeof l.target === 'object' ? l.target.id : l.target
      return validNodeIds.has(src) && validNodeIds.has(tgt)
    })
    
    if (graphHideOrphans) {
      const nodesWithLinks = new Set()
      links.forEach(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        nodesWithLinks.add(src)
        nodesWithLinks.add(tgt)
      })
      nodes = nodes.filter(n => nodesWithLinks.has(n.id))
    }
    
    return { nodes, links }
  }, [rawGraphData, graphHideTags, graphHideGhosts, graphHideOrphans])

  // Center on mount and data load
  useEffect(() => {
    if (graphRef.current && !isBuildingGraph && graphData.nodes.length > 0) {
      setTimeout(() => {
        if (selectedSnippet) {
          const node = graphData.nodes.find((n) => n.snippetId === selectedSnippet.id)
          if (node) {
            graphRef.current.centerAt(node.x, node.y, 400)
            graphRef.current.zoom(1.5, 400)
          }
        } else {
          // Allow the graph to explode naturally from the center without hacking the initial zoom
          // After 2.5 seconds (when the explosion starts to settle), smoothly zoom out to perfectly frame the final graph
          setTimeout(() => {
            if (graphRef.current) graphRef.current.zoomToFit(2500, 100)
          }, 2500)
        }
      }, 100) // Small delay to ensure WebGL engine is ready
    }
  }, [selectedSnippet, isBuildingGraph])

  // Physics Engine Setup
  useEffect(() => {
    // Unsubscribe listener for Live Physics without React Re-renders
    const unsubscribe = useSettingsStore.subscribe(
      (state, prevState) => {
        const { settings } = state
        const prev = prevState.settings
        
        // Only update if one of the physics settings actually changed
        if (
          settings.graphNodeSize !== prev.graphNodeSize ||
          settings.graphCenterForce !== prev.graphCenterForce ||
          settings.graphRepelForce !== prev.graphRepelForce ||
          settings.graphLinkForce !== prev.graphLinkForce ||
          settings.graphShowTexts !== prev.graphShowTexts ||
          settings.graphNodeColor !== prev.graphNodeColor
        ) {
          if (!graphRef.current) return
          const fg = graphRef.current

          const sizeMult = settings.graphNodeSize || 1.5
          const centerForce = settings.graphCenterForce ?? 0.05
          const repelForce = settings.graphRepelForce ?? 0.3
          const linkForce = settings.graphLinkForce ?? 0.05

          // Update force parameters instantly
          fg.d3Force('custom_x').strength(centerForce)
          fg.d3Force('custom_y').strength(centerForce)
          fg.d3Force('custom_charge').strength(-500 * repelForce) // Reduced from -3000 so orphans don't shoot to infinity
          
          fg.d3Force('custom_collide')
            .radius((d) => {
              const baseR = d.val ? Math.max(2, Math.sqrt(d.val) * 2.5) : 2
              return baseR * sizeMult + 40 // Physical gap
            })

          if (fg.d3Force('link')) fg.d3Force('link').strength(linkForce)

          fg.d3ReheatSimulation()
        }
      }
    )

    // Initial Setup
    if (!graphRef.current) return
    const fg = graphRef.current
    const initialSettings = useSettingsStore.getState().settings

    const sizeMult = initialSettings.graphNodeSize || 1.5
    const centerForce = initialSettings.graphCenterForce ?? 0.05
    const repelForce = initialSettings.graphRepelForce ?? 0.3
    const linkForce = initialSettings.graphLinkForce ?? 0.05

    // Initialize core forces only if they don't exist
    if (!fg.d3Force('custom_x')) fg.d3Force('custom_x', forceX(0))
    if (!fg.d3Force('custom_y')) fg.d3Force('custom_y', forceY(0))
    if (!fg.d3Force('custom_charge')) fg.d3Force('custom_charge', forceManyBody())
    if (!fg.d3Force('custom_collide')) fg.d3Force('custom_collide', forceCollide())

    // Disable default forces to prevent conflicts
    fg.d3Force('x', null)
    fg.d3Force('y', null)
    fg.d3Force('charge', null)
    fg.d3Force('radial', null)

    // Apply initial forces
    fg.d3Force('custom_x').strength(centerForce)
    fg.d3Force('custom_y').strength(centerForce)
    fg.d3Force('custom_charge').strength(-500 * repelForce)
    
    fg.d3Force('custom_collide')
      .radius((d) => {
        const baseR = d.val ? Math.max(2, Math.sqrt(d.val) * 2.5) : 2
        return baseR * sizeMult + 40
      })
      .strength(0.1)

    // Extremely elastic links like a spiderweb
    if (fg.d3Force('link')) fg.d3Force('link').distance(150).strength(linkForce)

    fg.d3ReheatSimulation()

    return () => unsubscribe()
  }, [])

  // Auto-Spin Logic
  useEffect(() => {
    if (!graphRef.current) return
    const fg = graphRef.current

    if (isSpinning) {
      const forceSpin = () => {
        let nodes
        function force(alpha) {
          if (!nodes) return
          for (let i = 0, n = nodes.length; i < n; ++i) {
            const node = nodes[i]
            const dx = node.x || 0
            const dy = node.y || 0
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 0) {
              // Apply tangential velocity for rotation
              node.vx += (-dy / dist) * 1.5 * alpha
              node.vy += (dx / dist) * 1.5 * alpha
            }
          }
        }
        force.initialize = function (_) {
          nodes = _
        }
        return force
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
    if (node.group === 'tag') return '#14b8a6' // Teal for Tags
    if (node.group === 'mention') return '#ff79c6' // Pink/Accent for Mentions

    // Dynamic color by category/tag
    if (node.primaryTag) return stringToColor(node.primaryTag)

    return useSettingsStore.getState().settings.graphNodeColor || '#40bafa' // Default blue for Notes
  }

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const isActive = selectedSnippet && node.snippetId === selectedSnippet.id
      const isHovered = hoverNode === node
      const label = (node.id || '').replace(/[*"']/g, '')
      const sizeMult = useSettingsStore.getState().settings.graphNodeSize || 1.5
      const r = (node.val ? Math.max(2, Math.sqrt(node.val) * 2.5) : 2) * sizeMult

      const q = searchQuery.trim().toLowerCase()
      const isSearchMatch = q !== '' && label.toLowerCase().includes(q)
      const isSearchDimmed = q !== '' && !isSearchMatch

      // High-Performance Node Circle Glow (Replaces expensive shadowBlur)
      if (isActive || isHovered || isSearchMatch) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false)
        ctx.fillStyle = isSearchMatch ? 'rgba(255, 255, 255, 0.4)' : isActive ? 'rgba(255, 170, 0, 0.3)' : 'rgba(64, 186, 250, 0.3)'
        ctx.fill()
      }

      // Dimming logic
      if (isSearchDimmed && !isHovered && !isActive) {
        ctx.globalAlpha = 0.05
      } else if (hoverNode && hoverNode !== node && !hoverNeighbors.has(node.id)) {
        ctx.globalAlpha = 0.15
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
      const liveSettings = useSettingsStore.getState().settings
      const showTextsSetting = liveSettings.graphShowTexts !== false && liveSettings.graphShowTexts !== 'false'

      if (showTextsSetting) {
        if (isActive || isHovered) shouldShow = true
        else if (globalScale > 1.8) shouldShow = true
        else if (node.val > 5 && globalScale > 1.2) shouldShow = true
      }

      if (shouldShow) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        // Fill
        if (isSearchDimmed && !isHovered) {
          ctx.globalAlpha = 0.1
        }
        ctx.fillStyle = isSearchMatch ? '#ffffff' : isActive ? '#ffaa00' : isHovered ? '#fff' : 'rgba(255, 255, 255, 0.9)'
        ctx.fillText(label, node.x, node.y + r + 2)
        ctx.globalAlpha = 1.0
      }
    },
    [
      selectedSnippet,
      hoverNode,
      hoverNeighbors,
      searchQuery
    ]
  )

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
            <GraphThemeSelector variant="button" size="small" />
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
            const sizeMult = useSettingsStore.getState().settings.graphNodeSize || 1.5
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
            return sourceId === hoverNode.id || targetId === hoverNode.id
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
          onNodeDragEnd={(node) => {
            node.fx = null
            node.fy = null
          }}
          backgroundColor="transparent"
          d3AlphaDecay={isSpinning ? 0 : 0.02}
          d3VelocityDecay={0.3} // Lower viscosity for smoother dragging
        />
        <GraphMiniMap 
          graphRef={graphRef} 
          graphData={graphData} 
          mainWidth={dimensions.width} 
          mainHeight={dimensions.height} 
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
      style={{ 
        flexDirection: 'column',
        transform: isMaximized ? 'none' : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)' 
      }}
    >
      <ModalHeader
        title=""
        onClose={onClose}
        onMouseDown={handleModalHeaderMouseDown}
        style={{ cursor: isMaximized ? 'default' : 'grab' }}
        left={
          <button
            className="win-btn"
            onClick={handleToggleSidebar}
            title={graphSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
            style={{ marginLeft: '-10px' }}
          >
            {graphSidebarOpen ? <PanelLeftClose size={12} strokeWidth={2} /> : <PanelLeftOpen size={12} strokeWidth={2} />}
          </button>
        }
        right={
          <button
            className="win-btn"
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <Copy size={12} strokeWidth={2} />
            ) : (
              <Square size={12} strokeWidth={2} />
            )}
          </button>
        }
      />

      <div className="nexus-main" style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <GraphSidebar 
          isOpen={graphSidebarOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSpinning={isSpinning}
          graphTheme={graphTheme}
          onHeaderMouseDown={handleModalHeaderMouseDown}
          isMaximized={isMaximized}
        />

        <div className="nexus-body">
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height - 32}
            graphData={graphData}
          nodeCanvasObject={paintNode}
          onNodeHover={(node, prev) => {
            setHoverNode(node)
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const sizeMult = useSettingsStore.getState().settings.graphNodeSize || 1.5
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
            return sourceId === hoverNode.id || targetId === hoverNode.id
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
          onNodeDragEnd={(node) => {
            node.fx = null
            node.fy = null
          }}
          backgroundColor="transparent"
          d3AlphaDecay={isSpinning ? 0 : 0.02}
          d3VelocityDecay={0.3} // Lower viscosity for smoother, more fluid dragging
        />
        <GraphMiniMap 
          graphRef={graphRef} 
          graphData={graphData} 
          mainWidth={dimensions.width} 
          mainHeight={dimensions.height - 32} 
        />
      </div>
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

Graph.displayName = 'Graph'

export default Graph
