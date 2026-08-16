import React from 'react'

const SettingTab = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="settings-sidebar">
      <button
        className={`nav-item ${activeTab === 'look-and-feel' ? 'active' : ''}`}
        onClick={() => setActiveTab('look-and-feel')}
      >
        Look & Feel
      </button>
      <button
        className={`nav-item ${activeTab === 'assistant' ? 'active' : ''}`}
        onClick={() => setActiveTab('assistant')}
      >
        AI Assistant
      </button>
      <button
        className={`nav-item ${activeTab === 'advanced' ? 'active' : ''}`}
        onClick={() => setActiveTab('advanced')}
      >
        Advanced
      </button>
    </aside>
  )
}

export default React.memo(SettingTab)
