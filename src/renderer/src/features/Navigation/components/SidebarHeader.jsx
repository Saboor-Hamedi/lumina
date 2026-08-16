import React, { memo } from 'react'
import { Plus, Network, MessageSquare, Calendar } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { useShallow } from 'zustand/react/shallow'

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
    <div className="sidebar-header-section" style={{ gap: '4px', justifyContent: 'space-between', display: 'flex' }}>
      <button className="new-note-btn" onClick={handleNewNote} style={{ flex: 1, padding: '4px', minWidth: 0, justifyContent: 'center' }}>
        <Plus size={14} style={{ flexShrink: 0 }} /> 
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>New</span>
      </button>
      <button className="new-note-btn" onClick={handleDailyNote} style={{ flex: 1, padding: '4px', minWidth: 0, justifyContent: 'center' }}>
        <Calendar size={14} style={{ flexShrink: 0 }} /> 
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Daily</span>
      </button>
      <button className="new-note-btn" onClick={onToggleGraph} style={{ flex: 1, padding: '4px', minWidth: 0, justifyContent: 'center' }}>
        <Network size={14} style={{ flexShrink: 0 }} /> 
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Graph</span>
      </button>
    </div>
  )
})

SidebarHeader.displayName = 'SidebarHeader'

export default SidebarHeader
