import React, { forwardRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/useVaultStore'

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
          return sourceId === hoverNode.id || targetId === hoverNode.id ? '#40bafa' : '#333333'
        }}
        linkDirectionalParticles={0}
        onNodeClick={(node) => {
          if (node.snippetId) {
            const s = snippets.find((sn) => sn.id === node.snippetId)
            if (s && onNavigate) onNavigate(s)
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
    )
  }
)

Graph2D.displayName = 'Graph2D'
export default React.memo(Graph2D)
