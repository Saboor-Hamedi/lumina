import React, { useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import './css/confirm.css'

/**
 * Confirm Modal Component
 *
 * Renders a lightweight confirmation dialog for destructive or critical actions
 * (e.g., deleting notes, bulk operations, or discarding changes).
 *
 * Features immediate visual dismissal on confirm, keyboard shortcuts (Enter to confirm,
 * Esc to cancel), auto-focus on the primary action button, and custom styling (danger or accent).
 *
 * Wrapped in React.memo to prevent unnecessary re-renders when parent components re-render.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the confirmation dialog is currently visible.
 * @param {() => void} props.onClose - Callback triggered when the dialog is dismissed or cancelled.
 * @param {() => void} props.onConfirm - Callback executed when the user confirms the action.
 * @param {string} [props.title='Are you sure?'] - Header title of the confirmation modal.
 * @param {string} [props.message='This action cannot be undone.'] - Detailed confirmation prompt message.
 * @param {string} [props.confirmText='Delete'] - Label text for the confirmation button.
 * @param {string} [props.cancelText='Cancel'] - Label text for the cancel button.
 * @param {boolean} [props.danger=true] - Whether the action is destructive (applies red danger theme).
 * @returns {React.ReactPortal | null}
 */
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
        onClose?.()
        onConfirm?.()
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
              onClose?.()
              onConfirm?.()
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

export default React.memo(Confirm)

