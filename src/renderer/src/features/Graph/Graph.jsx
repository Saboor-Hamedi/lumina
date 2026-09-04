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
import * as THREE from 'three'
import Graph3D from './Graph3D'
import Graph2D from './Graph2D'
import { useVaultStore } from '../../core/store/workspaceStore'
import { useAIStore } from '../AI/tools/lumina'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { usePerformanceStore } from './usePerformanceStore'
import PerformancePanel from './PerformancePanel'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import { forceRadial, forceManyBody, forceCollide, forceCenter, forceX, forceY } from 'd3-force'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../Overlays/ModalHeader'
import GraphThemeSelector from './GraphThemeSelector'
import GraphSidebar from './GraphSidebar'
import GraphMiniMap from './GraphMiniMap'
import './Graph.css'
import { getNodeColor, drawNode } from './graphs'

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
  const graphSnippets = useMemo(() => {
    return snippets.filter((s) => s.type !== 'image' && s.language !== 'image')
  }, [snippets])
  const selectedSnippet = useVaultStore((s) => s.selectedSnippet)
  const dirtySnippetIds = useVaultStore((s) => s.dirtySnippetIds)
  const embeddingsCache = useAIStore((s) => s.embeddingsCache)

  // Granular subscriptions so physics sliders do not cause React re-renders!
  const graphTheme = useSettingsStore((s) => s.settings.graphTheme || 'default')
  
  const handleRecenter = (e) => {
    if (e) e.stopPropagation()
    if (graphRef.current && graphRef.current.zoomToFit) {
      graphRef.current.zoomToFit(800, 100) // animate for 800ms with 100px padding
    }
  }
  const graphHideTags = useSettingsStore((s) => s.settings.graphHideTags)
  const graphHideGhosts = useSettingsStore((s) => s.settings.graphHideGhosts)
  const graphHideOrphans = useSettingsStore((s) => s.settings.graphHideOrphans)
  const graphSidebarOpen = useSettingsStore((s) => s.settings.graphSidebarOpen ?? true)
  const is3DMode = useSettingsStore((s) => s.settings.graph3DMode ?? false)
  const graphNodeSize = useSettingsStore((s) => s.settings.graphNodeSize || 1.5)
  const graphNodeColor = useSettingsStore((s) => s.settings.graphNodeColor || '#40bafa')
  const graphShowTexts = useSettingsStore((s) => s.settings.graphShowTexts !== false)

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

  const modalPos = useRef({ x: 0, y: 0 })
  const isDraggingModal = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const rafId = useRef(null)

  useEffect(() => {
    modalPos.current = { x: 0, y: 0 }
    if (containerRef.current && !isMaximized) {
      containerRef.current.style.transform = 'translate3d(0px, 0px, 0)'
    }
  }, [isOpen, isMaximized])

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
      if (e.target.closest('button')) return // Do not drag if clicking a button
      
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
      const rawData = buildGraphData(graphSnippets)
      const semantic = buildSemanticLinks(rawData.nodes, rawData.links, graphSnippets, embeddingsCache)
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
        const prevLinks = new Map(
          prev.links.map((l) => {
            const s = typeof l.source === 'object' ? l.source.id : l.source
            const t = typeof l.target === 'object' ? l.target.id : l.target
            return [`${s}|${t}`, l]
          })
        )

        const nextNodes = nodes.map((n) => {
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
            n.ageFactor = Math.min(1, age / maxAge)
          } else {
            n.ageFactor = 0.5
          }
          n.linkCount = linkCounts[n.id] || 0
          n.val = n.linkCount + 1

          const oldN = prevNodes.get(n.id)
          if (oldN) {
            oldN.ageFactor = n.ageFactor
            oldN.val = n.val
            oldN.linkCount = n.linkCount
            oldN.primaryTag = n.primaryTag
            return oldN
          }

          const spread = nodes.length <= 10 ? 200 : 1000
          n.x = (Math.random() - 0.5) * spread
          n.y = (Math.random() - 0.5) * spread
          n.z = (Math.random() - 0.5) * spread
          return n
        })

        const nextLinks = links.map((l) => {
          const s = typeof l.source === 'object' ? l.source.id : l.source
          const t = typeof l.target === 'object' ? l.target.id : l.target
          const oldL = prevLinks.get(`${s}|${t}`)
          if (oldL) {
            oldL.value = l.value
            if (l.type) oldL.type = l.type
            return oldL
          }
          return l
        })

        const isSameStructure =
          prev.nodes.length === nextNodes.length &&
          prev.links.length === nextLinks.length &&
          nextNodes.every((n) => prevNodes.has(n.id)) &&
          nextLinks.every((l, i) => {
            const prevL = prev.links[i]
            const src = typeof l.source === 'object' ? l.source.id : l.source
            const tgt = typeof l.target === 'object' ? l.target.id : l.target
            const prevSrc = typeof prevL.source === 'object' ? prevL.source.id : prevL.source
            const prevTgt = typeof prevL.target === 'object' ? prevL.target.id : prevL.target
            return src === prevSrc && tgt === prevTgt
          })

        if (isSameStructure) {
          return prev
        }

        return { nodes: nextNodes, links: nextLinks }
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
            if (is3DMode && graphRef.current.cameraPosition) {
              graphRef.current.zoomToFit(400, 50)
            } else if (!is3DMode && graphRef.current.zoomToFit) {
              graphRef.current.zoomToFit(400, 50)
              // If graph is tiny, it zooms in way too far. Cap it after animation finishes.
              setTimeout(() => {
                if (graphRef.current && graphRef.current.zoom() > 1.5) {
                  graphRef.current.zoom(1.5, 400)
                }
              }, 450)
            }
          }
        }, 100) // Small delay to ensure WebGL engine is ready
      }
    }
  }, [selectedSnippet, isBuildingGraph, graphData.nodes, is3DMode])

  // Ref for debouncing reheat
  const reheatTimeoutRef = useRef(null)

  // Physics Engine Setup
  // (Removed: Graph2D handles its own physics in a WebWorker to prevent main-thread freezing,
  // and Graph3D handles its own internal physics. This legacy block was causing the main thread
  // to fight the WebWorker, halving the framerate).
  useEffect(() => {
    // We still need to trigger the initial pulse overlay removal
    setIsEngineReady(false)
    const safetyTimer = setTimeout(() => setIsEngineReady(true), 1500)
    return () => clearTimeout(safetyTimer)
  }, [is3DMode])

  // Auto-Spin Logic removed to prevent CPU heavy continuous physics simulation

  // Precompute line colors to save 60,000+ calculations per second
  const defaultLineColor = useMemo(() => {
    const isSelectedTheme = graphTheme === 'space' || graphTheme === 'nebula'
    if (is3DMode) {
      return isSelectedTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(150, 150, 150, 0.15)'
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

  const nodeColorFn = useCallback((node) => {
    return getNodeColor(node, selectedSnippet?.id, graphNodeColor)
  }, [selectedSnippet, graphNodeColor])

  const normalizedSearchQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery])

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const isActive = selectedSnippet && node.snippetId === selectedSnippet.id
      const isHovered = hoverNode === node
      // Cap max radius tightly — nodes should be dots, not planets
      const baseR = node.val ? Math.min(10, Math.max(3, Math.sqrt(node.val) * 2.8)) : 3
      const r = baseR * graphNodeSize + 3

      const label = (node.id || '').replace(/[*"']/g, '')
      const isSearchMatch =
        normalizedSearchQuery !== '' && label.toLowerCase().includes(normalizedSearchQuery)
      const isSearchDimmed = normalizedSearchQuery !== '' && !isSearchMatch

      const isNeighborDimmed = hoverNode && hoverNode !== node && !hoverNeighbors.has(node.id)

      // LEVEL OF DETAIL (LOD) OPTIMIZATION:
      // Canvas fillText is extremely expensive. For thousands of nodes, drawing text every frame kills FPS.
      // Only draw text if explicitly hovered/active/searched, OR if the user is zoomed in close enough (globalScale > 1.5)
      const showText =
        graphShowTexts && (isActive || isHovered || isSearchMatch || globalScale >= 1.2)

      drawNode(
        ctx,
        node,
        r,
        nodeColorFn(node),
        isActive,
        isHovered,
        isSearchMatch,
        isSearchDimmed,
        isNeighborDimmed,
        showText,
        globalScale
      )
    },
    [
      selectedSnippet,
      hoverNode,
      hoverNeighbors,
      normalizedSearchQuery,
      graphNodeSize,
      graphShowTexts,
      nodeColorFn
    ]
  )

  if (!isOpen && !embedded) return null

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
            nodeColor={nodeColorFn}
            nodeRelSize={4}
            nodeThreeObject={(node) => {
              const base = node.val ? Math.min(10, Math.max(3, Math.sqrt(node.val) * 2.8)) : 3
              const r = base * graphNodeSize + 3
              const mesh = new THREE.Mesh(sharedSphereGeometry, getMaterial(nodeColorFn(node)))
              mesh.scale.set(r, r, r)
              return mesh
            }}
            linkVisibility={(link) => {
              if (!window._luminaIsDragging) return true
              return link.source === hoverNode || link.target === hoverNode
            }}
            linkColor={(link) => {
              const isHoverConnected = hoverNode && (link.source === hoverNode || link.target === hoverNode);
              const isSelectedConnected = selectedSnippet && ((link.source.snippetId === selectedSnippet.id) || (link.target.snippetId === selectedSnippet.id));
              
              if (!hoverNode && !selectedSnippet) return defaultLineColor;
              
              const isActive = hoverNode ? isHoverConnected : isSelectedConnected;
              
              const { settings } = useSettingsStore.getState();
              const dimOpacity = settings.graphLinkDimOpacity ?? 0.05;
              
              if (!isActive) {
                return `rgba(150, 150, 150, ${dimOpacity})`;
              }
              
              const highlightOpacity = settings.graphLinkHighlightOpacity ?? 0.6;
              const accentColor = settings.graphNodeColor || '#40bafa';
              
              const hexToRgba = (hex, alpha) => {
                if (hex.startsWith('#')) {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                }
                return hex;
              };

              return hexToRgba(accentColor, highlightOpacity);
            }}
            linkWidth={0.5}
            onNodeHover={(node) => setHoverNode(node)}
            onNodeClick={(node) => {
              if (graphRef.current && is3DMode) {
                const distance = 400
                const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
                graphRef.current.cameraPosition(
                  { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                  node,
                  1000
                )
              } else if (graphRef.current && !is3DMode) {
                graphRef.current.centerAt(node.x, node.y, 1000)
                graphRef.current.zoom(8, 1000)
              }

              setTimeout(() => {
                if (node.snippetId) {
                  const s = snippets.find((sn) => sn.id === node.snippetId)
                  if (s) onNavigate(s)
                }
              }, 150)
            }}
            onNodeDrag={(node) => {
              if (!window._luminaIsDragging) {
                window._luminaIsDragging = true
                usePerformanceStore.getState().setDragging(true)
              }
            }}
            onNodeDragEnd={(node) => {
              window._luminaIsDragging = false
              usePerformanceStore.getState().setDragging(false)
              setHoverNode(null)
              node.fx = null
              node.fy = null
              node.fz = null
              if (graphRef.current) graphRef.current.d3ReheatSimulation()
            }}
            onRenderFramePre={() => {
              window._luminaFrameStart = performance.now()
            }}
            onRenderFramePost={() => {
              const now = performance.now()
              const frameTime = now - window._luminaFrameStart
              const fps = window._luminaLastFrame ? 1000 / (now - window._luminaLastFrame) : 60
              window._luminaLastFrame = now
              usePerformanceStore.getState().updateMetrics({ frameTime, fps, nodeCount: graphData?.nodes?.length || 0, linkCount: graphData?.links?.length || 0 })
            }}
            backgroundColor="rgba(0,0,0,0)"
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.4}
            showNavInfo={false}
            linkDirectionalParticles={0}
            onEngineStop={() => setIsEngineReady(true)}
          />
        ) : (
          <Graph2D
            key="2d-graph-embedded"
            ref={graphRef}
            dimensions={dimensions}
            graphData={graphData}
            paintNode={paintNode}
            hoverNode={hoverNode}
            setHoverNode={setHoverNode}
            defaultLineColor={defaultLineColor}
            onNavigate={onNavigate}
            setIsEngineReady={setIsEngineReady}
          />
        )}
      </div>
    )
  }

  // Modal mode - show full UI with header and footer
  const container = (
    <div
      ref={containerRef}
      className={`nexus-container${isMaximized ? ' maximized' : ''}`}
      onClick={(e) => e.stopPropagation()}
      data-graph-theme={graphTheme}
      style={{
        flexDirection: 'column',
        transform: isMaximized
          ? 'none'
          : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
        position: 'relative',
        willChange: 'transform'
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
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
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
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              handleToggleMaximize()
            }}
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
        <PerformancePanel onRecenter={handleRecenter} />
        <GraphSidebar
          isOpen={graphSidebarOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSpinning={isSpinning}
          graphTheme={graphTheme}
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
              nodeColor={nodeColorFn}
              nodeRelSize={4}
              nodeThreeObject={(node) => {
                const base = node.val ? Math.min(10, Math.max(3, Math.sqrt(node.val) * 2.8)) : 3
                const r = base * graphNodeSize + 3
                const mesh = new THREE.Mesh(sharedSphereGeometry, getMaterial(nodeColorFn(node)))
                mesh.scale.set(r, r, r)
                return mesh
              }}
              linkVisibility={(link) => {
                if (!window._luminaIsDragging) return true
                return link.source === hoverNode || link.target === hoverNode
              }}
              linkColor={(link) => {
                const isHoverConnected = hoverNode && (link.source === hoverNode || link.target === hoverNode);
                const isSelectedConnected = selectedSnippet && ((link.source.snippetId === selectedSnippet.id) || (link.target.snippetId === selectedSnippet.id));
                
                if (!hoverNode && !selectedSnippet) return defaultLineColor;
                
                const isActive = hoverNode ? isHoverConnected : isSelectedConnected;
                
                const { settings } = useSettingsStore.getState();
                const dimOpacity = settings.graphLinkDimOpacity ?? 0.05;
                
                if (!isActive) {
                  return `rgba(150, 150, 150, ${dimOpacity})`;
                }
                
                const highlightOpacity = settings.graphLinkHighlightOpacity ?? 0.6;
                const accentColor = settings.graphNodeColor || '#40bafa';
                
                const hexToRgba = (hex, alpha) => {
                  if (hex.startsWith('#')) {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                  }
                  return hex;
                };

                return hexToRgba(accentColor, highlightOpacity);
              }}
              linkWidth={0.5}
              onNodeHover={(node) => setHoverNode(node)}
              onNodeClick={(node) => {
                if (graphRef.current) {
                  // Obsidian-style camera fly-to
                  const distance = 400
                  const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
                  graphRef.current.cameraPosition(
                    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                    node,
                    1000
                  )
                }

                // Wait 150ms before navigating so they see the start of the fly-to, 
                // but don't hold them up too long
                setTimeout(() => {
                  if (node.snippetId) {
                    const s = snippets.find((sn) => sn.id === node.snippetId)
                    if (s) onNavigate(s)
                  }
                }, 150)
              }}
              onNodeDrag={(node) => {
                window._luminaIsDragging = true
                usePerformanceStore.getState().setDragging(true)
              }}
              onNodeDragEnd={(node) => {
                window._luminaIsDragging = false
                usePerformanceStore.getState().setDragging(false)
                setHoverNode(null)
                node.fx = null
                node.fy = null
                node.fz = null
                if (graphRef.current) graphRef.current.d3ReheatSimulation()
              }}
              backgroundColor="rgba(0,0,0,0)"
              d3AlphaDecay={0.05}
              d3VelocityDecay={0.4}
              showNavInfo={false}

            />
          ) : (
            <Graph2D
              key="2d-graph-modal"
              ref={graphRef}
              dimensions={{ width: dimensions.width, height: dimensions.height - 32 }}
              graphData={graphData}
              paintNode={paintNode}
              hoverNode={hoverNode}
              setHoverNode={setHoverNode}
              defaultLineColor={defaultLineColor}
              onNavigate={onNavigate}
              setIsEngineReady={setIsEngineReady}
            />
          )}
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
