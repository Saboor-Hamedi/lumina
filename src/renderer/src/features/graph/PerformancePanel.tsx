import React, { useEffect, useState } from 'react'
import { usePerformanceStore, type PerformanceMetrics } from './usePerformanceStore'

export interface PerformancePanelProps {
  compact?: boolean
  embedded?: boolean
  is3DMode?: boolean
  onRecenter?: (e?: any) => void
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
  compact = false,
  embedded = false,
  is3DMode = false
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
    !embedded &&
    (!localMetrics ||
      (localMetrics.fps === 0 && localMetrics.frameTime === 0 && localMetrics.nodeCount === 0))
  ) {
    return null
  }

  if (embedded) {
    return (
      <div
        className="graph-performance-embedded"
        style={{
          width: '100%',
          background: 'var(--bg-editor, var(--bg-app))',
          color: 'var(--text-main, #f8fafc)',
          fontFamily: 'monospace',
          padding: '5px 8px',
          borderRadius: '6px',
          fontSize: '10.5px',
          border: '1px solid var(--border-dim, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          boxSizing: 'border-box',
          minWidth: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontWeight: 600, flexShrink: 0 }}>
            {localMetrics?.fps ? `${Math.round(localMetrics.fps)} FPS` : '— FPS'}
          </span>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            {localMetrics?.frameTime ? `${localMetrics.frameTime.toFixed(1)}ms` : '0ms'}
          </span>
          <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {localMetrics?.nodeCount ?? 0}N·{localMetrics?.linkCount ?? 0}L
          </span>
          {is3DMode && (
            <span style={{ color: 'var(--text-accent)', fontWeight: 600, flexShrink: 0 }}>
              GPU
            </span>
          )}
        </div>
      </div>
    )
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
    </div>
  )
}

export default PerformancePanel
