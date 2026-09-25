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
 *     3. Knowledge Graph 2D/3D visualization modal
 *     4. Infinite Canvas workspace (`trigger-new-canvas` event dispatch)
 *     5. AI Chat assistant docking & floating modal toggler
 *     6. Theme Customization & look-and-feel preferences modal
 *     7. Integrated Mail / Capsule communication notifications
 * - 100% TypeScript with strict memoization (`React.memo`) to avoid unneeded re-renders.
 */

import React, { memo } from 'react'
import { Plus, Network, LayoutDashboard, MessageSquare, Palette } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import DailyNotes from './components/DailyNotes'
import ActivityBarMail from './components/ActivityBarMail'
import './css/activitybar.css'

export interface ActivityBarProps {
  onToggleGraph?: () => void
  onOpenTheme?: () => void
}

export const ActivityBar: React.FC<ActivityBarProps> = memo(({
  onToggleGraph,
  onOpenTheme
}) => {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

  const handleOpenTheme = () => {
    if (onOpenTheme) {
      onOpenTheme()
    } else {
      window.dispatchEvent(new CustomEvent('open-theme-modal'))
    }
  }

  const handleNewNote = () => {
    window.dispatchEvent(new CustomEvent('trigger-new-note'))
  }

  const handleNewCanvas = () => {
    window.dispatchEvent(new CustomEvent('trigger-new-canvas'))
  }

  const handleToggleAIChat = () => {
    window.dispatchEvent(new CustomEvent('open-ai-chat'))
  }

  return (
    <aside className="lumina-activity-bar" data-testid="activity-bar" aria-label="Activity Bar">
      <div className="activity-bar-top">
        {/* 1. New Note */}
        <ToolTip text="New Note" position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={handleNewNote}
            aria-label="New Note"
          >
            <Plus size={16} />
          </button>
        </ToolTip>

        {/* 2. Daily Note */}
        <DailyNotes isActivityBar={true} />

        {/* 3. Knowledge Graph */}
        <ToolTip text="Knowledge Graph" position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={onToggleGraph}
            aria-label="Knowledge Graph"
          >
            <Network size={16} />
          </button>
        </ToolTip>

        {/* 4. Infinite Canvas */}
        <ToolTip text="Infinite Canvas" position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={handleNewCanvas}
            aria-label="Infinite Canvas"
          >
            <LayoutDashboard size={16} />
          </button>
        </ToolTip>

        {/* 5. Lumina AI Assistant */}
        <ToolTip text={`AI Chat (${isMac ? '⌘J' : 'Ctrl+J'})`} position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={handleToggleAIChat}
            aria-label="AI Chat"
          >
            <MessageSquare size={16} />
          </button>
        </ToolTip>

        {/* 6. Theme & Look-and-Feel Customizer */}
        <ToolTip text="Theme Settings" position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={handleOpenTheme}
            aria-label="Theme Settings"
          >
            <Palette size={16} />
          </button>
        </ToolTip>
      </div>

      <div className="activity-bar-bottom">
        {/* 7. Communication & Capsule Mail Hub */}
        <ActivityBarMail />
      </div>
    </aside>
  )
})

ActivityBar.displayName = 'ActivityBar'
export default ActivityBar
