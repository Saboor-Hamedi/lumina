import React, { forwardRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import { usePerformanceStore } from './usePerformanceStore'

const Graph2D = forwardRef(
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
      onWorkerDragStart,
      onWorkerDrag,
      onWorkerDragEnd
    },
    ref
  ) => {
    const snippets = useVaultStore((s) => s.snippets)
    const selectedSnippet = useVaultStore((s) => s.selectedSnippet)

    return (
      <ForceGraph2D
        ref={ref}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        onNodeHover={(node) => {
          if (window._luminaIsDragging) return
          setHoverNode(node)
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const sizeMult = useSettingsStore.getState().settings.graphNodeSize || 1.5
          const baseR = node.val ? Math.min(20, Math.max(4, Math.sqrt(node.val) * 3)) : 4
          const r = baseR * sizeMult + 5
          const hitRadius = window._luminaIsDragging ? Math.max(r + 20, 25) : r
          
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, hitRadius, 0, 2 * Math.PI, false)
          ctx.fill()
        }}
        linkVisibility={(link) => {
          if (window._luminaIsDragging || window._luminaIsPanning) {
            if (hoverNode) {
              return link.source === hoverNode || link.target === hoverNode
            }
            if (window._luminaIsPanning) {
              const weight = (link.source.val || 1) + (link.target.val || 1)
              return weight > 3 
            }
          }
          const isSelected = selectedSnippet && (link.source.snippetId === selectedSnippet.id || link.target.snippetId === selectedSnippet.id)
          const isHovered = hoverNode && (link.source.id === hoverNode?.id || link.target.id === hoverNode?.id)
          if (isSelected || isHovered) return true

          const isGhost = link.source.group === 'ghost' || link.target.group === 'ghost'
          
          if (isGhost) {
            // LOD Culling for Unresolved Links
            const scale = window._luminaGlobalScale || 1
            const visibilitySlider = useSettingsStore.getState().settings.graphGhostLinkOpacity ?? 0.3
            
            // If the user completely hides them via slider, or zoom is too far out
            if (visibilitySlider <= 0) return false
            if (scale < 1.2 && visibilitySlider < 0.5) return false
          } else {
            // Standard Link LOD
            if (window._luminaGlobalScale && window._luminaGlobalScale < 0.8) {
              const threshold = 1.5 / window._luminaGlobalScale 
              const weight = (link.source.val || 1) + (link.target.val || 1)
              if (weight < threshold) return false 
            }
          }
          
          return true
        }}
        linkColor={(link) => {
          const isHoverConnected = hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id);
          const isSelectedConnected = selectedSnippet && ((link.source.snippetId === selectedSnippet.id) || (link.target.snippetId === selectedSnippet.id));
          const isActive = isHoverConnected || isSelectedConnected;
          
          const settings = useSettingsStore.getState().settings;
          const isGhost = link.source.group === 'ghost' || link.target.group === 'ghost';
          
          if (isActive) {
            const highlightOpacity = settings.graphLinkHighlightOpacity ?? 0.6;
            const accentColor = settings.graphNodeColor || '#40bafa';
            
            if (accentColor.startsWith('#')) {
              const r = parseInt(accentColor.slice(1, 3), 16);
              const g = parseInt(accentColor.slice(3, 5), 16);
              const b = parseInt(accentColor.slice(5, 7), 16);
              return `rgba(${r}, ${g}, ${b}, ${highlightOpacity})`;
            }
            return accentColor;
          }
          
          if (isGhost) {
            const ghostOpacity = settings.graphGhostLinkOpacity ?? 0.3;
            // Exactly batch all ghost links with a single static string
            return `rgba(255, 255, 255, ${ghostOpacity * 0.3})`;
          }
          
          const dimOpacity = settings.graphLinkDimOpacity ?? 0.05;
          return `rgba(150, 150, 150, ${dimOpacity})`;
        }}
        linkWidth={(link) => {
          const isHoverConnected = hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id);
          const isSelectedConnected = selectedSnippet && ((link.source.snippetId === selectedSnippet.id) || (link.target.snippetId === selectedSnippet.id));
          const isActive = isHoverConnected || isSelectedConnected;
          
          if (isActive) return 0.4;
          
          const isGhost = link.source.group === 'ghost' || link.target.group === 'ghost';
          return isGhost ? 0.1 : 0.2; // 1px equivalent at scale
        }}
        linkDirectionalParticles={0}
        onNodeClick={(node) => {
          if (node.snippetId) {
            const s = snippets.find((sn) => sn.id === node.snippetId)
            if (s && onNavigate) onNavigate(s)
          }
        }}
        onNodeDrag={(node) => {
          if (!window._luminaIsDragging) {
            window._luminaIsDragging = true
            usePerformanceStore.getState().setDragging(true)
            if (onWorkerDragStart) onWorkerDragStart()
          }
          if (onWorkerDrag) onWorkerDrag(node)
        }}
        onNodeDragEnd={(node) => {
          window._luminaIsDragging = false
          usePerformanceStore.getState().setDragging(false)
          if (setHoverNode) setHoverNode(null)
          node.fx = null
          node.fy = null
          if (onWorkerDragEnd) onWorkerDragEnd(node)
        }}
        onRenderFramePre={(ctx, globalScale) => {
          const TARGET_FPS = 60
          const FRAME_MIN_TIME = 1000 / TARGET_FPS
          const now = performance.now()
          
          if (!window._luminaLastVsyncFrame) window._luminaLastVsyncFrame = now
          const delta = now - window._luminaLastVsyncFrame
          
          // If the frame came too fast, we can't technically cancel the canvas draw in all versions of the lib,
          // but we can track the pacing and exit our heavy logic early if it was supported.
          
          window._luminaLastVsyncFrame = now - (delta % FRAME_MIN_TIME) // Adjust for drift
          
          window._luminaGlobalScale = globalScale
          window._luminaFrameStart = now
          window._luminaNodesRenderTime = 0
        }}
        onRenderFramePost={() => {
          const now = performance.now()
          const frameTime = now - window._luminaFrameStart
          const nodesTime = window._luminaNodesRenderTime
          const linksTime = Math.max(0, frameTime - nodesTime)
          
          const fps = window._luminaLastFrame ? 1000 / (now - window._luminaLastFrame) : 60
          window._luminaLastFrame = now
          
          // THROTTLE HUD UPDATES TO EVERY 500MS
          if (!window._luminaLastHudUpdate || now - window._luminaLastHudUpdate > 500) {
            window._luminaLastHudUpdate = now
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

        onZoom={(transform) => {
          window._luminaIsPanning = true
          if (window._luminaPanTimeout) clearTimeout(window._luminaPanTimeout)
          window._luminaPanTimeout = setTimeout(() => {
            window._luminaIsPanning = false
          }, 150)
        }}
        onEngineStop={() => setIsEngineReady(true)}
      />
    )
  }
)

export default React.memo(React.forwardRef(function Graph2DWrapper(props, ref) {
  const fgRef = React.useRef()
  
  React.useImperativeHandle(ref, () => fgRef.current, [])

  const workerRef = React.useRef(null)

  React.useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge', null)
      fgRef.current.d3Force('link', null)
      fgRef.current.d3Force('center', null)
      fgRef.current.d3Force('collide', null)
    }

    workerRef.current = new Worker(new URL('./physics.worker.js', import.meta.url), { type: 'module' })

    const repelForce = useSettingsStore.getState().settings.graphRepelForce ?? 0.3
    const linkForce = useSettingsStore.getState().settings.graphLinkForce ?? 0.05
    const centerForce = useSettingsStore.getState().settings.graphCenterForce ?? 0.05

    const safeNodes = props.graphData.nodes.map(n => ({ id: n.id, val: n.val, x: n.x, y: n.y, fx: n.fx, fy: n.fy }))
    const safeLinks = props.graphData.links.map(l => ({ 
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
        
        // Return ownership of the memory buffer to the worker instantly
        workerRef.current.postMessage({ type: 'RELEASE_BUFFER', payload: { buffer: positions.buffer } }, [positions.buffer])
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [props.graphData])

  React.useEffect(() => {
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

  return <Graph2D 
    {...props} 
    ref={fgRef} 
    onWorkerDragStart={() => workerRef.current?.postMessage({ type: 'DRAG_START' })}
    onWorkerDrag={(node) => workerRef.current?.postMessage({ type: 'DRAG', payload: { id: node.id, x: node.x, y: node.y } })}
    onWorkerDragEnd={(node) => workerRef.current?.postMessage({ type: 'DRAG_END', payload: { id: node.id } })}
  />
}))
