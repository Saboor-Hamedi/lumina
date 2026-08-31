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
import ToolTip from '../../../components/atoms/ToolTip'

const EditorMenu = ({
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
  onExportText,
  onExportDocs,
  onInlineAI,
  onPreview
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

  // Close on Escape
  useEffect(() => {
    if (!showMoreMenu) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setShowMoreMenu(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
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
          {/* Inline AI removed per user request */}
          <ToolTip text="More Options (Ctrl+I)" position="bottom-right">
            <button
              className={`icon-btn menu-trigger ${showMoreMenu ? 'active' : ''}`}
              ref={buttonRef}
              onClick={(e) => {
                e.stopPropagation()
                setShowMoreMenu(!showMoreMenu)
              }}
            >
              <MoreVertical size={18} />
            </button>
          </ToolTip>

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
                    if (onPreview) onPreview()
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Preview Note</span>
                  <span className="shortcut-label">Ctrl+\</span>
                  <FileText size={12} className="menu-icon-right" />
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
                  <span className="menu-label">Copy as Plain Text</span>
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
                  <span className="menu-label">Copy as Web Code</span>
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
                          showToast('Failed to export markdown file', 'error')
                        }
                      }
                    } catch (error) {
                      console.error('Failed to export markdown file:', error)
                      showToast('Failed to export markdown file', 'error')
                    }
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Save as File (.md)</span>
                  <FileText size={12} className="menu-icon-right" />
                </div>
                <div
                  className="dropdown-item"
                  onClick={async () => {
                    try {
                      if (onExportText && typeof onExportText === 'function') {
                        const result = await onExportText()
                        if (result?.success) {
                          showToast('Text file exported successfully', 'success')
                        } else if (result?.canceled) {
                          // User canceled
                        } else {
                          showToast('Failed to export text file', 'error')
                        }
                      }
                    } catch (error) {
                      console.error('Failed to export text file:', error)
                      showToast('Failed to export text file', 'error')
                    }
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Save as Text (.txt)</span>
                  <FileType size={12} className="menu-icon-right" />
                </div>
                <div
                  className="dropdown-item"
                  onClick={async () => {
                    try {
                      if (onExportDocs && typeof onExportDocs === 'function') {
                        const result = await onExportDocs()
                        if (result?.success) {
                          showToast('HTML Doc exported successfully', 'success')
                        } else if (result?.canceled) {
                          // User canceled
                        } else {
                          showToast('Failed to export Docs', 'error')
                        }
                      }
                    } catch (error) {
                      console.error('Failed to export Docs:', error)
                      showToast('Failed to export Docs', 'error')
                    }
                    setShowMoreMenu(false)
                  }}
                >
                  <span className="menu-label">Save as Word Document</span>
                  <FileCode size={12} className="menu-icon-right" />
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

export default EditorMenu
