import React from 'react'
import { Sparkles, Network } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { LearnedButton } from '../../roadmap/ProgressTracker'
import VoiceButton from '../../voice'
import DrivePushButton from '../components/DrivePushButton'
import type { Snippet } from '../../../core/editor/types'

export interface MetaActionsProps {
  snippet?: Snippet | null
  title?: string
  isDirty?: boolean
  onInlineAI?: () => void
  showLocalGraph: boolean
  setShowLocalGraph: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * MetaActions
 *
 * Left-side quick action buttons for the editor header:
 * - Ask AI (Ctrl+K)
 * - Voice Input
 * - Google Drive Push / Backup
 * - Local Graph (Linked Mentions) toggle
 * - Learned / Roadmap status toggle
 */
export const MetaActions: React.FC<MetaActionsProps> = React.memo(
  ({
    snippet,
    title = '',
    isDirty = false,
    onInlineAI,
    showLocalGraph,
    setShowLocalGraph
  }) => {
    if (!snippet) return null

    return (
      <div
        className="meta-header-actions"
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

        <LearnedButton snippet={snippet} note={snippet} />
      </div>
    )
  }
)

MetaActions.displayName = 'MetaActions'
export default MetaActions
