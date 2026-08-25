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
        bottom: '160px', // Just above the minimap (120px height + 24px bottom + 16px gap)
        right: '24px',
        width: '160px',
        height: 'auto',
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#0f0',
        fontFamily: 'monospace',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '11px',
        zIndex: 9999,
        pointerEvents: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        border: '1px solid #333',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>PERFORMANCE</div>
      <div>FPS: {localMetrics.fps.toFixed(1)}</div>
      <div>Frame: {localMetrics.frameTime.toFixed(1)} ms</div>
      <div style={{ margin: '6px 0', borderTop: '1px dashed #555' }}></div>
      <div>Nodes: {localMetrics.nodeCount}</div>
      <div>Links: {localMetrics.linkCount}</div>
      <div style={{ margin: '6px 0', borderTop: '1px dashed #555' }}></div>
      <div>State: {localMetrics.isDragging ? <span style={{color: '#40bafa'}}>DRAGGING</span> : 'IDLE'}</div>
    </div>
  )
}
