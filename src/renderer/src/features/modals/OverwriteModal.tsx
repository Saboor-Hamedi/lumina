import React, { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import './css/confirm.css'

export interface OverwriteModalProps {
  /** Whether the modal dialog is currently visible */
  isOpen: boolean
  /** Callback fired when user cancels or dismisses the prompt ("Keep My Edits") */
  onClose: () => void
  /** Callback fired when user confirms overwriting with external changes */
  onConfirm: () => void | Promise<void>
  /** Modal header title */
  title?: string
  /** Explanatory message for conflict */
  message?: string
  /** Label for confirm action button */
  confirmText?: string
  /** Label for cancel action button */
  cancelText?: string
}

export const OverwriteModal: React.FC<OverwriteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'File Modified Externally',
  message = 'This file was modified externally. Do you want to reload the new version and lose your local edits, or keep your local edits?',
  confirmText = 'Overwrite',
  cancelText = 'Keep My Edits'
}) => {
  const handleConfirm = useCallback(() => {
    onConfirm()
    onClose()
  }, [onConfirm, onClose])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, onClose, handleConfirm])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="notification-wrapper"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="overwrite-modal-title"
      aria-describedby="overwrite-modal-message"
      data-testid="overwrite-modal"
    >
      <div className="notification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notification-header">
          <AlertTriangle size={18} className="text-accent" aria-hidden="true" />
          <h2 id="overwrite-modal-title" className="notification-title">
            {title}
          </h2>
        </div>
        <p id="overwrite-modal-message" className="notification-message">
          {message}
        </p>

        <div className="notification-footer">
          <button
            type="button"
            className="btn confirm-cancel"
            onClick={onClose}
            data-testid="overwrite-cancel-btn"
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            data-testid="overwrite-confirm-btn"
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default React.memo(OverwriteModal)
