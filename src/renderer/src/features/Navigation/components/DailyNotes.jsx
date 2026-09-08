import React, { memo, useState, useMemo } from 'react'
import { Calendar } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useVaultStore } from '../../../core/store/workspaceStore'
import Template from '../../template/Template'
import { defaultTemplates } from './defaultTemplates'

const DailyNotes = memo(() => {
  const saveSnippet = useVaultStore((state) => state.saveSnippet)
  const setSelectedSnippet = useVaultStore((state) => state.setSelectedSnippet)

  const [isModalOpen, setIsModalOpen] = useState(false)

  const virtualTemplates = useMemo(() => {
    return defaultTemplates.map((t, idx) => ({
      id: `template-${idx}`,
      title: t.title.replace(/\.md$/i, ''),
      code: t.code
    }))
  }, [])

  const getTodayTitle = () => {
    return new Date().toISOString().split('T')[0]
  }

  const handleDailyNote = () => {
    setIsModalOpen(true)
  }

  const handleSelectTemplate = async (template) => {
    const today = getTodayTitle()
    const templateName = template.id === 'blank' ? 'Note' : template.title.replace(/\.md$/i, '')
    const finalTitle = `${today} - ${templateName}`

    if (window.api?.createFolder) {
      try {
        await window.api.createFolder('DailyNotes')
      } catch (e) {
      }
    }

    try {
      const cached = localStorage.getItem('lumina-expanded-folders')
      let arr = cached ? JSON.parse(cached) : []
      if (!Array.isArray(arr)) arr = []
      if (!arr.includes('DailyNotes')) {
        arr.push('DailyNotes')
        localStorage.setItem('lumina-expanded-folders', JSON.stringify(arr))
        useSettingsStore.getState().updateSetting('expandedFolders', arr)
      }
    } catch (e) {}

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
        <Template
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          templates={virtualTemplates}
          onSelectTemplate={handleSelectTemplate}
        />
      )}
    </>
  )
})

DailyNotes.displayName = 'DailyNotes'

export default DailyNotes
