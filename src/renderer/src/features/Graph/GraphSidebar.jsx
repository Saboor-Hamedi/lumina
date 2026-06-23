import React from 'react'
import { Network, RefreshCw, Layers, Check } from 'lucide-react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './GraphSidebar.css'

const GraphSidebar = ({ searchQuery, setSearchQuery, isSpinning, setIsSpinning, graphTheme, onHeaderMouseDown, isMaximized }) => {
  return (
    <div className="nexus-sidebar">
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
          <div className="nexus-section-title">Controls</div>
          <button
            className={`nexus-action-btn ${isSpinning ? 'active' : ''}`}
            onClick={() => setIsSpinning(!isSpinning)}
          >
            <RefreshCw size={14} className={isSpinning ? 'spin-icon' : ''} />
            <span>{isSpinning ? 'Stop Rotation' : 'Auto Rotate'}</span>
          </button>
        </div>

        <div className="nexus-sidebar-section">
          <div className="nexus-section-title">Themes</div>
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
                onClick={() => useSettingsStore.getState().updateSetting('graphTheme', theme.id)}
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
      </div>
    </div>
  )
}

export default GraphSidebar
