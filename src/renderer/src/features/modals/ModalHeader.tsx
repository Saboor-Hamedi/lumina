import React from 'react'
import { X } from 'lucide-react'
import './css/modalHeader.css'

export interface ModalHeaderProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
  onClose?: () => void
  onMouseDown?: (e: React.MouseEvent<HTMLElement>) => void
  onDoubleClick?: (e: React.MouseEvent<HTMLElement>) => void
  style?: React.CSSProperties
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title = null,
  subtitle = null,
  icon = null,
  left = null,
  right = null,
  onClose = () => {},
  onMouseDown,
  onDoubleClick,
  style = {}
}) => {
  return (
    <header
      className="pane-header docs-modal-header"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={style}
    >
      <div className="modal-left docs-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {left}
        {icon || title || subtitle ? (
          <div className="modal-title-stack" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {icon}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {title ? (
                <div
                  className="theme-modal-title"
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 500,
                    color: 'var(--text-main)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {title}
                </div>
              ) : null}
              {subtitle ? (
                <div
                  className="theme-modal-subtitle"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="modal-right docs-header-right" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {right}
        <button
          type="button"
          className="docs-sidebar-toggle-btn guide-close-btn modal-close modal-close-top"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  )
}

export default ModalHeader
