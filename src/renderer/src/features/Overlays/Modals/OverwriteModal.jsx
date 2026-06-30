import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import './ConfirmModal.css'

// OverwriteModal: Used when the user and the agent write to the same file at the same time.
// Added so we don't forget why this specific modal exists!
const OverwriteModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'File Modified Externally',
  message = 'This file was modified externally. Do you want to reload the new version and lose your local edits, or keep your local edits?',
  confirmText = 'Overwrite',
  cancelText = 'Keep My Edits'
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="notification-wrapper">
      <div className="notification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notification-header">
          <AlertTriangle size={18} className="text-accent" />
          <h2 className="notification-title">{title}</h2>
        </div>
        <p className="notification-message">{message}</p>

        <div className="notification-footer">
          <button className="btn confirm-cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onConfirm()
              onClose()
            }}
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
