import { useState, useMemo, useEffect, useCallback } from 'react'
import { defaultTemplates } from './defaultTemplates'

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
