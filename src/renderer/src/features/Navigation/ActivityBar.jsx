import React, { memo } from 'react'
import { Plus, Network, LayoutDashboard, MessageSquare, Palette } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import DailyNotes from './components/DailyNotes'
import ActivityBarMail from './components/ActivityBarMail'
import './css/activitybar.css'

export const ActivityBar = memo(({
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
        {/* 1 New Note */}
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

        {/* 2 Daily Note */}
        <DailyNotes isActivityBar={true} />

        {/* 3 Knowledge Graph */}
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

        {/* 4 Canvas button */}
        <ToolTip text="New Canvas" position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={handleNewCanvas}
            aria-label="New Canvas"
          >
            <LayoutDashboard size={16} />
          </button>
        </ToolTip>

        {/* 5 AI Chat icon */}
        <ToolTip
          text={isMac ? 'Toggle AI Chat (⌘ + Shift + \\)' : 'Toggle AI Chat (Ctrl + Shift + \\)'}
          position="right"
        >
          <button
            type="button"
            className="activity-bar-btn"
            onClick={handleToggleAIChat}
            aria-label="Toggle AI Chat"
          >
            <MessageSquare size={16} />
          </button>
        </ToolTip>

        {/* 6 Gmail icon */}
        <ActivityBarMail />

        {/* 7 Theme & Appearance */}
        <ToolTip text="Themes & Appearance" position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={handleOpenTheme}
            aria-label="Themes & Appearance"
          >
            <Palette size={16} />
          </button>
        </ToolTip>
      </div>
    </aside>

  )
})

ActivityBar.displayName = 'ActivityBar'
export default ActivityBar
