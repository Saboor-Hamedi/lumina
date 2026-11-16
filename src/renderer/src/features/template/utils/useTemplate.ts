import { useState, useMemo, useEffect, useCallback } from 'react'
import { defaultTemplates } from './defaultTemplates'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'

export interface TemplateItem {
  id: string
  title: string
  code: string
  description?: string
}

export interface UseTemplateOptions {
  templates?: Array<{
    id?: string
    title?: string
    code?: string
    description?: string
  }>
  onSelectTemplate?: (template: TemplateItem) => void
  onClose?: () => void
}

export interface UseTemplateReturn {
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedId: string
  setSelectedId: (id: string) => void
  allTemplates: TemplateItem[]
  filteredTemplates: TemplateItem[]
  selectedTemplate: TemplateItem
  handleApply: (templateToApply?: TemplateItem) => void
}

export const BLANK_TEMPLATE: TemplateItem = {
  id: 'blank',
  title: 'Blank Note',
  code: '',
  description: 'Start with a completely empty note. No predefined structure.'
}

/**
 * Create a collision-safe daily note inside `DailyNotes` from a template and open it.
 */
export async function createNoteFromTemplate(template: {
  id: string
  title: string
  code?: string
}): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const templateName = template.id === 'blank' ? 'Note' : template.title.replace(/\.md$/i, '')
  const baseTitle = `${today} - ${templateName}`

  const { notes, saveNote, setSelectedNote } = useWorkspaceStore.getState()
  const existingTitles = new Set(
    (notes || [])
      .filter((n) => (n.folderId || '') === 'DailyNotes')
      .map((n) => (n.title || '').toLowerCase())
  )

  let finalTitle = baseTitle
  let counter = 2
  while (existingTitles.has(finalTitle.toLowerCase())) {
    finalTitle = `${baseTitle} (${counter++})`
  }

  try {
    const currentExpanded = useSettingsStore.getState().settings.expandedFolders || []
    const arr = Array.isArray(currentExpanded) ? [...currentExpanded] : []
    if (!arr.includes('DailyNotes')) {
      arr.push('DailyNotes')
      useSettingsStore.getState().updateSetting('expandedFolders', arr)
    }
  } catch {
    // Ignore settings update errors
  }

  const newNote = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `daily-${Date.now()}`,
    title: finalTitle,
    fileName: `${finalTitle}.md`,
    code: `# ${finalTitle}\n\n${template.code || ''}`,
    language: 'markdown',
    tags: '',
    folderId: 'DailyNotes',
    timestamp: Date.now(),
    isPinned: false,
    isLearned: false
  }

  const savedNote = saveNote ? await saveNote(newNote as any) : newNote
  if (setSelectedNote) setSelectedNote((savedNote || newNote) as any)
}

export function useTemplate({
  templates: propTemplates,
  onSelectTemplate,
  onClose
}: UseTemplateOptions = {}): UseTemplateReturn {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState('blank')

  // Prepare all templates with blank note first
  const allTemplates = useMemo<TemplateItem[]>(() => {
    const list: TemplateItem[] =
      propTemplates && propTemplates.length > 0
        ? propTemplates.map((t, idx) => ({
            id: t.id || `template-${idx}`,
            title: (t.title || 'Untitled').replace(/\.md$/i, ''),
            code: t.code || '',
            description: t.description
          }))
        : defaultTemplates.map((t, idx) => ({
            id: `template-${idx}`,
            title: t.title.replace(/\.md$/i, ''),
            code: t.code
          }))

    const hasBlank = list.some((t) => t.id === 'blank')
    return hasBlank ? list : [BLANK_TEMPLATE, ...list]
  }, [propTemplates])

  // Filter templates by search query
  const filteredTemplates = useMemo<TemplateItem[]>(() => {
    if (!searchQuery.trim()) return allTemplates
    const query = searchQuery.toLowerCase().trim()
    return allTemplates.filter(
      (t) =>
        t.title?.toLowerCase().includes(query) ||
        (t.code && t.code.toLowerCase().includes(query))
    )
  }, [allTemplates, searchQuery])

  // Selected template object
  const selectedTemplate = useMemo<TemplateItem>(() => {
    return (
      filteredTemplates.find((t) => t.id === selectedId) ||
      filteredTemplates[0] ||
      BLANK_TEMPLATE
    )
  }, [filteredTemplates, selectedId])

  // If the currently selected template is filtered out, select the first available
  useEffect(() => {
    if (filteredTemplates.length > 0 && !filteredTemplates.some((t) => t.id === selectedId)) {
      setSelectedId(filteredTemplates[0].id)
    }
  }, [filteredTemplates, selectedId])

  const handleApply = useCallback(
    (templateToApply?: TemplateItem) => {
      const target = templateToApply || selectedTemplate
      if (target && onSelectTemplate) {
        onSelectTemplate(target)
      }
      if (onClose) {
        onClose()
      }
    },
    [selectedTemplate, onSelectTemplate, onClose]
  )

  return {
    searchQuery,
    setSearchQuery,
    selectedId,
    setSelectedId,
    allTemplates,
    filteredTemplates,
    selectedTemplate,
    handleApply
  }
}

export default useTemplate
