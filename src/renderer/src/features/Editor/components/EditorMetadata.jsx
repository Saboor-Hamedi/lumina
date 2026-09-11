import React from 'react'
import EditorTitleBar from './EditorTitleBar'
import EditorActionBar from './EditorActionBar'

export { EditorTitleBar, EditorActionBar }

/**
 * EditorMetadata
 *
 * Unified container composing EditorTitleBar and EditorActionBar.
 * Allows independent toggling via `showTitle` and `showActions` flags.
 */
export const EditorMetadata = React.memo(
  ({
    snippet,
    title,
    setTitle,
    setIsDirty,
    isDirty,
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
            titleRef={titleRef}
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
