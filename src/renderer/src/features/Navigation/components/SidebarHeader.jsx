import React, { memo } from 'react'
import { Plus, Network, MessageSquare, Calendar } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { useShallow } from 'zustand/react/shallow'
import DailyNotes from './DailyNotes'

const SidebarHeader = memo(({ onToggleGraph }) => {
  const { snippets, saveSnippet, setSelectedSnippet } = useVaultStore(
    useShallow((state) => ({
      snippets: state.snippets,
      saveSnippet: state.saveSnippet,
      setSelectedSnippet: state.setSelectedSnippet
    }))
  )

  const handleNewNote = () => {
    window.dispatchEvent(new CustomEvent('trigger-new-note'))
  }

  return (
    <div
      className="sidebar-header-section"
      style={{ gap: '4px', justifyContent: 'space-between', display: 'flex' }}
    >
      <button
        className="new-note-btn"
        onClick={handleNewNote}
        style={{ flex: 1, padding: '4px', minWidth: 0, justifyContent: 'center' }}
      >
        <Plus size={14} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          New
        </span>
      </button>
      <DailyNotes />
      <button
        className="new-note-btn graph-header-btn"
        onClick={onToggleGraph}
        style={{ flex: 1, padding: '4px', minWidth: 0, justifyContent: 'center' }}
      >
        <Network size={14} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Graph
        </span>
      </button>
    </div>
  )
})

SidebarHeader.displayName = 'SidebarHeader'

export default SidebarHeader
