import React, { useEffect, useRef, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import { Dialog, Button } from '../../ui'
import './css/confirm.css'

export interface ConfirmProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message?: React.ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

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
 */
const Confirm: React.FC<ConfirmProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  danger = true
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)

  const handleConfirm = useCallback(() => {
    onClose?.()
    onConfirm?.()
  }, [onClose, onConfirm])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus()
    }, 10)
    return () => clearTimeout(timer)
  }, [isOpen])

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      onEnter={handleConfirm}
      ariaLabelledBy="confirm-modal-title"
      overlayClassName="confirm-overlay confirm-modal-overlay"
      className={`confirm-modal ${danger ? 'border-danger' : 'border-accent'}`}
    >
      <div className="confirm-header">
        <AlertCircle size={18} className={danger ? 'text-danger' : 'text-accent'} />
        <h2 id="confirm-modal-title" className="confirm-title">{title}</h2>
      </div>
      <p className="confirm-message">{message}</p>

      <div className="confirm-footer">
        <Button className="confirm-cancel" onClick={onClose}>
          {cancelText}
        </Button>
        <Button ref={confirmBtnRef} variant="primary" onClick={handleConfirm}>
          {confirmText}
        </Button>
      </div>
    </Dialog>
  )
}

export default React.memo(Confirm)
