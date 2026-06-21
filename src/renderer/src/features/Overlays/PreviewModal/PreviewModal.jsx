import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Clock } from 'lucide-react'
import ModalHeader from '../ModalHeader'
import { AtomicCodeMirrorEditor, wikiLinks } from '@atomic-editor/editor'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { imageWidgetExtension } from '../../Workspace/imageWidgetExtension'
import { htmlWidgetExtension } from '../../Workspace/htmlWidgetExtension'
import { tables } from '../../Workspace/tableWidgetExtension'
import { mermaidWidgetExtension } from '../../Workspace/mermaidWidgetExtension'
import { codeBlockDecorations } from '../../Workspace/codeBlockHeader'
import '@atomic-editor/editor/styles.css'
import '../../Editor/MarkdownEditor.css'
import '../../Theme/ThemeModal.css'
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts'

const PreviewModal = ({ isOpen, onClose, title, content }) => {
  const [shouldRenderEditor, setShouldRenderEditor] = useState(false)

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
    codeBlockDecorations,
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
  const readingTime = Math.ceil(wordCount / 200) || 1

  const headerStats = (
    <div className="preview-stats-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '16px' }}>
      <div className="preview-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-dim)' }}>
        <Clock size={12}/> {readingTime} min read
      </div>
      <div className="preview-stat-sep" style={{ width: '1px', height: '12px', background: 'var(--border-subtle)' }} />
      <div className="preview-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-dim)' }}>
        <FileText size={12}/> {wordCount} words
      </div>
    </div>
  )

  return createPortal(
    <div className="modal-overlay theme-modal-overlay" onClick={onClose}>
      <div 
        className="modal-container theme-modal-container" 
        onClick={(e) => e.stopPropagation()}
        style={{ width: '90vw', height: '85vh', display: 'flex', flexDirection: 'column', maxWidth: '1000px' }}
      >
        <ModalHeader title={`Preview: ${title}`} right={headerStats} icon={<FileText size={16} />} onClose={onClose} />

        <div className="preview-body seamless-scrollbar markdown-editor mode-source" style={{ overflowY: 'auto', flex: 1, padding: '40px 60px', background: 'var(--bg-app)' }}>
          <div className="editor-canvas-wrap" style={{ height: 'auto', display: 'block' }}>
            {shouldRenderEditor ? (
              <AtomicCodeMirrorEditor
                markdownSource={content || ''}
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
