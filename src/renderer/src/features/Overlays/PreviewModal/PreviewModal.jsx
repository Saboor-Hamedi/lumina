import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Clock } from 'lucide-react'
import ModalHeader from '../ModalHeader'
import { AtomicCodeMirrorEditor, wikiLinks } from '@atomic-editor/editor'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { languages } from '@codemirror/language-data'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { imageWidgetExtension } from '../../Workspace/imageWidgetExtension'
import { htmlWidgetExtension } from '../../Workspace/htmlWidgetExtension'
import { tables } from '../../Workspace/tableWidgetExtension'
import { mermaidWidgetExtension } from '../../Workspace/mermaidWidgetExtension'
import { calloutExtension } from '../../Workspace/calloutWidgetExtension'
import { codeBlockDecorations, codeMap, luminaSyntaxHighlighting } from '../../Workspace/codeBlockHeader'
import '@atomic-editor/editor/styles.css'
import '../../Editor/MarkdownEditor.css'
import '../../Editor/CodeWrapper.css'
import '../../Theme/ThemeModal.css'
import './PreviewModal.css'
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts'

const PreviewModal = ({ isOpen, onClose, title, content }) => {
  const [shouldRenderEditor, setShouldRenderEditor] = useState(false)
  const [copiedBlockId, setCopiedBlockId] = useState(null)

  useKeyboardShortcuts({
    onEscape: isOpen ? () => {
      onClose()
      return true
    } : undefined
  })

  

  useEffect(() => {
    if (isOpen) {
      // Small delay to allow the modal's CSS opening animation to run smoothly
      // before blocking the main thread with CodeMirror instantiation
      const timer = setTimeout(() => setShouldRenderEditor(true), 50)
      return () => {
        clearTimeout(timer)
      }
    } else {
      setShouldRenderEditor(false)
    }
  }, [isOpen])

  const handleLinkClick = useMemo(() => async (url) => {
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
          (s.title.toLowerCase() === targetLower ||
            s.title.toLowerCase() === `${targetLower}.md`)
      )
      if (targetSnippet) {
        setSelectedSnippet(targetSnippet)
        onClose()
      }
    } catch (e) {
      console.error(e)
    }
  }, [onClose])

  const extensions = useMemo(() => [
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
  ], [handleLinkClick])

  if (!isOpen) return null

  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0

  const headerStats = (
    <div className="preview-stats-bar">
      <span className="preview-indicator-tag">PREVIEW</span>
      <div className="preview-stat-sep" />
      <div className="preview-stat-item">
        <FileText size={12}/> {wordCount} words
      </div>
    </div>
  )

  return createPortal(
    <div className="modal-overlay theme-modal-overlay" onClick={onClose}>
      <div 
        className="modal-container theme-modal-container preview-modal-container" 
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader title={`Preview: ${title}`} right={headerStats} icon={<FileText size={16} />} onClose={onClose} />

        <div className="preview-body preview-modal-body seamless-scrollbar markdown-editor mode-source" style={{ overflowY: 'auto', flex: 1, padding: '24px 32px', background: 'var(--bg-app)' }}>
          <style>{`
            .preview-modal-body .editor-canvas-wrap {
              max-width: 100% !important;
              width: 100% !important;
              padding: 0 !important;
            }
            .preview-modal-body .cm-content,
            .preview-modal-body .atomic-cm-editor .cm-content,
            .preview-modal-body .atomic-cm-editor .cm-scroller {
              max-width: 100% !important;
              width: 100% !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
              margin: 0 !important;
            }
            .preview-modal-body .cm-line.cb-code-header::before {
              cursor: pointer !important;
            }
            .preview-modal-body .cm-line.cb-code-header.cb-copied::before,
            .preview-modal-body .cm-line.cb-code-header[data-cb-id="${copiedBlockId}"]::before {
              content: '✓ COPIED' !important;
              color: #4caf50 !important;
              background: transparent !important;
              border-color: transparent !important;
              font-weight: bold !important;
            }
            @media (max-width: 768px) {
              .preview-modal-body {
                padding: 16px 12px !important;
              }
            }
          `}</style>
          <div 
            className="editor-canvas-wrap" 
            style={{ height: 'auto', display: 'block', width: '100%', maxWidth: '100%', padding: 0 }}
            onMouseDown={async (e) => {
              const codeLine = e.target.closest('.cm-line.cb-code-header')
              if (codeLine) {
                const rect = codeLine.getBoundingClientRect()
                // Copy when clicked near the language pill on the right
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
              <div style={{ padding: '60px', color: 'var(--text-faint)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div className="mermaid-loading" style={{ opacity: 0.5 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader-2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  )
}

export default PreviewModal
