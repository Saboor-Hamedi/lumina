import React, { useState, useEffect, useRef } from 'react'
import { Calendar, Network, Sparkles } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import InlineGraph from '../../Graph/InlineGraph'
import { useVaultStore } from '../../../core/store/workspaceStore'
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts'
import ProgressTracker, { LearnedButton, LearningTrackBadge } from '../../roadmap/ProgressTracker'

const EditorMetadata = ({ snippet, title, setTitle, setIsDirty, titleRef, onInlineAI }) => {
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
            bottom: '-28px',
            left: 0,
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: '4px 8px',
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
      <div style={{ marginTop: '6px', marginLeft: '-6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <ToolTip text="Ask AI (Ctrl+K)" position="bottom">
          <button
            onClick={(e) => {
              e.preventDefault()
              if (onInlineAI) {
                onInlineAI()
              } else {
                window.dispatchEvent(new CustomEvent('open-inline-ai'))
              }
            }}
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: '5px',
              height: '21px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)',
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: '0 6px',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 400
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-main, #f8fafc)'
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <Sparkles size={11} style={{ opacity: 0.8 }} />
            <span>Ask AI</span>
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
                ? 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.12)'
                : 'transparent',
              border: showLocalGraph
                ? '1px solid rgba(var(--text-accent-rgb, 139, 92, 246), 0.35)'
                : '1px solid transparent',
              borderRadius: '5px',
              height: '21px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: showLocalGraph ? 'var(--text-accent, #a78bfa)' : 'var(--text-muted, #94a3b8)',
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: '0 6px',
              gap: '4px',
              fontSize: '11px',
              fontWeight: showLocalGraph ? 500 : 400
            }}
            onMouseEnter={(e) => {
              if (!showLocalGraph) {
                e.currentTarget.style.color = 'var(--text-main, #f8fafc)'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
              }
            }}
            onMouseLeave={(e) => {
              if (!showLocalGraph) {
                e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
              }
            }}
          >
            <Network size={11} style={{ opacity: showLocalGraph ? 1 : 0.8 }} />
            <span>Local Graph</span>
          </button>
        </ToolTip>

        <LearnedButton snippet={snippet} />
        <LearningTrackBadge snippetId={snippet?.id} />
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
              useVaultStore.getState().setActiveTabId(id)
              setShowLocalGraph(false) // Close dropdown on navigation
            }}
          />
        </div>
      )}
    </div>
  )
}

export default EditorMetadata
