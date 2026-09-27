/**
 * Settings Feature Type Definitions
 * Defines the tab identifiers, component prop contracts, and data structures.
 */

export type SettingsTabId =
  | 'look-and-feel'
  | 'shortcuts'
  | 'workspace'
  | 'assistant'
  | 'memory'
  | 'advanced'

export interface SettingsProps {
  /** Callback triggered when user dismisses the settings dialog */
  onClose: () => void
  /** Optional callback to open the custom theme gallery dialog */
  onOpenTheme?: () => void
  /** Initial tab identifier to display when opened */
  initialTab?: string
}

export interface SettingTabsProps {
  /** Currently active tab ID */
  activeTab: SettingsTabId
  /** State dispatcher to change active tab */
  setActiveTab: (tab: SettingsTabId) => void
  /** Whether the sidebar tabs pane is expanded or collapsed */
  isOpen?: boolean
}

export interface SettingPanelProps {
  /** Currently active tab ID */
  activeTab: SettingsTabId
  /** Optional callback to open the theme gallery */
  onOpenTheme?: () => void
}

export interface UserProfile {
  name: string
  role: string
  bio: string
}

export interface FactItem {
  text: string
  category?: string
  timestamp?: number
}

export interface MemoryData {
  user: UserProfile
  preferences: string[]
  facts: (string | FactItem)[]
}
