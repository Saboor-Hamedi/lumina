import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PanelLeftClose, PanelLeftOpen, Square, Copy, X, Check } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import TemplateSidebar from './TemplateSidebar'
import TemplateContent from './TemplateContent'
import useTemplate from './hooks/useTemplate'
import { useSettingsStore } from '../../core/store/SettingStore'
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
  const isMaximized = useSettingsStore((s) => s.settings.templateModalMaximized ?? false)

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
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ templateModalMaximized: !(settings.templateModalMaximized ?? false) })
  }, [])

  if (!isOpen) return null

  return createPortal(
    <div className="guide-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`template-modal-container modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          flexDirection: 'column',
          width: isMaximized ? '100vw' : '900px',
          height: isMaximized ? '100vh' : '76vh',
          maxWidth: isMaximized ? 'none' : '94vw',
          minHeight: isMaximized ? 'none' : '480px',
          maxHeight: isMaximized ? 'none' : '78vh',
          transform: isMaximized ? 'none' : 'translate3d(0px, 0px, 0px)',
          transition: '0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: 'rgba(0, 0, 0, 0.6) 0px 30px 60px',
          overflow: 'hidden',
          borderRadius: isMaximized ? '0' : '12px'
        }}
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
          </div>

          <div className="template-header-right">
            <button
              className="template-header-apply-btn"
              onClick={() => handleApply(selectedTemplate)}
              aria-label="Apply template"
            >
              <Check size={12} strokeWidth={2.5} />
              <span>Apply</span>
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
                className="template-window-btn"
                onClick={onClose}
                aria-label="Close Templates (Esc)"
              >
                <X size={15} />
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
