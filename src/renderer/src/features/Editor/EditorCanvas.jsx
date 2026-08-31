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
import { useVaultStore } from '../../core/store/useVaultStore'
import { setupWikilinkHover } from '../Workspace/hoverWikilink'
import ContextMenu from '../Overlays/ContextMenu'
import { getEditorContextMenuOptions } from './menu'
import EditorMetadata from '../Workspace/components/EditorMetadata'

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
    showToast
  }) => {
    const [contextMenu, setContextMenu] = useState(null)
    const editorWrapperRef = useRef(null)

    const inlineMetadata = useSettingsStore((state) => state.settings?.inlineMetadata !== false)
    const snippets = useVaultStore((state) => state.snippets)

    // --- Forceful Native Event Listener for Wikilinks ---
    useEffect(() => {
      const wrapper = editorWrapperRef.current
      if (!wrapper) return

      const cleanupHover = setupWikilinkHover(wrapper, useVaultStore.getState)

      const handleMouseDown = async (e) => {
        const linkEl = e.target.closest('.cm-atomic-wiki-link')
        if (linkEl) {
          e.preventDefault()
          e.stopPropagation()
          const target = linkEl.getAttribute('data-wiki-link-target')
          if (target) {
            try {
              const { snippets: allSnippets, saveSnippet, setSelectedSnippet } = useVaultStore.getState()
              const targetLower = target.toLowerCase()
              let targetSnippet = allSnippets.find((s) => {
                if (!s.title) return false

                const titleLower = s.title.toLowerCase()
                const fullPathLower = s.folderId
                  ? `${s.folderId}/${s.title}`.toLowerCase()
                  : titleLower

                return (
                  titleLower === targetLower ||
                  titleLower === `${targetLower}.md` ||
                  fullPathLower === targetLower ||
                  fullPathLower === `${targetLower}.md`
                )
              })
              if (!targetSnippet) {
                targetSnippet = {
                  id: crypto.randomUUID(),
                  title: target,
                  code: `# ${target}\n\n`,
                  language: 'markdown',
                  tags: '',
                  timestamp: Date.now()
                }
                await saveSnippet(targetSnippet)
              }
              setSelectedSnippet(targetSnippet)
            } catch (err) {
              showToast(`Failed to open wikilink: ${err.message}`, 'error')
            }
          }
          return
        }

        if (e.target.closest('.mermaid-edit-btn') || e.target.closest('.mermaid-widget-header')) {
          return
        }
      }

      wrapper.addEventListener('mousedown', handleMouseDown, { capture: true })
      return () => {
        wrapper.removeEventListener('mousedown', handleMouseDown, { capture: true })
        cleanupHover()
      }
    }, [showToast])

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
          />
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
