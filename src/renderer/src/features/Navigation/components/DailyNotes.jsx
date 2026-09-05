import React, { memo, useState } from 'react'
import { Calendar } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useVaultStore } from '../../../core/store/workspaceStore'
import { useShallow } from 'zustand/react/shallow'
import TemplateModal from './TemplateModal'
import { defaultTemplates } from './defaultTemplates'

const DailyNotes = memo(() => {
  const { snippets, saveSnippet, setSelectedSnippet } = useVaultStore(
    useShallow((state) => ({
      snippets: state.snippets,
      saveSnippet: state.saveSnippet,
      setSelectedSnippet: state.setSelectedSnippet
    }))
  )

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [templates, setTemplates] = useState([])

  const getTodayTitle = () => {
    return new Date().toISOString().split('T')[0]
  }

  const seedTemplates = async () => {
    if (window.api?.createFolder) {
      try {
        await window.api.createFolder('Templates')
      } catch (e) {
        // Ignore if exists
      }
    }

    for (const t of defaultTemplates) {
      const exists = snippets.find((s) => s.folderId === 'Templates' && s.title === t.title)
      if (!exists) {
        const newSnippet = {
          id: crypto.randomUUID(),
          title: t.title,
          code: t.code,
          language: 'markdown',
          folderId: 'Templates',
          timestamp: Date.now()
        }
        await saveSnippet(newSnippet)
      }
    }
  }

  const handleDailyNote = async () => {
    // Skip heavy IPC checks if all templates are already seeded
    const currentTemplates = useVaultStore
      .getState()
      .snippets.filter((s) => s.folderId === 'Templates')
    if (currentTemplates.length < defaultTemplates.length) {
      await seedTemplates()
    }

    // Update template list and open modal
    setTemplates(useVaultStore.getState().snippets.filter((s) => s.folderId === 'Templates'))
    setIsModalOpen(true)
  }

  const handleSelectTemplate = async (template) => {
    const today = getTodayTitle()
    const templateName = template.id === 'blank' ? 'Note' : template.title.replace('.md', '')
    const finalTitle = `${today} - ${templateName}`

    if (window.api?.createFolder) {
      try {
        await window.api.createFolder('DailyNotes')
      } catch (e) {
        // Ignore
      }
    }

    const newNote = {
      id: crypto.randomUUID(),
      title: finalTitle,
      code: `# ${finalTitle}\n\n${template.code || ''}`,
      language: 'markdown',
      folderId: 'DailyNotes',
      timestamp: Date.now()
    }
    await saveSnippet(newNote)
    setSelectedSnippet(newNote)
  }

  return (
    <>
      <ToolTip text="Daily Note" position="bottom">
        <button
          className="new-note-btn"
          onClick={handleDailyNote}
          style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
        >
          <Calendar size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Daily
          </span>
        </button>
      </ToolTip>

      {isModalOpen && (
        <TemplateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          templates={templates}
          onSelectTemplate={handleSelectTemplate}
        />
      )}
    </>
  )
})

DailyNotes.displayName = 'DailyNotes'

export default DailyNotes
