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
      setIsEngineReady
    },
    ref
  ) => {
    const snippets = useVaultStore((s) => s.snippets)

    return (
      <ForceGraph2D
        ref={ref}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        onNodeHover={(node) => setHoverNode(node)}
        nodePointerAreaPaint={(node, color, ctx) => {
          const sizeMult = useSettingsStore.getState().settings.graphNodeSize || 1.5
          const baseR = node.val ? Math.min(20, Math.max(4, Math.sqrt(node.val) * 3)) : 4
          const r = baseR * sizeMult + 5
          const hitRadius = Math.max(r + 10, 15)
          
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, hitRadius, 0, 2 * Math.PI, false)
          ctx.fill()
        }}
        linkVisibility={(link) => {
          const isDragging = usePerformanceStore.getState().metrics.isDragging
          if (!isDragging) return true
          // If dragging, ONLY render links attached to the dragged/hovered node
          return link.source === hoverNode || link.target === hoverNode
        }}
        linkColor={(link) => {
          if (!hoverNode) return defaultLineColor
          return link.source === hoverNode || link.target === hoverNode ? '#40bafa' : 'rgba(150, 150, 150, 0.05)'
        }}
        linkWidth={(link) => {
          if (!hoverNode) return 0.2
          return link.source === hoverNode || link.target === hoverNode ? 0.4 : 0.1
        }}
        linkDirectionalParticles={0}
        onNodeClick={(node) => {
          if (node.snippetId) {
            const s = snippets.find((sn) => sn.id === node.snippetId)
            if (s && onNavigate) onNavigate(s)
          }
        }}
        onNodeDrag={(node) => {
          usePerformanceStore.getState().setDragging(true)
        }}
        onNodeDragEnd={(node) => {
          usePerformanceStore.getState().setDragging(false)
          node.fx = null
          node.fy = null
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
        backgroundColor="transparent"
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.4}
        nodeLabel={(node) => (node.id || '').replace(/[*"']/g, '')}
        onEngineStop={() => setIsEngineReady(true)}
      />
    )
  }
)

Graph2D.displayName = 'Graph2D'
export default React.memo(Graph2D)
