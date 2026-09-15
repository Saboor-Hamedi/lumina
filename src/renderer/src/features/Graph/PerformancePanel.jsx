import React, { useEffect, useState } from 'react'
import { usePerformanceStore } from './usePerformanceStore'
import { Target } from 'lucide-react'

export default function PerformancePanel({ compact = false, is3DMode = false, onRecenter }) {
  const [localMetrics, setLocalMetrics] = useState(() => usePerformanceStore.getState().metrics)

  useEffect(() => {
    let animationFrameId
    let lastUpdate = performance.now()
    
    const updateLoop = (timestamp) => {
      if (timestamp - lastUpdate > 300) {
        setLocalMetrics(usePerformanceStore.getState().metrics)
        lastUpdate = timestamp
      }
      animationFrameId = requestAnimationFrame(updateLoop)
    }
    
    animationFrameId = requestAnimationFrame(updateLoop)
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  if (!localMetrics || (localMetrics.fps === 0 && localMetrics.frameTime === 0 && localMetrics.nodeCount === 0)) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-panel, #18181b)',
        color: 'var(--text-main, #f8fafc)',
        fontFamily: 'monospace',
        padding: '4px 8px 4px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        zIndex: 300,
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        pointerEvents: 'auto'
      }}
    >
      <span>FPS: {localMetrics.fps.toFixed(1)}</span>
      <span style={{ color: 'var(--text-muted)' }}>{localMetrics.frameTime.toFixed(1)}ms</span>
      <span style={{ color: 'var(--text-muted)' }}>N: {localMetrics.nodeCount} | L: {localMetrics.linkCount}</span>
      {is3DMode && <span style={{ color: 'var(--text-accent)' }}>[GPU]</span>}
      
      {onRecenter && (
        <button
          onClick={onRecenter}
          title="Recenter Graph"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-dim)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-main)',
            padding: '4px',
            marginLeft: '4px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--text-accent)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-primary)'
            e.currentTarget.style.color = 'var(--text-main)'
          }}
        >
          <Target size={12} />
        </button>
      )}
    </div>
  )
}
