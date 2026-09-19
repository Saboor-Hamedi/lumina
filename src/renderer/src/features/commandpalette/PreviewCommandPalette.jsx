import React, { useEffect, useMemo, useState } from 'react'
import { AtomicCodeMirrorEditor, wikiLinks } from '@atomic-editor/editor'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { languages } from '@codemirror/language-data'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
// Media & editor extensions
import { imageWidgetExtension } from '../media'
import { htmlWidgetExtension } from '../Editor/extensions/htmlExtension'
import { katexExtension } from '../Editor/extensions/katexExtension'
import { tables } from '../table/tableExtension'
import { mermaidWidgetExtension } from '../../core/mermaid'
import { calloutExtension, highlightExtension } from '../../core/editor'
import {
  codeBlockDecorations,
  codeMap,
  luminaSyntaxHighlighting,
  copyCodeAsImage
} from '../../core/code'
import { Sparkles } from 'lucide-react'
// Lumina AI Thinking Block
import { ThinkingBlock } from '../AI/components/LuminaThinkingBlock'

import '@atomic-editor/editor/styles.css'
import '../Editor/Editor.css'
import '../../assets/codeWrapper.css'
import '../media/css/imageExtension.css'

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
        const { notes, setSelectedNote } = useWorkspaceStore.getState()
        const targetLower = url.toLowerCase()
        const targetSnippet = (notes || []).find(
          (s) =>
            s.title &&
            (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
        )
        if (targetSnippet) {
          if (setSelectedNote) setSelectedNote(targetSnippet)
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
      Prec.highest(imageWidgetExtension),
      htmlWidgetExtension,
      katexExtension,
      mermaidWidgetExtension,
      calloutExtension,
      highlightExtension,
      codeBlockDecorations,
      luminaSyntaxHighlighting,
      Prec.highest(tables({ onLinkClick: handleLinkClick })),
      wikiLinks({
        openOnClick: true,
        resolve: async (target) => {
          const { notes } = useWorkspaceStore.getState()
          const targetLower = target.toLowerCase()
          const exists = (notes || []).some(
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

  const { thinkContent, cleanContent } = useMemo(() => {
    if (!content) return { thinkContent: '', cleanContent: '' }
    let think = ''
    let remaining = content
    const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i)
    if (thinkMatch) {
      think = thinkMatch[1].trim()
      remaining = remaining.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim()
    }
    return { thinkContent: think, cleanContent: remaining }
  }, [content])

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
          {thinkContent && (
            <div style={{ marginBottom: '12px' }}>
              <ThinkingBlock thinkContent={thinkContent} isStreaming={false} />
            </div>
          )}
          {shouldRenderEditor ? (
            <AtomicCodeMirrorEditor
              markdownSource={cleanContent || ''}
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
