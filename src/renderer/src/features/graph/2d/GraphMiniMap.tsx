import React, { useEffect, useRef } from 'react'
import { Target } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'

export interface GraphMiniMapProps {
  graphRef: React.RefObject<any>
  graphData: {
    nodes?: Array<{ id: string | number; x: number; y: number; z?: number; val?: number; [key: string]: any }>
    links?: Array<any>
  }
  mainWidth: number
  mainHeight: number
  style?: React.CSSProperties
  is3DMode?: boolean
}

const GraphMiniMap: React.FC<GraphMiniMapProps> = ({
  graphRef,
  graphData,
  mainWidth,
  mainHeight,
  style,
  is3DMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const graphDataRef = useRef(graphData)

  useEffect(() => {
    graphDataRef.current = graphData
  }, [graphData])

  useEffect(() => {
    let lastDrawTime = 0
    const draw = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(draw)

      if (timestamp - lastDrawTime < 100) return
      lastDrawTime = timestamp

      const canvas = canvasRef.current
      if (!canvas || !graphRef.current) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { width, height } = canvas

      ctx.clearRect(0, 0, width, height)

      const nodes = graphDataRef.current?.nodes || []
      if (nodes.length === 0) return

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        if (n.x < minX) minX = n.x
        if (n.x > maxX) maxX = n.x
        if (is3DMode) {
          if ((n.z ?? 0) < minY) minY = n.z ?? 0
          if ((n.z ?? 0) > maxY) maxY = n.z ?? 0
        } else {
          if (n.y < minY) minY = n.y
          if (n.y > maxY) maxY = n.y
        }
      }

      const padding = 50
      minX -= padding
      maxX += padding
      minY -= padding
      maxY += padding

      const graphW = Math.max(maxX - minX, 1)
      const graphH = Math.max(maxY - minY, 1)

      const scaleX = width / graphW
      const scaleY = height / graphH
      const scale = Math.min(scaleX, scaleY)

      const offsetX = width / 2 - ((minX + maxX) / 2) * scale
      const offsetY = height / 2 - ((minY + maxY) / 2) * scale

      ctx.fillStyle = 'rgba(64, 186, 250, 0.4)'
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        let cx: number, cy: number
        if (is3DMode) {
          cx = n.x * scale + offsetX
          cy = (n.z ?? 0) * scale + offsetY
        } else {
          cx = n.x * scale + offsetX
          cy = n.y * scale + offsetY
        }

        const r = Math.max(1, (n.val ? Math.sqrt(n.val) : 1) * 0.5)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      try {
        if (!is3DMode && graphRef.current.zoom && graphRef.current.centerAt) {
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

            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
            ctx.fillRect(boxX, boxY, boxW, boxH)
          }
        }
      } catch {
        // Ignore initialization timing
      }
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [graphRef, mainWidth, mainHeight, is3DMode])

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (graphRef.current && graphRef.current.zoomToFit) {
      graphRef.current.zoomToFit(800, 100)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
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
      <ToolTip text="Recenter Graph" position="top">
        <button
          title="Recenter Graph"
          onClick={handleRecenter}
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
            color: 'var(--text-muted)',
            transition: 'all 0.2s',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-accent)'
            e.currentTarget.style.borderColor = 'var(--text-accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border-dim)'
          }}
        >
          <Target size={12} />
        </button>
      </ToolTip>
    </div>
  )
}

export default GraphMiniMap
