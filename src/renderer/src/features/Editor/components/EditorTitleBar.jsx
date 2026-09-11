import React, { useState } from 'react'
import ProgressTracker from '../../roadmap/ProgressTracker'

/**
 * EditorTitleBar
 *
 * Dedicated component for the note title input and its validation tooltip.
 * Keeps title editing isolated from action buttons and quick controls.
 */
export const EditorTitleBar = ({
  snippet,
  title,
  setTitle,
  setIsDirty,
  titleRef,
  editorMenu,
  showMenu = true
}) => {
  const [error, setError] = useState(false)

  if (!snippet) return null

  return (
    <div className="editor-title-bar" style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          width: '100%'
        }}
      >
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
          style={{ flex: 1, minWidth: 0 }}
        />

        {showMenu && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ProgressTracker snippetId={snippet?.id} />
            {editorMenu}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            position: 'absolute',
            top: '32px',
            left: 0,
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            zIndex: 10,
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

export default React.memo(EditorTitleBar)
