import React, { useState, useCallback, useEffect } from 'react'
import { Square, Copy, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { useSettingsStore } from '../../core/store/SettingStore'
import ToolTip from '../../components/atoms/ToolTip'
import SettingTabs, { SETTINGS_TAB_ORDER } from './SettingTabs'
import SettingPanel from './SettingPanel'
import { useModalDrag } from './hook/useModalDrag'
import type { SettingsProps, SettingsTabId } from './types'
import './css/settings.css'

const TAB_LABELS: Record<SettingsTabId, string> = {
  workspace: 'Workspace',
  'look-and-feel': 'Look & Feel',
  shortcuts: 'Shortcuts',
  assistant: 'AI Assistant',
  memory: 'AI Memory',
  advanced: 'Advanced'
}

/**
 * Maps incoming initialTab strings to a valid SettingsTabId
 */
const mapInitialTab = (tab?: string): SettingsTabId => {
  if (!tab) return 'look-and-feel'
  if (['workspace', 'vault'].includes(tab)) return 'workspace'
  if (['look-and-feel', 'appearance', 'type', 'general'].includes(tab)) return 'look-and-feel'
  if (tab === 'shortcuts') return 'shortcuts'
  if (['ai', 'assistant'].includes(tab)) return 'assistant'
  if (['memory', 'ai-memory'].includes(tab)) return 'memory'
  if (['graph', 'advanced'].includes(tab)) return 'advanced'
  return 'look-and-feel'
}

/**
 * Settings Modal Component
 * Orchestrator component featuring a draggable & resizable modal dialog.
 * Houses SettingTabs (sidebar) and SettingPanel (properties canvas).
 */
export const Settings: React.FC<SettingsProps> = ({
  onClose,
  onOpenTheme,
  initialTab = 'look-and-feel'
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() => mapInitialTab(initialTab))
  const isMaximized = useSettingsStore((s) => s.settings.settingsModalMaximized ?? false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Custom modal drag positioning hook
  const { containerRef, modalPos, handleModalHeaderMouseDown } = useModalDrag(isMaximized)

  // Maximize / Restore window toggle
  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ settingsModalMaximized: !(settings.settingsModalMaximized ?? false) })
  }, [])

  // Toggle sidebar collapse
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  // Close modal on Escape, unless actively recording a shortcut
  useKeyboardShortcuts({
    onEscape: () => {
      const isRecording =
        (window as unknown as { __isRecordingShortcut?: boolean }).__isRecordingShortcut ||
        document.querySelector('.shortcut-recording, .shortcut-inline-input, .shortcut-modal-overlay')

      if (isRecording) {
        return false
      }
      if (onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  // Keyboard navigation for switching tabs (Ctrl+Tab, Ctrl+Shift+Tab, Shift+Tab, Ctrl+1..6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if actively recording a keybinding in Shortcut manager
      const isRecording =
        (window as unknown as { __isRecordingShortcut?: boolean }).__isRecordingShortcut ||
        document.querySelector('.shortcut-recording, .shortcut-inline-input, .shortcut-modal-overlay')
      if (isRecording) return

      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

      // 1. Ctrl + 1..6: Direct tab jump
      if (e.ctrlKey && !e.altKey && !e.metaKey && e.key >= '1' && e.key <= '6') {
        const index = parseInt(e.key, 10) - 1
        if (index >= 0 && index < SETTINGS_TAB_ORDER.length) {
          e.preventDefault()
          setActiveTab(SETTINGS_TAB_ORDER[index])
          return
        }
      }

      // 2. Ctrl + Shift + Tab OR Shift + Tab (when not typing in an input): Previous Tab
      if (e.shiftKey && (e.key === 'Tab' || e.code === 'Tab')) {
        if (e.ctrlKey || !isInput) {
          e.preventDefault()
          setActiveTab((prev) => {
            const currentIndex = SETTINGS_TAB_ORDER.indexOf(prev)
            const prevIndex =
              currentIndex <= 0 ? SETTINGS_TAB_ORDER.length - 1 : currentIndex - 1
            return SETTINGS_TAB_ORDER[prevIndex]
          })
          return
        }
      }

      // 3. Ctrl + Tab: Next Tab
      if (e.ctrlKey && !e.shiftKey && (e.key === 'Tab' || e.code === 'Tab')) {
        e.preventDefault()
        setActiveTab((prev) => {
          const currentIndex = SETTINGS_TAB_ORDER.indexOf(prev)
          const nextIndex = (currentIndex + 1) % SETTINGS_TAB_ORDER.length
          return SETTINGS_TAB_ORDER[nextIndex]
        })
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  return (
    <div className="nexus-overlay settings-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`settings-modal modal-container settings-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          flexDirection: 'column',
          width: isMaximized ? '100vw' : '900px',
          height: isMaximized ? '100vh' : '76vh',
          maxWidth: isMaximized ? 'none' : '94vw',
          minHeight: isMaximized ? 'none' : '480px',
          maxHeight: isMaximized ? 'none' : '78vh',
          transform: isMaximized
            ? 'none'
            : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
          transition: '0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          borderRadius: isMaximized ? '0' : '12px'
        }}
      >
        {/* Modal Window Header */}
        <div
          className="modal-header settings-modal-header"
          onMouseDown={handleModalHeaderMouseDown}
          style={{ cursor: isMaximized ? 'default' : 'grab' }}
        >
          <div className="settings-header-left">
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                type="button"
                className="settings-sidebar-toggle-btn"
                onClick={handleToggleSidebar}
                aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={15} strokeWidth={2} />
                ) : (
                  <PanelLeftOpen size={15} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <span className="settings-header-title">Settings</span>
            <span className="settings-header-divider">/</span>
            <span className="settings-header-subtitle">
              {TAB_LABELS[activeTab] || 'Preferences'}
            </span>
          </div>

          <div className="window-controls settings-header-right">
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                type="button"
                className="control-icon control-maximize settings-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} strokeWidth={2} />
                ) : (
                  <Square size={13} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                type="button"
                className="control-icon control-close settings-close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Modal Body: Navigation Sidebar (SettingTabs) + Content Viewport (SettingPanel) */}
        <div
          className={`modal-body settings-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
        >
          <SettingTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isOpen={isSidebarOpen}
          />
          <SettingPanel
            activeTab={activeTab}
            onOpenTheme={onOpenTheme}
          />
        </div>
      </div>
    </div>
  )
}

export default React.memo(Settings)
