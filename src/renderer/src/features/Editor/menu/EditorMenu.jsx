import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  MoreVertical,
  Copy,
  FileText,
  Download
} from 'lucide-react'
import { useToast } from '../../../core/notification'
import ToastNotification from '../../../core/notification'
import ToolTip from '../../../components/atoms/ToolTip'

const EditorMenu = ({
  title,
  snippet,
  setSelectedSnippet,
  isDirty,
  isSaving = false,
  onSave,
  onToggleInspector,
  onInlineAI,
  onPreview,
  onOpenExportDialog
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

  useEffect(() => {
    if (showMoreMenu && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: buttonRect.bottom + 6,
        right: Math.max(8, window.innerWidth - buttonRect.right)
      })
    }
  }, [showMoreMenu])

  useEffect(() => {
    if (!showMoreMenu) return
    const handleResize = () => setShowMoreMenu(false)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [showMoreMenu])

  return (
    <div className="editor-titlebar" style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', top: 'auto', right: 'auto', zIndex: 20 }}>
      <div className="editor-controls" style={{ margin: 0, gap: 0 }}>
        <div className="menu-container">
          <ToolTip text="More Options (Ctrl+I)" position="bottom-right">
            <button
              className={`icon-btn menu-trigger ${showMoreMenu ? 'active' : ''}`}
              ref={buttonRef}
              onClick={(e) => {
                e.stopPropagation()
                setShowMoreMenu(!showMoreMenu)
              }}
              style={{
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: showMoreMenu ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: 0,
                cursor: 'pointer',
                color: showMoreMenu ? 'var(--text-main, #f8fafc)' : 'var(--text-muted, #94a3b8)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-main, #f8fafc)'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
              }}
              onMouseLeave={(e) => {
                if (!showMoreMenu) {
                  e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <MoreVertical size={16} />
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
                  onClick={() => {
                    setShowMoreMenu(false)
                    if (onOpenExportDialog) onOpenExportDialog()
                  }}
                >
                  <span className="menu-label">Export with Preview…</span>
                  <Download size={12} className="menu-icon-right" />
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
