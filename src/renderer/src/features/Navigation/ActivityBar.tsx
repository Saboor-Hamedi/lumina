/**
 * ActivityBar.tsx
 * 
 * VS Code-style Activity Bar Navigation Strip for Lumina.
 * 
 * Architecture & Responsibilities:
 * - Ultra-thin, persistent vertical navigation strip docked to the far-left edge of the window.
 * - Primary workspace trigger bar providing single-click access to:
 *     1. New Markdown Note creation (`trigger-new-note` event dispatch)
 *     2. Daily Journaling Notes (embedded calendar picker & quick note injector)
 *     3. Knowledge Graph 2D/3D visualization tab
 *     4. Infinite Canvas workspace (`trigger-new-canvas` event dispatch)
 *     5. AI Chat assistant docking & floating modal toggler
 *     6. Theme Customization & look-and-feel preferences modal
 *     7. Integrated Mail / Capsule communication notifications
 * - 100% TypeScript with strict memoization (`React.memo`) to avoid unneeded re-renders.
 */

import React, { memo, useState, useEffect } from 'react'
import {
  Files,
  MessageSquare,
  Terminal,
  Palette,
  Book
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import DailyNotes from './components/DailyNotes'
import ActivityBarMail from './components/ActivityBarMail'
import { useSettingStore } from '../../core/store/SettingStore'
import { useSidebarViewStore, toggleSidebarView } from './sidebarViewStore'
import './css/activitybar.css'

export interface ActivityBarProps {
  isZenHidden?: boolean
  onToggleGraph?: () => void
  onToggleAIChat?: () => void
  onToggleTerminal?: () => void
  isTerminalOpen?: boolean
  onOpenTheme?: () => void
  onOpenDocs?: () => void
  onOpenGuide?: () => void
}

export const ActivityBar: React.FC<ActivityBarProps> = memo(({
  isZenHidden = false,
  onToggleGraph,
  onToggleAIChat,
  onToggleTerminal,
  isTerminalOpen = false,
  onOpenTheme,
  onOpenDocs,
  onOpenGuide
}) => {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(() => {
    return useSettingStore.getState().settings?.sidebar?.isLeftOpen ?? true
  })
  const sidebarActiveView = useSidebarViewStore((s) => s.activeView)
  const activeActivityItem = useSidebarViewStore((s) => s.activeActivityItem)
  const setActiveActivityItem = useSidebarViewStore((s) => s.setActiveActivityItem)

  useEffect(() => {
    const handleLeftSidebarChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ open?: boolean }>
      if (typeof customEvent.detail?.open === 'boolean') {
        const nextOpen = customEvent.detail.open
        setIsLeftSidebarOpen(nextOpen)
        const current = useSidebarViewStore.getState().activeActivityItem
        if (!nextOpen && (current === 'files' || current === 'theme' || current === 'templates')) {
          setActiveActivityItem(null)
        } else if (nextOpen && current === null) {
          setActiveActivityItem(useSidebarViewStore.getState().activeView)
        }
      }
    }
    window.addEventListener('left-sidebar-toggle', handleLeftSidebarChange)
    return () => {
      window.removeEventListener('left-sidebar-toggle', handleLeftSidebarChange)
    }
  }, [setActiveActivityItem])

  const handleToggleExplorer = () => {
    toggleSidebarView('files')
  }

  const handleOpenTheme = () => {
    toggleSidebarView('theme')
  }

  const handleOpenLumina = () => {
    setActiveActivityItem('lumina')
    if (onToggleAIChat) {
      onToggleAIChat()
    } else {
      window.dispatchEvent(new CustomEvent('open-ai-chat'))
    }
  }

  const handleOpenDocs = () => {
    setActiveActivityItem('docs')
    if (onOpenDocs) {
      onOpenDocs()
    } else {
      window.dispatchEvent(new CustomEvent('open-docs-modal'))
    }
  }

  const handleToggleTerminal = () => {
    if (isTerminalOpen && activeActivityItem === 'terminal') {
      setActiveActivityItem(isLeftSidebarOpen ? sidebarActiveView : null)
    } else {
      setActiveActivityItem('terminal')
    }
    if (onToggleTerminal) {
      onToggleTerminal()
    } else {
      window.dispatchEvent(new CustomEvent('toggle-terminal'))
    }
  }

  return (
    <aside className={`lumina-activity-bar${isZenHidden ? ' zen-hidden' : ''}`} data-testid="activity-bar" aria-label="Activity Bar">
      <div className="activity-bar-inner">
        <div className="activity-bar-top">
          {/* 0. Explorer / Files (Active indicator when sidebar is open) */}
          <ToolTip text={`Explorer (${isMac ? '⌘B' : 'Ctrl+B'})`} position="right">
            <button
              type="button"
              className={`activity-bar-btn ${isLeftSidebarOpen && activeActivityItem === 'files' ? 'active' : ''}`}
              onClick={handleToggleExplorer}
              aria-label="Explorer"
            >
              <Files size={16} />
            </button>
          </ToolTip>

          {/* 1. Lumina AI */}
          <ToolTip text={`Lumina AI (${isMac ? '⌘⇧\\' : 'Ctrl+Shift+\\'})`} position="right">
            <button
              type="button"
              className={`activity-bar-btn ${activeActivityItem === 'lumina' ? 'active' : ''}`}
              onClick={handleOpenLumina}
              aria-label="Lumina AI"
            >
              <MessageSquare size={16} />
            </button>
          </ToolTip>

          {/* 2. Daily Note */}
          <DailyNotes isActivityBar={true} />

          {/* 3. Terminal */}
          <ToolTip text={`Terminal (${isMac ? '⌘J' : 'Ctrl+J'})`} position="right">
            <button
              type="button"
              className={`activity-bar-btn ${isTerminalOpen && activeActivityItem === 'terminal' ? 'active' : ''}`}
              onClick={handleToggleTerminal}
              aria-label="Terminal"
            >
              <Terminal size={16} />
            </button>
          </ToolTip>

          {/* 4. Theme & Look-and-Feel Customizer */}
          <ToolTip text="Theme Settings" position="right">
            <button
              type="button"
              className={`activity-bar-btn ${isLeftSidebarOpen && activeActivityItem === 'theme' ? 'active' : ''}`}
              onClick={handleOpenTheme}
              aria-label="Theme Settings"
            >
              <Palette size={16} />
            </button>
          </ToolTip>
        </div>

        <div className="activity-bar-bottom">
          {/* Documentation */}
          <ToolTip text={`Documentation (${isMac ? '⌘D' : 'Ctrl+D'})`} position="right">
            <button
              type="button"
              className={`activity-bar-btn ${activeActivityItem === 'docs' ? 'active' : ''}`}
              onClick={handleOpenDocs}
              aria-label="Documentation"
            >
              <Book size={16} />
            </button>
          </ToolTip>

          {/* Communication & Capsule Mail Hub */}
          <ActivityBarMail />
        </div>
      </div>
    </aside>
  )
})

ActivityBar.displayName = 'ActivityBar'
export default ActivityBar
