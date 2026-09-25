import React, { memo } from 'react'
import { Plus, Network } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import DailyNotes from './DailyNotes'

export interface SidebarHeaderProps {
  onToggleGraph?: () => void
}

const SidebarHeader: React.FC<SidebarHeaderProps> = memo(({ onToggleGraph }) => {
  const handleNewNote = () => {
    window.dispatchEvent(new CustomEvent('trigger-new-note'))
  }

  return (
    <div
      className="sidebar-header-section"
      style={{ gap: '4px', justifyContent: 'space-between', display: 'flex' }}
    >
      <ToolTip text="New Note" position="bottom">
        <button
          className="new-note-btn"
          onClick={handleNewNote}
          style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
        >
          <Plus size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            New
          </span>
        </button>
      </ToolTip>
      <DailyNotes />
      <ToolTip text="Local Graph View" position="bottom">
        <button
          className="new-note-btn graph-header-btn"
          onClick={onToggleGraph}
          style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
        >
          <Network size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Graph
          </span>
        </button>
      </ToolTip>
    </div>
  )
})

SidebarHeader.displayName = 'SidebarHeader'

export default SidebarHeader
