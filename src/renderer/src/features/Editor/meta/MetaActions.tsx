import React from 'react'
import { Sparkles, Network } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { LearnedButton } from '../../roadmap/ProgressTracker'
import VoiceButton from '../../voice'
import MetaDrivePush from './MetaDrivePush'
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
      <div className="meta-header-actions">
        <ToolTip text="Ask AI (Ctrl+K)" position="bottom">
          <button
            type="button"
            className="meta-action-btn"
            onClick={(e) => {
              e.preventDefault()
              if (onInlineAI) {
                onInlineAI()
              } else {
                window.dispatchEvent(new CustomEvent('open-inline-ai'))
              }
            }}
          >
            <Sparkles size={12} style={{ opacity: 0.85 }} />
            <span>Ask AI</span>
          </button>
        </ToolTip>

        <VoiceButton id="editor-voice" />
        <MetaDrivePush snippet={snippet} title={title} isDirty={isDirty} />

        <ToolTip text="Linked Mentions" position="bottom">
          <button
            type="button"
            className={`meta-action-btn ${showLocalGraph ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              setShowLocalGraph(!showLocalGraph)
            }}
          >
            <Network size={12} style={{ opacity: showLocalGraph ? 1 : 0.85 }} />
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
