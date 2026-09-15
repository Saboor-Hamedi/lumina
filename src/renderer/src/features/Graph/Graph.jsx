import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  X,
  Network,
  RefreshCw,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink
} from 'lucide-react'
import * as THREE from 'three'
import Graph3D from './Graph3D'
import Graph2D from './Graph2D'
import { useVaultStore, GRAPH_TAB_ID } from '../../core/store/workspaceStore'
import { useAIStore } from '../AI/tools/lumina'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { usePerformanceStore } from './usePerformanceStore'
import PerformancePanel from './PerformancePanel'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import { forceRadial, forceManyBody, forceCollide, forceCenter, forceX, forceY } from 'd3-force'
import ToolTip from '../../components/atoms/ToolTip'
import GraphSidebar from './GraphSidebar'
import GraphMiniMap from './GraphMiniMap'
import '../canvas/css/canvas-drawer.css'
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

  const handleRecenter = (e) => {
    if (e) e.stopPropagation()
    if (graphRef.current && graphRef.current.zoomToFit) {
      graphRef.current.zoomToFit(800, 100)
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

  const isSpinning = useSettingsStore((s) => s.settings.graphAnimate ?? false)
  const graphRef = useRef()
  const containerRef = useRef()
  const [isEngineReady, setIsEngineReady] = useState(false)
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? (embedded ? window.innerHeight : Math.max(200, window.innerHeight * 0.94 - 34)) : 600
  })

  const handleToggleSidebar = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ graphSidebarOpen: !(settings.graphSidebarOpen ?? true) })
  }, [])

  const handleToggle3D = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ graph3DMode: !settings.graph3DMode })
  }, [])

  const handleOpenAsTab = useCallback(() => {
    onClose?.()
    useVaultStore.getState().setActiveTabId(GRAPH_TAB_ID)
  }, [onClose])

  useEffect(() => {
    if (embedded || !isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [embedded, isOpen, onClose])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({
            width: rect.width,
            height: embedded ? rect.height : Math.max(200, rect.height - 34)
          })
          return
        }
      }
      setDimensions({
        width: typeof window !== 'undefined' ? window.innerWidth : 800,
        height: typeof window !== 'undefined' ? (embedded ? window.innerHeight : Math.max(200, window.innerHeight * 0.94 - 34)) : 600
      })
    }
    updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }
    window.addEventListener('resize', updateDimensions)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateDimensions)
    }
  }, [embedded])

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

  // Precompute line colors
  const defaultLineColor = useMemo(() => {
    if (is3DMode) {
      return 'rgba(150, 150, 150, 0.15)'
    }
    return 'rgba(150, 150, 150, 0.08)'
  }, [is3DMode])

  const dimmedLineColor = useMemo(() => {
    if (is3DMode) {
      return 'rgba(150, 150, 150, 0.06)'
    }
    return 'rgba(150, 150, 150, 0.02)'
  }, [is3DMode])

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
  if (embedded) {
    return (
      <div
        ref={containerRef}
        className="nexus-embedded-graph"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div className="graph-embedded-controls">
          <div className="graph-embedded-controls-left">
            <ToolTip text="Recenter graph view" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleRecenter}
              >
                <RefreshCw size={13} />
                <span>Recenter</span>
              </button>
            </ToolTip>
          </div>
          <div className="graph-embedded-controls-right">
            <ToolTip text={is3DMode ? 'Switch to 2D Nexus' : 'Switch to 3D Cosmos'} position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleToggle3D}
              >
                <Layers size={13} />
                <span>{is3DMode ? '3D' : '2D'}</span>
              </button>
            </ToolTip>
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

  // Modal mode - Slide-up Drawer matching CanvasDrawerModal exactly
  return (
    <div className="canvas-drawer-overlay graph-drawer-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className="canvas-drawer-container graph-drawer-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="canvas-drawer-header">
          <div className="canvas-drawer-title-group">
            <ToolTip text={graphSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleToggleSidebar}
                aria-label={graphSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {graphSidebarOpen ? (
                  <PanelLeftClose size={14} />
                ) : (
                  <PanelLeftOpen size={14} />
                )}
              </button>
            </ToolTip>

            <div className="canvas-drawer-selector-btn">
              <Network size={14} className="canvas-drawer-icon" />
              <span className="canvas-drawer-title">Knowledge Graph</span>
              <span className="graph-drawer-badge">{rawGraphData.nodes.length} nodes</span>
            </div>
          </div>

          <div className="canvas-drawer-header-actions">
            <ToolTip text={is3DMode ? 'Switch to 2D Nexus' : 'Switch to 3D Cosmos'} position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleToggle3D}
              >
                <Layers size={13} />
                <span>{is3DMode ? '3D' : '2D'}</span>
              </button>
            </ToolTip>

            <ToolTip text="Recenter Graph" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleRecenter}
              >
                <RefreshCw size={13} />
                <span>Recenter</span>
              </button>
            </ToolTip>

            <ToolTip text="Open in Editor Tab" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleOpenAsTab}
              >
                <ExternalLink size={13} />
                <span>Open in Tab</span>
              </button>
            </ToolTip>

            <ToolTip text="Close Drawer (Esc)" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </ToolTip>
          </div>
        </div>

        <div className="canvas-drawer-body" style={{ display: 'flex', position: 'relative', overflow: 'hidden' }}>
          <PerformancePanel onRecenter={handleRecenter} />
          <GraphSidebar
            isOpen={graphSidebarOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isSpinning={isSpinning}
          />

          <div className="nexus-body" style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden' }}>
            <div className={`graph-initializer ${isEngineReady ? 'ready' : ''}`}>
              <div className="pulse-ring"></div>
              <div className="graph-initializer-text">Initializing Physics</div>
            </div>

            {is3DMode ? (
              <Graph3D
                key="3d-graph-modal"
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
                  if (graphRef.current) {
                    const distance = 400
                    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
                    graphRef.current.cameraPosition(
                      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                      node,
                      1000
                    )
                  }

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
                dimensions={{ width: dimensions.width, height: dimensions.height }}
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
    </div>
  )
})

Graph.displayName = 'Graph'

export default Graph
