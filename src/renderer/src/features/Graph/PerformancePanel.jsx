import React, { useEffect, useState } from 'react'
import { usePerformanceStore } from './usePerformanceStore'

export default function PerformancePanel({ compact = false, is3DMode = false }) {
  const [localMetrics, setLocalMetrics] = useState(null)

  useEffect(() => {
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
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#0f0',
        fontFamily: 'monospace',
        padding: '6px 10px',
        borderRadius: '4px',
        fontSize: '10px',
        zIndex: 9999,
        pointerEvents: 'none',
        border: '1px solid #333',
        display: 'flex',
        gap: '12px'
      }}
    >
      <span>FPS: {localMetrics.fps.toFixed(1)}</span>
      <span>Frame: {localMetrics.frameTime.toFixed(1)}ms</span>
      <span style={{ color: '#aaa' }}>N: {localMetrics.nodeCount} | L: {localMetrics.linkCount}</span>
      {is3DMode && <span style={{ color: '#b57edd' }}>[GPU]</span>}
    </div>
  )
}
