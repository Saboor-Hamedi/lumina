import React from 'react'

const EditorFooter = ({ isDirty, viewMode, setViewMode }) => {
  // Toggle between editor (source) and preview (live)
  const toggleMode = () => {
    setViewMode(viewMode === 'live' ? 'source' : 'live')
  }

  return (
    <div className="editor-footer-bar">
      <div className="editor-status-icons">
        <div className={`status-pill ${isDirty ? 'dirty' : 'saved'}`}>
          {isDirty ? 'Unsaved' : 'Saved'}
        </div>
      </div>

      <div className="mode-toggle">
        <button
          className={`mode-btn ${viewMode === 'source' ? 'active' : ''}`}
          onClick={toggleMode}
          title={viewMode === 'live' ? 'Switch to Editor (Show Syntax)' : 'Editor Mode - All syntax visible'}
        >
          Editor
        </button>
        <button
          className={`mode-btn ${viewMode === 'live' ? 'active' : ''}`}
          onClick={toggleMode}
          title={viewMode === 'source' ? 'Switch to Preview (Hide Syntax)' : 'Preview Mode - Syntax hidden'}
        >
          Preview
        </button>
      </div>
    </div>
  )
}

export default EditorFooter
