import React, { memo } from 'react'
import { Plus, Network, MessageSquare } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useVaultStore } from '../../../core/store/useVaultStore'

const SidebarHeader = memo(({ onToggleGraph, onToggleAIChat }) => {
  const { saveSnippet, setSelectedSnippet } = useVaultStore()

  const handleNewNote = () => {
    window.dispatchEvent(new CustomEvent('trigger-new-note'))
  }

  return (
    <div className="sidebar-header-section">
      <button className="new-note-btn" onClick={handleNewNote}>
        <Plus size={14} /> New Note
      </button>
      <div className="sidebar-top-actions">
        <ToolTip text="Graph View (Ctrl+G)">
          <button className="sidebar-icon-btn" onClick={onToggleGraph}>
            <Network size={14} />
          </button>
        </ToolTip>
        <ToolTip text="AI Chat">
          <button className="sidebar-icon-btn" onClick={onToggleAIChat}>
            <MessageSquare size={14} />
          </button>
        </ToolTip>
      </div>
    </div>
  )
})

SidebarHeader.displayName = 'SidebarHeader'

export default SidebarHeader
