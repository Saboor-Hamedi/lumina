import React, { useState } from 'react'
import { Calendar } from 'lucide-react'

const EditorMetadata = ({ snippet, title, setTitle, setIsDirty, titleRef }) => {
  const [error, setError] = useState(false)

  if (!snippet) return null

  return (
    <div className="editor-metadata-bar" style={{ position: 'relative' }}>
      <input
        type="text"
        ref={titleRef}
        className={`editor-large-title ${error ? 'title-error-shake' : ''}`}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setIsDirty(true)
          if (error) setError(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (!title || title.trim() === '') {
              setError(true)
            } else {
              setError(false)
              window.dispatchEvent(new CustomEvent('focus-editor-start'))
            }
          }
        }}
        onDoubleClick={(e) => e.target.select()}
        placeholder="Untitled"
        spellCheck="false"
      />
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: '-4px', // Moved up significantly
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#ef4444',
            fontSize: '8px',
            fontWeight: '500',
            pointerEvents: 'none',
            animation: 'fadeIn 0.2s ease-out',
            whiteSpace: 'nowrap'
          }}
        >
          Title cannot be empty
        </div>
      )}
    </div>
  )
}

export default EditorMetadata
