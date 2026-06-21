import React from 'react'
import { X } from 'lucide-react'
import './ModalHeader.css'

const ModalHeader = ({
  title = null,
  subtitle = null,
  icon = null,
  left = null,
  right = null,
  onClose = () => {},
  onMouseDown = null,
  style = {}
}) => {
  return (
    <header className="pane-header" onMouseDown={onMouseDown} style={style}>

      <div className="modal-left">
        {left ? (
          left
        ) : icon || title || subtitle ? (
          <div className="modal-title-stack">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {title ? (
                <>
                  <div className="theme-modal-title">{title}</div>
                </>
              ) : null}
              {subtitle ? <div className="theme-modal-subtitle">{subtitle}</div> : null}
            </div>
          </div>
        ) : null}
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
