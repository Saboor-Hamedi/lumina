import React, { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FileText } from 'lucide-react'
import ModalHeader from '../ModalHeader'
import { PreviewCommandPalette } from '../PreviewCommandPalette'
import './PreviewModal.css'
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts'

const PreviewModal = ({ isOpen, onClose, title, content }) => {
  useKeyboardShortcuts({
    onEscape: isOpen
      ? () => {
          onClose()
          return true
        }
      : undefined
  })

  if (!isOpen) return null

  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0

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

        <PreviewCommandPalette content={content} onClose={onClose} />
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  )
}

export default PreviewModal
