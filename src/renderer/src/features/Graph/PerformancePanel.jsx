import React, { useEffect, useState } from 'react'
import { usePerformanceStore } from './usePerformanceStore'

export default function PerformancePanel() {
  const [localMetrics, setLocalMetrics] = useState(null)

  useEffect(() => {
    // Throttle React updates to twice a second so the panel itself doesn't cause lag
    let animationFrameId
    let lastUpdate = 0
    
    const updateLoop = (timestamp) => {
      if (timestamp - lastUpdate > 500) {
        setLocalMetrics(usePerformanceStore.getState().metrics)
        lastUpdate = timestamp
      }
      animationFrameId = requestAnimationFrame(updateLoop)
    }
    
    animationFrameId = requestAnimationFrame(updateLoop)
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  if (!localMetrics) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#0f0',
        fontFamily: 'monospace',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '11px',
        zIndex: 9999,
        pointerEvents: 'none',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        border: '1px solid #333'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>LUMINA PERFORMANCE</div>
      <div>FPS: {localMetrics.fps.toFixed(1)}</div>
      <div>Frame Time: {localMetrics.frameTime.toFixed(1)} ms</div>
      <div style={{ margin: '8px 0', borderTop: '1px dashed #555' }}></div>
      <div>Nodes: {localMetrics.nodeCount}</div>
      <div>Links: {localMetrics.linkCount}</div>
      <div>Node Render: {localMetrics.nodesRenderTime.toFixed(2)} ms</div>
      <div>Link Render: {localMetrics.linksRenderTime.toFixed(2)} ms</div>
      <div style={{ margin: '8px 0', borderTop: '1px dashed #555' }}></div>
      <div>Status: {localMetrics.isDragging ? <span style={{color: '#fa40bafa'}}>DRAGGING</span> : 'IDLE'}</div>
    </div>
  )
}
