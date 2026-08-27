import React, { useEffect, useState } from 'react'
import { usePerformanceStore } from './usePerformanceStore'
import { Target } from 'lucide-react'

export default function PerformancePanel({ compact = false, is3DMode = false, onRecenter }) {
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
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        fontFamily: 'monospace',
        padding: '4px 6px 4px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        zIndex: 9999,
        border: '1px solid var(--border-dim)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
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
