import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { X, Square, Copy, Network, RefreshCw, Layers, Search } from 'lucide-react'
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
  const { settings } = useSettingsStore()
  const { embeddingsCache } = useAIStore()
  const graphTheme = settings.graphTheme || 'default'
  const [hoverNode, setHoverNode] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
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
    setIsMaximized((prev) => !prev)
  }, [])

  const modalPos = useRef({ x: 0, y: 0 })
  const isDraggingModal = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingModal.current || isMaximized) return
      
      const newX = e.clientX - dragStart.current.x
      const newY = e.clientY - dragStart.current.y
      modalPos.current = { x: newX, y: newY }
      
      if (containerRef.current) {
        containerRef.current.style.transform = `translate(${newX}px, ${newY}px)`
      }
    }
    
    const handleMouseUp = () => {
      isDraggingModal.current = false
      if (containerRef.current && !isMaximized) {
        containerRef.current.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isMaximized])

  const handleModalHeaderMouseDown = (e) => {
    if (isMaximized) return
    isDraggingModal.current = true
    
    if (containerRef.current) {
      containerRef.current.style.transition = 'none'
    }

    dragStart.current = {
      x: e.clientX - modalPos.current.x,
      y: e.clientY - modalPos.current.y
    }
  }

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

  // Graph Data Construction
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
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

      setGraphData({ nodes, links })
      setIsBuildingGraph(false)
    }, 250) // Wait 250ms to allow the modal CSS open animation to finish perfectly smoothly

    return () => clearTimeout(timer)
  }, [snippets, selectedSnippet, embeddingsCache])

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
          graphRef.current.zoomToFit(400)
        }
      }, 100) // Small delay to ensure WebGL engine is ready
    }
  }, [selectedSnippet, isBuildingGraph, graphData.nodes.length])

  // Physics Engine Setup
  useEffect(() => {
    if (!graphRef.current) return
    const fg = graphRef.current

    const sizeMult = settings.graphNodeSize || 1.5

    // Galactic Core Gravity: Weakened to barely pull at all
    fg.d3Force('x', forceX(0).strength(0.001))
    fg.d3Force('y', forceY(0).strength(0.001))

    // Galaxy Disc Structure: Forces nodes into a circular galaxy shape, widened and weakened
    // To make it look "hollow" (like a ring/donut), we ensure no node is allowed at radius 0
    fg.d3Force(
      'radial',
      forceRadial(
        (d) => {
          if (d.linkCount === 0) return 1500 // Bring unlinked stars much further out
          // Hubs (many links) get pulled to the event horizon (radius 400), leaving a giant hollow center
          // Normal notes (few links) orbit further out
          return Math.max(400, 900 - d.linkCount * 40)
        },
        0,
        0
      ).strength(0.02) // Extremely soft pull so nodes drift
    )

    // Gentle repulsion to separate clusters (Obsidian uses very low values like -200 to -400)
    fg.d3Force('charge', forceManyBody().strength(-300))

    // Very soft collisions so they slide past each other gently
    fg.d3Force(
      'collide',
      forceCollide()
        .radius((d) => {
          const baseR = d.val ? Math.max(2, Math.sqrt(d.val) * 2.5) : 2
          return baseR * sizeMult + 40 // Increased physical gap to space them out heavily
        })
        .strength(0.1)
    )

    // Extremely elastic links like a spiderweb
    if (fg.d3Force('link')) fg.d3Force('link').distance(150).strength(0.05)

    // Reheat to apply new physical sizes
    fg.d3ReheatSimulation()
  }, [settings.graphNodeSize])

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

    return settings.graphNodeColor || '#40bafa' // Default blue for Notes
  }

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const isActive = selectedSnippet && node.snippetId === selectedSnippet.id
      const isHovered = hoverNode === node
      const label = (node.id || '').replace(/[*"']/g, '')
      const sizeMult = settings.graphNodeSize || 1.5
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
      searchQuery,
      settings.graphNodeSize,
      settings.graphShowTexts,
      settings.graphNodeColor
    ]
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
          cooldownTicks={100}
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
        flexDirection: 'row',
        transform: isMaximized ? 'none' : `translate(${modalPos.current.x}px, ${modalPos.current.y}px)`,
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' // Will be overridden via ref during drag
      }}
    >
      <GraphSidebar 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSpinning={isSpinning}
        setIsSpinning={setIsSpinning}
        graphTheme={graphTheme}
        onHeaderMouseDown={handleModalHeaderMouseDown}
        isMaximized={isMaximized}
      />

      <div className="nexus-main">
        <ModalHeader
          title=""
          onClose={onClose}
          onMouseDown={handleModalHeaderMouseDown}
          style={{ cursor: isMaximized ? 'default' : 'grab' }}
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

        <div className="nexus-body">
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width - 260}
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
          cooldownTicks={150}
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
