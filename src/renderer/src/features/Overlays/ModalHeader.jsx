import React from 'react'
import { X } from 'lucide-react'
import './ThemeModal.css'

const ModalHeader = ({ title = null, subtitle = null, icon = null, left = null, right = null, onClose = () => {} }) => {
  return (
    <header className="pane-header modal-header-with-knob">
      <div className="modal-header-knob" aria-hidden="true" />

      <div className="modal-left">
        {left ? (
          left
        ) : (
          (icon || title || subtitle) ? (
            <div className="modal-title-stack">
              {icon ? <span className="theme-modal-icon">{icon}</span> : null}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {title ? (
                  <>
                    <div className="theme-modal-title">{title}</div>
                    <div className="modal-title-knob" aria-hidden="true" />
                  </>
                ) : null}
                {subtitle ? <div className="theme-modal-subtitle">{subtitle}</div> : null}
              </div>
            </div>
          ) : null
        )}
      </div>

      <div className="modal-right">
        {right}
        <button className="modal-close modal-close-top" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
    </header>
  )
}

export default ModalHeader
