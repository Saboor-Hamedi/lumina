import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { X, Network, Globe, Focus, Atom } from 'lucide-react'
import ForceGraph2D from 'react-force-graph-2d'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useAIStore } from '../../core/store/useAIStore'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import { forceRadial, forceManyBody } from 'd3-force'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import './GraphNexus.css'

const GraphNexus = ({ isOpen, onClose, onNavigate }) => {
  const { snippets, selectedSnippet, dirtySnippetIds } = useVaultStore()
  const { embeddingsCache } = useAIStore()
  const [activeMode, setActiveMode] = useState('universe') // 'universe' | 'neighborhood' | 'orb'
  const [hoverNode, setHoverNode] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const graphRef = useRef()
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth * 0.95,
    height: window.innerHeight * 0.92
  })

  // Localized Escape Handler
  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen) {
        onClose()
        return true
      }
      return false
    }
  })

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth * 0.95,
        height: window.innerHeight * 0.92
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Graph Data Construction
  const graphData = useMemo(() => {
    const rawData = buildGraphData(snippets)
    const semantic = buildSemanticLinks(rawData.nodes, rawData.links, snippets, embeddingsCache)
    let nodes = rawData.nodes
    let links = [...rawData.links, ...semantic]

    // Calculate Age Gravity
    const now = Date.now()
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days is "old"
    
    nodes.forEach(n => {
        if (n.snippetId) {
            const s = snippets.find(sn => sn.id === n.snippetId)
            const age = now - (s?.timestamp || now)
            // Normalized age: 0 (new) to 1 (old)
            n.ageFactor = Math.min(1, age / maxAge)
        } else {
            n.ageFactor = 0.5 // Standard for ghost/tags
        }
    })

    if (activeMode === 'neighborhood' && selectedSnippet) {
      // Filter logic...
      const neighbors = new Set()
      links.forEach(l => {
        const sId = l.source.id || l.source
        const tId = l.target.id || l.target
        if (sId === selectedSnippet.title) neighbors.add(tId)
        if (tId === selectedSnippet.title) neighbors.add(sId)
      })
      neighbors.add(selectedSnippet.title)

      nodes = nodes.filter(n => neighbors.has(n.id))
      links = links.filter(l => neighbors.has(l.source.id || l.source) && neighbors.has(l.target.id || l.target))
    }

    return { nodes, links }
  }, [snippets, activeMode, selectedSnippet, embeddingsCache])

  // Center on mount/mode change
  useEffect(() => {
    if (graphRef.current) {
      setTimeout(() => {
        if (activeMode === 'universe') {
            graphRef.current.zoomToFit(400, 50)
        } else if (selectedSnippet) {
            const node = graphData.nodes.find(n => n.snippetId === selectedSnippet.id)
            if (node) {
                graphRef.current.centerAt(node.x, node.y, 400)
                graphRef.current.zoom(activeMode === 'orb' ? 3 : 2, 400)
            }
        }
      }, 100)
    }
  }, [activeMode, graphData.nodes.length])

  // D3 Forces Polish
  useEffect(() => {
    if (!graphRef.current) return
    const fg = graphRef.current
    
    if (activeMode === 'orb' || activeMode === 'neighborhood') {
      fg.d3Force('center', null)
      fg.d3Force('radial', forceRadial(d => (d.ageFactor || 0.5) * 150, 0, 0).strength(0.8))
      fg.d3Force('charge', forceManyBody().strength(-150))
    } else {
      // Universe Mode: Chronological Rings
      fg.d3Force('center', null)
      fg.d3Force('radial', forceRadial(d => (d.ageFactor || 0.5) * 450, 0, 0).strength(0.4))
      fg.d3Force('charge', forceManyBody().strength(-80))
    }
  }, [activeMode])

  if (!isOpen) return null

  const nodeColor = (node) => {
    if (selectedSnippet && node.snippetId === selectedSnippet.id) return '#ffaa00'
    if (node.group === 'ghost') return 'rgba(150, 150, 150, 0.4)'
    if (node.group === 'tag') return '#14b8a6'
    return '#40bafa'
  }

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const isActive = selectedSnippet && node.snippetId === selectedSnippet.id
      const isHovered = hoverNode === node
      const label = (node.id || '').replace(/[*"']/g, '')
      const r = node.val ? Math.max(3, Math.sqrt(node.val) * 4) : 3

      // Node Circle
      if (isActive || isHovered) {
        ctx.shadowColor = isActive ? '#ffaa00' : 'rgba(64, 186, 250, 0.5)'
        ctx.shadowBlur = isHovered ? 20 : 15
      }
      
      // Relationship Dimming Logic
      if (hoverNode && hoverNode !== node) {
          const isNeighbor = graphData.links.some(l => 
            (l.source.id === hoverNode.id && l.target.id === node.id) ||
            (l.source.id === node.id && l.target.id === hoverNode.id)
          )
          if (!isNeighbor) ctx.globalAlpha = 0.15
      }

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
      ctx.fillStyle = nodeColor(node)
      ctx.fill()
      ctx.shadowBlur = 0 // Reset
      ctx.globalAlpha = 1.0

      // Text Logic: Compensatory Scaling
      const baseFontSize = 14
      const fontSize = baseFontSize / globalScale
      ctx.font = `${fontSize}px Inter, sans-serif`

      let shouldShow = false
      if (isActive || isHovered) shouldShow = true
      else if (globalScale > 0.8) shouldShow = true
      else if (node.val > 5 && globalScale > 0.3) shouldShow = true

      if (shouldShow) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        
        // Fill
        ctx.fillStyle = isActive ? '#ffaa00' : isHovered ? '#fff' : 'rgba(255, 255, 255, 0.9)'
        ctx.fillText(label, node.x, node.y + r + 2)
      }
    },
    [selectedSnippet, hoverNode, graphData.links]
  )

  return (
    <div className="nexus-overlay" onClick={onClose}>
      <div className="nexus-container" onClick={e => e.stopPropagation()}>
        <header className="nexus-header">
          <div className="nexus-brand">
            <Network size={18} className="nexus-icon" />
            <span>Graph Nexus</span>
          </div>

          <div className="nexus-tabs">
            <button 
              className={`nexus-tab ${activeMode === 'universe' ? 'active' : ''}`}
              onClick={() => setActiveMode('universe')}
            >
              <Globe size={14} />
              Universe
            </button>
            <button 
              className={`nexus-tab ${activeMode === 'neighborhood' ? 'active' : ''}`}
              onClick={() => setActiveMode('neighborhood')}
            >
              <Focus size={14} />
              Neighborhood
            </button>
            <button 
              className={`nexus-tab ${activeMode === 'orb' ? 'active' : ''}`}
              onClick={() => setActiveMode('orb')}
            >
              <Atom size={14} />
              The Orb
            </button>
          </div>

          <button className="nexus-close" onClick={onClose}>
            <X size={20} />
          </button>
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
              const r = node.val ? Math.max(3, Math.sqrt(node.val) * 4) : 3
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
              ctx.fill()
            }}
            linkColor={(link) => {
                if (!hoverNode) return 'rgba(255, 255, 255, 0.15)'
                const isConnected = link.source.id === hoverNode.id || link.target.id === hoverNode.id
                return isConnected ? 'rgba(64, 186, 250, 0.6)' : 'rgba(255, 255, 255, 0.05)'
            }}
            linkDirectionalParticles={activeMode === 'orb' ? 4 : 2}
            linkDirectionalParticleSpeed={0.005}
            onNodeClick={(node) => {
              if (node.snippetId) {
                const s = snippets.find(sn => sn.id === node.snippetId)
                if (s) onNavigate(s)
              }
            }}
            backgroundColor="rgba(0,0,0,0)"
            d3AlphaDecay={activeMode === 'orb' ? 0.01 : 0.05}
            cooldownTicks={100}
          />
          
          {activeMode === 'orb' && <div className="orb-lens" />}

          {/* INSIGHT TOOLTIP */}
          {hoverNode && hoverNode.snippetId && (
            <div className="nexus-insight-card">
              {(() => {
                const s = snippets.find(sn => sn.id === hoverNode.snippetId)
                if (!s) return null
                return (
                  <>
                    <div className="card-header">
                      <div className="card-title">
                        {s.title}
                        {dirtySnippetIds.includes(s.id) && <div className="dirty-indicator" style={{ marginLeft: '8px', display: 'inline-block' }} />}
                      </div>
                      <div className="card-meta">
                        {s.language} • {s.code?.trim().split(/\s+/).length || 0} words
                      </div>
                    </div>
                    <div className="card-summary">
                      {s.code ? s.code.slice(0, 160) + (s.code.length > 160 ? '...' : '') : 'Empty note'}
                    </div>
                    {s.tags && (
                      <div className="card-tags">
                        {s.tags.split(',').map(tag => (
                          <span key={tag} className="card-tag">#{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                    <div className="card-footer">
                      Last edited {new Date(s.timestamp).toLocaleDateString()}
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </div>

        <footer className="nexus-footer">
          <div className="nexus-hint">ESC to close • Click node to teleport</div>
          {selectedSnippet && (
            <div className="nexus-focus-info">
              Focusing: <strong>{selectedSnippet.title}</strong>
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}

export default GraphNexus
