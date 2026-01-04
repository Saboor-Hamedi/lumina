import React, { useRef, useState, useEffect } from 'react'
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
  Printer
} from 'lucide-react'

const EditorTitleBar = ({
  title,
  snippet,
  setSelectedSnippet,
  isDirty,
  viewMode,
  setViewMode,
  onSave,
  onToggleInspector,
  onExportHTML,
  onExportPDF
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)

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

  return (
    <div className="editor-titlebar">
      <div className="editor-breadcrumb">
        <div className="breadcrumb-item clickable" onClick={() => setSelectedSnippet(null)}>
          <FileType size={12} className="breadcrumb-icon" />
          <span>Vault</span>
        </div>
        <ChevronRight size={12} className="breadcrumb-sep" />
        <div className="breadcrumb-item">
          {(() => {
            const lang = (snippet?.language || 'markdown').toLowerCase()
            if (
              ['javascript', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'python', 'py'].includes(lang)
            )
              return <FileCode size={12} className="breadcrumb-icon" />
            if (lang === 'json') return <FileJson size={12} className="breadcrumb-icon" />
            if (lang === 'markdown' || lang === 'md')
              return <Hash size={12} className="breadcrumb-icon" />
            return <FileType size={12} className="breadcrumb-icon" />
          })()}
          <span className="breadcrumb-active">{title || 'Untitled'}</span>
          {isDirty && <div className="dirty-indicator" style={{ marginLeft: '8px' }} />}
        </div>
      </div>

      <div className="editor-controls">
        <button className="icon-btn" onClick={onSave} title="Save (Ctrl+S)">
          <Save size={16} />
        </button>
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

          {showMoreMenu && (
            <div
              className="native-dropdown-menu"
              ref={menuRef}
              onClick={(e) => e.stopPropagation()}
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
                onClick={() => {
                  navigator.clipboard.writeText(snippet.code)
                  setShowMoreMenu(false)
                }}
              >
                <span className="menu-label">Copy Raw Markdown</span>
                <Copy size={12} className="menu-icon-right" />
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  onExportHTML()
                  setShowMoreMenu(false)
                }}
              >
                <span className="menu-label">Copy HTML Code</span>
                <FileCode size={12} className="menu-icon-right" />
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  onExportPDF()
                  setShowMoreMenu(false)
                }}
              >
                <span className="menu-label">Export to PDF</span>
                <Printer size={12} className="menu-icon-right" />
              </div>
              <div className="dropdown-divider" />
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditorTitleBar
