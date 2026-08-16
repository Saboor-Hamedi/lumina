import React, { useEffect, useMemo, useState } from 'react'
import { AtomicCodeMirrorEditor, wikiLinks } from '@atomic-editor/editor'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { languages } from '@codemirror/language-data'
import { useVaultStore } from '../../core/store/useVaultStore'
import { imageWidgetExtension } from '../dropImage/imageWidgetExtension'
import { htmlWidgetExtension } from '../Workspace/htmlWidgetExtension'
import { tables } from '../table/tableWidgetExtension'
import { mermaidWidgetExtension } from '../Workspace/mermaidWidgetExtension'
import { calloutExtension } from '../Workspace/calloutWidgetExtension'
import {
  codeBlockDecorations,
  codeMap,
  luminaSyntaxHighlighting
} from '../Workspace/codeBlockHeader'

import '@atomic-editor/editor/styles.css'
import '../Editor/MarkdownEditor.css'
import '../Editor/CodeWrapper.css'

/**
 * A reusable, full-fidelity read-only markdown preview.
 * This mounts a CodeMirror editor with all extensions (mermaid, tables, images, etc.)
 */
export const PreviewCommandPalette = React.memo(({ content, onClose }) => {
  const [shouldRenderEditor, setShouldRenderEditor] = useState(false)
  const [copiedBlockId, setCopiedBlockId] = useState(null)

  useEffect(() => {
    // Delay mount to avoid blocking UI thread instantly
    const timer = setTimeout(() => setShouldRenderEditor(true), 150)
    return () => clearTimeout(timer)
  }, [content]) // Reset on content change

  const handleLinkClick = useMemo(
    () => async (url) => {
      if (url.match(/^(https?|mailto|file):\/\//i)) {
        window.open(url, '_blank')
        return
      }
      try {
        const { snippets, setSelectedSnippet } = useVaultStore.getState()
        const targetLower = url.toLowerCase()
        const targetSnippet = snippets.find(
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
    [onClose]
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
      tables({ onLinkClick: handleLinkClick }),
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
      className="preview-body seamless-scrollbar markdown-editor mode-source"
      style={{ overflowY: 'auto', flex: 1, padding: '24px 32px', background: 'var(--bg-app)' }}
    >
      <style>{`
        .preview-body .editor-canvas-wrap {
          max-width: 720px !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 auto !important;
        }
        .preview-body .cm-content,
        .preview-body .atomic-cm-editor .cm-content,
        .preview-body .atomic-cm-editor .cm-scroller {
          max-width: 720px !important;
          width: 100% !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          margin: 0 auto !important;
        }
        .preview-body .cm-line.cb-code-header::before {
          cursor: pointer !important;
        }
        .preview-body .cm-line.cb-code-header.cb-copied::before,
        .preview-body .cm-line.cb-code-header[data-cb-id="${copiedBlockId}"]::before {
          content: '✓ COPIED' !important;
          color: #4caf50 !important;
          background: transparent !important;
          border-color: transparent !important;
          font-weight: bold !important;
        }
        @media (max-width: 768px) {
          .preview-body {
            padding: 16px 12px !important;
          }
        }
      `}</style>
      <div
        className="editor-canvas-wrap"
        style={{
          height: 'auto',
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          padding: 0
        }}
        onMouseDown={async (e) => {
          const codeLine = e.target.closest('.cm-line.cb-code-header')
          if (codeLine) {
            const rect = codeLine.getBoundingClientRect()
            if (e.clientX < rect.right - 100 && !e.target.closest('span')) return
            const id = codeLine.getAttribute('data-cb-id')
            const code = id != null ? codeMap.get(Number(id)) : null
            if (code != null) {
              e.preventDefault()
              e.stopPropagation()
              try {
                await navigator.clipboard.writeText(code)
                codeLine.classList.add('cb-copied')
                setCopiedBlockId(id)
                setTimeout(() => {
                  if (codeLine) codeLine.classList.remove('cb-copied')
                  setCopiedBlockId(null)
                }, 3000)
              } catch (err) {
                console.error('Failed to copy: ', err)
              }
            }
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-loader-2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default PreviewCommandPalette
