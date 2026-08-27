import React, { useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const UpdateHeader = ({ currentVersion, newVersion, status }) => {
  const [channel, setChannel] = useState('stable')
  const isUpToDate = status === 'idle' || currentVersion === newVersion

  return (
    <div className="update-details-header">
      <div className="channel-toggle">
        <button 
          className={`channel-btn ${channel === 'stable' ? 'active' : ''}`}
          onClick={() => setChannel('stable')}
        >
          Stable
        </button>
        <button 
          className={`channel-btn ${channel === 'beta' ? 'active' : ''}`}
          onClick={() => setChannel('beta')}
        >
          Beta
        </button>
      </div>

      {isUpToDate ? (
        <div className="up-to-date-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>You're up to date!</span>
          <span className="version-badge" style={{ marginLeft: 'auto', background: 'var(--bg-active)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            v{currentVersion}
          </span>
        </div>
      ) : (
        <div className="update-version-showcase">
          <div className="version-block current">
            <span className="version-label">Current</span>
            <span className="version-number">{currentVersion}</span>
          </div>
          
          <div className="version-divider">
            <div className="animated-arrow">
              <ArrowRight size={14} />
            </div>
          </div>
          
          <div className="version-block latest">
            <span className="version-label beta">{channel === 'beta' ? 'Beta' : 'Latest'}</span>
            <span className="version-number">{channel === 'beta' ? newVersion + '-beta' : newVersion}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default UpdateHeader
