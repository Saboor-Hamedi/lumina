import React, { forwardRef, useRef, useEffect, useImperativeHandle } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { usePerformanceStore } from '../usePerformanceStore'

export interface Graph2DInnerProps {
  dimensions: { width: number; height: number }
  graphData: { nodes: any[]; links: any[] }
  paintNode: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void
  hoverNode: any
  setHoverNode: (node: any) => void
  defaultLineColor: string
  onNavigate?: (snippet: any) => void
  setIsEngineReady: (ready: boolean) => void
  isCentralNode?: (node: any) => boolean
  onWorkerDragStart?: () => void
  onWorkerDrag?: (node: any) => void
  onWorkerDragEnd?: (node: any, isCentral?: boolean) => void
  onNodePositionChanged?: (node: any) => void
}

const Graph2DInner = forwardRef<any, Graph2DInnerProps>(
  (
    {
      dimensions,
      graphData,
      paintNode,
      hoverNode,
      setHoverNode,
      defaultLineColor,
      onNavigate,
      setIsEngineReady,
      isCentralNode,
      onWorkerDragStart,
      onWorkerDrag,
      onWorkerDragEnd
    },
    ref
  ) => {
    const snippets = useWorkspaceStore((s) => s.notes) || []
    const selectedSnippet = useWorkspaceStore((s) => s.selectedNote)

    return (
      <ForceGraph2D
        ref={ref}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        onNodeHover={(node: any) => {
          if ((window as any)._luminaIsDragging) return
          setHoverNode(node)
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const sizeMult = useSettingsStore.getState().settings.graphNodeSize || 1.5
          const baseR = node.val ? Math.min(20, Math.max(4, Math.sqrt(node.val) * 3)) : 4
          const r = baseR * sizeMult + 5
          const hitRadius = (window as any)._luminaIsDragging ? Math.max(r + 20, 25) : r

          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, hitRadius, 0, 2 * Math.PI, false)
          ctx.fill()
        }}
        linkVisibility={(link: any) => {
          if ((window as any)._luminaIsDragging || (window as any)._luminaIsPanning) {
            if (hoverNode) {
              return link.source === hoverNode || link.target === hoverNode
            }
            if ((window as any)._luminaIsPanning) {
              const weight = (link.source.val || 1) + (link.target.val || 1)
              return weight > 3
            }
          }
          const isSelected =
            selectedSnippet &&
            (link.source.snippetId === selectedSnippet.id || link.target.snippetId === selectedSnippet.id)
          const isHovered =
            hoverNode && (link.source.id === hoverNode?.id || link.target.id === hoverNode?.id)
          if (isSelected || isHovered) return true

          const isGhost = link.source.group === 'ghost' || link.target.group === 'ghost'

          if (isGhost) {
            const scale = (window as any)._luminaGlobalScale || 1
            const visibilitySlider =
              useSettingsStore.getState().settings.graphGhostLinkOpacity ?? 0.3
            if (visibilitySlider <= 0) return false
            if (scale < 1.2 && visibilitySlider < 0.5) return false
          } else {
            if ((window as any)._luminaGlobalScale && (window as any)._luminaGlobalScale < 0.8) {
              const threshold = 1.5 / (window as any)._luminaGlobalScale
              const weight = (link.source.val || 1) + (link.target.val || 1)
              if (weight < threshold) return false
            }
          }

          return true
        }}
        linkColor={(link: any) => {
          const isHoverConnected =
            hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id)
          const isSelectedConnected =
            selectedSnippet &&
            (link.source.snippetId === selectedSnippet.id ||
              link.target.snippetId === selectedSnippet.id)
          const isActive = isHoverConnected || isSelectedConnected

          const settings = useSettingsStore.getState().settings
          const isGhost = link.source.group === 'ghost' || link.target.group === 'ghost'

          let rgb = '167, 139, 250'
          if (typeof document !== 'undefined') {
            const rootRgb = getComputedStyle(document.documentElement)
              .getPropertyValue('--text-accent-rgb')
              .trim()
            if (rootRgb) rgb = rootRgb
          }

          if (isActive) {
            const highlightOpacity = settings.graphLinkHighlightOpacity ?? 0.85
            return `rgba(${rgb}, ${highlightOpacity})`
          }

          if (isGhost) {
            const ghostOpacity = settings.graphGhostLinkOpacity ?? 0.3
            return `rgba(${rgb}, ${ghostOpacity * 0.35})`
          }

          if (hoverNode || selectedSnippet) {
            const dimOpacity = settings.graphLinkDimOpacity ?? 0.04
            return `rgba(${rgb}, ${dimOpacity})`
          }

          return defaultLineColor || `rgba(${rgb}, 0.25)`
        }}
        linkWidth={(link: any) => {
          const isHoverConnected =
            hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id)
          const isSelectedConnected =
            selectedSnippet &&
            (link.source.snippetId === selectedSnippet.id ||
              link.target.snippetId === selectedSnippet.id)
          const isActive = isHoverConnected || isSelectedConnected

          if (isActive) return 0.4

          const isGhost = link.source.group === 'ghost' || link.target.group === 'ghost'
          return isGhost ? 0.1 : 0.2
        }}
        linkDirectionalParticles={0}
        onNodeClick={(node: any) => {
          if (node.snippetId) {
            const s = snippets.find((sn) => sn.id === node.snippetId)
            if (s && onNavigate) onNavigate(s)
          }
        }}
        onRenderFramePre={(_ctx: CanvasRenderingContext2D, globalScale: number) => {
          const TARGET_FPS = 60
          const FRAME_MIN_TIME = 1000 / TARGET_FPS
          const now = performance.now()

          if (!(window as any)._luminaLastVsyncFrame) (window as any)._luminaLastVsyncFrame = now
          const delta = now - (window as any)._luminaLastVsyncFrame

          ;(window as any)._luminaLastVsyncFrame = now - (delta % FRAME_MIN_TIME)
          ;(window as any)._luminaGlobalScale = globalScale
          ;(window as any)._luminaFrameStart = now
          ;(window as any)._luminaNodesRenderTime = 0
        }}
        onRenderFramePost={() => {
          const now = performance.now()
          const frameTime = now - ((window as any)._luminaFrameStart || now)
          const nodesTime = (window as any)._luminaNodesRenderTime || 0
          const linksTime = Math.max(0, frameTime - nodesTime)

          const fps = (window as any)._luminaLastFrame
            ? 1000 / (now - (window as any)._luminaLastFrame)
            : 60
          ;(window as any)._luminaLastFrame = now

          if (
            !(window as any)._luminaLastHudUpdate ||
            now - (window as any)._luminaLastHudUpdate > 500
          ) {
            ;(window as any)._luminaLastHudUpdate = now
            usePerformanceStore.getState().updateMetrics({
              frameTime,
              fps,
              nodesRenderTime: nodesTime,
              linksRenderTime: linksTime,
              nodeCount: graphData?.nodes?.length || 0,
              linkCount: graphData?.links?.length || 0
            })
          }
        }}
        backgroundColor="transparent"
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.4}
        onNodeDrag={(node: any) => {
          ;(window as any)._luminaIsDragging = true
          usePerformanceStore.getState().setDragging(true)
          if (onWorkerDragStart) onWorkerDragStart()
          if (onWorkerDrag) onWorkerDrag(node)
        }}
        onNodeDragEnd={(node: any) => {
          ;(window as any)._luminaIsDragging = false
          usePerformanceStore.getState().setDragging(false)
          if (setHoverNode) setHoverNode(null)
          const isCentral = isCentralNode ? isCentralNode(node) : false
          if (isCentral) {
            node.fx = null
            node.fy = null
          } else {
            node.fx = node.x
            node.fy = node.y
          }
          if (onWorkerDragEnd) onWorkerDragEnd(node, isCentral)
        }}
        onZoom={() => {
          ;(window as any)._luminaIsPanning = true
          if ((window as any)._luminaPanTimeout) clearTimeout((window as any)._luminaPanTimeout)
          ;(window as any)._luminaPanTimeout = setTimeout(() => {
            ;(window as any)._luminaIsPanning = false
          }, 150)
        }}
        onEngineStop={() => setIsEngineReady(true)}
      />
    )
  }
)

Graph2DInner.displayName = 'Graph2DInner'

export interface Graph2DProps {
  dimensions: { width: number; height: number }
  graphData: { nodes: any[]; links: any[] }
  paintNode: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void
  hoverNode: any
  setHoverNode: (node: any) => void
  defaultLineColor: string
  onNavigate?: (snippet: any) => void
  setIsEngineReady: (ready: boolean) => void
  onNodePositionChanged?: (node: any) => void
  [key: string]: any
}

const Graph2D = forwardRef<any, Graph2DProps>(function Graph2DWrapper(props, ref) {
  const fgRef = useRef<any>(null)

  useImperativeHandle(ref, () => fgRef.current, [])

  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge', null)
      fgRef.current.d3Force('link', null)
      fgRef.current.d3Force('center', null)
      fgRef.current.d3Force('collide', null)
    }

    workerRef.current = new Worker(new URL('../physics.worker.ts', import.meta.url), {
      type: 'module'
    })

    const repelForce = useSettingsStore.getState().settings.graphRepelForce ?? 0.3
    const linkForce = useSettingsStore.getState().settings.graphLinkForce ?? 0.05
    const centerForce = useSettingsStore.getState().settings.graphCenterForce ?? 0.05

    const safeNodes = props.graphData.nodes.map((n) => ({
      id: n.id,
      val: n.val,
      x: n.x,
      y: n.y,
      fx: n.fx,
      fy: n.fy
    }))
    const safeLinks = props.graphData.links.map((l) => ({
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target
    }))

    workerRef.current.postMessage({
      type: 'INIT',
      payload: {
        nodes: safeNodes,
        links: safeLinks,
        settings: { repelForce, linkForce, centerForce }
      }
    })

    workerRef.current.onmessage = (e) => {
      const { type, positions } = e.data
      if (type === 'TICK' && fgRef.current && props.graphData.nodes) {
        for (let i = 0; i < props.graphData.nodes.length; i++) {
          props.graphData.nodes[i].x = positions[i * 2]
          props.graphData.nodes[i].y = positions[i * 2 + 1]
        }
        fgRef.current.d3ReheatSimulation()

        workerRef.current?.postMessage(
          { type: 'RELEASE_BUFFER', payload: { buffer: positions.buffer } },
          [positions.buffer]
        )
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [props.graphData])

  useEffect(() => {
    return useSettingsStore.subscribe((state) => {
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'UPDATE_SETTINGS',
          payload: {
            settings: {
              repelForce: state.settings.graphRepelForce ?? 0.3,
              linkForce: state.settings.graphLinkForce ?? 0.05,
              centerForce: state.settings.graphCenterForce ?? 0.05
            }
          }
        })
      }
    })
  }, [])

  useEffect(() => {
    const handleReset = () => {
      workerRef.current?.postMessage({ type: 'RESET_POSITIONS' })
    }
    window.addEventListener('reset-graph-positions', handleReset)
    return () => window.removeEventListener('reset-graph-positions', handleReset)
  }, [])

  return (
    <Graph2DInner
      {...props}
      ref={fgRef}
      onWorkerDragStart={() => workerRef.current?.postMessage({ type: 'DRAG_START' })}
      onWorkerDrag={(node) =>
        workerRef.current?.postMessage({
          type: 'DRAG',
          payload: { id: node.id, x: node.x, y: node.y }
        })
      }
      onWorkerDragEnd={(node, isCentral) => {
        workerRef.current?.postMessage({
          type: 'DRAG_END',
          payload: { id: node.id, x: node.x, y: node.y, isCentral }
        })
        if (!isCentral) {
          props.onNodePositionChanged?.(node)
        }
      }}
    />
  )
})

export default React.memo(Graph2D)
