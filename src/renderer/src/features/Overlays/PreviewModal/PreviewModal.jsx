import React, { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FileText } from 'lucide-react'
import ModalHeader from '../ModalHeader'
import { PreviewCommandPalette } from '../PreviewCommandPalette'
import './PreviewModal.css'
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts'
import { useVaultStore } from '../../../core/store/workspaceStore'

const PreviewModal = ({ isOpen, onClose, title, content, snippetId }) => {
  useKeyboardShortcuts({
    onEscape: isOpen
      ? () => {
          onClose()
          return true
        }
      : undefined
  })

  // Live real-time subscription to editor drafts and snippets
  const draft = useVaultStore((state) => (snippetId ? state.drafts?.[snippetId] : undefined))
  const activeSnippet = useVaultStore((state) =>
    snippetId
      ? (Array.isArray(state.snippets) ? state.snippets : Object.values(state.snippets || {})).find(
          (s) => s.id === snippetId
        )
      : null
  )

  const liveContent = useMemo(() => {
    if (activeSnippet?.type === 'image') {
      const relPath =
        activeSnippet.relativePath ||
        (activeSnippet.folderId
          ? `${activeSnippet.folderId}/${activeSnippet.fileName}`
          : activeSnippet.fileName)
      return `![${activeSnippet.title || activeSnippet.fileName}](${relPath})`
    }
    return draft !== undefined
      ? draft
      : activeSnippet?.code !== undefined
        ? activeSnippet.code
        : content || ''
  }, [activeSnippet, draft, content])

  if (!isOpen) return null

  const wordCount = liveContent ? liveContent.split(/\s+/).filter(Boolean).length : 0

  const headerStats = (
    <div className="preview-stats-bar">
      <span className="preview-indicator-tag">PREVIEW</span>
      <div className="preview-stat-sep" />
      <div className="preview-stat-item">
        <FileText size={12} /> {wordCount} words
      </div>
    </div>
  )

  return createPortal(
    <div className="modal-overlay theme-modal-overlay" onClick={onClose}>
      <div
        className="modal-container theme-modal-container preview-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          title={title}
          right={headerStats}
          icon={<FileText size={16} />}
          onClose={onClose}
        />

        <PreviewCommandPalette content={liveContent} onClose={onClose} />
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  )
}

export default PreviewModal
