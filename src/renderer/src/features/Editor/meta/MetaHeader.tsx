import React from 'react'
import MetaActionBar from './MetaActionBar'
import type { Snippet } from '../../../core/editor/types'

export interface MetaHeaderProps {
  snippet?: Snippet | null
  title?: string
  setTitle?: (title: string) => void
  setIsDirty?: (dirty: boolean) => void
  isDirty?: boolean
  titleRef?: React.RefObject<HTMLInputElement | null> | React.MutableRefObject<any>
  onInlineAI?: () => void
  editorMenu?: React.ReactNode
  showTitle?: boolean
  showActions?: boolean
  showMenu?: boolean
  showTools?: boolean
  position?: 'bottom' | 'top' | 'inline'
  onPreview?: () => void
  onOpenExportDialog?: () => void
  onToggleInspector?: () => void
}

/**
 * MetaHeader
 *
 * Dedicated header container for the note editor canvas.
 * Hosts quick action controls, AI shortcuts, local graph integration,
 * progress tracking, and note options menu.
 */
export const MetaHeader: React.FC<MetaHeaderProps> = React.memo(
  ({
    snippet,
    title = '',
    isDirty = false,
    onInlineAI,
    editorMenu,
    showActions = true,
    showTools = true,
    position = 'inline',
    onPreview,
    onOpenExportDialog,
    onToggleInspector
  }) => {
    if (!snippet || !showActions) return null

    return (
      <div
        className="editor-metadata-bar meta-header-bar"
        style={position === 'inline' ? { position: 'relative', paddingBottom: '8px', marginBottom: '4px' } : undefined}
      >
        <MetaActionBar
          position={position}
          snippet={snippet}
          showTools={showTools}
          title={title}
          isDirty={isDirty}
          onInlineAI={onInlineAI}
          editorMenu={editorMenu}
          onPreview={onPreview}
          onOpenExportDialog={onOpenExportDialog}
          onToggleInspector={onToggleInspector}
        />
      </div>
    )
  }
)

MetaHeader.displayName = 'MetaHeader'
export default MetaHeader
