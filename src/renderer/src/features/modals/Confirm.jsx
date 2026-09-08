import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import './css/confirm.css'

const Confirm = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  danger = true
}) => {
  const confirmBtnRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // Focus confirm button when opened
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus()
    }, 10)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose?.()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onConfirm?.()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [isOpen, onClose, onConfirm])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay confirm-overlay" onClick={onClose}>
      <div
        className={`modal-container confirm-modal ${danger ? 'border-danger' : 'border-accent'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header">
          <AlertCircle size={18} className={danger ? 'text-danger' : 'text-accent'} />
          <h2 className="confirm-title">{title}</h2>
        </div>
        <p className="confirm-message">{message}</p>

        <div className="confirm-footer">
          <button type="button" className="btn confirm-cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onConfirm?.()
              onClose?.()
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

export default Confirm

