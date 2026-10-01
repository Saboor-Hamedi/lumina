import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  X,
  Network,
  RefreshCw,
  Layers,
  ExternalLink,
  Download,
  FileCode
} from 'lucide-react'
import * as THREE from 'three'
import Graph3D from './3d/Graph3D'
import Graph2D from './2d/Graph2D'
import { useWorkspaceStore, GRAPH_TAB_ID } from '../../core/store/workspaceStore'
import { useAIStore } from '../AI/tools/lumina'
import { useSettingsStore } from '../../core/store/SettingStore'
import { usePerformanceStore } from './usePerformanceStore'
import PerformancePanel from './PerformancePanel'
import { buildGraphData, buildSemanticLinks } from '../../core/utils/graphBuilder'
import ToolTip from '../../components/atoms/ToolTip'
import GraphSidebar from './GraphSidebar'
import '../canvas/css/canvas-drawer.css'
import '../canvas/css/canvas-toolbar.css'
import '../canvas/css/canvas-studio.css'
import './css/Graph.css'
import { getNodeColor, drawNode } from './graphs'
import {
  exportGraphAsPNG,
  exportGraphAsSVG,
  saveNodePosition,
  loadNodePositions,
  clearNodePositions
} from './utils/graphExport'

const sharedSphereGeometry = new THREE.SphereGeometry(1, 8, 8)
const materialCache: Record<string, THREE.MeshBasicMaterial> = {}
const getMaterial = (color: string) => {
  if (!materialCache[color]) {
    materialCache[color] = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    })
  }
  return materialCache[color]
}

export const getActiveThemeColors = () => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    const rgb = getComputedStyle(root).getPropertyValue('--text-accent-rgb').trim()
    const hex = getComputedStyle(root).getPropertyValue('--text-accent').trim()
    if (rgb) return { rgb, hex: hex || `rgb(${rgb})` }
    if (hex && hex.startsWith('#')) {
      const clean = hex.replace('#', '')
      const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16)
      if (!isNaN(bigint)) {
        const r = (bigint >> 16) & 255
        const g = (bigint >> 8) & 255
        const b = bigint & 255
        return { rgb: `${r}, ${g}, ${b}`, hex }
      }
    }
  }
  return { rgb: '167, 139, 250', hex: '#a78bfa' }
}

export interface GraphProps {
  isOpen?: boolean
  onClose?: () => void
  onNavigate?: (snippet: any) => void
  embedded?: boolean
}

const Graph: React.FC<GraphProps> = React.memo(({ isOpen = true, onClose, onNavigate, embedded = false }) => {
  const [themeColors, setThemeColors] = useState(() => getActiveThemeColors())

  useEffect(() => {
    const updateTheme = () => {
      setThemeColors(getActiveThemeColors())
    }
    updateTheme()

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-theme' || m.attributeName === 'style') {
          updateTheme()
          break
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    window.addEventListener('theme-changed', updateTheme)
    window.addEventListener('storage', updateTheme)

    return () => {
      observer.disconnect()
      window.removeEventListener('theme-changed', updateTheme)
      window.removeEventListener('storage', updateTheme)
    }
  }, [])

  const snippets = useWorkspaceStore((s) => s.notes) || []
  const graphSnippets = useMemo(() => {
    return (snippets || []).filter((s) => s.type !== 'image' && s.language !== 'image')
  }, [snippets])
  const selectedSnippet = useWorkspaceStore((s) => s.selectedNote)
  const embeddingsCache = useAIStore((s) => s.embeddingsCache)

  const handleRecenter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (graphRef.current && graphRef.current.zoomToFit) {
      graphRef.current.zoomToFit(800, 100)
    }
  }

  const graphHideTags = useSettingsStore((s) => s.settings.graphHideTags)
  const graphHideGhosts = useSettingsStore((s) => s.settings.graphHideGhosts)
  const graphHideOrphans = useSettingsStore((s) => s.settings.graphHideOrphans)

  const [localSidebarOpen, setLocalSidebarOpen] = useState(true)
  const storeSidebarOpen = useSettingsStore((s) => s.settings.graphSidebarOpen)
  const isSidebarOpen = storeSidebarOpen !== undefined ? storeSidebarOpen : localSidebarOpen

  const is3DMode = useSettingsStore((s) => s.settings.graph3DMode ?? false)
  const graphNodeSize = useSettingsStore((s) => s.settings.graphNodeSize || 1.5)

  const [hoverNode, setHoverNode] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isEngineReady, setIsEngineReady] = useState(false)
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? (embedded ? window.innerHeight : Math.max(200, window.innerHeight * 0.94 - 34)) : 600
  })

  const handleToggleSidebar = useCallback(() => {
    const next = !isSidebarOpen
    setLocalSidebarOpen(next)
    const { updateSetting } = useSettingsStore.getState()
    if (typeof updateSetting === 'function') {
      updateSetting('graphSidebarOpen', next)
    }
  }, [isSidebarOpen])

  const handleToggle3D = useCallback(() => {
    const { settings, updateSetting } = useSettingsStore.getState()
    const next = !settings.graph3DMode
    if (typeof updateSetting === 'function') {
      updateSetting('graph3DMode', next)
    }
  }, [])

  const handleClose = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_graph_display_mode', 'modal')
    }
    onClose?.()
  }, [onClose])

  const handleOpenAsTab = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_graph_display_mode', 'tab')
    }
    onClose?.()
    useWorkspaceStore.getState().openGraphTab()
  }, [onClose])

  const handleSwitchToModal = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_graph_display_mode', 'modal')
    }
    useWorkspaceStore.getState().closeTab(GRAPH_TAB_ID)
    window.dispatchEvent(new CustomEvent('open-graph-modal'))
  }, [])

  useEffect(() => {
    if (embedded || !isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [embedded, isOpen, handleClose])

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

  const [rawGraphData, setRawGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] })
  const [isBuildingGraph, setIsBuildingGraph] = useState(true)

  useEffect(() => {
    setIsBuildingGraph(true)

    const timer = setTimeout(() => {
      const rawData = buildGraphData(graphSnippets)
      const semantic = buildSemanticLinks(rawData.nodes, rawData.links, graphSnippets, embeddingsCache)
      let nodes = rawData.nodes
      let links = [...rawData.links, ...semantic]

      const now = Date.now()
      const maxAge = 30 * 24 * 60 * 60 * 1000

      const linkCounts: Record<string, number> = {}
      links.forEach((l) => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        linkCounts[src] = (linkCounts[src] || 0) + 1
        linkCounts[tgt] = (linkCounts[tgt] || 0) + 1
      })

      const savedPositions = loadNodePositions()

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

          const savedPos = savedPositions[n.id]

          const oldN = prevNodes.get(n.id)
          if (oldN) {
            oldN.ageFactor = n.ageFactor
            oldN.val = n.val
            oldN.linkCount = n.linkCount
            oldN.primaryTag = n.primaryTag
            if (savedPos) {
              oldN.fx = savedPos.x
              oldN.fy = savedPos.y
              oldN.x = savedPos.x
              oldN.y = savedPos.y
            }
            return oldN
          }

          if (savedPos) {
            n.fx = savedPos.x
            n.fy = savedPos.y
            n.x = savedPos.x
            n.y = savedPos.y
          } else {
            const spread = nodes.length <= 10 ? 200 : 1000
            n.x = (Math.random() - 0.5) * spread
            n.y = (Math.random() - 0.5) * spread
            n.z = (Math.random() - 0.5) * spread
          }
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
    }, embedded ? 0 : 20)

    return () => clearTimeout(timer)
  }, [snippets, selectedSnippet, embeddingsCache, embedded])

  const graphData = useMemo(() => {
    let { nodes, links } = rawGraphData
    if (graphHideTags) {
      nodes = nodes.filter((n) => n.group !== 'tag')
    }
    if (graphHideGhosts) {
      nodes = nodes.filter((n) => n.group !== 'ghost')
    }

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

  useEffect(() => {
    if (graphRef.current && !isBuildingGraph && graphData.nodes.length > 0) {
      const isFirstRender = !hasInitialRender.current
      const didSnippetChange = !embedded && prevSelectedId.current !== selectedSnippet?.id

      if (isFirstRender || didSnippetChange) {
        hasInitialRender.current = true
        prevSelectedId.current = selectedSnippet?.id

        setTimeout(() => {
          if (!graphRef.current) return
          if (selectedSnippet) {
            const node = graphData.nodes.find((n) => n.snippetId === selectedSnippet.id)
            if (node) {
              if (is3DMode) {
                const distance = 200
                const distRatio =
                  1 + distance / Math.max(1, Math.hypot(node.x || 0, node.y || 0, node.z || 0))

                graphRef.current.cameraPosition(
                  {
                    x: (node.x || 0) * distRatio,
                    y: (node.y || 0) * distRatio,
                    z: (node.z || 0) * distRatio
                  },
                  { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
                  400
                )
              } else {
                if (graphRef.current.centerAt) {
                  graphRef.current.centerAt(node.x || 0, node.y || 0, 400)
                  graphRef.current.zoom(1.0, 400)
                }
              }
            }
          } else if (isFirstRender) {
            if (is3DMode && graphRef.current.cameraPosition) {
              graphRef.current.zoomToFit(400, 50)
            } else if (!is3DMode && graphRef.current.zoomToFit) {
              graphRef.current.zoomToFit(400, 50)
              setTimeout(() => {
                if (graphRef.current && graphRef.current.zoom() > 1.5) {
                  graphRef.current.zoom(1.5, 400)
                }
              }, 450)
            }
          }
        }, 100)
      }
    }
  }, [selectedSnippet, isBuildingGraph, graphData.nodes, is3DMode])

  useEffect(() => {
    setIsEngineReady(false)
    const safetyTimer = setTimeout(() => setIsEngineReady(true), 1500)
    return () => clearTimeout(safetyTimer)
  }, [is3DMode])

  const defaultLineColor = useMemo(() => {
    return `rgba(${themeColors.rgb}, ${is3DMode ? 0.35 : 0.25})`
  }, [themeColors.rgb, is3DMode])

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

  const nodeColorFn = useCallback(
    (node: any) => {
      return getNodeColor(node, selectedSnippet?.id, themeColors.hex)
    },
    [selectedSnippet, themeColors.hex]
  )

  const normalizedSearchQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery])

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isActive = selectedSnippet && node.snippetId === selectedSnippet.id
      const isHovered = hoverNode === node
      const baseR = node.val ? Math.min(10, Math.max(3, Math.sqrt(node.val) * 2.8)) : 3
      const r = baseR * graphNodeSize + 3

      const label = (node.id || '').replace(/[*"']/g, '')
      const isSearchMatch =
        normalizedSearchQuery !== '' && label.toLowerCase().includes(normalizedSearchQuery)
      const isSearchDimmed = normalizedSearchQuery !== '' && !isSearchMatch

      const isNeighborDimmed = hoverNode && hoverNode !== node && !hoverNeighbors.has(node.id)

      const showText =
        useSettingsStore.getState().settings.graphShowTexts !== false &&
        (isActive || isHovered || isSearchMatch || globalScale >= 1.2)

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
      nodeColorFn
    ]
  )

  // Handlers for exporting and resetting layout
  const handleExportPNG = useCallback(() => {
    exportGraphAsPNG(containerRef.current, 'lumina-knowledge-graph.png')
  }, [])

  const handleExportSVG = useCallback(() => {
    exportGraphAsSVG(graphData, dimensions.width, dimensions.height, themeColors, 'lumina-knowledge-graph.svg')
  }, [graphData, dimensions, themeColors])

  const handleResetLayout = useCallback(() => {
    clearNodePositions()
    window.dispatchEvent(new CustomEvent('reset-graph-positions'))
    if (graphRef.current?.zoomToFit) {
      graphRef.current.zoomToFit(600, 50)
    }
  }, [])

  const centralNodeId = useMemo(() => {
    if (selectedSnippet) {
      const sNode = graphData.nodes.find((n) => n.snippetId === selectedSnippet.id)
      if (sNode) return sNode.id
    }
    let maxDegree = -1
    let maxId: any = null
    for (const n of graphData.nodes) {
      const deg = n.linkCount || n.val || 0
      if (deg > maxDegree) {
        maxDegree = deg
        maxId = n.id
      }
    }
    return maxId
  }, [selectedSnippet, graphData.nodes])

  const isCentralNode = useCallback(
    (node: any) => {
      if (!node) return false
      if (centralNodeId && node.id === centralNodeId) return true
      if (selectedSnippet && node.snippetId === selectedSnippet.id) return true
      return Boolean(node.isCenter)
    },
    [centralNodeId, selectedSnippet]
  )

  const handleNodePositionChanged = useCallback((node: any) => {
    if (node?.id && !isCentralNode(node) && node.x !== undefined && node.y !== undefined) {
      saveNodePosition(node.id, node.x, node.y)
    }
  }, [isCentralNode])

  if (!isOpen && !embedded) return null

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
        <PerformancePanel onRecenter={handleRecenter} is3DMode={is3DMode} />
        <div
          className="nexus-body"
          style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
        >
          {is3DMode ? (
            <Graph3D
              key="3d-graph-embedded"
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              nodeColor={nodeColorFn}
              nodeRelSize={4}
              nodeThreeObject={(node: any) => {
                const base = node.val ? Math.min(10, Math.max(3, Math.sqrt(node.val) * 2.8)) : 3
                const r = base * graphNodeSize + 3
                const mesh = new THREE.Mesh(sharedSphereGeometry, getMaterial(nodeColorFn(node)))
                mesh.scale.set(r, r, r)
                return mesh
              }}
              linkVisibility={(link: any) => {
                if (!(window as any)._luminaIsDragging) return true
                return link.source === hoverNode || link.target === hoverNode
              }}
              linkColor={(link: any) => {
                const isHoverConnected =
                  hoverNode && (link.source === hoverNode || link.target === hoverNode)
                const isSelectedConnected =
                  selectedSnippet &&
                  (link.source.snippetId === selectedSnippet.id ||
                    link.target.snippetId === selectedSnippet.id)
                const isActive = hoverNode ? isHoverConnected : isSelectedConnected

                const { settings } = useSettingsStore.getState()
                if (isActive) {
                  const highlightOpacity = settings.graphLinkHighlightOpacity ?? 0.85
                  return `rgba(${themeColors.rgb}, ${highlightOpacity})`
                }

                if (hoverNode || selectedSnippet) {
                  const dimOpacity = settings.graphLinkDimOpacity ?? 0.04
                  return `rgba(${themeColors.rgb}, ${dimOpacity})`
                }

                return defaultLineColor
              }}
              linkWidth={0.5}
              onNodeHover={(node: any) => setHoverNode(node)}
              onNodeClick={(node: any) => {
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
                    if (s) onNavigate?.(s)
                  }
                }, 150)
              }}
              onNodeDrag={() => {
                if (!(window as any)._luminaIsDragging) {
                  ;(window as any)._luminaIsDragging = true
                  usePerformanceStore.getState().setDragging(true)
                }
              }}
              onNodeDragEnd={(node: any) => {
                ;(window as any)._luminaIsDragging = false
                usePerformanceStore.getState().setDragging(false)
                setHoverNode(null)
                const isCentral = isCentralNode(node)
                if (isCentral) {
                  node.fx = null
                  node.fy = null
                  node.fz = null
                } else {
                  node.fx = node.x
                  node.fy = node.y
                  node.fz = node.z
                  handleNodePositionChanged(node)
                }
                if (graphRef.current) graphRef.current.d3ReheatSimulation()
              }}
              onRenderFramePre={() => {
                ;(window as any)._luminaFrameStart = performance.now()
              }}
              onRenderFramePost={() => {
                const now = performance.now()
                const frameTime = now - ((window as any)._luminaFrameStart || now)
                const fps = (window as any)._luminaLastFrame
                  ? 1000 / (now - (window as any)._luminaLastFrame)
                  : 60
                ;(window as any)._luminaLastFrame = now
                usePerformanceStore.getState().updateMetrics({
                  frameTime,
                  fps,
                  nodeCount: graphData?.nodes?.length || 0,
                  linkCount: graphData?.links?.length || 0
                })
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
              onNodePositionChanged={handleNodePositionChanged}
              isCentralNode={isCentralNode}
            />
          )}
        </div>

        <GraphSidebar
          isOpen={isSidebarOpen}
          onToggleExpand={handleToggleSidebar}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          nodeCount={rawGraphData.nodes.length}
          onRecenter={handleRecenter}
          is3DMode={is3DMode}
          onToggle3D={handleToggle3D}
          onSwitchToModal={handleSwitchToModal}
          onExportPNG={handleExportPNG}
          onExportSVG={handleExportSVG}
          onResetLayout={handleResetLayout}
        />
      </div>
    )
  }

  return (
    <div className="canvas-drawer-overlay graph-drawer-overlay" onClick={handleClose}>
      <div
        ref={containerRef}
        className="canvas-drawer-container graph-drawer-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="canvas-drawer-header" data-testid="modal-header">
          <div className="canvas-drawer-title-group">
            <div className="canvas-drawer-selector-btn">
              <Network size={14} className="canvas-drawer-icon" />
              <span className="canvas-drawer-title">Knowledge Graph</span>
              <span className="graph-drawer-badge">{rawGraphData.nodes.length} nodes</span>
            </div>
          </div>

          <div className="canvas-drawer-header-actions">
            <ToolTip
              text={is3DMode ? 'Switch to 2D Nexus' : 'Switch to 3D Cosmos'}
              position="bottom"
            >
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleToggle3D}
              >
                <Layers size={13} />
                <span>{is3DMode ? '3D' : '2D'}</span>
              </button>
            </ToolTip>

            <ToolTip text="Export PNG Image" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleExportPNG}
              >
                <Download size={14} />
              </button>
            </ToolTip>

            <ToolTip text="Export SVG Vector" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleExportSVG}
              >
                <FileCode size={14} />
              </button>
            </ToolTip>

            <ToolTip text="Recenter Graph" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleRecenter}
              >
                <RefreshCw size={14} />
              </button>
            </ToolTip>

            <ToolTip text="Open in Editor Tab" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn"
                onClick={handleOpenAsTab}
              >
                <ExternalLink size={14} />
              </button>
            </ToolTip>

            <ToolTip text="Close Drawer (Esc)" position="bottom">
              <button
                type="button"
                className="canvas-drawer-action-btn close-btn"
                onClick={handleClose}
                aria-label="Close"
              >
                <span className="sr-only" style={{ display: 'none' }}>
                  Close
                </span>
                <X size={14} />
              </button>
            </ToolTip>
          </div>
        </div>

        <div
          className="canvas-drawer-body"
          style={{
            position: 'relative',
            width: '100%',
            height: 'calc(100% - 34px)',
            overflow: 'hidden'
          }}
        >
          <PerformancePanel onRecenter={handleRecenter} is3DMode={is3DMode} />

          <div
            className="nexus-body"
            style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
          >
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
                nodeThreeObject={(node: any) => {
                  const base = node.val ? Math.min(10, Math.max(3, Math.sqrt(node.val) * 2.8)) : 3
                  const r = base * graphNodeSize + 3
                  const mesh = new THREE.Mesh(sharedSphereGeometry, getMaterial(nodeColorFn(node)))
                  mesh.scale.set(r, r, r)
                  return mesh
                }}
                linkVisibility={(link: any) => {
                  if (!(window as any)._luminaIsDragging) return true
                  return link.source === hoverNode || link.target === hoverNode
                }}
                linkColor={(link: any) => {
                  const isHoverConnected =
                    hoverNode && (link.source === hoverNode || link.target === hoverNode)
                  const isSelectedConnected =
                    selectedSnippet &&
                    (link.source.snippetId === selectedSnippet.id ||
                      link.target.snippetId === selectedSnippet.id)
                  const isActive = hoverNode ? isHoverConnected : isSelectedConnected

                  const { settings } = useSettingsStore.getState()
                  if (isActive) {
                    const highlightOpacity = settings.graphLinkHighlightOpacity ?? 0.85
                    return `rgba(${themeColors.rgb}, ${highlightOpacity})`
                  }

                  if (hoverNode || selectedSnippet) {
                    const dimOpacity = settings.graphLinkDimOpacity ?? 0.04
                    return `rgba(${themeColors.rgb}, ${dimOpacity})`
                  }

                  return defaultLineColor
                }}
                linkWidth={0.5}
                onNodeHover={(node: any) => setHoverNode(node)}
                onNodeClick={(node: any) => {
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
                      if (s) onNavigate?.(s)
                    }
                  }, 150)
                }}
                onNodeDrag={() => {
                  ;(window as any)._luminaIsDragging = true
                  usePerformanceStore.getState().setDragging(true)
                }}
                onNodeDragEnd={(node: any) => {
                  ;(window as any)._luminaIsDragging = false
                  usePerformanceStore.getState().setDragging(false)
                  setHoverNode(null)
                  const isCentral = isCentralNode(node)
                  if (isCentral) {
                    node.fx = null
                    node.fy = null
                    node.fz = null
                  } else {
                    node.fx = node.x
                    node.fy = node.y
                    node.fz = node.z
                    handleNodePositionChanged(node)
                  }
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
                dimensions={dimensions}
                graphData={graphData}
                paintNode={paintNode}
                hoverNode={hoverNode}
                setHoverNode={setHoverNode}
                defaultLineColor={defaultLineColor}
                onNavigate={onNavigate}
                setIsEngineReady={setIsEngineReady}
                onNodePositionChanged={handleNodePositionChanged}
                isCentralNode={isCentralNode}
              />
            )}
          </div>

          <GraphSidebar
            isOpen={isSidebarOpen}
            onToggleExpand={handleToggleSidebar}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            nodeCount={rawGraphData.nodes.length}
            onRecenter={handleRecenter}
            is3DMode={is3DMode}
            onToggle3D={handleToggle3D}
            onExportPNG={handleExportPNG}
            onExportSVG={handleExportSVG}
            onResetLayout={handleResetLayout}
          />
        </div>
      </div>
    </div>
  )
})

Graph.displayName = 'Graph'

export default Graph
