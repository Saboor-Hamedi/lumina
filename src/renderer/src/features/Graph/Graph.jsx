import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  X,
  Square,
  Copy,
  Network,
  RefreshCw,
  Layers,
  Search,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import ForceGraph2D from 'react-force-graph-2d'
import * as THREE from 'three'
import Graph3D from './Graph3D'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useAIStore } from '../AI/tools/LuminaChat'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import { forceRadial, forceManyBody, forceCollide, forceCenter, forceX, forceY } from 'd3-force'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../Overlays/ModalHeader'
import GraphThemeSelector from './GraphThemeSelector'
import GraphSidebar from './GraphSidebar'
import GraphMiniMap from './GraphMiniMap'
import './Graph.css'

const sharedSphereGeometry = new THREE.SphereGeometry(1, 8, 8)
const materialCache = {}
const getMaterial = (color) => {
  if (!materialCache[color]) {
    materialCache[color] = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    })
  }
  return materialCache[color]
}

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
  const snippets = useVaultStore((s) => s.snippets)
  const selectedSnippet = useVaultStore((s) => s.selectedSnippet)
  const dirtySnippetIds = useVaultStore((s) => s.dirtySnippetIds)
  const embeddingsCache = useAIStore((s) => s.embeddingsCache)

  // Granular subscriptions so physics sliders do not cause React re-renders!
  const graphTheme = useSettingsStore((s) => s.settings.graphTheme || 'default')
  const graphHideTags = useSettingsStore((s) => s.settings.graphHideTags)
  const graphHideGhosts = useSettingsStore((s) => s.settings.graphHideGhosts)
  const graphHideOrphans = useSettingsStore((s) => s.settings.graphHideOrphans)
  const graphSidebarOpen = useSettingsStore((s) => s.settings.graphSidebarOpen ?? true)
  const is3DMode = useSettingsStore((s) => s.settings.graph3DMode ?? false)

  const [hoverNode, setHoverNode] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const isMaximized = useSettingsStore((s) => s.settings.graphModalMaximized ?? false)

  const isSpinning = useSettingsStore((s) => s.settings.graphAnimate ?? false)
  const graphRef = useRef()
  const containerRef = useRef()
  const [isEngineReady, setIsEngineReady] = useState(false)
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

  const modalPos = useRef(JSON.parse(localStorage.getItem('graph-modal-pos') || '{"x":0,"y":0}'))
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

  const handleModalHeaderMouseDown = useCallback(
    (e) => {
      if (isMaximized) return
      isDraggingModal.current = true

      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }

      dragStart.current = {
        x: e.clientX - modalPos.current.x,
        y: e.clientY - modalPos.current.y
      }
    },
    [isMaximized]
  )

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

      setRawGraphData((prev) => {
        const prevNodes = new Map(prev.nodes.map((n) => [n.id, n]))

        nodes.forEach((n) => {
          const oldN = prevNodes.get(n.id)
          if (oldN && oldN.x !== undefined) {
            n.x = oldN.x
            n.y = oldN.y
            n.vx = oldN.vx
            n.vy = oldN.vy
          } else {
            // Spawn nodes over a much wider area so the physics engine doesn't have to spend 3 seconds exploding them
            n.x = (Math.random() - 0.5) * 2000
            n.y = (Math.random() - 0.5) * 2000
            n.z = (Math.random() - 0.5) * 2000
          }

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

        const isSameStructure =
          prev.nodes.length === nodes.length &&
          prev.links.length === links.length &&
          nodes.every((n) => prevNodes.has(n.id)) &&
          links.every((l, i) => {
            const prevL = prev.links[i]
            const src = typeof l.source === 'object' ? l.source.id : l.source
            const tgt = typeof l.target === 'object' ? l.target.id : l.target
            const prevSrc = typeof prevL.source === 'object' ? prevL.source.id : prevL.source
            const prevTgt = typeof prevL.target === 'object' ? prevL.target.id : prevL.target
            return src === prevSrc && tgt === prevTgt
          })

        if (isSameStructure) {
          // Mutate existing nodes for minor prop changes to avoid triggering a full React re-render
          // which would cause react-force-graph to reheat the physics simulation and jiggle
          nodes.forEach((n) => {
            const oldN = prevNodes.get(n.id)
            if (oldN) {
              oldN.ageFactor = n.ageFactor
              oldN.val = n.val
              oldN.linkCount = n.linkCount
              oldN.primaryTag = n.primaryTag
            }
          })
          return prev
        }

        return { nodes, links }
      })

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
      links.forEach((l) => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        nodesWithLinks.add(src)
        nodesWithLinks.add(tgt)
      })
      nodes = nodes.filter((n) => nodesWithLinks.has(n.id))
    }

    return { nodes, links }
  }, [rawGraphData, graphHideTags, graphHideGhosts, graphHideOrphans])

  const prevSelectedId = useRef(selectedSnippet?.id)
  const hasInitialRender = useRef(false)

  // Center on mount and data load
  useEffect(() => {
    if (graphRef.current && !isBuildingGraph && graphData.nodes.length > 0) {
      const isFirstRender = !hasInitialRender.current
      const didSnippetChange = prevSelectedId.current !== selectedSnippet?.id

      if (isFirstRender || didSnippetChange) {
        hasInitialRender.current = true
        prevSelectedId.current = selectedSnippet?.id

        setTimeout(() => {
          if (!graphRef.current) return
          if (selectedSnippet) {
            const node = graphData.nodes.find((n) => n.snippetId === selectedSnippet.id)
            if (node) {
              if (is3DMode) {
                // In 3D, position the camera to look at the node from a reasonable distance
                const distance = 200
                const distRatio =
                  1 + distance / Math.max(1, Math.hypot(node.x || 0, node.y || 0, node.z || 0))

                graphRef.current.cameraPosition(
                  {
                    x: (node.x || 0) * distRatio,
                    y: (node.y || 0) * distRatio,
                    z: (node.z || 0) * distRatio
                  }, // new position
                  { x: node.x || 0, y: node.y || 0, z: node.z || 0 }, // lookAt
                  400 // ms transition duration
                )
              } else {
                if (graphRef.current.centerAt) {
                  graphRef.current.centerAt(node.x || 0, node.y || 0, 400)
                  graphRef.current.zoom(1.0, 400) // Lowered zoom from 1.5 to 1.0
                }
              }
            }
          } else if (isFirstRender) {
            // Instantly frame the graph without waiting 2.5 seconds
            if (is3DMode && graphRef.current.cameraPosition) {
              // 3D zoomToFit
              graphRef.current.zoomToFit(400, 50)
            } else if (!is3DMode && graphRef.current.zoomToFit) {
              // 2D zoomToFit
              graphRef.current.zoomToFit(400, 50)
            }
          }
        }, 100) // Small delay to ensure WebGL engine is ready
      }
    }
  }, [selectedSnippet, isBuildingGraph, graphData.nodes, is3DMode])

  // Ref for debouncing reheat
  const reheatTimeoutRef = useRef(null)

  // Physics Engine Setup
  useEffect(() => {
    // Unsubscribe listener for Live Physics without React Re-renders
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
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
        if (is3DMode) return // Graph3D handles its own live physics
        const fg = graphRef.current

        // Delay execution to ensure 3D physics engine is initialized on mount
        setTimeout(() => {
          const sizeMult = settings.graphNodeSize || 1.5
          const centerForce = settings.graphCenterForce ?? 0.05
          const repelForce = settings.graphRepelForce ?? 0.3
          const linkForce = settings.graphLinkForce ?? 0.05

          // Update force parameters instantly
          fg.d3Force('custom_x').strength(0)
          fg.d3Force('custom_y').strength(0)

          if (!is3DMode) {
            fg.d3Force('custom_gravity', null)
            if (fg.d3Force('custom_radial')) {
              fg.d3Force('custom_radial')
                .radius((d) => (d.val <= 1 ? 800 : 0))
                .strength((d) => (d.val <= 1 ? 0.2 : centerForce))
            }

            // Ensure 2D forces exist and default 3D/2D charge is disabled
            if (fg.d3Force('charge')) fg.d3Force('charge', null)
            if (!fg.d3Force('custom_charge')) fg.d3Force('custom_charge', forceManyBody())
            if (!fg.d3Force('custom_collide')) fg.d3Force('custom_collide', forceCollide())

            fg.d3Force('custom_charge').strength(-500 * repelForce)
            fg.d3Force('custom_collide')
              .radius((d) => {
                const baseR = d.val ? Math.max(2, Math.sqrt(d.val) * 2.5) : 2
                return baseR * sizeMult + 15
              })
              .strength(0.75)
              .iterations(1)
          }

          if (fg.d3Force('link')) fg.d3Force('link').strength(linkForce)

          // Debounce the reheat to prevent violent shaking when dragging sliders
          if (reheatTimeoutRef.current) clearTimeout(reheatTimeoutRef.current)
          reheatTimeoutRef.current = setTimeout(() => {
            if (graphRef.current) graphRef.current.d3ReheatSimulation()
          }, 300)
        }, 50)
      }
    })

    // Initial Setup
    setIsEngineReady(false)
    const safetyTimer = setTimeout(() => setIsEngineReady(true), 1500)
    
    if (!graphRef.current) return
    if (is3DMode) return // Graph3D handles its own initial physics setup
    const fg = graphRef.current

    // Defer initialization slightly so ForceGraph3D's internal engine has mounted and created d3ForceLayout
    const initTimer = setTimeout(() => {
      const initialSettings = useSettingsStore.getState().settings

      const sizeMult = initialSettings.graphNodeSize || 1.5
      const centerForce = initialSettings.graphCenterForce ?? 0.05
      const repelForce = initialSettings.graphRepelForce ?? 0.3
      const linkForce = initialSettings.graphLinkForce ?? 0.05

      // Initialize core forces only if they don't exist
      if (!fg.d3Force('custom_x')) fg.d3Force('custom_x', forceX(0))
      if (!fg.d3Force('custom_y')) fg.d3Force('custom_y', forceY(0))

      if (!is3DMode) {
        fg.d3Force('custom_gravity', null)
        if (!fg.d3Force('custom_radial')) fg.d3Force('custom_radial', forceRadial(800))
        if (!fg.d3Force('custom_charge')) fg.d3Force('custom_charge', forceManyBody())
        if (!fg.d3Force('custom_collide')) fg.d3Force('custom_collide', forceCollide())
      }

      // Disable default forces to prevent conflicts
      fg.d3Force('x', null)
      fg.d3Force('y', null)
      fg.d3Force('z', null)
      fg.d3Force('radial', null)
      fg.d3Force('center', null)

      if (!is3DMode) {
        fg.d3Force('charge', null)
      }

      // Apply initial forces
      fg.d3Force('custom_x').strength(0)
      fg.d3Force('custom_y').strength(0)

      if (!is3DMode) {
        fg.d3Force('custom_radial')
          .radius((d) => (d.val <= 1 ? 800 : 0))
          .strength((d) => (d.val <= 1 ? 0.2 : centerForce))

        fg.d3Force('custom_charge').strength(-500 * repelForce)
        fg.d3Force('custom_collide')
          .radius((d) => {
            const baseR = d.val ? Math.max(2, Math.sqrt(d.val) * 2.5) : 2
            return baseR * sizeMult + 15
          })
          .strength(0.75)
          .iterations(1)
      }

      // Extremely elastic links like a spiderweb
      if (fg.d3Force('link')) fg.d3Force('link').distance(150).strength(linkForce)

      fg.d3ReheatSimulation()
    }, 100) // 100ms initialization delay

    return () => {
      unsubscribe()
      clearTimeout(initTimer)
      clearTimeout(safetyTimer)
    }
  }, [is3DMode])

  // Auto-Spin Logic removed to prevent CPU heavy continuous physics simulation

  // Precompute line colors to save 60,000+ calculations per second
  const defaultLineColor = useMemo(() => {
    const isSelectedTheme = graphTheme === 'space' || graphTheme === 'nebula'
    if (is3DMode) {
      return isSelectedTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(150, 150, 150, 0.25)'
    }
    return isSelectedTheme ? 'rgba(255, 255, 255, 0.04)' : 'rgba(150, 150, 150, 0.08)' // Extremely faint so it's not muddy
  }, [graphTheme, is3DMode])

  const dimmedLineColor = useMemo(() => {
    const isSelectedTheme = graphTheme === 'space' || graphTheme === 'nebula'
    if (is3DMode) {
      return isSelectedTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(150, 150, 150, 0.1)'
    }
    return isSelectedTheme ? 'rgba(255, 255, 255, 0.01)' : 'rgba(150, 150, 150, 0.02)'
  }, [graphTheme, is3DMode])

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
        ctx.fillStyle = isSearchMatch
          ? 'rgba(255, 255, 255, 0.4)'
          : isActive
            ? 'rgba(255, 170, 0, 0.3)'
            : 'rgba(64, 186, 250, 0.3)'
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
    },
    [selectedSnippet, hoverNode, hoverNeighbors, searchQuery]
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

        {is3DMode ? (
          <Graph3D
            key="3d-graph-embedded"
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeColor={nodeColor}
            nodeRelSize={4}
            nodeThreeObject={(node) => {
              const base = node.val ? Math.max(2, Math.sqrt(node.val) * 2.5) : 2
              const targetRadius =
                base * (useSettingsStore.getState().settings.graphNodeSize || 1.5)
              const r = targetRadius / 4
              const mesh = new THREE.Mesh(sharedSphereGeometry, getMaterial(nodeColor(node)))
              mesh.scale.set(r, r, r)
              return mesh
            }}
            linkColor={(link) => {
              if (!hoverNode) return defaultLineColor
              const sourceId = link.source.id || link.source
              const targetId = link.target.id || link.target
              return sourceId === hoverNode.id || targetId === hoverNode.id
                ? '#40bafa'
                : '#333333'
            }}
            linkWidth={0.5}
            onNodeHover={(node) => setHoverNode(node)}
            onNodeClick={(node) => {
              if (node.snippetId) {
                const s = snippets.find((sn) => sn.id === node.snippetId)
                if (s) onNavigate(s)
              }
            }}
            onNodeDragEnd={(node) => {
              node.fx = null
              node.fy = null
              node.fz = null
            }}
            backgroundColor="rgba(0,0,0,0)"
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.4}
            showNavInfo={false}
            linkDirectionalParticles={0}
            nodeLabel={(node) => (node.id || '').replace(/[*"']/g, '')}
            onEngineStop={() => setIsEngineReady(true)}
          />
        ) : (
          <ForceGraph2D
            key="2d-graph-embedded"
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
                ? '#40bafa'
                : '#333333'
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
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.4}
            nodeLabel={(node) => (node.id || '').replace(/[*"']/g, '')}
            onEngineStop={() => setIsEngineReady(true)}
          />
        )}
        <GraphMiniMap
          graphRef={graphRef}
          graphData={graphData}
          mainWidth={dimensions.width}
          mainHeight={dimensions.height}
          is3DMode={is3DMode}
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
        transform: isMaximized
          ? 'none'
          : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
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
            onClick={(e) => {
              handleToggleSidebar(e)
              e.currentTarget.blur()
            }}
            title={graphSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
            style={{ marginLeft: '-10px' }}
          >
            {graphSidebarOpen ? (
              <PanelLeftClose size={12} strokeWidth={2} />
            ) : (
              <PanelLeftOpen size={12} strokeWidth={2} />
            )}
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

        <div className="nexus-body" style={{ position: 'relative' }}>
          {/* Initializer Pulse Overlay */}
          <div className={`graph-initializer ${isEngineReady ? 'ready' : ''}`}>
            <div className="pulse-ring"></div>
            <div className="graph-initializer-text">Initializing Physics</div>
          </div>

          {is3DMode ? (
            <Graph3D
              key="3d-graph-modal"
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height - 32}
              graphData={graphData}
              nodeColor={nodeColor}
              nodeRelSize={4}
              nodeThreeObject={(node) => {
                const base = node.val ? Math.max(2, Math.sqrt(node.val) * 2.5) : 2
                const targetRadius =
                  base * (useSettingsStore.getState().settings.graphNodeSize || 1.5)
                const r = targetRadius / 4
                const mesh = new THREE.Mesh(sharedSphereGeometry, getMaterial(nodeColor(node)))
                mesh.scale.set(r, r, r)
                return mesh
              }}
              linkColor={(link) => {
                if (!hoverNode) return defaultLineColor
                const sourceId = link.source.id || link.source
                const targetId = link.target.id || link.target
                return sourceId === hoverNode.id || targetId === hoverNode.id
                  ? '#40bafa'
                  : '#333333'
              }}
              linkWidth={0.5}
              onNodeHover={(node) => setHoverNode(node)}
              onNodeClick={(node) => {
                if (node.snippetId) {
                  const s = snippets.find((sn) => sn.id === node.snippetId)
                  if (s) onNavigate(s)
                }
              }}
              onNodeDragEnd={(node) => {
                node.fx = null
                node.fy = null
                node.fz = null
              }}
              backgroundColor="rgba(0,0,0,0)"
              d3AlphaDecay={0.05}
              d3VelocityDecay={0.4}
              showNavInfo={false}
            />
          ) : (
            <ForceGraph2D
              key="2d-graph-modal"
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
                  ? '#40bafa'
                  : '#333333'
              }}
              linkWidth={0.5}
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
              d3AlphaDecay={0.05}
              d3VelocityDecay={0.4}
              linkDirectionalParticles={0}
              nodeLabel={(node) => (node.id || '').replace(/[*"']/g, '')}
              onEngineStop={() => setIsEngineReady(true)}
            />
          )}
          <GraphMiniMap
            graphRef={graphRef}
            graphData={graphData}
            mainWidth={dimensions.width}
            mainHeight={dimensions.height - 32}
            is3DMode={is3DMode}
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
