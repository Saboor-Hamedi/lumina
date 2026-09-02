import React, { useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const UpdateHeader = ({ currentVersion, newVersion, status }) => {
  const [channel, setChannel] = useState('stable')
  const isUpToDate = status === 'idle' || currentVersion === newVersion

  return (
    <div className="update-details-header">
      <div className="update-channel-bar">
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
        {!isUpToDate && (
          <span className="update-header-badge">
            <span className="badge-has-update">● Update Available</span>
          </span>
        )}
      </div>

      {isUpToDate ? (
        <div className="up-to-date-header">
          <CheckCircle2 size={16} className="up-to-date-icon" />
          <span className="up-to-date-text">You're up to date!</span>
          <span className="version-badge">v{currentVersion}</span>
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
            <span className="version-label beta">
              {channel === 'beta' ? 'Beta' : 'Latest'}
            </span>
            <span className="version-number">
              {channel === 'beta' ? newVersion + '-beta' : newVersion}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default UpdateHeader
