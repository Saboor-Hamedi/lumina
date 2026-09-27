import React from 'react'
import { Folder, Palette, Keyboard, Sparkles, Brain, SlidersHorizontal } from 'lucide-react'
import type { SettingTabsProps, SettingsTabId } from './types'

export interface TabItem {
  id: SettingsTabId
  label: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  dividerAfter?: boolean
}

/**
 * Clean, senior-designed tabs configuration.
 * Workspace first, followed by Look & Feel, Shortcuts, AI Assistant, AI Memory, and Advanced.
 * No bulky uppercase section headers or redundant text.
 */
export const SETTINGS_TABS: TabItem[] = [
  { id: 'workspace', label: 'Workspace', icon: Folder },
  { id: 'look-and-feel', label: 'Look & Feel', icon: Palette },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, dividerAfter: true },
  { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
  { id: 'memory', label: 'AI Memory', icon: Brain },
  { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal }
]

/** Tab IDs in navigational order */
export const SETTINGS_TAB_ORDER: SettingsTabId[] = SETTINGS_TABS.map((t) => t.id)

/**
 * SettingTabs Component
 * Minimalist, tactile navigation sidebar.
 * Clean, lightweight, and dry.
 */
export const SettingTabs: React.FC<SettingTabsProps> = ({
  activeTab,
  setActiveTab,
  isOpen = true
}) => {
  return (
    <aside
      className={`sidebar settings-sidebar ${isOpen ? '' : 'closed'}`}
      aria-label="Settings Navigation"
    >
      <div className="settings-sidebar-scrollable seamless-scrollbar">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <React.Fragment key={tab.id}>
              <button
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-selected={isActive}
                role="button"
              >
                <Icon size={14} style={{ flexShrink: 0 }} />
                <span>{tab.label}</span>
              </button>
              {tab.dividerAfter && <div className="settings-sidebar-divider" />}
            </React.Fragment>
          )
        })}
      </div>
    </aside>
  )
}

export default React.memo(SettingTabs)
