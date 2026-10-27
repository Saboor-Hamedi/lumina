import React, { useEffect, useState } from 'react'
import { usePerformanceStore, type PerformanceMetrics } from './usePerformanceStore'
import { Target } from 'lucide-react'

export interface PerformancePanelProps {
  compact?: boolean
  is3DMode?: boolean
  onRecenter?: (e?: any) => void
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
  compact = false,
  is3DMode = false,
  onRecenter
}) => {
  const [localMetrics, setLocalMetrics] = useState<PerformanceMetrics>(() => usePerformanceStore.getState().metrics)

  useEffect(() => {
    let animationFrameId: number
    let lastUpdate = performance.now()

    const updateLoop = (timestamp: number) => {
      if (timestamp - lastUpdate > 300) {
        setLocalMetrics(usePerformanceStore.getState().metrics)
        lastUpdate = timestamp
      }
      animationFrameId = requestAnimationFrame(updateLoop)
    }

    animationFrameId = requestAnimationFrame(updateLoop)
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  if (
    !localMetrics ||
    (localMetrics.fps === 0 && localMetrics.frameTime === 0 && localMetrics.nodeCount === 0)
  ) {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: compact ? '8px' : '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-panel, #18181b)',
        color: 'var(--text-main, #f8fafc)',
        fontFamily: 'monospace',
        padding: compact ? '2px 8px' : '4px 8px 4px 12px',
        borderRadius: '6px',
        fontSize: compact ? '10px' : '11px',
        zIndex: 300,
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '8px' : '12px',
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        boxSizing: 'border-box'
      }}
    >
      <span style={{ flexShrink: 0 }}>
        {compact ? `${Math.round(localMetrics.fps)} FPS` : `FPS: ${localMetrics.fps.toFixed(1)}`}
      </span>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
        {compact ? `${localMetrics.frameTime.toFixed(1)}ms` : `${localMetrics.frameTime.toFixed(1)}ms`}
      </span>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
        {compact
          ? `${localMetrics.nodeCount}N · ${localMetrics.linkCount}L`
          : `N: ${localMetrics.nodeCount} | L: ${localMetrics.linkCount}`}
      </span>
      {is3DMode && <span style={{ color: 'var(--text-accent)', flexShrink: 0 }}>[GPU]</span>}

      {onRecenter && (
        <button
          onClick={onRecenter}
          title="Recenter Graph"
          style={{
            background: 'var(--bg-editor, var(--bg-panel))',
            border: '1px solid var(--border-dim)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-main)',
            padding: compact ? '2px 3px' : '4px',
            marginLeft: '2px',
            flexShrink: 0,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--text-accent)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-editor, var(--bg-panel))'
            e.currentTarget.style.color = 'var(--text-main)'
          }}
        >
          <Target size={compact ? 11 : 12} />
        </button>
      )}
    </div>
  )
}

export default PerformancePanel
