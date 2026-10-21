import React from 'react'
import ProgressTracker from '../../roadmap/ProgressTracker'
import type { Snippet } from '../../../core/editor/types'

export interface MetaToolsProps {
  snippet?: Snippet | null
  editorMenu?: React.ReactNode
}

/**
 * MetaTools
 *
 * Right-side quick tools for the editor header:
 * - Roadmap Progress Tracker
 * - Note Dropdown Menu (Export, Preview, Settings)
 */
export const MetaTools: React.FC<MetaToolsProps> = React.memo(({ snippet, editorMenu }) => {
  if (!snippet && !editorMenu) return null

  return (
    <div
      className="meta-header-tools"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      <ProgressTracker snippetId={snippet?.id} noteId={snippet?.id} />
      {editorMenu}
    </div>
  )
})

MetaTools.displayName = 'MetaTools'
export default MetaTools
