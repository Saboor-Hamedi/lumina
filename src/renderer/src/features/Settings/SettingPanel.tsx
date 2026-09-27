import React from 'react'
import type { SettingPanelProps } from './types'
import SettingLookAndFeel from './SettingLookAndFeel'
import SettingAssistant from './SettingAssistant'
import SettingMemory from './SettingMemory'
import SettingShortcuts from './SettingShortcuts'
import SettingWorkspace from './SettingWorkspace'
import SettingAdvanced from './SettingAdvanced'

/**
 * SettingPanel Component
 * Main viewport container that hosts the active settings section's properties,
 * input fields, sliders, and controls.
 */
export const SettingPanel: React.FC<SettingPanelProps> = ({ activeTab, onOpenTheme }) => {
  return (
    <main className="content settings-body seamless-scrollbar">
      <div className="settings-content-wrap">
        {activeTab === 'look-and-feel' && <SettingLookAndFeel onOpenTheme={onOpenTheme} />}
        {activeTab === 'shortcuts' && <SettingShortcuts />}
        {activeTab === 'workspace' && <SettingWorkspace />}
        {activeTab === 'assistant' && <SettingAssistant />}
        {activeTab === 'memory' && <SettingMemory />}
        {activeTab === 'advanced' && <SettingAdvanced />}
      </div>
    </main>
  )
}

export default React.memo(SettingPanel)
