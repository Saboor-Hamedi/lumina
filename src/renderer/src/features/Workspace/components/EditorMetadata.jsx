import React, { useState, useEffect, useRef } from 'react'
import { Calendar, Network } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import InlineGraph from '../../Graph/InlineGraph'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts'

const EditorMetadata = ({ snippet, title, setTitle, setIsDirty, titleRef }) => {
  const [error, setError] = useState(false)
  const [showLocalGraph, setShowLocalGraph] = useState(false)
  const containerRef = useRef(null)

  useKeyboardShortcuts({
    onEscape: showLocalGraph
      ? () => {
          setShowLocalGraph(false)
          return true
        }
      : null
  })

  useEffect(() => {
    if (!showLocalGraph) return

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowLocalGraph(false)
      }
    }

    // Use capture phase to ensure it runs before other events might stop propagation
    document.addEventListener('mousedown', handleOutsideClick, true)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true)
    }
  }, [showLocalGraph])

  if (!snippet) return null

  return (
    <div ref={containerRef} className="editor-metadata-bar" style={{ position: 'relative' }}>
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
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ToolTip text="Ask AI (Ctrl+K)" position="bottom">
          <button
            onClick={(e) => {
              e.preventDefault()
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
            }}
            style={{
              marginLeft: '-8px',
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

        <ToolTip text="Linked Mentions" position="bottom">
          <button
            onClick={(e) => {
              e.preventDefault()
              setShowLocalGraph(!showLocalGraph)
            }}
            style={{
              background: showLocalGraph
                ? 'var(--bg-active, rgba(255,255,255,0.05))'
                : 'transparent',
              border: 'none',
              borderRadius: '5px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: showLocalGraph ? 'var(--text-main, #e5e5e5)' : 'var(--text-muted, #888)',
              transition: 'all 0.2s ease',
              padding: '0 8px',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-main, #e5e5e5)'
              if (!showLocalGraph)
                e.currentTarget.style.background = 'var(--bg-active, rgba(255,255,255,0.05))'
            }}
            onMouseLeave={(e) => {
              if (!showLocalGraph) {
                e.currentTarget.style.color = 'var(--text-muted, #888)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <Network size={12} />
            <span style={{ fontSize: '12px', fontWeight: 500 }}>Local Graph</span>
          </button>
        </ToolTip>
      </div>

      {showLocalGraph && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '8px',
            width: '100%',
            zIndex: 50,
            borderRadius: '8px',
            border: '1px solid var(--border-color, rgba(255,255,255,0.05))',
            overflow: 'hidden'
          }}
        >
          <InlineGraph
            focusNodeId={snippet.id}
            onNavigate={(id) => {
              useVaultStore.getState().openTab(id)
              setShowLocalGraph(false) // Close dropdown on navigation
            }}
          />
        </div>
      )}
    </div>
  )
}

export default EditorMetadata
