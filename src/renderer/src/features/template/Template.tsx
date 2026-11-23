import React, { useRef, useCallback, useEffect, useDeferredValue, memo } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutTemplate,
  FileText,
  Calendar,
  CheckSquare,
  Table,
  X,
  Check
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { SearchInput } from '../../ui'
import useTemplate, {
  createNoteFromTemplate,
  type TemplateItem
} from './utils/useTemplate'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { PreviewCommandPalette } from '../commandpalette'
import './css/template.css'

export interface TemplateProps {
  isOpen?: boolean
  isEmbedded?: boolean
  onClose?: () => void
  templates?: TemplateItem[]
  onSelectTemplate?: (template: TemplateItem) => void
}

interface TemplateRowProps {
  template: TemplateItem
  isActive: boolean
  onSelect: (id: string) => void
  onApply: (template: TemplateItem) => void
}

const getTemplateIcon = (id: string, title: string) => {
  const t = (title || '').toLowerCase()
  if (id === 'blank') return FileText
  if (t.includes('daily') || t.includes('calendar') || t.includes('journal')) return Calendar
  if (t.includes('todo') || t.includes('task') || t.includes('check')) return CheckSquare
  if (t.includes('project') || t.includes('table') || t.includes('tracker') || t.includes('matrix'))
    return Table
  return LayoutTemplate
}

const getTemplateCategory = (id: string, title: string): string => {
  if (id === 'blank') return 'Blank'
  const t = (title || '').toLowerCase()
  if (t.includes('daily')) return 'Daily'
  if (t.includes('meeting') || t.includes('interview')) return 'Meeting'
  if (t.includes('project') || t.includes('tracker')) return 'Project'
  if (t.includes('weekly')) return 'Weekly'
  return 'Doc'
}

const TemplateRow: React.FC<TemplateRowProps> = memo(
  ({ template, isActive, onSelect, onApply }) => {
    const Icon = getTemplateIcon(template.id, template.title)
    const category = getTemplateCategory(template.id, template.title)

    return (
      <div
        data-template-id={template.id}
        className={`lumina-drawer-item ${isActive ? 'active' : ''}`}
        onClick={() => onSelect(template.id)}
        onDoubleClick={() => onApply(template)}
        role="button"
        tabIndex={0}
        title={`${template.title} (Click to preview, Double-click to apply)`}
      >
        <div className="lumina-drawer-item-icon">
          <Icon size={14} />
        </div>
        <span className="lumina-drawer-item-label">{template.title}</span>
        <div className="lumina-drawer-item-meta">
          <span className="template-drawer-badge">{category}</span>
          {isActive && <Check size={13} strokeWidth={2.5} style={{ color: 'var(--text-accent)' }} />}
        </div>
      </div>
    )
  }
)

TemplateRow.displayName = 'TemplateRow'

export const Template: React.FC<TemplateProps> = ({
  isOpen = false,
  isEmbedded = false,
  onClose = () => {},
  templates,
  onSelectTemplate
}) => {
  const listRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const {
    searchQuery,
    setSearchQuery,
    selectedId,
    setSelectedId,
    filteredTemplates,
    selectedTemplate,
    handleApply
  } = useTemplate({
    templates,
    onSelectTemplate: onSelectTemplate || createNoteFromTemplate,
    onClose: isEmbedded ? undefined : onClose
  })

  // Esc key closes standalone drawer only (never the docked left sidebar)
  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen && !isEmbedded && onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  // Scroll active item into view on open
  useEffect(() => {
    if (!isOpen) return
    setTimeout(() => {
      const container = listRef.current
      if (!container) return
      const activeItem = container.querySelector<HTMLElement>('.lumina-drawer-item.active')
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' })
      }
    }, 50)
  }, [isOpen])

  const scrollToItem = useCallback((idx: number) => {
    const container = listRef.current
    if (!container) return
    const el = container.children[idx] as HTMLElement | undefined
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [])

  // Latest values in refs so the keydown listener is bound once per open
  const navRef = useRef({ filteredTemplates, selectedId, handleApply })
  navRef.current = { filteredTemplates, selectedId, handleApply }

  // Keyboard navigation (↑/↓ to move, Enter to apply)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const { filteredTemplates: list, selectedId: current, handleApply: apply } = navRef.current
      const target = e.target as HTMLElement | null
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (list.length === 0) return
        e.preventDefault()
        const idx = list.findIndex((t) => t.id === current)
        const base = idx === -1 ? 0 : idx
        const next =
          e.key === 'ArrowDown' ? Math.min(list.length - 1, base + 1) : Math.max(0, base - 1)
        setSelectedId(list[next].id)
        scrollToItem(next)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        apply()
      } else if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setSelectedId, scrollToItem])

  // Defer the heavy rich-markdown preview so list navigation stays instant
  const deferredPreview = useDeferredValue(selectedTemplate)

  // Stable apply callback so memoized rows don't re-render on every selection change
  const stableApply = useCallback(
    (t: TemplateItem) => navRef.current.handleApply(t),
    []
  )

  if (!isOpen && !isEmbedded) return null

  const content = (
    <div className="lumina-sidebar-pane template-sidebar-pane">
      {/* Sidebar Header */}
      <div className="lumina-drawer-header">
        <div className="lumina-drawer-header-left">
          <LayoutTemplate size={14} className="lumina-drawer-header-icon" />
          <span className="lumina-drawer-title">Templates</span>
          <span className="lumina-drawer-badge">{filteredTemplates.length}</span>
        </div>

        <div className="lumina-drawer-header-right">
          <ToolTip text="Close" position="bottom">
            <button
              type="button"
              className="lumina-drawer-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </ToolTip>
        </div>
      </div>

      {/* Search Bar */}
      <SearchInput
        ref={searchInputRef}
        placeholder="Search templates..."
        value={searchQuery}
        onChange={setSearchQuery}
        autoFocus
      />

      {/* Template List */}
      <div ref={listRef} className="lumina-drawer-list template-sidebar-list">
        {filteredTemplates.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            isActive={template.id === selectedId}
            onSelect={setSelectedId}
            onApply={stableApply}
          />
        ))}

        {filteredTemplates.length === 0 && (
          <div className="lumina-drawer-empty">
            No templates found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Built-in Rich Markdown Template Preview + Apply Button */}
      <div className="template-sidebar-preview-pane">
        <div className="template-sidebar-preview-header">
          <span className="template-sidebar-preview-title" title={selectedTemplate.title}>
            {selectedTemplate.title}
          </span>
          <button
            type="button"
            className="template-sidebar-apply-btn"
            onClick={() => handleApply(selectedTemplate)}
          >
            <Check size={12} strokeWidth={2.5} />
            <span>Apply</span>
          </button>
        </div>

        <div className="template-sidebar-preview-body">
          {deferredPreview.id === 'blank' || !deferredPreview.code?.trim() ? (
            <div className="template-sidebar-blank-preview">
              <FileText size={22} className="template-blank-preview-icon" />
              <span className="template-blank-preview-text">
                Start with a clean, empty note.
              </span>
            </div>
          ) : isOpen ? (
            <div className="template-sidebar-rich-preview">
              <PreviewCommandPalette content={deferredPreview.code} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  if (isEmbedded) {
    return content
  }

  return createPortal(
    <div className="lumina-side-drawer-overlay" onClick={onClose}>
      <div
        className="lumina-side-drawer-panel template-side-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>,
    document.body
  )
}

export default React.memo(Template)
