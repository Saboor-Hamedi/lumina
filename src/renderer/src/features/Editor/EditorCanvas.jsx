/**
 * =========================================================================================
 * Editor Canvas Component (`EditorCanvas.jsx`)
 * =========================================================================================
 *
 * Responsibilities:
 * - Wraps the CodeMirror canvas in `.editor-canvas-wrap`
 * - Renders the context menu and handles right-click events
 * - Integrates inline `EditorMetadata`
 * - Handles wikilink hover & capture mousedown events
 * - Renders `<AtomicCodeMirrorEditor>`
 * =========================================================================================
 */

import React, { useState, useEffect, useRef } from 'react'
import { AtomicCodeMirrorEditor } from '@atomic-editor/editor'
import { languages } from '@codemirror/language-data'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/workspaceStore'
import { setupWikilinkHover } from './wikilink/hoverWikilink'
import ContextMenu from '../Overlays/ContextMenu'
import { getEditorContextMenuOptions } from './menu'
import EditorMetadata from './components/EditorMetadata'

export const EditorCanvas = React.memo(
  ({
    snippet,
    editorKey,
    handleMarkdownChange,
    editorHandleRef,
    finalExtensions,
    realViewRef,
    titleRef,
    title,
    setTitle,
    onSave,
    setIsDirty,
    showToast,
    onInlineAI,
    editorMenu
  }) => {
    const [contextMenu, setContextMenu] = useState(null)
    const editorWrapperRef = useRef(null)

    const inlineMetadata = useSettingsStore((state) => state.settings?.inlineMetadata !== false)
    const snippets = useVaultStore((state) => state.snippets)

    useEffect(() => {
      const wrapper = editorWrapperRef.current
      if (!wrapper) return

      const cleanupHover = setupWikilinkHover(wrapper, useVaultStore.getState)
      return () => {
        cleanupHover()
      }
    }, [])

    return (
      <div
        className="editor-canvas-wrap"
        ref={editorWrapperRef}
        onContextMenu={(e) => {
          const isEditor = e.target.closest('.cm-editor') || e.target.closest('.editor-canvas-wrap')
          if (!isEditor) return
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={getEditorContextMenuOptions(realViewRef.current)}
            onClose={() => setContextMenu(null)}
          />
        )}
        {inlineMetadata && (
          <EditorMetadata
            titleRef={titleRef}
            snippet={snippet}
            onSave={onSave}
            snippets={snippets}
            title={title}
            setTitle={setTitle}
            setIsDirty={setIsDirty}
            onInlineAI={onInlineAI}
            editorMenu={editorMenu}
          />
        )}
        {!inlineMetadata && editorMenu && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0', width: '100%' }}>
            {editorMenu}
          </div>
        )}

        <AtomicCodeMirrorEditor
          key={`${snippet?.id}-${editorKey}`}
          documentId={snippet?.id}
          markdownSource={snippet?.code || ''}
          onMarkdownChange={handleMarkdownChange}
          editorHandleRef={editorHandleRef}
          codeLanguages={languages}
          extensions={finalExtensions}
          onLinkClick={(url) => {
            if (window.api?.openExternal) {
              window.api.openExternal(url)
            } else {
              window.open(url, '_blank', 'noopener,noreferrer')
            }
          }}
        />
      </div>
    )
  }
)

EditorCanvas.displayName = 'EditorCanvas'
