import React, { useState, useEffect } from 'react'
import { Network, RefreshCw, Layers, Check } from 'lucide-react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './GraphSidebar.css'
import '../../assets/toggle-theme.css'

const GraphSidebar = ({ isOpen = true, searchQuery, setSearchQuery, graphTheme, onHeaderMouseDown, isMaximized }) => {
  const { settings, updateSetting } = useSettingsStore()

  return (
    <div className={`nexus-sidebar ${isOpen ? '' : 'closed'}`}>
      <div 
        className="nexus-sidebar-header" 
        onMouseDown={onHeaderMouseDown}
        style={{ cursor: isMaximized ? 'default' : 'grab' }}
      >
        <Network size={16} />
        <span>Graph Nexus</span>
      </div>

      <div className="nexus-sidebar-content">
        <div className="nexus-search-wrap">
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nexus-search-input"
          />
        </div>


        <div className="nexus-sidebar-section">
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', justifyContent: 'center' }}>
            {[
              { id: 'default', color: '#1a1a20' },
              { id: 'space', color: '#000000' },
              { id: 'nebula', color: 'linear-gradient(135deg, #130b29, #090616)' },
              { id: 'ocean', color: 'linear-gradient(135deg, #02111d, #073a5a)' },
              { id: 'sunset', color: 'linear-gradient(135deg, #2a0826, #6b1432)' },
              { id: 'neural', color: 'linear-gradient(135deg, #0a192f, #112240)' }
            ].map(theme => (
              <button 
                key={theme.id}
                title={theme.id.charAt(0).toUpperCase() + theme.id.slice(1)}
                onClick={() => updateSetting('graphTheme', theme.id)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: theme.color,
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'none',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {graphTheme === theme.id && <Check size={14} color="#ffffff" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div className="nexus-sidebar-section" style={{ marginTop: '12px' }}>
          <div className="nexus-section-title">Filters</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-main)' }}>
              <span>Show Tags</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={!settings.graphHideTags}
                  onChange={(e) => updateSetting('graphHideTags', !e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-main)' }}>
              <span>Show Unresolved Links</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={!settings.graphHideGhosts}
                  onChange={(e) => updateSetting('graphHideGhosts', !e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-main)' }}>
              <span>Show Orphans</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={!settings.graphHideOrphans}
                  onChange={(e) => updateSetting('graphHideOrphans', !e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="nexus-sidebar-section" style={{ marginTop: '12px' }}>
          <div className="nexus-section-title">Display</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '12px 2px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                <span>Node Size</span>
              </div>
              <input 
                type="range" 
                className="graph-slider"
                min="0.5" max="3.0" step="0.1" 
                value={settings.graphNodeSize || 1.5}
                onChange={(e) => updateSetting('graphNodeSize', parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                <span>Center Force</span>
              </div>
              <input 
                type="range" 
                className="graph-slider"
                min="0.0" max="1.0" step="0.01" 
                value={settings.graphCenterForce ?? 0.05}
                onChange={(e) => updateSetting('graphCenterForce', parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                <span>Repel Force</span>
              </div>
              <input 
                type="range" 
                className="graph-slider"
                min="0.0" max="1.0" step="0.01" 
                value={settings.graphRepelForce ?? 0.3}
                onChange={(e) => updateSetting('graphRepelForce', parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                <span>Link Force</span>
              </div>
              <input 
                type="range" 
                className="graph-slider"
                min="0.0" max="1.0" step="0.01" 
                value={settings.graphLinkForce ?? 0.05}
                onChange={(e) => updateSetting('graphLinkForce', parseFloat(e.target.value))}
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
          onClick={() => updateSetting('graphAnimate', settings.graphAnimate === false ? true : false)}
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
          <RefreshCw size={12} className={settings.graphAnimate !== false ? 'spin-icon' : ''} color={settings.graphAnimate !== false ? 'var(--text-accent)' : 'var(--text-muted)'} />
        </button>
      </div>
    </div>
  )
}

export default GraphSidebar
