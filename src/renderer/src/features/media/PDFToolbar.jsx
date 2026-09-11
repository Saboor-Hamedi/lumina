import React, { useState } from 'react'
import { FolderOpen, ChevronDown, ChevronUp } from 'lucide-react'

export const PDFToolbar = ({ snippet, onOpenInFolder }) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={`pdf-viewer-toolbar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {isExpanded && (
        <div className="pdf-viewer-toolbar-content">
          {snippet?.size && (
            <span className="pdf-viewer-badge">{formatFileSize(snippet.size)}</span>
          )}
          <span className="pdf-viewer-badge uppercase">PDF</span>
          <div className="pdf-viewer-divider" />
          <button
            className="pdf-viewer-btn"
            title="Open Containing Folder"
            onClick={onOpenInFolder}
          >
            <FolderOpen size={14} />
          </button>
          <div className="pdf-viewer-divider" />
        </div>
      )}
      <button
        className="pdf-viewer-btn pdf-viewer-toggle-btn"
        title={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  )
}

export default React.memo(PDFToolbar)
