import React from 'react'
import EditorTitleBar from './EditorTitleBar'
import EditorActionBar from './EditorActionBar'

export { EditorTitleBar, EditorActionBar }

export interface EditorMetadataProps {
  snippet?: any
  title?: string
  setTitle?: (title: string) => void
  setIsDirty?: (dirty: boolean) => void
  isDirty?: boolean
  titleRef?: React.RefObject<HTMLInputElement | null> | React.MutableRefObject<any>
  onInlineAI?: () => void
  editorMenu?: React.ReactNode
  showTitle?: boolean
  showActions?: boolean
}

/**
 * EditorMetadata
 *
 * Unified container composing EditorTitleBar and EditorActionBar.
 * Allows independent toggling via `showTitle` and `showActions` flags.
 */
export const EditorMetadata: React.FC<EditorMetadataProps> = React.memo(
  ({
    snippet,
    title = '',
    setTitle = () => {},
    setIsDirty = () => {},
    isDirty = false,
    titleRef,
    onInlineAI,
    editorMenu,
    showTitle = true,
    showActions = true
  }) => {
    if (!snippet) return null
    if (!showTitle && !showActions) return null

    return (
      <div className="editor-metadata-bar" style={{ position: 'relative' }}>
        {showTitle && (
          <EditorTitleBar
            snippet={snippet}
            title={title}
            setTitle={setTitle}
            setIsDirty={setIsDirty}
            titleRef={titleRef as any}
            editorMenu={editorMenu}
            showMenu={true}
          />
        )}
        {showActions && (
          <EditorActionBar
            snippet={snippet}
            title={title}
            isDirty={isDirty}
            onInlineAI={onInlineAI}
            editorMenu={editorMenu}
            showMenuWhenTitleHidden={!showTitle}
          />
        )}
      </div>
    )
  }
)

EditorMetadata.displayName = 'EditorMetadata'
export default EditorMetadata
