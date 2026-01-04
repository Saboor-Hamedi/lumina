import React from 'react'
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
  if (!isOpen) return null

  return (
    <div className="modal-overlay confirm-overlay" onClick={onClose}>
      <div className="modal-container confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-header">
           <AlertCircle size={24} className={danger ? 'text-danger' : 'text-accent'} />
           <button className="confirm-close" onClick={onClose}>
             <X size={18} />
           </button>
        </div>
        
        <div className="confirm-body">
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
    </div>
  )
}

export default ConfirmModal
