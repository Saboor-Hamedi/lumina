import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Network } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import InlineGraph from '../../graph/InlineGraph'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useKeyboardShortcuts } from '../../../core/shortcuts'
import ProgressTracker, { LearnedButton } from '../../roadmap/ProgressTracker'
import VoiceButton from '../../voice'
import DrivePushButton from './DrivePushButton'

/**
 * EditorActionBar
 *
 * Dedicated component for quick editor action buttons:
 * - Ask AI (Ctrl+K)
 * - Voice Input
 * - Google Drive Sync / Push
 * - Linked Mentions / Local Graph toggle
 * - Learned / Roadmap progress
 * - Fallback container for ProgressTracker and EditorMenu when title bar is hidden
 */
export const EditorActionBar = ({
  snippet,
  title,
  isDirty,
  onInlineAI,
  editorMenu,
  showMenuWhenTitleHidden = false
}) => {
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

    document.addEventListener('mousedown', handleOutsideClick, true)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true)
    }
  }, [showLocalGraph])

  if (!snippet) return null

  return (
    <div
      ref={containerRef}
      className="editor-action-bar"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        margin: '4px 0 2px 0'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap',
          marginLeft: '-6px'
        }}
      >
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

        <VoiceButton id="editor-voice" />
        <DrivePushButton snippet={snippet} title={title} isDirty={isDirty} />

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
      </div>

      {showMenuWhenTitleHidden && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ProgressTracker snippetId={snippet?.id} />
          {editorMenu}
        </div>
      )}

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
              useWorkspaceStore.getState().setActiveTabId(id)
              setShowLocalGraph(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

export default React.memo(EditorActionBar)
