import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, X } from 'lucide-react'
import './ConfirmModal.css'

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  danger = true
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
    <div className="modal-overlay confirm-overlay" onClick={onClose}>
      <div className="modal-container confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          {/* <button className="confirm-close" onClick={onClose}>
            <X size={18} />
          </button> */}
        </div>

        <div className="confirm-body">
        <AlertCircle size={24} className={danger ? 'text-danger' : 'text-accent'} />

          <h2 className="confirm-title">{title}</h2>
          <p className="confirm-message">{message}</p>
        </div>

        <div className="confirm-footer">
          <button className="btn confirm-cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
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

export default ConfirmModal
