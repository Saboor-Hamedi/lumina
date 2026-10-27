import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PanelLeftClose, PanelLeftOpen, Square, Copy, X, Check } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import TemplateSidebar from './TemplateSidebar'
import TemplateContent from './TemplateContent'
import useTemplate, { type TemplateItem } from './utils/useTemplate'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import '../modals/css/guide.css'
import '../Docs/Documentation.css'
import '../preview/preview.css'
import './css/template.css'

export interface TemplateProps {
  isOpen?: boolean
  onClose?: () => void
  templates?: TemplateItem[]
  onSelectTemplate?: (template: TemplateItem) => void
}

export const Template: React.FC<TemplateProps> = ({
  isOpen = false,
  onClose = () => {},
  templates,
  onSelectTemplate = () => {}
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMaximized = useSettingsStore((s: any) => s.settings?.templateModalMaximized ?? false)

  const containerRef = useRef<HTMLDivElement | null>(null)

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
    onSelectTemplate,
    onClose
  })

  // Esc key closes modal cleanly via Lumina's global shortcut manager
  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen && onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = filteredTemplates.findIndex((t) => t.id === selectedId)
        const nextIndex = Math.min(filteredTemplates.length - 1, (currentIndex === -1 ? 0 : currentIndex) + 1)
        if (filteredTemplates[nextIndex]) {
          setSelectedId(filteredTemplates[nextIndex].id)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIndex = filteredTemplates.findIndex((t) => t.id === selectedId)
        const prevIndex = Math.max(0, (currentIndex === -1 ? 0 : currentIndex) - 1)
        if (filteredTemplates[prevIndex]) {
          setSelectedId(filteredTemplates[prevIndex].id)
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (!isInput || target?.classList.contains('template-search-input')) {
          e.preventDefault()
          handleApply()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, filteredTemplates, selectedId, handleApply, setSelectedId])

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState() as any
    updateSettings({ templateModalMaximized: !(settings?.templateModalMaximized ?? false) })
  }, [])

  if (!isOpen) return null

  return createPortal(
    <div className="guide-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`docs-modal-container template-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - exactly identical to Documentation / mother modal */}
        <div
          className="docs-modal-header template-modal-header"
          onDoubleClick={handleToggleMaximize}
          style={{ cursor: 'default' }}
        >
          <div className="docs-header-left template-header-left">
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                type="button"
                className="docs-sidebar-toggle-btn template-sidebar-toggle-btn"
                onClick={handleToggleSidebar}
                aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={15} strokeWidth={2} />
                ) : (
                  <PanelLeftOpen size={15} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <span
              className="template-header-title"
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                color: 'var(--text-main)',
                letterSpacing: '-0.01em',
                background: 'transparent',
                padding: 0
              }}
            >
              Templates
            </span>
            {selectedTemplate && (
              <>
                <span style={{ opacity: 0.35, color: 'var(--text-muted)', fontSize: '12px' }}>/</span>
                <span
                  className="template-header-active-pill"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 400,
                    color: 'var(--text-muted)',
                    maxWidth: '240px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: 'transparent',
                    padding: 0
                  }}
                  title={selectedTemplate?.title?.replace(/\.md$/, '')}
                >
                  {selectedTemplate?.title?.replace(/\.md$/, '') || 'Blank Note'}
                </span>
              </>
            )}
          </div>

          <div className="docs-header-right template-header-right">
            <button
              type="button"
              className="template-header-apply-btn"
              onClick={() => handleApply(selectedTemplate)}
              aria-label="Use selected template"
            >
              <Check size={12} strokeWidth={2.5} />
              <span>Apply</span>
            </button>
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                type="button"
                className="docs-window-btn template-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} strokeWidth={2} />
                ) : (
                  <Square size={13} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                type="button"
                className="guide-close-btn"
                onClick={onClose}
                aria-label="Close Templates (Esc)"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Content Container: Flat Docked Sidebar + Content */}
        <div className={`docs-container template-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <TemplateSidebar
            templates={filteredTemplates}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onApply={handleApply}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isOpen={isSidebarOpen}
          />

          <TemplateContent
            template={selectedTemplate}
            onApply={handleApply}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}

export default React.memo(Template)
