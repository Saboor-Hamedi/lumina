import React, { useState } from 'react'
import { Calendar } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'


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
      <div style={{ marginTop: '8px', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ToolTip text="Ask AI (Ctrl+K)" position="bottom">
          <button
            onClick={(e) => {
              e.preventDefault()
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
            }}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '5px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted, #888)',
              transition: 'all 0.2s ease',
              padding: '0 8px',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-main, #e5e5e5)'
              e.currentTarget.style.background = 'var(--bg-active, rgba(255,255,255,0.05))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #888)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span>
            <span style={{ fontSize: '12px', fontWeight: 500 }}>Ask AI</span>
          </button>
        </ToolTip>


      </div>
    </div>
  )
}

export default EditorMetadata
