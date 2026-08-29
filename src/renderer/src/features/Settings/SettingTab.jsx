import React from 'react'
import { Palette, Sparkles, Keyboard, SlidersHorizontal } from 'lucide-react'

const SettingTab = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="settings-sidebar">
      <button
        className={`nav-item ${activeTab === 'look-and-feel' ? 'active' : ''}`}
        onClick={() => setActiveTab('look-and-feel')}
      >
        <Palette size={14} style={{ flexShrink: 0 }} />
        <span>Look & Feel</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'assistant' ? 'active' : ''}`}
        onClick={() => setActiveTab('assistant')}
      >
        <Sparkles size={14} style={{ flexShrink: 0 }} />
        <span>AI Assistant</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'shortcuts' ? 'active' : ''}`}
        onClick={() => setActiveTab('shortcuts')}
      >
        <Keyboard size={14} style={{ flexShrink: 0 }} />
        <span>Shortcuts</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'advanced' ? 'active' : ''}`}
        onClick={() => setActiveTab('advanced')}
      >
        <SlidersHorizontal size={14} style={{ flexShrink: 0 }} />
        <span>Advanced</span>
      </button>
    </aside>
  )
}

export default React.memo(SettingTab)
