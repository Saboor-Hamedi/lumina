import React from 'react'

const EditorFooter = ({ isDirty, onTogglePreview }) => {
  return (
    <div className="editor-footer-bar">
      <div className="editor-status-icons">
        <div className={`status-pill ${isDirty ? 'dirty' : 'saved'}`}>
          {isDirty ? 'Unsaved' : 'Saved'}
        </div>
      </div>

      <div className="mode-toggle">
        <button
          className="mode-btn preview-open-btn"
          onClick={() => onTogglePreview && onTogglePreview()}
          title={'Open Preview Overlay'}
        >
          Preview
        </button>
      </div>
    </div>
  )
}

export default EditorFooter
