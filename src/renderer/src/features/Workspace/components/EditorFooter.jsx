import React from 'react'
import { Eye } from 'lucide-react'

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
          <Eye size={16} />
        </button>
      </div>
    </div>
  )
}

export default EditorFooter
