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

  if (compact) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
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

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '136px', 
        right: '8px',
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
      {is3DMode ? (
        <div style={{ color: '#b57edd', fontWeight: 'bold' }}>GPU Accelerated</div>
      ) : (
        <>
          <div style={{ color: '#aaa' }}>Links: {(localMetrics.linksRenderTime || 0).toFixed(1)} ms</div>
          <div style={{ color: '#aaa' }}>Nodes: {(localMetrics.nodesRenderTime || 0).toFixed(1)} ms</div>
        </>
      )}
      
      <div style={{ margin: '6px 0', borderTop: '1px dashed #555' }}></div>
      <div>Nodes: {localMetrics.nodeCount}</div>
      <div>Links: {localMetrics.linkCount}</div>
      <div style={{ margin: '6px 0', borderTop: '1px dashed #555' }}></div>
      <div>State: {localMetrics.isDragging ? <span style={{color: '#40bafa'}}>DRAGGING</span> : 'IDLE'}</div>
    </div>
  )
}
