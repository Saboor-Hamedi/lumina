import React, { useState, useEffect } from 'react'
import { Network, RefreshCw, Layers } from 'lucide-react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './GraphSidebar.css'
import '../../assets/toggle-theme.css'
import Toggle from '../../components/toggle'

const GraphSidebar = ({
  isOpen = true,
  searchQuery,
  setSearchQuery
}) => {
  const { settings, updateSetting } = useSettingsStore()
  
  // Fast optimistic update for instant slider preview without heavy I/O
  const fastUpdate = (key, val) => {
    useSettingsStore.setState(state => ({
      settings: { ...state.settings, [key]: val }
    }))
  }

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery || '')

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        setSearchQuery(localSearchQuery)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [localSearchQuery, setSearchQuery, searchQuery])

  useEffect(() => {
    if (searchQuery !== localSearchQuery) {
      setLocalSearchQuery(searchQuery || '')
    }
  }, [searchQuery])

  return (
    <div className={`nexus-sidebar ${isOpen ? '' : 'closed'}`}>
      <div className="nexus-sidebar-content">
        <div className="nexus-search-wrap">
          <input
            type="text"
            placeholder="Search nodes..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="nexus-search-input"
          />
        </div>

        <div className="nexus-sidebar-section" style={{ marginTop: '12px' }}>
          <div className="nexus-section-title">Filters</div>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 2px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-main)'
              }}
            >
              <span>Show Tags</span>
              <Toggle
                checked={!settings.graphHideTags}
                onChange={(e) => updateSetting('graphHideTags', !e.target.checked)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-main)'
              }}
            >
              <span>Show Unresolved Links</span>
              <Toggle
                checked={!settings.graphHideGhosts}
                onChange={(e) => updateSetting('graphHideGhosts', !e.target.checked)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-main)'
              }}
            >
              <span>Show Orphans</span>
              <Toggle
                checked={!settings.graphHideOrphans}
                onChange={(e) => updateSetting('graphHideOrphans', !e.target.checked)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-main)'
              }}
            >
              <span>3D Sphere Mode</span>
              <Toggle
                checked={settings.graph3DMode ?? false}
                onChange={(e) => updateSetting('graph3DMode', e.target.checked)}
              />
            </div>
          </div>
        </div>

        <div className="nexus-sidebar-section" style={{ marginTop: '12px' }}>
          <div className="nexus-section-title">Display</div>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '12px 2px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Node Size</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.graphNodeSize || 1.5}
                onChange={(e) => fastUpdate('graphNodeSize', parseFloat(e.target.value))}
                onMouseUp={(e) => updateSetting('graphNodeSize', parseFloat(e.target.value))}
                onTouchEnd={(e) => updateSetting('graphNodeSize', parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Center Force</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.0"
                max="1.0"
                step="0.01"
                value={settings.graphCenterForce ?? 0.05}
                onChange={(e) => fastUpdate('graphCenterForce', parseFloat(e.target.value))}
                onMouseUp={(e) => updateSetting('graphCenterForce', parseFloat(e.target.value))}
                onTouchEnd={(e) => updateSetting('graphCenterForce', parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Repel Force</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.0"
                max="1.0"
                step="0.01"
                value={settings.graphRepelForce ?? 0.3}
                onChange={(e) => fastUpdate('graphRepelForce', parseFloat(e.target.value))}
                onMouseUp={(e) => updateSetting('graphRepelForce', parseFloat(e.target.value))}
                onTouchEnd={(e) => updateSetting('graphRepelForce', parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Link Force</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.0"
                max="1.0"
                step="0.01"
                value={settings.graphLinkForce ?? 0.05}
                onChange={(e) => fastUpdate('graphLinkForce', parseFloat(e.target.value))}
                onMouseUp={(e) => updateSetting('graphLinkForce', parseFloat(e.target.value))}
                onTouchEnd={(e) => updateSetting('graphLinkForce', parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Selected Link Opacity</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.graphLinkHighlightOpacity ?? 0.6}
                onChange={(e) => fastUpdate('graphLinkHighlightOpacity', parseFloat(e.target.value))}
                onMouseUp={(e) => updateSetting('graphLinkHighlightOpacity', parseFloat(e.target.value))}
                onTouchEnd={(e) => updateSetting('graphLinkHighlightOpacity', parseFloat(e.target.value))}
              />
            </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontWeight: 500
                  }}
                >
                  <span>Inactive Link Opacity</span>
                </div>
                <input
                  type="range"
                  className="graph-slider"
                  min="0.0"
                  max="0.3"
                  step="0.01"
                  value={settings.graphLinkDimOpacity ?? 0.05}
                  onChange={(e) => fastUpdate('graphLinkDimOpacity', parseFloat(e.target.value))}
                  onMouseUp={(e) => updateSetting('graphLinkDimOpacity', parseFloat(e.target.value))}
                  onTouchEnd={(e) => updateSetting('graphLinkDimOpacity', parseFloat(e.target.value))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontWeight: 500
                  }}
                >
                  <span>Unresolved Link Opacity</span>
                </div>
                <input
                  type="range"
                  className="graph-slider"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.graphGhostLinkOpacity ?? 0.3}
                  onChange={(e) => fastUpdate('graphGhostLinkOpacity', parseFloat(e.target.value))}
                  onMouseUp={(e) => updateSetting('graphGhostLinkOpacity', parseFloat(e.target.value))}
                  onTouchEnd={(e) => updateSetting('graphGhostLinkOpacity', parseFloat(e.target.value))}
                />
              </div>
          </div>
        </div>
      </div>

      <div
        className="nexus-sidebar-footer"
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}
      >
        <button
          className={`theme-toggle ${settings.graphAnimate !== false ? 'active' : ''}`}
          title={settings.graphAnimate !== false ? 'Stop Rotation' : 'Auto Rotate'}
          onClick={() =>
            updateSetting('graphAnimate', settings.graphAnimate === false ? true : false)
          }
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            background: 'transparent',
            border: 'none',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <RefreshCw
            size={12}
            className={settings.graphAnimate !== false ? 'spin-icon' : ''}
            color={settings.graphAnimate !== false ? 'var(--text-accent)' : 'var(--text-muted)'}
          />
        </button>
      </div>
    </div>
  )
}

export default GraphSidebar
