import React, { useEffect, useRef } from 'react'
import { Target } from 'lucide-react'

const GraphMiniMap = ({ graphRef, graphData, mainWidth, mainHeight, style }) => {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas || !graphRef.current) return
      
      const ctx = canvas.getContext('2d')
      const { width, height } = canvas
      
      // Clear background
      ctx.clearRect(0, 0, width, height)

      const nodes = graphData?.nodes || []
      if (nodes.length === 0) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // 1. Calculate bounds of the entire graph
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        if (n.x < minX) minX = n.x
        if (n.x > maxX) maxX = n.x
        if (n.y < minY) minY = n.y
        if (n.y > maxY) maxY = n.y
      }

      // Add a small safety margin
      const padding = 50
      minX -= padding
      maxX += padding
      minY -= padding
      maxY += padding

      const graphW = Math.max(maxX - minX, 1)
      const graphH = Math.max(maxY - minY, 1)

      // Calculate scale to fit graph into the minimap canvas
      const scaleX = width / graphW
      const scaleY = height / graphH
      const scale = Math.min(scaleX, scaleY)

      const offsetX = width / 2 - ((minX + maxX) / 2) * scale
      const offsetY = height / 2 - ((minY + maxY) / 2) * scale

      // 2. Draw nodes
      ctx.fillStyle = 'rgba(64, 186, 250, 0.4)'
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const cx = n.x * scale + offsetX
        const cy = n.y * scale + offsetY
        const r = Math.max(1, (n.val ? Math.sqrt(n.val) : 1) * 0.5)
        
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // 3. Draw viewport box
      try {
        const currentZoom = graphRef.current.zoom()
        const currentCenter = graphRef.current.centerAt()
        
        if (currentZoom && currentCenter) {
          const vpWidthGraph = mainWidth / currentZoom
          const vpHeightGraph = mainHeight / currentZoom
          
          const vpMinX = currentCenter.x - vpWidthGraph / 2
          const vpMinY = currentCenter.y - vpHeightGraph / 2
          
          const boxX = vpMinX * scale + offsetX
          const boxY = vpMinY * scale + offsetY
          const boxW = vpWidthGraph * scale
          const boxH = vpHeightGraph * scale
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
          ctx.lineWidth = 1
          ctx.strokeRect(boxX, boxY, boxW, boxH)
          
          // Semi-transparent fill for viewport
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
          ctx.fillRect(boxX, boxY, boxW, boxH)
        }
      } catch (err) {
        // centerAt/zoom might throw if not fully initialized
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [graphData, graphRef, mainWidth, mainHeight])

  const handleRecenter = (e) => {
    e.stopPropagation()
    if (graphRef.current) {
      graphRef.current.zoomToFit(800, 100)
    }
  }

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        width: '160px',
        height: '120px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-dim)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        zIndex: 50,
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <canvas 
        ref={canvasRef}
        width={160}
        height={120}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      
      {/* Recenter Button Overlay */}
      <button
        onClick={handleRecenter}
        title="Recenter Graph"
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          width: '24px',
          height: '24px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-dim)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-accent)',
          padding: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--text-accent)'
          e.currentTarget.style.color = 'var(--bg-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-primary)'
          e.currentTarget.style.color = 'var(--text-accent)'
        }}
      >
        <Target size={14} />
      </button>
    </div>
  )
}

export default GraphMiniMap
