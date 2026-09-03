import React, { useEffect, useMemo, useState } from 'react'
import { AtomicCodeMirrorEditor, wikiLinks } from '@atomic-editor/editor'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { languages } from '@codemirror/language-data'
import { useVaultStore } from '../../core/store/useVaultStore'
import { imageWidgetExtension } from '../dropImage/imageWidgetExtension'
import { htmlWidgetExtension } from '../Workspace/htmlWidgetExtension'
import { tables } from '../table/tableExtension'
import { mermaidWidgetExtension } from '../Workspace/mermaidWidgetExtension'
import { calloutExtension } from '../Workspace/calloutWidgetExtension'
import {
  codeBlockDecorations,
  codeMap,
  luminaSyntaxHighlighting,
  copyCodeAsImage
} from '../codeBlock/codeBlockHeader'
import { Sparkles } from 'lucide-react'

import '@atomic-editor/editor/styles.css'
import '../Editor/Editor.css'
import '../codeBlock/codeWrapper.css'

/**
 * A reusable, full-fidelity read-only markdown preview.
 * Inherits 100% of the editor's typography, extensions, tables, and scrolling.
 */
export const PreviewCommandPalette = React.memo(({ content, onClose, customLinkHandler, footerNav }) => {
  const scrollerRef = React.useRef(null)
  const [shouldRenderEditor] = useState(true)

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = 0
    }
  }, [content])

  const handleLinkClick = useMemo(
    () => async (url) => {
      if (customLinkHandler) {
        const handled = customLinkHandler(url)
        if (handled) return
      }

      if (url.match(/^(https?|mailto|file):\/\//i)) {
        window.open(url, '_blank')
        return
      }
      try {
        const { snippets, setSelectedSnippet } = useVaultStore.getState()
        const targetLower = url.toLowerCase()
        const targetSnippet = snippets?.find(
          (s) =>
            s.title &&
            (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
        )
        if (targetSnippet) {
          setSelectedSnippet(targetSnippet)
          if (onClose) onClose()
        }
      } catch (e) {
        console.error(e)
      }
    },
    [onClose, customLinkHandler]
  )

  const extensions = useMemo(
    () => [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      imageWidgetExtension,
      htmlWidgetExtension,
      mermaidWidgetExtension,
      calloutExtension,
      codeBlockDecorations,
      luminaSyntaxHighlighting,
      Prec.highest(tables({ onLinkClick: handleLinkClick })),
      wikiLinks({
        openOnClick: true,
        resolve: async (target) => {
          const { snippets } = useVaultStore.getState()
          const targetLower = target.toLowerCase()
          const exists = snippets.some(
            (s) =>
              s.title &&
              (s.title.toLowerCase() === targetLower ||
                s.title.toLowerCase() === `${targetLower}.md`)
          )
          return { label: target, status: exists ? 'resolved' : 'missing' }
        },
        onOpen: handleLinkClick
      })
    ],
    [handleLinkClick]
  )

  return (
    <div
      ref={scrollerRef}
      className="markdown-editor mode-source preview-body seamless-scrollbar"
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: 1,
        height: '100%',
        padding: '16px 12px',
        background: 'var(--bg-app)'
      }}
    >
      <style>{`
        .preview-body .cm-table-ui-header,
        .preview-body .cm-table-ui-delete-btn,
        .preview-body .cm-table-ui-drag-handle {
          display: none !important;
        }
        .preview-body .cm-atomic-table table {
          border-top-left-radius: 6px !important;
          border-top-right-radius: 6px !important;
        }
        .preview-body .editor-canvas-wrap {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 auto !important;
          padding: 0 8px 24px 8px !important;
        }
      `}</style>
      <div className="editor-scroller" style={{ overflow: 'visible', height: 'auto', padding: 0 }}>
        <div
          className="editor-canvas-wrap"
          style={{ maxWidth: '100%', width: '100%', margin: '0 auto', padding: '0 8px 24px 8px' }}
          onMouseDown={(e) => {
            if (e.target.closest('.mermaid-edit-btn') || e.target.closest('.mermaid-widget-header')) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          {shouldRenderEditor ? (
            <AtomicCodeMirrorEditor
              markdownSource={content || ''}
              codeLanguages={languages}
              extensions={extensions}
              blurEditorOnMount={true}
            />
          ) : (
            <div
              style={{
                padding: '60px',
                color: 'var(--text-faint)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div className="mermaid-loading" style={{ opacity: 0.5 }}>
                <Sparkles size={24} />
              </div>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Rendering preview...</span>
            </div>
          )}
          {footerNav}
        </div>
      </div>
    </div>
  )
})

export default PreviewCommandPalette
