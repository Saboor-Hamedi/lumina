import React from 'react'

const EditorFooter = ({ isDirty, viewMode, setViewMode, onTogglePreview }) => {
  // Switch between explicit modes to avoid accidental toggles
  const activateSource = () => setViewMode('source')
  const activateReading = () => setViewMode('reading')

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
          onClick={activateSource}
          title={'Editor Mode - All syntax visible'}
        >
          Editor
        </button>
        <button
          className={`mode-btn ${viewMode === 'reading' ? 'active' : ''}`}
          onClick={activateReading}
          title={'Preview Mode - Rendered view'}
        >
          Preview
        </button>
        <button
          className="mode-btn preview-open-btn"
          onClick={() => onTogglePreview && onTogglePreview()}
          title={'Open Preview Overlay'}
        >
          Open Preview
        </button>
      </div>
    </div>
  )
}

export default EditorFooter
