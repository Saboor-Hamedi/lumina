import React, { memo } from 'react'
import { Plus, Network, MessageSquare, Calendar } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useVaultStore } from '../../../core/store/useVaultStore'

const SidebarHeader = memo(({ onToggleGraph, onToggleAIChat }) => {
  const { snippets, saveSnippet, setSelectedSnippet } = useVaultStore()

  const handleNewNote = () => {
    window.dispatchEvent(new CustomEvent('trigger-new-note'))
  }

  const handleDailyNote = async () => {
    const today = new Date().toISOString().split('T')[0]
    const title = today

    if (window.api?.createFolder) {
      try {
        await window.api.createFolder('DailyNotes')
      } catch (e) {
        // Ignore if already exists
      }
    }

    const existing = snippets.find(
      (s) => (s.title === title || s.title === `${today}.md`) && s.folderId === 'DailyNotes'
    )

    if (existing) {
      setSelectedSnippet(existing)
    } else {
      const newNote = {
        id: crypto.randomUUID(),
        title: title,
        code: `# ${today}\n\n`,
        language: 'markdown',
        folderId: 'DailyNotes',
        timestamp: Date.now()
      }
      await saveSnippet(newNote)
      setSelectedSnippet(newNote)
    }
  }

  return (
    <div className="sidebar-header-section">
      <button className="new-note-btn" onClick={handleNewNote}>
        <Plus size={14} /> New Note
      </button>
      <div className="sidebar-top-actions">
        <ToolTip text="Daily Note">
          <button className="sidebar-icon-btn" onClick={handleDailyNote}>
            <Calendar size={14} />
          </button>
        </ToolTip>
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
