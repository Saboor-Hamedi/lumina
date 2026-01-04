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
  isDirty, // Unused here?
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
            if (['javascript', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'python', 'py'].includes(lang))
              return <FileCode size={12} className="breadcrumb-icon" />
            if (lang === 'json') return <FileJson size={12} className="breadcrumb-icon" />
            if (lang === 'markdown' || lang === 'md')
              return <Hash size={12} className="breadcrumb-icon" />
            return <FileType size={12} className="breadcrumb-icon" />
          })()}
          <span className="breadcrumb-active">{title || 'Untitled'}</span>
        </div>
      </div>

      <div className="editor-controls">
        <div style={{ position: 'relative' }}>
          <button
            className="icon-btn"
            ref={buttonRef}
            onClick={(e) => {
                e.stopPropagation(); // Prevent immediate close
                setShowMoreMenu(!showMoreMenu);
            }}
            title="More Options"
          >
            <MoreVertical size={18} />
          </button>
          
          {showMoreMenu && (
            <div className="export-menu-dropdown" ref={menuRef} onClick={(e) => e.stopPropagation()}>
              <div
                className="dropdown-item"
                onClick={() => {
                  onSave()
                  setShowMoreMenu(false)
                }}
              >
                <Save size={11} className="menu-icon" />
                <span className="menu-label">Save File</span>
                <span className="shortcut-label">Ctrl+S</span>
              </div>
              <div className="dropdown-divider" />
              <div
                className="dropdown-item"
                onClick={() => {
                  navigator.clipboard.writeText(snippet.code)
                  setShowMoreMenu(false)
                }}
              >
                <Copy size={11} className="menu-icon" />
                <span className="menu-label">Copy Raw Markdown</span>
              </div>
              <div className="dropdown-item" onClick={onExportHTML}>
                <FileCode size={11} className="menu-icon" />
                <span className="menu-label">Copy HTML Code</span>
              </div>
              <div className="dropdown-item" onClick={onExportPDF}>
                <Printer size={11} className="menu-icon" />
                <span className="menu-label">Export to PDF</span>
              </div>
              <div className="dropdown-divider" />
              <div
                className="dropdown-item"
                onClick={() => {
                  onToggleInspector()
                  setShowMoreMenu(false)
                }}
              >
                <Sidebar size={11} className="menu-icon" />
                <span className="menu-label">Toggle Inspector</span>
                <span className="shortcut-label">Ctrl+I</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditorTitleBar
