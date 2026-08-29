import React, { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import ModalHeader from '../Overlays/ModalHeader'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import SettingTab from './SettingTab'
import SettingLookAndFeel from './SettingLookAndFeel'
import SettingAssistant from './SettingAssistant'
import SettingShortcuts from './SettingShortcuts'
import SettingAdvanced from './SettingAdvanced'
import './Settings.css'

const Settings = ({ onClose, onOpenTheme, initialTab = 'look-and-feel' }) => {
  const mapInitialTab = (tab) => {
    if (tab === 'shortcuts') return 'shortcuts'
    if (['graph', 'advanced'].includes(tab)) return 'advanced'
    if (['ai', 'assistant'].includes(tab)) return 'assistant'
    if (['look-and-feel', 'appearance', 'type', 'general'].includes(tab)) return 'look-and-feel'
    return 'look-and-feel'
  }

  const [activeTab, setActiveTab] = useState(mapInitialTab(initialTab))

  useKeyboardShortcuts({
    onEscape: onClose
  })

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10005 }}>
      <div
        className="modal-container settings-container premium-preview-card"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader title="Settings" icon={<SettingsIcon size={16} />} onClose={onClose} />

        <div className="settings-layout">
          <SettingTab activeTab={activeTab} setActiveTab={setActiveTab} />

          <main className="settings-body">
            {activeTab === 'look-and-feel' && <SettingLookAndFeel onOpenTheme={onOpenTheme} />}
            {activeTab === 'assistant' && <SettingAssistant />}
            {activeTab === 'shortcuts' && <SettingShortcuts />}
            {activeTab === 'advanced' && <SettingAdvanced />}
          </main>
        </div>
      </div>
    </div>
  )
}

export default Settings
