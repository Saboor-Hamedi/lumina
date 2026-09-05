import React from 'react'
import { Palette, Sparkles, Keyboard, SlidersHorizontal } from 'lucide-react'

const SettingTab = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="settings-sidebar">
      <div className="settings-sidebar-header">
        <span className="settings-sidebar-title">Preferences</span>
      </div>

      <div className="settings-sidebar-scrollable seamless-scrollbar">
        <div className="settings-sidebar-group">
          <div className="settings-sidebar-group-title">GENERAL</div>
          <button
            className={`nav-item ${activeTab === 'look-and-feel' ? 'active' : ''}`}
            onClick={() => setActiveTab('look-and-feel')}
          >
            <Palette size={14} style={{ flexShrink: 0 }} />
            <span>Look & Feel</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            <Keyboard size={14} style={{ flexShrink: 0 }} />
            <span>Shortcuts</span>
          </button>
        </div>

        <div className="settings-sidebar-group">
          <div className="settings-sidebar-group-title">FEATURES</div>
          <button
            className={`nav-item ${activeTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('assistant')}
          >
            <Sparkles size={14} style={{ flexShrink: 0 }} />
            <span>Lumina AI Assistant</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            <SlidersHorizontal size={14} style={{ flexShrink: 0 }} />
            <span>Advanced</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

export default React.memo(SettingTab)
