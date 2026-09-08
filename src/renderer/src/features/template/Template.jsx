import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LayoutTemplate, PanelLeftClose, PanelLeftOpen, Square, Copy, X, Check } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import TemplateSidebar from './TemplateSidebar'
import TemplateContent from './TemplateContent'
import useTemplate from './hooks/useTemplate'
import '../modals/css/guide.css'
import '../preview/preview.css'
import './css/template.css'

const Template = ({
  isOpen = false,
  onClose = () => {},
  templates,
  onSelectTemplate = () => {}
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)

  const containerRef = useRef(null)

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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      // If typing in search input, don't hijack up/down unless necessary
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'

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
        if (!isInput || e.target.classList.contains('template-search-input')) {
          e.preventDefault()
          handleApply()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [isOpen, onClose, filteredTemplates, selectedId, handleApply, setSelectedId])

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev)
  }, [])

  if (!isOpen) return null

  return createPortal(
    <div className="guide-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`template-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="template-modal-header"
          style={{ cursor: 'default' }}
        >
          <div className="template-header-left">
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                className="template-sidebar-toggle-btn"
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
            <div className="guide-logo-badge">
              <LayoutTemplate size={15} />
            </div>
            <div className="guide-header-title">Templates</div>
            {selectedTemplate && (
              <div className="guide-step-counter template-header-active-pill">
                {selectedTemplate.title}
              </div>
            )}
          </div>

          <div className="template-header-right">
            <button
              className="template-header-apply-btn"
              onClick={() => handleApply(selectedTemplate)}
              aria-label="Use selected template"
            >
              <Check size={13} strokeWidth={2.5} />
              <span>Use Template</span>
            </button>
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                className="template-window-btn"
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
                className="guide-close-btn"
                onClick={onClose}
                aria-label="Close Templates (Esc)"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Content Container */}
        <div className={`template-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
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
