import React from 'react'
import { Files, Search, Settings, Network } from 'lucide-react'
import './ActivityBar.css'

const ActivityBar = ({ activeTab, onTabChange, onSettingsClick }) => {
  return (
    <div className="activity-bar">
      <div className="bar-top">
        <button
          className={`bar-item ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => onTabChange('files')}
          title="Explorer"
        >
          <Files size={24} strokeWidth={1.5} />
        </button>
        <button
          className={`bar-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => onTabChange('search')}
          title="Search"
        >
          <Search size={24} strokeWidth={1.5} />
        </button>
        <button
          className={`bar-item ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => onTabChange('graph')}
          title="Graph View"
        >
          <Network size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="bar-bottom">
        <button className="bar-item" title="Settings" onClick={onSettingsClick}>
          <Settings size={22} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

export default ActivityBar
