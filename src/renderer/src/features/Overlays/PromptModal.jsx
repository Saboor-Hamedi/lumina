import React from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import './PromptModal.css'

/**
 * PromptModal Component
 * Standardized premium confirmation dialog.
 * Uses 5px global radius and unified modal system.
 */
const PromptModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  onDiscard, 
  title, 
  message, 
  confirmLabel = 'Save changes', 
  discardLabel = 'Discard',
  cancelLabel = 'Cancel',
  type = 'warning' 
}) => {
  
  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen) {
        onClose()
        return true
      }
      return false
    }
  })

  if (!isOpen) return null

  return (
    <div className="modal-overlay prompt-overlay" onClick={onClose}>
      <div className="modal-container prompt-container" onClick={e => e.stopPropagation()}>
        <header className="pane-header">
          <div className="modal-title-stack">
            <AlertTriangle size={16} className={`prompt-icon-${type}`} />
            <span>{title}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="prompt-body">
          <p className="prompt-message">{message}</p>
        </div>

        <footer className="prompt-footer">
          <div className="prompt-actions-secondary">
             <button className="btn" onClick={onClose}>{cancelLabel}</button>
          </div>
          <div className="prompt-actions-primary">
            {onDiscard && (
              <button className="btn btn-danger" onClick={onDiscard}>
                {discardLabel}
              </button>
            )}
            <button className="btn btn-primary" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default PromptModal
