import React from 'react'

const EditorFooter = ({ isDirty, viewMode, setViewMode }) => {
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
          onClick={() => setViewMode('source')}
          title="Source Mode"
        >
          Src
        </button>
        <button
          className={`mode-btn ${viewMode === 'live' ? 'active' : ''}`}
          onClick={() => setViewMode('live')}
          title="Live Mode"
        >
          Live
        </button>
        <button
          className={`mode-btn ${viewMode === 'reading' ? 'active' : ''}`}
          onClick={() => setViewMode('reading')}
          title="Reading Mode"
        >
          Read
        </button>
      </div>
    </div>
  )
}

export default EditorFooter
