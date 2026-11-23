import React from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Dialog, Button } from '../../ui'
import './css/promptModal.css'

export interface PromptModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onDiscard?: () => void
  title: string
  message: string
  confirmLabel?: string
  discardLabel?: string
  cancelLabel?: string
  type?: 'warning' | 'danger' | 'info'
}

export const PromptModal: React.FC<PromptModalProps> = ({
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
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="prompt-overlay"
      className="prompt-container"
    >
      <header className="pane-header docs-modal-header">
        <div
          className="modal-title-stack docs-header-left"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <AlertTriangle size={15} className={`prompt-icon-${type}`} />
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'var(--text-main)',
              letterSpacing: '-0.01em'
            }}
          >
            {title}
          </span>
        </div>
        <div className="docs-header-right">
          <button
            type="button"
            className="docs-sidebar-toggle-btn guide-close-btn modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="prompt-body">
        <p className="prompt-message">{message}</p>
      </div>

      <footer className="prompt-footer">
        <div className="prompt-actions-secondary">
          <Button onClick={onClose}>{cancelLabel}</Button>
        </div>
        <div className="prompt-actions-primary">
          {onDiscard && (
            <Button variant="danger" onClick={onDiscard}>
              {discardLabel}
            </Button>
          )}
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </footer>
    </Dialog>
  )
}

export default PromptModal
