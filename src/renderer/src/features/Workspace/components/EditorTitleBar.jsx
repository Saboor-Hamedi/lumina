import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Save,
  Sidebar,
  ChevronRight, // Ensure this matches lucide version, or stick to provided
  Hash,
  FileCode,
  FileJson,
  FileType,
  MoreVertical,
  Copy,
  Printer,
  Zap,
  FileText,
  Loader2
} from 'lucide-react'
import { useToast } from '../../../core/hooks/useToast'
import ToastNotification from '../../../core/notification'

const EditorTitleBar = ({
  title,
  snippet,
  setSelectedSnippet,
  isDirty,
  isSaving = false,
  viewMode,
  setViewMode,
  onSave,
  onToggleInspector,
  onExportHTML,
  onExportPDF,
  onExportMarkdown,
  onInlineAI
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const { toast, showToast, clearToast } = useToast()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showMoreMenu &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowMoreMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [showMoreMenu])

  // Calculate menu position when it opens
  useEffect(() => {
    if (showMoreMenu && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: buttonRect.bottom + 8,
        right: window.innerWidth - buttonRect.right
      })
    }
  }, [showMoreMenu])

  return (
    <div className="editor-titlebar">
      <div className="editor-controls">
        <div className="menu-container">
          <button
            className={`icon-btn menu-trigger ${showMoreMenu ? 'active' : ''}`}
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation()
              setShowMoreMenu(!showMoreMenu)
            }}
            title="More Options (Ctrl+I)"
          >
            <MoreVertical size={18} />
          </button>

          {showMoreMenu &&
            createPortal(
              <div
                className="native-dropdown-menu"
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  top: `${menuPosition.top}px`,
                  right: `${menuPosition.right}px`
                }}
              >
                <div
                  className="dropdown-item"
                  onClick={() => {
                    onSave()
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Save File</span>
                  <span className="shortcut-label">Ctrl+S</span>
                  <Save size={12} className="menu-icon-right" />
                </div>
                <div className="dropdown-divider" />
                <div
                  className="dropdown-item"
                  onClick={async () => {
                    try {
                      if (snippet?.code) {
                        await navigator.clipboard.writeText(snippet.code)
                        showToast('Markdown copied to clipboard', 'success')
                      }
                    } catch (error) {
                      console.error('Failed to copy markdown:', error)
                      showToast('Failed to copy markdown', 'error')
                    }
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Copy Raw Markdown</span>
                  <Copy size={12} className="menu-icon-right" />
                </div>
                <div
                  className="dropdown-item"
                  onClick={async () => {
                    try {
                      if (onExportHTML && typeof onExportHTML === 'function') {
                        await onExportHTML()
                        showToast('HTML copied to clipboard', 'success')
                      }
                    } catch (error) {
                      console.error('Failed to export HTML:', error)
                      showToast('Failed to export HTML', 'error')
                    }
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Copy HTML Code</span>
                  <FileCode size={12} className="menu-icon-right" />
                </div>
                <div
                  className="dropdown-item"
                  onClick={async () => {
                    try {
                      if (onExportPDF && typeof onExportPDF === 'function') {
                        const result = await onExportPDF()
                        if (result?.success) {
                          showToast('PDF exported successfully', 'success')
                        } else if (result?.canceled) {
                          // User canceled, no notification needed
                        } else {
                          showToast('Failed to export PDF', 'error')
                        }
                      }
                    } catch (error) {
                      console.error('Failed to export PDF:', error)
                      showToast('Failed to export PDF', 'error')
                    }
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Export to PDF</span>
                  <Printer size={12} className="menu-icon-right" />
                </div>
                <div
                  className="dropdown-item"
                  onClick={async () => {
                    try {
                      if (onExportMarkdown && typeof onExportMarkdown === 'function') {
                        const result = await onExportMarkdown()
                        if (result?.success) {
                          showToast('Markdown file exported successfully', 'success')
                        } else if (result?.canceled) {
                          // User canceled, no notification needed
                        } else {
                          showToast('Failed to export markdown', 'error')
                        }
                      }
                    } catch (error) {
                      console.error('Failed to export markdown:', error)
                      showToast('Failed to export markdown', 'error')
                    }
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Export as Markdown</span>
                  <FileText size={12} className="menu-icon-right" />
                </div>
                <div className="dropdown-divider" />
                <div
                  className="dropdown-item"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowMoreMenu(false)
                    // Use setTimeout to ensure menu closes before opening modal
                    setTimeout(() => {
                      if (onInlineAI) {
                        onInlineAI()
                      }
                    }, 0)
                  }}
                >
                  <span className="menu-label">Inline AI</span>
                  <span className="shortcut-label">Ctrl+K</span>
                  <Zap size={12} className="menu-icon-right" />
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    onToggleInspector()
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Toggle Inspector</span>
                  <span className="shortcut-label">Ctrl+I</span>
                  <Sidebar size={12} className="menu-icon-right" />
                </div>
                <div className="dropdown-divider" />
                <div
                  className="dropdown-item"
                  onClick={() => {
                    // Trigger details modal via custom event
                    window.dispatchEvent(new CustomEvent('open-details-modal'))
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Show Details</span>
                  <FileText size={12} className="menu-icon-right" />
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>
      <ToastNotification toast={toast} onClose={clearToast} />
    </div>
  )
}

export default EditorTitleBar
